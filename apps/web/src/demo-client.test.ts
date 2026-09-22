import { DemoDatasetSchema } from "@foundation-like-notion/contracts"
import { describe, expect, it } from "vitest"
import { createStaticDemoClient } from "./demo-client.js"

const dataset = DemoDatasetSchema.parse({
  presentation: {},
  databases: [
    {
      id: "demo_database",
      name: "Demo",
      defaultTemplate: "simple",
      templates: ["simple"],
    },
  ],
  articles: [
    {
      id: "demo_article",
      databaseId: "demo_database",
      title: "Public chemistry note",
      titleRichText: [{ text: "Public chemistry note" }],
      createdTime: "2026-01-01T00:00:00.000+00:00",
      lastEditedTime: "2026-01-01T00:00:00.000+00:00",
      variables: { tags: { type: "string[]", value: ["chemistry", "demo"] } },
      blocks: [{ type: "image", assetId: "demo_asset", caption: [] }],
      defaultTemplate: "simple",
      templates: ["simple"],
    },
  ],
  assets: { demo_asset: "demo/image.svg" },
})

describe("StaticDemoReaderClient", () => {
  it("reads, searches, and resolves assets without an HTTP API", async () => {
    const client = createStaticDemoClient(dataset, "/Foundation-Like-Notion/")
    await expect(client.getSession()).resolves.toBe(true)
    await expect(client.getDatabases()).resolves.toHaveLength(1)
    await expect(
      client.searchArticles({
        query: "chemistry",
        filters: [{ fieldId: "tags", operator: "contains", value: "demo" }],
        pageSize: 20,
      }),
    ).resolves.toEqual(
      expect.objectContaining({ items: [expect.objectContaining({ id: "demo_article" })] }),
    )
    expect(client.assetUrl("demo_asset")).toBe("/Foundation-Like-Notion/demo/image.svg")
    expect(() => client.assetUrl("demo_missing")).toThrow(/unavailable/i)
  })
})
