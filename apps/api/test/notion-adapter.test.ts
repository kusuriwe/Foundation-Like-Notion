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

  it("maps a relation target custom emoji through the authenticated asset proxy", async () => {
    const article = page("page-one")
    article.properties.Category.relation = [{ id: "class-page" }]
    const classPage = page("class-page", "allowed-relations")
    classPage.icon = {
      type: "custom_emoji",
      custom_emoji: {
        id: "private-custom-emoji",
        name: "class-icon",
        url: "https://example.test/class.png",
      },
    } as never
    const retrievePage = vi.fn(async ({ page_id }: { page_id: string }) =>
      page_id === "page-one" ? article : classPage,
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

    const result = await adapter.getArticle(database, "page-one")
    expect(result?.properties["relation-id"]).toEqual(
      expect.objectContaining({
        value: expect.objectContaining({
          icon: { kind: "asset", sourceAssetId: "page-icon:class-page" },
        }),
      }),
    )
    await expect(adapter.getAsset("page-icon:class-page")).resolves.toEqual({
      url: "https://example.test/class.png",
      kind: "image",
    })
  })

  it("maps a native Notion article icon through the authenticated asset proxy", async () => {
    const article = page("page-one")
    article.icon = {
      type: "icon",
      icon: { name: "book open", color: "blue" },
    } as never
    const retrievePage = vi.fn().mockResolvedValue(article)
    const client = {
      dataSources: { query: vi.fn() },
      pages: { retrieve: retrievePage },
      blocks: {
        children: { list: vi.fn().mockResolvedValue({ results: [], next_cursor: null }) },
        retrieve: vi.fn(),
      },
    } as unknown as Client
    const adapter = new NotionAdapter("unused-test-token", config, client)

    const result = await adapter.getArticle(database, "page-one")

    expect(result?.icon).toEqual({ kind: "asset", sourceAssetId: "page-icon:page-one" })
    expect(JSON.stringify(result)).not.toContain("book open")
    await expect(adapter.getAsset("page-icon:page-one")).resolves.toEqual({
      url: "https://www.notion.so/icons/book_open_blue.svg?mode=light",
      kind: "image",
      fetchProfile: "notion-icon",
    })
  })

  it("rejects malformed native Notion icon metadata", async () => {
    const article = page("page-one")
    article.icon = {
      type: "icon",
      icon: { name: "../../private", color: "blue" },
    } as never
    const client = {
      dataSources: { query: vi.fn() },
      pages: { retrieve: vi.fn().mockResolvedValue(article) },
      blocks: {
        children: { list: vi.fn().mockResolvedValue({ results: [], next_cursor: null }) },
        retrieve: vi.fn(),
      },
    } as unknown as Client
    const adapter = new NotionAdapter("unused-test-token", config, client)

    const result = await adapter.getArticle(database, "page-one")

    expect(result?.icon).toBeUndefined()
    await expect(adapter.getAsset("page-icon:page-one")).resolves.toBeUndefined()
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
      { type: "equation", expression: "E=mc^2", text: "E=mc^2" },
    ])
    expect(result?.blocks[0]).toEqual({
      type: "paragraph",
      content: [
        { text: "Value: ", href: null, annotations: expect.any(Object) },
        { type: "equation", expression: "x^2", text: "x^2" },
      ],
    })
  })

  it("preserves callout children, colors, and proxied custom or file icons", async () => {
    const listChildren = vi.fn(async ({ block_id }: { block_id: string }) => {
      const results =
        block_id === "page-one"
          ? [
              {
                id: "callout-one",
                type: "callout",
                has_children: true,
                callout: {
                  rich_text: [{ plain_text: "Important", href: null, annotations: {} }],
                  color: "blue_background",
                  icon: {
                    type: "custom_emoji",
                    custom_emoji: { id: "private-emoji", url: "https://example.test/icon.png" },
                  },
                },
              },
              {
                id: "callout-two",
                type: "callout",
                has_children: false,
                callout: {
                  rich_text: [{ plain_text: "Uploaded icon", href: null, annotations: {} }],
                  color: "yellow",
                  icon: {
                    type: "file",
                    file: { url: "https://example.test/uploaded.png" },
                  },
                },
              },
            ]
          : block_id === "callout-one"
            ? [
                {
                  id: "nested-paragraph",
                  type: "paragraph",
                  paragraph: {
                    rich_text: [{ plain_text: "Nested", href: null, annotations: {} }],
                  },
                },
              ]
            : []
      return { results, next_cursor: null }
    })
    const client = {
      dataSources: { query: vi.fn() },
      databases: { retrieve: vi.fn() },
      pages: { retrieve: vi.fn().mockResolvedValue(page("page-one")) },
      blocks: {
        children: { list: listChildren },
        retrieve: vi.fn(async ({ block_id }: { block_id: string }) =>
          block_id === "callout-one"
            ? {
                id: block_id,
                type: "callout",
                callout: {
                  icon: {
                    type: "custom_emoji",
                    custom_emoji: { url: "https://example.test/icon.png" },
                  },
                },
              }
            : {
                id: block_id,
                type: "callout",
                callout: {
                  icon: {
                    type: "file",
                    file: { url: "https://example.test/uploaded.png" },
                  },
                },
              },
        ),
      },
    } as unknown as Client
    const adapter = new NotionAdapter("unused-test-token", config, client)

    const result = await adapter.getArticle(database, "page-one")

    expect(result?.blocks[0]).toEqual(
      expect.objectContaining({
        type: "callout",
        color: "blue_background",
        icon: { kind: "asset", sourceAssetId: "block-icon:callout-one" },
        children: [expect.objectContaining({ type: "paragraph" })],
      }),
    )
    await expect(adapter.getAsset("block-icon:callout-one")).resolves.toEqual({
      url: "https://example.test/icon.png",
      kind: "image",
    })
    expect(result?.blocks[1]).toEqual(
      expect.objectContaining({
        type: "callout",
        color: "yellow",
        icon: { kind: "asset", sourceAssetId: "block-icon:callout-two" },
      }),
    )
    await expect(adapter.getAsset("block-icon:callout-two")).resolves.toEqual({
      url: "https://example.test/uploaded.png",
      kind: "image",
    })
  })

  it("fails the whole article when callout nesting exceeds the configured depth", async () => {
    const listChildren = vi.fn(async ({ block_id }: { block_id: string }) => {
      const level = block_id === "page-one" ? 0 : Number(block_id.split("-")[1]) + 1
      return {
        results: [
          {
            id: `deep-${level}`,
            type: "callout",
            has_children: true,
            callout: {
              rich_text: [{ plain_text: `Level ${level}`, href: null, annotations: {} }],
              color: "default",
              icon: { type: "emoji", emoji: "!" },
            },
          },
        ],
        next_cursor: null,
      }
    })
    const client = {
      dataSources: { query: vi.fn() },
      pages: { retrieve: vi.fn().mockResolvedValue(page("page-one")) },
      blocks: { children: { list: listChildren }, retrieve: vi.fn() },
    } as unknown as Client
    const adapter = new NotionAdapter("unused-test-token", config, client)

    await expect(adapter.getArticle(database, "page-one")).rejects.toEqual(
      expect.objectContaining({ category: "unavailable" }),
    )
    expect(listChildren).toHaveBeenCalledTimes(6)
  })

  it("fails the whole article instead of truncating more than 500 blocks", async () => {
    const blocks = Array.from({ length: 501 }, (_, index) => ({
      id: `paragraph-${index}`,
      type: "paragraph",
      paragraph: { rich_text: [{ plain_text: String(index), href: null, annotations: {} }] },
    }))
    const client = {
      dataSources: { query: vi.fn() },
      pages: { retrieve: vi.fn().mockResolvedValue(page("page-one")) },
      blocks: {
        children: { list: vi.fn().mockResolvedValue({ results: blocks, next_cursor: null }) },
        retrieve: vi.fn(),
      },
    } as unknown as Client
    const adapter = new NotionAdapter("unused-test-token", config, client)

    await expect(adapter.getArticle(database, "page-one")).rejects.toEqual(
      expect.objectContaining({ category: "unavailable" }),
    )
  })

  it("renders every child-database property as a safe string table and paginates rows", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        results: [
          {
            object: "page",
            properties: {
              Name: {
                id: "title-property",
                type: "title",
                title: [{ plain_text: "Trial", href: null, annotations: {} }],
              },
              Result: { id: "result-property", type: "number", number: 42 },
              Relation: {
                id: "relation-property",
                type: "relation",
                relation: [{ id: "private-related-id" }],
              },
            },
          },
        ],
        next_cursor: "private-table-cursor",
      })
      .mockResolvedValueOnce({ results: [], next_cursor: null })
    const client = {
      dataSources: {
        retrieve: vi.fn(async ({ data_source_id }: { data_source_id: string }) => {
          if (data_source_id === "private-denied-source") throw new Error("not shared")
          return {
            properties: {
              Result: { id: "result-property", type: "number" },
              Name: { id: "title-property", type: "title" },
              Relation: { id: "relation-property", type: "relation" },
            },
          }
        }),
        query,
      },
      databases: {
        retrieve: vi.fn().mockResolvedValue({
          data_sources: [
            { id: "private-child-source", name: "Measurements" },
            { id: "private-denied-source", name: "Restricted rows" },
          ],
        }),
      },
      pages: { retrieve: vi.fn().mockResolvedValue(page("page-one")) },
      blocks: {
        children: {
          list: vi.fn().mockResolvedValue({
            results: [
              {
                id: "private-child-database",
                type: "child_database",
                child_database: { title: "Notebook" },
              },
            ],
            next_cursor: null,
          }),
        },
        retrieve: vi.fn(),
      },
    } as unknown as Client
    const adapter = new NotionAdapter("unused-test-token", config, client)

    const article = await adapter.getArticle(database, "page-one")
    expect(article?.blocks[0]).toEqual({
      type: "embeddedDatabase",
      title: "Notebook",
      tables: [
        expect.objectContaining({
          status: "available",
          sourceTableId: "private-child-source",
          columns: [
            { sourcePropertyId: "title-property", label: "Name" },
            { sourcePropertyId: "relation-property", label: "Relation" },
            { sourcePropertyId: "result-property", label: "Result" },
          ],
          rows: [["Trial", "1 reference", "42"]],
          nextCursor: "private-table-cursor",
        }),
        { status: "unavailable", title: "Restricted rows" },
      ],
    })

    await adapter.getEmbeddedTablePage(
      "private-child-source",
      [
        { sourcePropertyId: "title-property", label: "Name" },
        { sourcePropertyId: "result-property", label: "Result" },
      ],
      "private-table-cursor",
      50,
    )
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data_source_id: "private-child-source",
        start_cursor: "private-table-cursor",
        page_size: 50,
      }),
    )
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
