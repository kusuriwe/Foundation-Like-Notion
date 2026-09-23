import type {
  ContentAdapter,
  SourceArticle,
  SourceAsset,
  SourceBlock,
  SourceEmbeddedColumn,
  SourceEmbeddedTablePage,
  SourceIcon,
  SourcePage,
  SourceQuery,
  SourceReference,
  SourceValue,
} from "./adapters/content-adapter.js"
import type { ContentDatabaseConfig } from "./config.js"

function addIdentifier(target: Set<string>, value: string | undefined): void {
  if (!value) return
  target.add(value)
  const separator = value.indexOf(":")
  if (separator >= 0 && separator < value.length - 1) target.add(value.slice(separator + 1))
}

function collectIcon(target: Set<string>, icon: SourceIcon | undefined): void {
  if (icon?.kind === "asset") addIdentifier(target, icon.sourceAssetId)
}

function collectReference(target: Set<string>, reference: SourceReference): void {
  addIdentifier(target, reference.sourceId)
  addIdentifier(target, reference.sourceDataSourceId)
  collectIcon(target, reference.icon)
}

function collectValue(target: Set<string>, value: SourceValue): void {
  if (value.type === "reference") collectReference(target, value.value)
  if (value.type === "reference[]") {
    for (const reference of value.value) collectReference(target, reference)
  }
}

function collectBlocks(target: Set<string>, blocks: readonly SourceBlock[]): void {
  for (const block of blocks) {
    if (block.type === "image" || block.type === "file") {
      addIdentifier(target, block.sourceAssetId)
    } else if (block.type === "callout") {
      collectIcon(target, block.icon)
      if (block.children) collectBlocks(target, block.children)
    } else if (block.type === "embeddedDatabase") {
      for (const table of block.tables) {
        if (table.status !== "available") continue
        addIdentifier(target, table.sourceTableId)
        for (const column of table.columns) addIdentifier(target, column.sourcePropertyId)
      }
    }
  }
}

function collectArticle(target: Set<string>, article: SourceArticle): void {
  addIdentifier(target, article.sourceId)
  addIdentifier(target, article.sourceDataSourceId)
  collectIcon(target, article.icon)
  for (const value of Object.values(article.properties)) collectValue(target, value)
  collectBlocks(target, article.blocks)
}

/**
 * Record backend-only identifiers observed during export without logging their values.
 * export中に確認したbackend専用IDを、値をlog出力せず記録します。
 */
export class TrackingContentAdapter implements ContentAdapter {
  readonly #delegate: ContentAdapter
  readonly #identifiers = new Set<string>()

  constructor(delegate: ContentAdapter) {
    this.#delegate = delegate
  }

  identifiers(): readonly string[] {
    return [...this.#identifiers]
  }

  async listArticles(database: ContentDatabaseConfig, query: SourceQuery): Promise<SourcePage> {
    addIdentifier(this.#identifiers, database.sourceDataSourceId)
    const page = await this.#delegate.listArticles(database, query)
    for (const article of page.items) {
      addIdentifier(this.#identifiers, article.sourceId)
      addIdentifier(this.#identifiers, article.sourceDataSourceId)
      collectIcon(this.#identifiers, article.icon)
    }
    return page
  }

  async getArticle(
    database: ContentDatabaseConfig,
    sourcePageId: string,
  ): Promise<SourceArticle | undefined> {
    addIdentifier(this.#identifiers, sourcePageId)
    const article = await this.#delegate.getArticle(database, sourcePageId)
    if (article) collectArticle(this.#identifiers, article)
    return article
  }

  async getEmbeddedTablePage(
    sourceTableId: string,
    columns: readonly SourceEmbeddedColumn[],
    cursor: string | undefined,
    pageSize: number,
  ): Promise<SourceEmbeddedTablePage | undefined> {
    addIdentifier(this.#identifiers, sourceTableId)
    for (const column of columns) addIdentifier(this.#identifiers, column.sourcePropertyId)
    return this.#delegate.getEmbeddedTablePage(sourceTableId, columns, cursor, pageSize)
  }

  async getAsset(sourceAssetId: string): Promise<SourceAsset | undefined> {
    addIdentifier(this.#identifiers, sourceAssetId)
    return this.#delegate.getAsset(sourceAssetId)
  }
}
