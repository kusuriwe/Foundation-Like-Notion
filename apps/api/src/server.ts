import { Client } from "@notionhq/client"
import { FixtureAdapter } from "./adapters/fixture-adapter.js"
import { NotionAdapter } from "./adapters/notion-adapter.js"
import { buildApp } from "./app.js"
import { loadRuntimeConfig, ReaderConfigSchema, type RuntimeConfig } from "./config.js"
import { resolvePropertyNamesAtStartup } from "./property-name-resolver.js"

const input = await loadRuntimeConfig()
let runtime: RuntimeConfig
let adapter: FixtureAdapter | NotionAdapter
if (input.reader.source === "fixture") {
  runtime = { ...input, reader: ReaderConfigSchema.parse(input.reader) }
  adapter = new FixtureAdapter()
} else {
  const token = input.notionToken as string
  const client = new Client({ auth: token, notionVersion: "2026-03-11", logger: () => undefined })
  const reader = await resolvePropertyNamesAtStartup(input.reader, async (dataSourceId) => {
    const schema = await client.dataSources.retrieve({ data_source_id: dataSourceId })
    return Object.entries(schema.properties).map(([name, property]) => ({
      name,
      id: property.id,
      type: property.type,
    }))
  })
  runtime = { ...input, reader }
  adapter = new NotionAdapter(token, reader, client)
}
const app = await buildApp({ runtime, adapter })

const close = async (): Promise<void> => {
  await app.close()
  process.exit(0)
}

process.once("SIGINT", close)
process.once("SIGTERM", close)

await app.listen({ host: runtime.host, port: runtime.port })
