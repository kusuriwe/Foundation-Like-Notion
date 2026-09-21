import { APIErrorCode, APIResponseError, type Client, RequestTimeoutError } from "@notionhq/client"
import { describe, expect, it, vi } from "vitest"
import type { ContentAdapterError, SourceFilter } from "../src/adapters/content-adapter.js"
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

  it("converts every validated source filter type to the Notion query shape", async () => {
    const query = vi.fn().mockResolvedValue({ results: [], next_cursor: null })
    const client = {
      dataSources: { query },
      pages: { retrieve: vi.fn() },
      blocks: { children: { list: vi.fn() }, retrieve: vi.fn() },
    } as unknown as Client
    const adapter = new NotionAdapter("unused-test-token", config, client)
    const filters: SourceFilter[] = [
      {
        propertyId: "title",
        type: "string",
        sourceType: "title",
        operator: "contains",
        value: "Title",
      },
      {
        propertyId: "text",
        type: "string",
        sourceType: "rich_text",
        operator: "equals",
        value: "Text",
      },
      {
        propertyId: "select",
        type: "string",
        sourceType: "select",
        operator: "equals",
        value: "Choice",
      },
      {
        propertyId: "status",
        type: "string",
        sourceType: "status",
        operator: "equals",
        value: "Active",
      },
      {
        propertyId: "tags",
        type: "string[]",
        sourceType: "multi_select",
        operator: "contains",
        value: "Tag",
      },
      {
        propertyId: "checked",
        type: "boolean",
        sourceType: "checkbox",
        operator: "equals",
        value: true,
      },
      {
        propertyId: "amount",
        type: "number",
        sourceType: "number",
        operator: "greaterThan",
        value: 10,
      },
      {
        propertyId: "date",
        type: "date",
        sourceType: "date",
        operator: "before",
        value: "2026-09-21",
      },
      {
        propertyId: "relation",
        type: "reference",
        sourceType: "relation",
        operator: "equals",
        value: "private-relation-id",
      },
      {
        propertyId: "empty",
        type: "number",
        sourceType: "number",
        operator: "isEmpty",
      },
    ]

    await adapter.listArticles(database, { filters, pageSize: 20 })

    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: {
          and: [
            { property: "title", title: { contains: "Title" } },
            { property: "text", rich_text: { equals: "Text" } },
            { property: "select", select: { equals: "Choice" } },
            { property: "status", status: { equals: "Active" } },
            { property: "tags", multi_select: { contains: "Tag" } },
            { property: "checked", checkbox: { equals: true } },
            { property: "amount", number: { greater_than: 10 } },
            { property: "date", date: { before: "2026-09-21" } },
            { property: "relation", relation: { contains: "private-relation-id" } },
            { property: "empty", number: { is_empty: true } },
          ],
        },
      }),
    )
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

  it("preserves inline equations in article titles and body rich text", async () => {
    const article = page("page-one")
    article.properties.Name.title = [
      { plain_text: "Energy ", href: null, annotations: {} },
      {
        type: "equation",
        equation: { expression: "E=mc^2" },
        plain_text: "E=mc^2",
        href: null,
        annotations: {},
      },
    ] as never
    const client = {
      dataSources: { query: vi.fn() },
      pages: { retrieve: vi.fn().mockResolvedValue(article) },
      blocks: {
        children: {
          list: vi.fn().mockResolvedValue({
            results: [
              {
                id: "paragraph-one",
                type: "paragraph",
                paragraph: {
                  rich_text: [
                    { plain_text: "Value: ", href: null, annotations: {} },
                    {
                      type: "equation",
                      equation: { expression: "x^2" },
                      plain_text: "x^2",
                      href: null,
                      annotations: {},
                    },
                  ],
                },
              },
            ],
            next_cursor: null,
          }),
        },
        retrieve: vi.fn(),
      },
    } as unknown as Client
    const adapter = new NotionAdapter("unused-test-token", config, client)

    const result = await adapter.getArticle(database, "page-one")

    expect(result?.title).toBe("Energy E=mc^2")
    expect(result?.titleRichText).toEqual([
      { text: "Energy ", href: null, annotations: expect.any(Object) },
      { type: "equation", expression: "E=mc^2" },
    ])
    expect(result?.blocks[0]).toEqual({
      type: "paragraph",
      content: [
        { text: "Value: ", href: null, annotations: expect.any(Object) },
        { type: "equation", expression: "x^2" },
      ],
    })
  })

  it("maps unexpected upstream failures to the safe unavailable category", async () => {
    const client = {
      dataSources: { query: vi.fn().mockRejectedValue(new Error("rate limited")) },
      pages: { retrieve: vi.fn() },
      blocks: { children: { list: vi.fn() }, retrieve: vi.fn() },
    } as unknown as Client
    const adapter = new NotionAdapter("unused-test-token", config, client)
    await expect(adapter.listArticles(database, { pageSize: 20 })).rejects.toEqual(
      expect.objectContaining<Partial<ContentAdapterError>>({ category: "unavailable" }),
    )
  })

  it("suppresses SDK logging when a real client receives a private upstream error", async () => {
    const consoleSpies = (["debug", "info", "log", "warn", "error"] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => undefined),
    )
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            object: "error",
            status: 404,
            code: "object_not_found",
            message: "private upstream detail with notion-object-id",
            request_id: "private-notion-request-id",
          }),
          { status: 404, headers: { "content-type": "application/json" } },
        ),
    )
    vi.stubGlobal("fetch", fetchMock)

    try {
      const adapter = new NotionAdapter("unused-test-token", config)
      await expect(adapter.listArticles(database, { pageSize: 20 })).rejects.toEqual(
        expect.objectContaining<Partial<ContentAdapterError>>({ category: "not_found" }),
      )
      expect(fetchMock).toHaveBeenCalledOnce()
      for (const spy of consoleSpies) expect(spy).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
      for (const spy of consoleSpies) spy.mockRestore()
    }
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
