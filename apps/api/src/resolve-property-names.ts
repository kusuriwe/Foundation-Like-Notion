import path from "node:path"
import { Client, isNotionClientError } from "@notionhq/client"
import { resolvePropertyNamesInFile } from "./property-name-resolver.js"

class SafeNotionError extends Error {
  readonly code: string
  readonly status: number | undefined

  constructor(code: string, status?: number) {
    super("Notion schema retrieval failed")
    this.name = "SafeNotionError"
    this.code = code
    this.status = status
  }
}

/** Run the redacted local Property-name resolver. / 秘密値を出さずローカル Property 名 resolver を実行します。 */
async function main(): Promise<void> {
  const token = process.env.NOTION_TOKEN
  if (!token) {
    throw new Error("NOTION_TOKEN is required")
  }
  const repositoryRoot = path.resolve(import.meta.dirname, "../../..")
  const configPath =
    process.env.READER_RESOLVE_CONFIG_PATH ?? path.join(repositoryRoot, ".env/reader.yaml")
  const client = new Client({ auth: token, notionVersion: "2026-03-11", logger: () => {} })
  const summary = await resolvePropertyNamesInFile(configPath, async (dataSourceId) => {
    try {
      const schema = await client.dataSources.retrieve({ data_source_id: dataSourceId })
      return Object.entries(schema.properties).map(([name, property]) => ({
        name,
        id: property.id,
        type: property.type,
      }))
    } catch (error) {
      if (isNotionClientError(error)) {
        const status =
          "status" in error && typeof error.status === "number" ? error.status : undefined
        throw new SafeNotionError(error.code, status)
      }
      throw new SafeNotionError("unknown")
    }
  })
  console.log(JSON.stringify(summary, null, 2))
  if (summary.issues.length > 0) {
    process.exitCode = 2
  }
}

main().catch((error: unknown) => {
  if (error instanceof SafeNotionError) {
    console.error(
      JSON.stringify({
        error: "notion_schema_unavailable",
        code: error.code,
        status: error.status,
      }),
    )
  } else {
    console.error(JSON.stringify({ error: "property_resolution_failed" }))
  }
  process.exitCode = 1
})
