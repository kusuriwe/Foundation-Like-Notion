import { APIErrorCode, APIResponseError, type Client, RequestTimeoutError } from "@notionhq/client"
import { describe, expect, it, vi } from "vitest"
import type { ContentAdapterError } from "../src/adapters/content-adapter.js"
import { NotionAdapter } from "../src/adapters/notion-adapter.js"
import { type ContentDatabaseConfig, ReaderConfigSchema } from "../src/config.js"

const database: ContentDatabaseConfig = {
  id: "notion-database",
  name: "Notion database",
  sourceDataSourceId: "allowed-source",
  titlePropertyId: "title-id",
  defaultTemplate: "simple",
  templates: ["simple"],
  sort: [{ field: "created_time", direction: "ascending" }],
  variables: {
    title: { propertyId: "title-id", type: "string", required: true },
    category: { propertyId: "relation-id", type: "reference", required: false },
  },
  filters: {},
}

const config = ReaderConfigSchema.parse({
  version: 1,
  source: "notion",
  contentDatabases: [database],
  relationSources: ["allowed-relations"],
})

function page(id: string, parent = "allowed-source") {
  return {
    object: "page",
    id,
    parent: { type: "data_source_id", data_source_id: parent },
    created_time: "2026-01-01T00:00:00.000Z",
    last_edited_time: "2026-01-02T00:00:00.000Z",
    icon: { type: "emoji", emoji: "📄" },
    properties: {
      Name: {
        id: "title-id",
        type: "title",
        title: [{ plain_text: "Allowed article", href: null, annotations: {} }],
      },
      Category: {
        id: "relation-id",
        type: "relation",
        relation: [{ id: "outside-page" }],
      },
    },
  }
}

function apiError(code: APIErrorCode, status: number): APIResponseError {
  return new APIResponseError({
    code,
    status,
    message: "private upstream detail",
    headers: new Headers(),
    rawBodyText: "{}",
    additional_data: undefined,
    request_id: "notion-request-id",
  })
}

describe("NotionAdapter", () => {
  it("queries only the configured data source and preserves pagination", async () => {
    const query = vi.fn().mockResolvedValue({
      results: [page("page-one")],
      next_cursor: "next-notion-cursor",
    })
    const client = {
      dataSources: { query },
      pages: { retrieve: vi.fn() },
      blocks: { children: { list: vi.fn() }, retrieve: vi.fn() },
    } as unknown as Client
    const adapter = new NotionAdapter("unused-test-token", config, client)

    const result = await adapter.listArticles(database, { pageSize: 20 })
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ data_source_id: "allowed-source", page_size: 20 }),
    )
    expect(result.nextCursor).toBe("next-notion-cursor")
    expect(result.items[0]?.sourceId).toBe("page-one")
  })

  it("omits relation values whose parent is outside the allowlist", async () => {
    const retrievePage = vi.fn(async ({ page_id }: { page_id: string }) =>
      page_id === "outside-page" ? page(page_id, "outside-source") : page(page_id),
    )
    const client = {
      dataSources: { query: vi.fn() },
      pages: { retrieve: retrievePage },
      blocks: {
        children: {
          list: vi.fn().mockResolvedValue({ results: [], next_cursor: null }),
        },
        retrieve: vi.fn(),
      },
    } as unknown as Client
    const adapter = new NotionAdapter("unused-test-token", config, client)

    const result = await adapter.getArticle(database, "page-one")
    expect(result?.properties["title-id"]).toEqual({ type: "string", value: "Allowed article" })
    expect(result?.properties["relation-id"]).toBeUndefined()
  })

  it("deduplicates repeated relation lookups within one article", async () => {
    const article = page("page-one")
    article.properties.RelatedAgain = {
      id: "relation-id-two",
      type: "relation",
      relation: [{ id: "shared-relation-page" }],
    }
    article.properties.Category.relation = [{ id: "shared-relation-page" }]
    const relationDatabase: ContentDatabaseConfig = {
      ...database,
      variables: {
        ...database.variables,
        categoryTwo: { propertyId: "relation-id-two", type: "reference", required: false },
      },
    }
    const retrievePage = vi.fn(async ({ page_id }: { page_id: string }) =>
      page_id === "page-one" ? article : page(page_id, "allowed-relations"),
    )
    const client = {
      dataSources: { query: vi.fn() },
      pages: { retrieve: retrievePage },
      blocks: {
        children: { list: vi.fn().mockResolvedValue({ results: [], next_cursor: null }) },
        retrieve: vi.fn(),
      },
    } as unknown as Client
    const adapter = new NotionAdapter("unused-test-token", config, client)

    const result = await adapter.getArticle(relationDatabase, "page-one")

    expect(result?.properties["relation-id"]).toEqual(result?.properties["relation-id-two"])
    expect(retrievePage).toHaveBeenCalledTimes(2)
  })

  it("reads every page of article blocks", async () => {
    const listChildren = vi
      .fn()
      .mockResolvedValueOnce({
        results: [{ id: "block-one", type: "paragraph", paragraph: { rich_text: [] } }],
        next_cursor: "next-block-cursor",
      })
      .mockResolvedValueOnce({
        results: [{ id: "block-two", type: "paragraph", paragraph: { rich_text: [] } }],
        next_cursor: null,
      })
    const client = {
      dataSources: { query: vi.fn() },
      pages: { retrieve: vi.fn().mockResolvedValue(page("page-one")) },
      blocks: { children: { list: listChildren }, retrieve: vi.fn() },
    } as unknown as Client
    const adapter = new NotionAdapter("unused-test-token", config, client)

    const result = await adapter.getArticle(database, "page-one")

    expect(result?.blocks).toHaveLength(2)
    expect(listChildren).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ start_cursor: "next-block-cursor" }),
    )
  })

  it("surfaces upstream failures for the API error boundary", async () => {
    const client = {
      dataSources: { query: vi.fn().mockRejectedValue(new Error("rate limited")) },
      pages: { retrieve: vi.fn() },
      blocks: { children: { list: vi.fn() }, retrieve: vi.fn() },
    } as unknown as Client
    const adapter = new NotionAdapter("unused-test-token", config, client)
    await expect(adapter.listArticles(database, { pageSize: 20 })).rejects.toThrow("rate limited")
  })

  it.each([
    [apiError(APIErrorCode.ObjectNotFound, 404), "not_found"],
    [apiError(APIErrorCode.RateLimited, 429), "rate_limited"],
    [new RequestTimeoutError(), "timeout"],
  ] as const)("maps Notion errors to a public-safe category", async (error, category) => {
    const client = {
      dataSources: { query: vi.fn().mockRejectedValue(error) },
      pages: { retrieve: vi.fn() },
      blocks: { children: { list: vi.fn() }, retrieve: vi.fn() },
    } as unknown as Client
    const adapter = new NotionAdapter("unused-test-token", config, client)

    await expect(adapter.listArticles(database, { pageSize: 20 })).rejects.toEqual(
      expect.objectContaining<Partial<ContentAdapterError>>({ category }),
    )
  })
})
