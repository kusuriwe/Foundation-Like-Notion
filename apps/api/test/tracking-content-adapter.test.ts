import { describe, expect, it, vi } from "vitest"
import type { ContentAdapter } from "../src/adapters/content-adapter.js"
import { ReaderConfigSchema } from "../src/config.js"
import { TrackingContentAdapter } from "../src/tracking-content-adapter.js"

const database = ReaderConfigSchema.parse({
  version: 1,
  source: "notion",
  contentDatabases: [
    {
      id: "reader-database",
      name: "Reader",
      sourceDataSourceId: "source-database",
      titlePropertyId: "title-property",
      defaultTemplate: "simple",
      templates: ["simple"],
      variables: {},
      filters: {},
    },
  ],
}).contentDatabases[0]

if (!database) throw new Error("Missing test database")

describe("TrackingContentAdapter", () => {
  it("records nested backend identifiers without changing adapter results", async () => {
    const article = {
      sourceId: "source-page",
      sourceDataSourceId: "source-database",
      title: "Public",
      titleRichText: [{ text: "Public" }],
      createdTime: "2026-09-23T00:00:00.000Z",
      lastEditedTime: "2026-09-23T00:00:00.000Z",
      properties: {
        relation: {
          type: "reference" as const,
          value: {
            sourceId: "relation-page",
            sourceDataSourceId: "relation-source",
            title: "Relation",
            icon: { kind: "asset" as const, sourceAssetId: "page-icon:relation-page" },
          },
        },
      },
      blocks: [
        { type: "image" as const, sourceAssetId: "block:image-block", caption: [] },
        {
          type: "embeddedDatabase" as const,
          title: "Table",
          tables: [
            {
              status: "available" as const,
              sourceTableId: "child-source",
              title: "Rows",
              columns: [{ sourcePropertyId: "child-property", label: "Name" }],
              rows: [],
              nextCursor: null,
            },
          ],
        },
      ],
    }
    const delegate: ContentAdapter = {
      listArticles: vi.fn().mockResolvedValue({ items: [article], nextCursor: null }),
      getArticle: vi.fn().mockResolvedValue(article),
      getEmbeddedTablePage: vi.fn().mockResolvedValue({ rows: [], nextCursor: null }),
      getAsset: vi.fn().mockResolvedValue({ url: "https://example.invalid/image", kind: "image" }),
    }
    const tracking = new TrackingContentAdapter(delegate)

    await tracking.listArticles(database, { pageSize: 20 })
    await tracking.getArticle(database, "source-page")
    await tracking.getEmbeddedTablePage(
      "child-source",
      [{ sourcePropertyId: "child-property", label: "Name" }],
      undefined,
      50,
    )
    await tracking.getAsset("block:image-block")

    expect(tracking.identifiers()).toEqual(
      expect.arrayContaining([
        "source-page",
        "source-database",
        "relation-page",
        "relation-source",
        "page-icon:relation-page",
        "image-block",
        "child-source",
        "child-property",
      ]),
    )
  })
})
