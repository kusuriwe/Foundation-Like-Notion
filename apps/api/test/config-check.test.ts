import path from "node:path"
import type { Client } from "@notionhq/client"
import { beforeAll, describe, expect, it, vi } from "vitest"
import {
  checkConfiguration,
  ConfigurationCheckError,
  notionSchemaRetriever,
  safeCheckFailure,
  SourceSchemaError,
} from "../src/config-check.js"
import { loadReaderConfigInput, type ReaderConfigInput } from "../src/config.js"

const hash = "$argon2id$test-hash"
let minimal: ReaderConfigInput

beforeAll(async () => {
  minimal = await loadReaderConfigInput(
    path.resolve(import.meta.dirname, "../../../config/reader.notion.minimal.example.yaml"),
  )
})

describe("setup configuration check", () => {
  it("accepts the minimal Notion example and deduplicates source schema reads", async () => {
    const sourceId = minimal.contentDatabases[0]?.sourceDataSourceId
    if (!sourceId) throw new Error("Example has no content source")
    const reader = { ...minimal, relationSources: [sourceId] }
    const retrieve = vi.fn(async () => [{ name: "Name", id: "title-id", type: "title" }])
    const result = await checkConfiguration(
      { reader, passwordHash: hash, notionToken: "private-token" },
      retrieve,
      async () => false,
    )

    expect(result).toEqual({
      ok: true,
      source: "notion",
      dataSourcesChecked: 1,
      mappingsChecked: 1,
    })
    expect(retrieve).toHaveBeenCalledTimes(1)
    expect(retrieve).toHaveBeenCalledWith(sourceId)
  })

  it("validates fixture settings without Notion access", async () => {
    const reader = await loadReaderConfigInput(
      path.resolve(import.meta.dirname, "../../../config/reader.example.yaml"),
    )
    const retrieve = vi.fn(async () => {
      throw new Error("must not read Notion")
    })
    const result = await checkConfiguration(
      { reader, passwordHash: hash },
      retrieve,
      async () => false,
    )
    expect(result.source).toBe("fixture")
    expect(result.dataSourcesChecked).toBe(0)
    expect(retrieve).not.toHaveBeenCalled()
  })

  it("rejects missing and malformed password hashes before any remote call", async () => {
    const retrieve = vi.fn(async () => [])
    await expect(
      checkConfiguration({ reader: minimal, passwordHash: "", notionToken: "private" }, retrieve),
    ).rejects.toMatchObject({ category: "missing_password_hash" })
    await expect(
      checkConfiguration(
        { reader: minimal, passwordHash: "$argon2id$broken", notionToken: "private" },
        retrieve,
        async () => {
          throw new Error("malformed hash with private detail")
        },
      ),
    ).rejects.toMatchObject({ category: "invalid_password_hash" })
    expect(retrieve).not.toHaveBeenCalled()
  })

  it("rejects missing token, missing Property and incompatible type without exposing values", async () => {
    const retrieve = vi.fn(async () => [{ name: "Other", id: "secret-id", type: "title" }])
    await expect(
      checkConfiguration({ reader: minimal, passwordHash: hash }, retrieve, async () => false),
    ).rejects.toMatchObject({ category: "missing_notion_token" })
    const missing = await checkConfiguration(
      { reader: minimal, passwordHash: hash, notionToken: "private-token" },
      retrieve,
      async () => false,
    ).catch((error: unknown) => error)
    expect(safeCheckFailure(missing)).toEqual({
      ok: false,
      category: "property_no_match",
      path: "contentDatabases[0].titlePropertyName",
    })
    expect(JSON.stringify(safeCheckFailure(missing))).not.toMatch(/private-token|secret-id|Other/)

    retrieve.mockResolvedValueOnce([{ name: "Name", id: "secret-id", type: "number" }])
    await expect(
      checkConfiguration(
        { reader: minimal, passwordHash: hash, notionToken: "private-token" },
        retrieve,
        async () => false,
      ),
    ).rejects.toMatchObject({ category: "property_type_mismatch" })
  })

  it("checks relation-source access and redacts upstream errors", async () => {
    const reader = { ...minimal, relationSources: ["relation-source"] }
    const retrieve = vi.fn(async (id: string) => {
      if (id === "relation-source") throw new SourceSchemaError(404)
      return [{ name: "Name", id: "title-id", type: "title" }]
    })
    const failure = await checkConfiguration(
      { reader, passwordHash: hash, notionToken: "private-token" },
      retrieve,
      async () => false,
    ).catch((error: unknown) => error)
    expect(safeCheckFailure(failure)).toEqual({
      ok: false,
      category: "source_unavailable",
      path: "relationSources[0]",
      status: 404,
    })
    expect(retrieve).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(safeCheckFailure(new Error("private-token secret-id")))).toBe(
      '{"ok":false,"category":"invalid_config"}',
    )
  })

  it("redacts user-defined field keys from diagnostic paths", () => {
    const failure = safeCheckFailure(
      new ConfigurationCheckError(
        "property_no_match",
        "contentDatabases[0].variables.secret-property-name.propertyName",
      ),
    )
    expect(failure.path).toBe("contentDatabases[0].variables")
    expect(JSON.stringify(failure)).not.toContain("secret-property-name")
  })

  it("uses only the SDK schema-retrieve method and hides SDK failures", async () => {
    const retrieve = vi.fn(async () => ({
      properties: { Name: { id: "private-property-id", type: "title" } },
    }))
    const query = vi.fn()
    const update = vi.fn()
    const sdk = { retrieve, query, update } as unknown as Pick<Client["dataSources"], "retrieve">
    const read = notionSchemaRetriever(sdk)

    await expect(read("private-source-id")).resolves.toEqual([
      { name: "Name", id: "private-property-id", type: "title" },
    ])
    expect(retrieve).toHaveBeenCalledTimes(1)
    expect(query).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()

    retrieve.mockRejectedValueOnce(new Error("private-token private-source-id"))
    const failure = await read("private-source-id").catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(SourceSchemaError)
    expect(JSON.stringify(safeCheckFailure(failure))).not.toMatch(/private-token|private-source-id/)
  })
})
