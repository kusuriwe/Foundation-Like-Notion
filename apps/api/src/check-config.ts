import path from "node:path"
import { Client } from "@notionhq/client"
import {
  checkConfiguration,
  notionSchemaRetriever,
  safeCheckFailure,
  SourceSchemaError,
} from "./config-check.js"
import { loadReaderConfigInput } from "./config.js"

/** Run the setup diagnostic and print only redacted categories and counts. / 初期設定を診断し、安全な分類と件数だけを表示します。 */
async function main(): Promise<void> {
  const configPath = path.resolve(process.env.READER_CONFIG_PATH ?? "config/reader.example.yaml")
  const reader = await loadReaderConfigInput(configPath)
  const token = process.env.NOTION_TOKEN
  const client =
    reader.source === "notion" && token
      ? new Client({ auth: token, notionVersion: "2026-03-11", logger: () => undefined })
      : undefined
  const summary = await checkConfiguration(
    {
      reader,
      passwordHash: process.env.READER_PASSWORD_HASH ?? "",
      ...(token ? { notionToken: token } : {}),
    },
    client
      ? notionSchemaRetriever(client.dataSources)
      : async () => {
          throw new SourceSchemaError()
        },
  )
  process.stdout.write(`${JSON.stringify(summary)}\n`)
}

main().catch((error: unknown) => {
  process.stderr.write(`${JSON.stringify(safeCheckFailure(error))}\n`)
  process.exitCode = 1
})
