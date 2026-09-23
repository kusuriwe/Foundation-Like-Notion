import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { defaultPresentation, type Article } from "@foundation-like-notion/contracts"
import { describe, expect, it, vi } from "vitest"
import type { SourceAsset } from "../src/adapters/content-adapter.js"
import { ReaderConfigSchema } from "../src/config.js"
import {
  applyDemoCandidate,
  assertPublicBytes,
  createDemoAssetWriter,
  readDemoCandidate,
  writeDemoCandidate,
} from "../src/demo-export-files.js"
import { demoPublicId, exportDemoDataset } from "../src/demo-exporter.js"

const config = ReaderConfigSchema.parse({
  version: 1,
  source: "notion",
  contentDatabases: [
    {
      id: "reader-database",
      name: "Public notes",
      sourceDataSourceId: "private-source",
      titlePropertyId: "private-title-property",
      defaultTemplate: "simple",
      templates: ["simple"],
      variables: {},
      filters: {},
    },
  ],
  presentation: defaultPresentation,
})

function article(): Article {
  return {
    id: "art_private_reader_id",
    databaseId: "reader-database",
    title: "Public article",
    titleRichText: [{ text: "Public article" }],
    icon: { kind: "asset", assetId: "asset_article_icon" },
    createdTime: "2026-09-23T00:00:00.000Z",
    lastEditedTime: "2026-09-23T00:00:00.000Z",
    variables: {
      class: {
        type: "reference",
        value: {
          readerId: "art_private_relation",
          title: "Class",
          icon: { kind: "asset", assetId: "asset_relation_icon" },
        },
      },
    },
    blocks: [
      {
        type: "callout",
        content: [{ text: "Nested" }],
        children: [{ type: "image", assetId: "asset_nested_image", caption: [{ text: "Image" }] }],
      },
      {
        type: "embeddedDatabase",
        title: "Rows",
        tables: [
          {
            status: "available",
            tableId: "tbl_private",
            title: "Table",
            columns: ["Name"],
            rows: [["first"]],
            nextCursor: "cur_private",
          },
        ],
      },
    ],
    defaultTemplate: "simple",
    templates: ["simple"],
  }
}

describe("static demo exporter", () => {
  it("paginates content, exhausts tables, and rewrites every public identifier", async () => {
    const getEmbeddedTablePage = vi.fn().mockResolvedValue({
      rows: [["second"]],
      nextCursor: null,
    })
    const reader = {
      listDatabases: () => [
        {
          id: "reader-database",
          name: "Public notes",
          defaultTemplate: "simple",
          templates: ["simple"],
        },
      ],
      listArticles: vi.fn().mockResolvedValue({
        items: [
          {
            id: "art_private_reader_id",
            databaseId: "reader-database",
            title: "Public article",
            createdTime: "2026-09-23T00:00:00.000Z",
            lastEditedTime: "2026-09-23T00:00:00.000Z",
          },
        ],
        nextCursor: null,
      }),
      getArticle: vi.fn().mockResolvedValue(article()),
      getEmbeddedTablePage,
      getAsset: vi.fn().mockResolvedValue({ url: "https://assets.invalid/file", kind: "image" }),
    }
    const writeAsset = vi.fn(async (_source: SourceAsset, publicAssetId: string) => ({
      relativePath: `assets/${publicAssetId}.webp`,
      bytes: 10,
    }))

    const first = await exportDemoDataset(config, reader, writeAsset)
    const second = await exportDemoDataset(config, reader, writeAsset)
    expect(second.dataset).toEqual(first.dataset)
    expect(first.dataset.databases[0]?.id).toMatch(/^demo_/)
    expect(first.dataset.articles[0]?.id).toMatch(/^demo_/)
    expect(JSON.stringify(first.dataset)).not.toMatch(
      /private_reader_id|private_relation|private-source|private-title-property/,
    )
    expect(first.dataset.assets).toHaveProperty(demoPublicId("asset", "asset_article_icon"))
    const tableBlock = first.dataset.articles[0]?.blocks[1]
    expect(tableBlock?.type).toBe("embeddedDatabase")
    if (tableBlock?.type !== "embeddedDatabase") throw new Error("Expected table")
    expect(tableBlock.tables[0]).toEqual(
      expect.objectContaining({ rows: [["first"], ["second"]], nextCursor: null }),
    )
    expect(getEmbeddedTablePage).toHaveBeenCalledWith(
      "art_private_reader_id",
      "tbl_private",
      "cur_private",
    )
    expect(writeAsset).toHaveBeenCalledTimes(6)
  })

  it("rejects private markers and source-shaped identifiers without revealing them", () => {
    expect(() =>
      assertPublicBytes(Buffer.from("prefix secret-value suffix"), ["secret-value"], "article"),
    ).toThrowError("private_value_detected")
    expect(() =>
      assertPublicBytes(Buffer.from("3e32ed92200180908146d3807ad98239"), [], "article"),
    ).toThrowError("source_identifier_detected")
  })

  it("rasterizes active SVG input before writing a public image", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "notion-demo-asset-"))
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async () => {
      const response = new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><script>alert(1)</script><rect width="2" height="2" fill="red"/></svg>',
        { status: 200, headers: { "content-type": "image/svg+xml" } },
      )
      Object.defineProperty(response, "url", { value: "https://assets.invalid/icon.svg" })
      return response
    }) as typeof fetch
    try {
      const writer = createDemoAssetWriter(directory, [])
      const result = await writer(
        { url: "https://assets.invalid/icon.svg", kind: "image" },
        "demo_asset",
      )
      expect(result.relativePath).toBe("assets/demo_asset.webp")
      const output = await readFile(path.join(directory, result.relativePath))
      expect(output.subarray(0, 4).toString("ascii")).toBe("RIFF")
      expect(output.toString("utf8")).not.toContain("script")
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("validates a candidate before replacing the tracked snapshot", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "notion-demo-apply-"))
    const destination = path.join(directory, "demo", "published")
    const invalidCandidate = path.join(directory, "candidate")
    await mkdir(destination, { recursive: true })
    await mkdir(invalidCandidate, { recursive: true })
    await writeFile(path.join(destination, "sentinel.txt"), "unchanged")
    await writeFile(path.join(invalidCandidate, "demo.yaml"), "invalid: true")

    await expect(applyDemoCandidate(directory, invalidCandidate)).rejects.toThrow()
    await expect(readFile(path.join(destination, "sentinel.txt"), "utf8")).resolves.toBe(
      "unchanged",
    )
  })

  it("round-trips a generated source snapshot through the public schema", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "notion-demo-candidate-"))
    const dataset = {
      presentation: defaultPresentation,
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
          ...article(),
          id: "demo_article",
          databaseId: "demo_database",
          icon: undefined,
          titleRichText: [{ text: "Public article " }],
          variables: {},
          blocks: [],
        },
      ],
      assets: {},
    }
    await writeDemoCandidate(directory, dataset, [])
    await expect(readDemoCandidate(directory)).resolves.toEqual(dataset)
    const serialized = await readFile(path.join(directory, "articles", "demo_article.yaml"), "utf8")
    expect(serialized).not.toMatch(/[ \t]+$/m)
  })
})
