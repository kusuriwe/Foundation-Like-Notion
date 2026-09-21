import { readFile, mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { SearchRequestSchema } from "@foundation-like-notion/contracts"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ContentAdapter, SourcePage, SourceQuery } from "../src/adapters/content-adapter.js"
import { type ContentDatabaseConfig, type ReaderConfig, ReaderConfigSchema } from "../src/config.js"
import { ReaderDatabase } from "../src/database.js"
import { ReaderRequestError, ReaderService } from "../src/reader-service.js"

const filterMappings = {
  title: {
    propertyId: "title-property",
    type: "string",
    sourceType: "title",
    operators: ["equals", "contains", "isEmpty"],
  },
  text: {
    propertyId: "text-property",
    type: "string",
    sourceType: "rich_text",
    operators: ["equals", "contains", "isEmpty"],
  },
  select: {
    propertyId: "select-property",
    type: "string",
    sourceType: "select",
    operators: ["equals", "isEmpty"],
  },
  status: {
    propertyId: "status-property",
    type: "string",
    sourceType: "status",
    operators: ["equals", "isEmpty"],
  },
  tags: {
    propertyId: "tags-property",
    type: "string[]",
    sourceType: "multi_select",
    operators: ["contains", "isEmpty"],
  },
  checked: {
    propertyId: "checked-property",
    type: "boolean",
    sourceType: "checkbox",
    operators: ["equals"],
  },
  amount: {
    propertyId: "amount-property",
    type: "number",
    sourceType: "number",
    operators: ["equals", "greaterThan", "isEmpty"],
  },
  date: {
    propertyId: "date-property",
    type: "date",
    sourceType: "date",
    operators: ["equals", "before", "after", "isEmpty"],
  },
  relation: {
    propertyId: "relation-property",
    type: "reference",
    sourceType: "relation",
    operators: ["equals", "contains", "isEmpty"],
  },
} as const

function readerConfig(overrides: readonly Partial<ContentDatabaseConfig>[] = [{}]): ReaderConfig {
  return ReaderConfigSchema.parse({
    version: 1,
    source: "fixture",
    contentDatabases: overrides.map((override, index) => ({
      id: `database-${index + 1}`,
      name: `Database ${index + 1}`,
      sourceDataSourceId: `source-${index + 1}`,
      titlePropertyId: "title-property",
      defaultTemplate: "simple",
      templates: ["simple"],
      variables: {},
      filters: filterMappings,
      ...override,
    })),
  })
}

function adapterReturning(page: SourcePage) {
  const listArticles = vi.fn(
    async (_database: ContentDatabaseConfig, _query: SourceQuery): Promise<SourcePage> => page,
  )
  const adapter: ContentAdapter = {
    listArticles,
    getArticle: vi.fn(),
    getAsset: vi.fn(),
  }
  return { adapter, listArticles }
}

