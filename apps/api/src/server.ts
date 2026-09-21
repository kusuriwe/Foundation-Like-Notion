import { FixtureAdapter } from "./adapters/fixture-adapter.js"
import { NotionAdapter } from "./adapters/notion-adapter.js"
import { buildApp } from "./app.js"
import { loadRuntimeConfig } from "./config.js"

const runtime = await loadRuntimeConfig()
const adapter =
  runtime.reader.source === "fixture"
    ? new FixtureAdapter()
    : new NotionAdapter(runtime.notionToken as string, runtime.reader)
const app = await buildApp({ runtime, adapter })

const close = async (): Promise<void> => {
  await app.close()
  process.exit(0)
}

process.once("SIGINT", close)
process.once("SIGTERM", close)

await app.listen({ host: runtime.host, port: runtime.port })
