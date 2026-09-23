import { createHash } from "node:crypto"
import {
  DemoDatasetSchema,
  type Article,
  type ArticleBlock,
  type DemoDataset,
  type ReaderIcon,
  type ReaderValue,
  type Reference,
  type RichText,
} from "@foundation-like-notion/contracts"
import type { ReaderConfig } from "./config.js"
import type { SourceAsset } from "./adapters/content-adapter.js"
import type { ReaderService } from "./reader-service.js"

export const DEMO_EXPORT_LIMITS = Object.freeze({
  articles: 200,
  assets: 500,
  embeddedTableRows: 500,
  assetBytes: 10 * 1024 * 1024,
  totalAssetBytes: 100 * 1024 * 1024,
})

export class DemoExportError extends Error {
  constructor(
    readonly category: string,
    readonly path?: string,
  ) {
    super(category)
    this.name = "DemoExportError"
  }
}

export type DemoAssetWriter = (
  source: SourceAsset,
  publicAssetId: string,
) => Promise<Readonly<{ relativePath: string; bytes: number }>>

type ExportReader = Pick<
  ReaderService,
  "listDatabases" | "listArticles" | "getArticle" | "getEmbeddedTablePage" | "getAsset"
>

function publicId(namespace: string, opaqueId: string): string {
  const digest = createHash("sha256").update(namespace).update("\0").update(opaqueId).digest("hex")
  return `demo_${digest.slice(0, 24)}`
}

function rewriteIcon(
  icon: ReaderIcon | undefined,
  assetIds: Map<string, string>,
): ReaderIcon | undefined {
  if (!icon || icon.kind === "emoji") return icon
  return { kind: "asset", assetId: mappedAssetId(icon.assetId, assetIds) }
}

function mappedAssetId(readerAssetId: string, assetIds: Map<string, string>): string {
  const existing = assetIds.get(readerAssetId)
  if (existing) return existing
  if (assetIds.size >= DEMO_EXPORT_LIMITS.assets) {
    throw new DemoExportError("asset_limit_exceeded")
  }
  const generated = publicId("asset", readerAssetId)
  assetIds.set(readerAssetId, generated)
  return generated
}

function rewriteReference(reference: Reference, assetIds: Map<string, string>): Reference {
  const icon = rewriteIcon(reference.icon, assetIds)
  return {
    readerId: publicId("reference", reference.readerId),
    title: reference.title,
    ...(icon ? { icon } : {}),
  }
}

function rewriteValue(value: ReaderValue, assetIds: Map<string, string>): ReaderValue {
  if (value.type === "reference") {
    return { type: "reference", value: rewriteReference(value.value, assetIds) }
  }
  if (value.type === "reference[]") {
    return {
      type: "reference[]",
      value: value.value.map((reference) => rewriteReference(reference, assetIds)),
    }
  }
  return value
}

function copyRichText(value: readonly RichText[]): RichText[] {
  return value.map((entry) => ({ ...entry }))
}

async function rewriteBlocks(
  blocks: readonly ArticleBlock[],
  reader: ExportReader,
  readerArticleId: string,
  publicArticleId: string,
  assetIds: Map<string, string>,
  path: readonly number[] = [],
): Promise<ArticleBlock[]> {
  const rewritten: ArticleBlock[] = []
  for (const [index, block] of blocks.entries()) {
    const blockPath = [...path, index]
    if (block.type === "callout") {
      const icon = rewriteIcon(block.icon, assetIds)
      rewritten.push({
        type: "callout",
        content: copyRichText(block.content),
        ...(icon ? { icon } : {}),
        ...(block.color ? { color: block.color } : {}),
        ...(block.children
          ? {
              children: await rewriteBlocks(
                block.children,
                reader,
                readerArticleId,
                publicArticleId,
                assetIds,
                blockPath,
              ),
            }
          : {}),
      })
      continue
    }
    if (block.type === "image") {
      rewritten.push({
        type: "image",
        assetId: mappedAssetId(block.assetId, assetIds),
        caption: copyRichText(block.caption),
      })
      continue
    }
    if (block.type === "file") {
      rewritten.push({
        type: "file",
        assetId: mappedAssetId(block.assetId, assetIds),
        name: block.name,
      })
      continue
    }
    if (block.type === "embeddedDatabase") {
      const tables: ArticleBlock & { type: "embeddedDatabase" } = {
        type: "embeddedDatabase",
        title: block.title,
        tables: [],
      }
      for (const [tableIndex, table] of block.tables.entries()) {
        if (table.status === "unavailable") {
          tables.tables.push({ ...table })
          continue
        }
        const rows = table.rows.map((row) => [...row])
        let cursor = table.nextCursor
        while (cursor) {
          const page = await reader.getEmbeddedTablePage(readerArticleId, table.tableId, cursor)
          rows.push(...page.rows.map((row) => [...row]))
          if (rows.length > DEMO_EXPORT_LIMITS.embeddedTableRows) {
            throw new DemoExportError(
              "embedded_table_limit_exceeded",
              `articles[].blocks[${blockPath.join(".")}].tables[${tableIndex}]`,
            )
          }
          cursor = page.nextCursor
        }
        tables.tables.push({
          status: "available",
          tableId: publicId(
            "embedded-table",
            `${publicArticleId}:${blockPath.join(".")}:${tableIndex}`,
          ),
          title: table.title,
          columns: [...table.columns],
          rows,
          nextCursor: null,
        })
      }
      rewritten.push(tables)
      continue
    }
    if (block.type === "bulletedList" || block.type === "numberedList") {
      rewritten.push({ ...block, items: block.items.map(copyRichText) })
      continue
    }
    if (block.type === "table") {
      rewritten.push({
        ...block,
        rows: block.rows.map((row) => row.map(copyRichText)),
      })
      continue
    }
    if (block.type === "code") {
      rewritten.push({ ...block, caption: copyRichText(block.caption) })
      continue
    }
    if ("content" in block) {
      rewritten.push({ ...block, content: copyRichText(block.content) })
      continue
    }
    rewritten.push({ ...block })
  }
  return rewritten
}