describe("ReaderService request boundaries", () => {
  const databases: ReaderDatabase[] = []

  afterEach(() => {
    for (const database of databases.splice(0)) database.close()
  })

  async function createDatabase(): Promise<{ database: ReaderDatabase; filePath: string }> {
    const directory = await mkdtemp(path.join(tmpdir(), "notion-reader-service-test-"))
    const filePath = path.join(directory, "reader.sqlite")
    const database = new ReaderDatabase(filePath)
    databases.push(database)
    return { database, filePath }
  }

  it("keeps upstream list cursors out of the browser and SQLite", async () => {
    const { database, filePath } = await createDatabase()
    const { adapter, listArticles } = adapterReturning({
      items: [],
      nextCursor: "private-upstream-cursor",
    })
    const reader = new ReaderService(readerConfig(), database, adapter)

    const first = await reader.listArticles("database-1", undefined, 20)
    expect(first.nextCursor).toMatch(/^cur_[A-Za-z0-9_-]{43}$/)
    expect(first.nextCursor).not.toContain("private-upstream-cursor")

    await reader.listArticles("database-1", first.nextCursor ?? undefined, 20)
    expect(listArticles).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({ cursor: "private-upstream-cursor", pageSize: 20 }),
    )
    expect((await readFile(filePath)).toString("utf8")).not.toContain("private-upstream-cursor")
  })

  it("rejects tampered, context-changed, and cross-endpoint cursors before the adapter", async () => {
    const { database } = await createDatabase()
    const { adapter, listArticles } = adapterReturning({
      items: [],
      nextCursor: "private-upstream-cursor",
    })
    const reader = new ReaderService(readerConfig(), database, adapter)
    const first = await reader.listArticles("database-1", undefined, 20)
    const cursor = first.nextCursor ?? ""
    const tampered = `${cursor.slice(0, -1)}${cursor.endsWith("a") ? "b" : "a"}`

    await expect(reader.listArticles("database-1", tampered, 20)).rejects.toBeInstanceOf(
      ReaderRequestError,
    )
    await expect(reader.listArticles("database-1", cursor, 10)).rejects.toBeInstanceOf(
      ReaderRequestError,
    )
    await expect(
      reader.search(SearchRequestSchema.parse({ filters: [], cursor, pageSize: 20 })),
    ).rejects.toBeInstanceOf(ReaderRequestError)
    expect(listArticles).toHaveBeenCalledTimes(1)
  })

  it("maps every configured source type only after validating its value", async () => {
    const { database } = await createDatabase()
    const relation = database.getOrCreateResource("private-relation-page", "page")
    const { adapter, listArticles } = adapterReturning({ items: [], nextCursor: null })
    const reader = new ReaderService(readerConfig(), database, adapter)

    await reader.search(
      SearchRequestSchema.parse({
        filters: [
          { fieldId: "title", operator: "equals", value: "Title" },
          { fieldId: "text", operator: "contains", value: "Text" },
          { fieldId: "select", operator: "equals", value: "Choice" },
          { fieldId: "status", operator: "equals", value: "Active" },
          { fieldId: "tags", operator: "contains", value: "Tag" },
          { fieldId: "checked", operator: "equals", value: true },
          { fieldId: "amount", operator: "greaterThan", value: 10 },
          { fieldId: "date", operator: "before", value: "2026-09-21" },
          { fieldId: "relation", operator: "equals", value: relation.readerId },
          { fieldId: "amount", operator: "isEmpty" },
        ],
        pageSize: 20,
      }),
    )

    expect(listArticles).toHaveBeenCalledOnce()
    const query = listArticles.mock.calls[0]?.[1]
    expect(query?.filters).toEqual([
      expect.objectContaining({ sourceType: "title", value: "Title" }),
      expect.objectContaining({ sourceType: "rich_text", value: "Text" }),
      expect.objectContaining({ sourceType: "select", value: "Choice" }),
      expect.objectContaining({ sourceType: "status", value: "Active" }),
      expect.objectContaining({ sourceType: "multi_select", value: "Tag" }),
      expect.objectContaining({ sourceType: "checkbox", value: true }),
      expect.objectContaining({ sourceType: "number", value: 10 }),
      expect.objectContaining({ sourceType: "date", value: "2026-09-21" }),
      expect.objectContaining({ sourceType: "relation", value: "private-relation-page" }),
      expect.not.objectContaining({ value: expect.anything() }),
    ])
  })

  it.each([
    ["checked", "not-boolean"],
    ["amount", "10"],
    ["date", "tomorrow"],
    ["title", false],
    ["relation", "unknown-reader-id"],
  ] as const)("rejects an invalid %s value before calling the adapter", async (fieldId, value) => {
    const { database } = await createDatabase()
    const { adapter, listArticles } = adapterReturning({ items: [], nextCursor: null })
    const reader = new ReaderService(readerConfig(), database, adapter)
    const request = SearchRequestSchema.parse({
      filters: [{ fieldId, operator: "equals", value }],
      pageSize: 20,
    })

    await expect(reader.search(request)).rejects.toBeInstanceOf(ReaderRequestError)
    expect(listArticles).not.toHaveBeenCalled()
  })

  it("validates every selected database before the first upstream request", async () => {
    const { database } = await createDatabase()
    const secondFilters = {
      ...filterMappings,
      title: {
        propertyId: "title-property",
        type: "number",
        sourceType: "number",
        operators: ["equals"],
      },
    } as const
    const config = readerConfig([{}, { filters: secondFilters }])
    const { adapter, listArticles } = adapterReturning({ items: [], nextCursor: null })
    const reader = new ReaderService(config, database, adapter)

    await expect(
      reader.search(
        SearchRequestSchema.parse({
          databaseIds: ["database-1", "database-2"],
          filters: [{ fieldId: "title", operator: "equals", value: "text" }],
          pageSize: 20,
        }),
      ),
    ).rejects.toBeInstanceOf(ReaderRequestError)
    expect(listArticles).not.toHaveBeenCalled()
  })

  it("binds search cursors to the original public query context", async () => {
    const { database } = await createDatabase()
    const { adapter, listArticles } = adapterReturning({
      items: [],
      nextCursor: "private-search-cursor",
    })
    const reader = new ReaderService(readerConfig(), database, adapter)
    const first = await reader.search(
      SearchRequestSchema.parse({ query: "first", filters: [], pageSize: 1 }),
    )

    expect(first.nextCursor).toMatch(/^cur_[A-Za-z0-9_-]{43}$/)
    await reader.search(
      SearchRequestSchema.parse({
        query: "first",
        filters: [],
        cursor: first.nextCursor,
        pageSize: 1,
      }),
    )
    expect(listArticles).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({ cursor: "private-search-cursor", pageSize: 1 }),
    )
    await expect(
      reader.search(
        SearchRequestSchema.parse({
          query: "changed",
          filters: [],
          cursor: first.nextCursor,
          pageSize: 1,
        }),
      ),
    ).rejects.toBeInstanceOf(ReaderRequestError)
    expect(listArticles).toHaveBeenCalledTimes(2)
  })
})
