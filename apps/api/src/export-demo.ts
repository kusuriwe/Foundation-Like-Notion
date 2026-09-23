import path from "node:path"
import { fileURLToPath } from "node:url"
import { Client } from "@notionhq/client"
import { NotionAdapter } from "./adapters/notion-adapter.js"
import { loadReaderConfigInput, type ReaderConfig, type ReaderConfigInput } from "./config.js"
import {
  applyDemoCandidate,
  createDemoAssetWriter,
  resetCandidate,
  validateDemoCandidatePrivacy,
  writeDemoCandidate,
} from "./demo-export-files.js"
import { DemoExportError, demoExportFailure, exportDemoDataset } from "./demo-exporter.js"
import { ReaderDatabase } from "./database.js"
import { resolvePropertyNamesAtStartup } from "./property-name-resolver.js"
import { ReaderService } from "./reader-service.js"
import { TrackingContentAdapter } from "./tracking-content-adapter.js"

function configIdentifiers(input: ReaderConfigInput, resolved: ReaderConfig): readonly string[] {
  const values = new Set<string>()
  const add = (value: string | undefined) => {
    if (value) values.add(value)
  }
  for (const source of input.relationSources) add(source)
  for (const database of input.contentDatabases) {
    add(database.sourceDataSourceId)
    add(database.titlePropertyId)
    for (const mapping of Object.values(database.variables)) add(mapping.propertyId)
    for (const mapping of Object.values(database.filters)) add(mapping.propertyId)
  }
  for (const database of resolved.contentDatabases) {
    add(database.sourceDataSourceId)
    add(database.titlePropertyId)
    for (const mapping of Object.values(database.variables)) add(mapping.propertyId)
    for (const mapping of Object.values(database.filters)) add(mapping.propertyId)
  }
  return [...values]
}

function parseArguments(): Readonly<{ apply: boolean }> {
  const arguments_ = process.argv.slice(2)
  if (arguments_.some((argument) => argument !== "--apply")) {
    throw new DemoExportError("invalid_arguments")
  }
  return { apply: arguments_.includes("--apply") }
}

/**
 * Export the ignored local Notion configuration without starting the API server.
 * API serverを起動せず、ignoredのlocal Notion設定を静的demoへ書き出します。
 */
async function main(): Promise<void> {
  const options = parseArguments()
  const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url))
  const configPath = path.resolve(process.env.READER_CONFIG_PATH ?? ".env/reader.yaml")
  const input = await loadReaderConfigInput(configPath)
  if (input.source !== "notion") throw new DemoExportError("notion_source_required")
  const token = process.env.NOTION_TOKEN
  if (!token) throw new DemoExportError("missing_notion_token")

  const client = new Client({ auth: token, notionVersion: "2026-03-11", logger: () => undefined })
  const resolved = await resolvePropertyNamesAtStartup(input, async (dataSourceId) => {
    const schema = await client.dataSources.retrieve({ data_source_id: dataSourceId })
    return Object.entries(schema.properties).map(([name, property]) => ({
      name,
      id: property.id,
      type: property.type,
    }))
  })

  const exportRoot = path.join(repositoryRoot, ".data", "demo-export")
  const candidateRoot = path.join(exportRoot, "candidate")
  const candidatePublishedRoot = path.join(candidateRoot, "published")
  await resetCandidate(candidateRoot, repositoryRoot)

  const database = new ReaderDatabase(path.join(exportRoot, "reader.sqlite"))
  try {
    const adapter = new TrackingContentAdapter(new NotionAdapter(token, resolved, client))
    const reader = new ReaderService(resolved, database, adapter)
    const initialPrivateValues = [
      token,
      process.env.READER_PASSWORD_HASH ?? "",
      ...configIdentifiers(input, resolved),
    ]
    const { dataset, assetBytes } = await exportDemoDataset(
      resolved,
      reader,
      createDemoAssetWriter(candidatePublishedRoot, initialPrivateValues),
    )
    const privateValues = [...initialPrivateValues, ...adapter.identifiers()]
    await writeDemoCandidate(candidatePublishedRoot, dataset, privateValues)
    await validateDemoCandidatePrivacy(candidatePublishedRoot, privateValues)
    if (options.apply) {
      await applyDemoCandidate(repositoryRoot, candidatePublishedRoot)
      await validateDemoCandidatePrivacy(
        path.join(repositoryRoot, "demo", "published"),
        privateValues,
      )
    }
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        applied: options.apply,
        databases: dataset.databases.length,
        articles: dataset.articles.length,
        assets: Object.keys(dataset.assets).length,
        assetBytes,
      })}\n`,
    )
  } finally {
    database.close()
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${JSON.stringify(demoExportFailure(error))}\n`)
  process.exitCode = 1
})