async function rewriteArticle(
  article: Article,
  reader: ExportReader,
  databaseIds: ReadonlyMap<string, string>,
  assetIds: Map<string, string>,
): Promise<Article> {
  const databaseId = databaseIds.get(article.databaseId)
  if (!databaseId) throw new DemoExportError("unknown_database")
  const id = publicId("article", article.id)
  const icon = rewriteIcon(article.icon, assetIds)
  return {
    id,
    databaseId,
    title: article.title,
    titleRichText: copyRichText(article.titleRichText),
    ...(icon ? { icon } : {}),
    createdTime: article.createdTime,
    lastEditedTime: article.lastEditedTime,
    variables: Object.fromEntries(
      Object.entries(article.variables).map(([name, value]) => [
        name,
        rewriteValue(value, assetIds),
      ]),
    ),
    blocks: await rewriteBlocks(article.blocks, reader, article.id, id, assetIds),
    defaultTemplate: article.defaultTemplate,
    templates: [...article.templates],
  }
}

/**
 * Export the configured Reader view into validated public demo DTOs.
 * 設定済みのReader表示を、検証済みの公開demo DTOへ書き出します。
 *
 * Args:
 *   config: Resolved read-only Reader configuration.
 *   reader: Reader service backed by an isolated export database.
 *   writeAsset: Safe asset materializer returning only a public relative path.
 *
 * Returns:
 *   Validated immutable demo dataset and export counts.
 *
 * Raises:
 *   DemoExportError: Pagination, limits, references, or asset export failed closed.
 */
export async function exportDemoDataset(
  config: ReaderConfig,
  reader: ExportReader,
  writeAsset: DemoAssetWriter,
): Promise<Readonly<{ dataset: DemoDataset; assetBytes: number }>> {
  const databases = reader.listDatabases()
  const databaseIds = new Map(
    databases.map((database) => [database.id, publicId("database", database.id)]),
  )
  const assetIds = new Map<string, string>()
  const articles: Article[] = []

  for (const database of databases) {
    let cursor: string | undefined
    do {
      const page = await reader.listArticles(database.id, cursor, 100)
      for (const summary of page.items) {
        if (articles.length >= DEMO_EXPORT_LIMITS.articles) {
          throw new DemoExportError("article_limit_exceeded")
        }
        const article = await reader.getArticle(summary.id)
        articles.push(await rewriteArticle(article, reader, databaseIds, assetIds))
      }
      cursor = page.nextCursor ?? undefined
    } while (cursor)
  }

  if (articles.length === 0) throw new DemoExportError("no_articles")

  const assets: Record<string, string> = {}
  let assetBytes = 0
  for (const [readerAssetId, publicAssetId] of assetIds) {
    const source = await reader.getAsset(readerAssetId)
    const written = await writeAsset(source, publicAssetId)
    assetBytes += written.bytes
    if (assetBytes > DEMO_EXPORT_LIMITS.totalAssetBytes) {
      throw new DemoExportError("total_asset_limit_exceeded")
    }
    assets[publicAssetId] = written.relativePath
  }

  const dataset = DemoDatasetSchema.parse({
    presentation: config.presentation,
    databases: databases.map((database) => ({
      ...database,
      id: databaseIds.get(database.id),
    })),
    articles,
    assets,
  })
  return { dataset, assetBytes }
}

export const demoPublicId = publicId
