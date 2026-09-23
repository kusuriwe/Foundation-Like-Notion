import { cp, mkdtemp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
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
import {
  DEMO_EXPORT_LIMITS,
  DemoExportError,
  demoExportFailure,
  demoPublicId,
  exportDemoDataset,
} from "../src/demo-exporter.js"

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
      listArticles: vi.fn(async (_databaseId: string, cursor: string | undefined) =>
        cursor
          ? { items: [], nextCursor: null }
          : {
              items: [
                {
                  id: "art_private_reader_id",
                  databaseId: "reader-database",
                  title: "Public article",
                  createdTime: "2026-09-23T00:00:00.000Z",
                  lastEditedTime: "2026-09-23T00:00:00.000Z",
                },
              ],
              nextCursor: "cur_private_list",
            },
      ),
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
    expect(reader.listArticles).toHaveBeenCalledWith("reader-database", undefined, 100)
    expect(reader.listArticles).toHaveBeenCalledWith("reader-database", "cur_private_list", 100)
    expect(writeAsset).toHaveBeenCalledTimes(6)
  })

  it("fails closed at article and asset count limits", async () => {
    const database = {
      id: "reader-database",
      name: "Public notes",
      defaultTemplate: "simple",
      templates: ["simple"],
    }
    const summary = {
      id: "art_private_reader_id",
      databaseId: "reader-database",
      title: "Public article",
      createdTime: "2026-09-23T00:00:00.000Z",
      lastEditedTime: "2026-09-23T00:00:00.000Z",
    }
    const articleReader = {
      listDatabases: () => [database],
      listArticles: vi.fn().mockResolvedValue({
        items: Array.from({ length: DEMO_EXPORT_LIMITS.articles + 1 }, () => summary),
        nextCursor: null,
      }),
      getArticle: vi.fn().mockResolvedValue({
        ...article(),
        icon: undefined,
        variables: {},
        blocks: [],
      }),
      getEmbeddedTablePage: vi.fn(),
      getAsset: vi.fn(),
    }
    await expect(exportDemoDataset(config, articleReader, vi.fn())).rejects.toThrowError(
      "article_limit_exceeded",
    )

    const assetHeavyArticle = {
      ...article(),
      icon: undefined,
      variables: {},
      blocks: Array.from({ length: DEMO_EXPORT_LIMITS.assets + 1 }, (_, index) => ({
        type: "image" as const,
        assetId: `asset_${index}`,
        caption: [],
      })),
    }
    const assetReader = {
      listDatabases: () => [database],
      listArticles: vi.fn().mockResolvedValue({ items: [summary], nextCursor: null }),
      getArticle: vi.fn().mockResolvedValue(assetHeavyArticle),
      getEmbeddedTablePage: vi.fn(),
      getAsset: vi.fn(),
    }
    await expect(exportDemoDataset(config, assetReader, vi.fn())).rejects.toThrowError(
      "asset_limit_exceeded",
    )
    expect(assetReader.getAsset).not.toHaveBeenCalled()
  })

  it("fails closed at embedded-table and total asset byte limits", async () => {
    const database = {
      id: "reader-database",
      name: "Public notes",
      defaultTemplate: "simple",
      templates: ["simple"],
    }
    const summary = {
      id: "art_private_reader_id",
      databaseId: "reader-database",
      title: "Public article",
      createdTime: "2026-09-23T00:00:00.000Z",
      lastEditedTime: "2026-09-23T00:00:00.000Z",
    }
    const tableArticle = article()
    const tableBlock = tableArticle.blocks[1]
    if (tableBlock?.type !== "embeddedDatabase" || tableBlock.tables[0]?.status !== "available") {
      throw new Error("Expected an available embedded table")
    }
    tableBlock.tables[0].rows = Array.from({ length: DEMO_EXPORT_LIMITS.embeddedTableRows }, () => [
      "row",
    ])
    tableBlock.tables[0].nextCursor = "cur_private"
    const tableReader = {
      listDatabases: () => [database],
      listArticles: vi.fn().mockResolvedValue({ items: [summary], nextCursor: null }),
      getArticle: vi.fn().mockResolvedValue(tableArticle),
      getEmbeddedTablePage: vi.fn().mockResolvedValue({ rows: [["overflow"]], nextCursor: null }),
      getAsset: vi.fn(),
    }
    await expect(exportDemoDataset(config, tableReader, vi.fn())).rejects.toThrowError(
      "embedded_table_limit_exceeded",
    )

    const oneAssetArticle = { ...article(), variables: {}, blocks: [], titleRichText: [] }
    const assetReader = {
      listDatabases: () => [database],
      listArticles: vi.fn().mockResolvedValue({ items: [summary], nextCursor: null }),
      getArticle: vi.fn().mockResolvedValue(oneAssetArticle),
      getEmbeddedTablePage: vi.fn(),
      getAsset: vi.fn().mockResolvedValue({ url: "https://assets.invalid/file", kind: "image" }),
    }
    await expect(
      exportDemoDataset(config, assetReader, async () => ({
        relativePath: "assets/demo_asset.webp",
        bytes: DEMO_EXPORT_LIMITS.totalAssetBytes + 1,
      })),
    ).rejects.toThrowError("total_asset_limit_exceeded")
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

  it("rejects an oversized asset before reading its response body", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "notion-demo-large-asset-"))
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async () => {
      const response = new Response("small", {
        status: 200,
        headers: { "content-length": String(DEMO_EXPORT_LIMITS.assetBytes + 1) },
      })
      Object.defineProperty(response, "url", { value: "https://assets.invalid/large.png" })
      return response
    }) as typeof fetch
    try {
      const writer = createDemoAssetWriter(directory, [])
      await expect(
        writer({ url: "https://assets.invalid/large.png", kind: "image" }, "demo_asset"),
      ).rejects.toThrowError("asset_limit_exceeded")
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

  it("restores the previous snapshot when replacement fails after backup", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "notion-demo-rollback-"))
    const destination = path.join(directory, "demo", "published")
    const candidate = path.join(directory, "candidate")
    await mkdir(destination, { recursive: true })
    await writeFile(path.join(destination, "sentinel.txt"), "previous")
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
          variables: {},
          blocks: [],
        },
      ],
      assets: {},
    }
    await writeDemoCandidate(candidate, dataset, [])
    let moveCalls = 0

    await expect(
      applyDemoCandidate(directory, candidate, {
        copy: async (source, target) => {
          await cp(source, target, { recursive: true, errorOnExist: true })
        },
        move: async (source, target) => {
          moveCalls += 1
          if (moveCalls === 2) throw new Error("simulated replacement failure")
          await rename(source, target)
        },
        remove: async (target) => {
          await rm(target, { recursive: true, force: true })
        },
      }),
    ).rejects.toThrowError("simulated replacement failure")
    await expect(readFile(path.join(destination, "sentinel.txt"), "utf8")).resolves.toBe("previous")
  })

  it("redacts unexpected errors and expected error details from CLI diagnostics", () => {
    const token = "secret_token_value"
    const notionId = "3e32ed92200180908146d3807ad98239"
    const unexpected = JSON.stringify(demoExportFailure(new Error(`${token}:${notionId}`)))
    const expected = JSON.stringify(
      demoExportFailure(new DemoExportError("asset_unavailable", `${token}:${notionId}`)),
    )

    expect(unexpected).toBe('{"ok":false,"category":"export_failed"}')
    expect(expected).toBe('{"ok":false,"category":"asset_unavailable"}')
    expect(`${unexpected}${expected}`).not.toContain(token)
    expect(`${unexpected}${expected}`).not.toContain(notionId)
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
