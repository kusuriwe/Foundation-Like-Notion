import {
  ReaderIdSchema,
  type Article,
  type ArticleBlock,
  type ArticlePage,
  type ArticleSummary,
  type DatabaseSummary,
  type EmbeddedTablePage,
  type ReaderIcon,
  type SearchFilter,
  type SearchRequest,
} from "@foundation-like-notion/contracts"
import { z } from "zod"
import type {
  ContentAdapter,
  SourceBlock,
  SourceFilter,
  SourceIcon,
} from "./adapters/content-adapter.js"
import type { ContentDatabaseConfig, ReaderConfig } from "./config.js"
import { CursorRegistry } from "./cursor-registry.js"
import type { ReaderDatabase } from "./database.js"
import { resolveProperties } from "./domain/property-resolver.js"
import { EmbeddedTableRegistry } from "./embedded-table-registry.js"

const EMBEDDED_TABLE_PAGE_SIZE = 50

export class ReaderNotFoundError extends Error {
  constructor() {
    super("Reader resource was not found")
    this.name = "ReaderNotFoundError"
  }
}

export class ReaderRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ReaderRequestError"
  }
}

const FilterDateValueSchema = z.union([z.iso.date(), z.iso.datetime({ offset: true })])

function listCursorContext(databaseId: string, pageSize: number): readonly unknown[] {
  return ["article-list", databaseId, pageSize]
}

function searchCursorContext(
  request: SearchRequest,
  databases: readonly ContentDatabaseConfig[],
): readonly unknown[] {
  return [
    "search",
    request.query ?? null,
    databases.map((database) => database.id),
    request.filters.map((filter) => [
      filter.fieldId,
      filter.operator,
      "value" in filter ? filter.value : null,
    ]),
    request.pageSize,
  ]
}

function embeddedTableCursorContext(readerArticleId: string, tableId: string): readonly unknown[] {
  return ["embedded-table", readerArticleId, tableId, EMBEDDED_TABLE_PAGE_SIZE]
}

function safeWebUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : undefined
  } catch {
    return undefined
  }
}

/**
 * Enforce Reader allowlists while mapping backend objects to public contracts.
 * backend object を公開 contract へ変換しつつ Reader allowlist を適用します。
 */
export class ReaderService {
  readonly #config: ReaderConfig
  readonly #database: ReaderDatabase
  readonly #adapter: ContentAdapter
  readonly #cursors: CursorRegistry
  readonly #embeddedTables: EmbeddedTableRegistry

  constructor(
    config: ReaderConfig,
    database: ReaderDatabase,
    adapter: ContentAdapter,
    cursors = new CursorRegistry(),
    embeddedTables = new EmbeddedTableRegistry(),
  ) {
    this.#config = config
    this.#database = database
    this.#adapter = adapter
    this.#cursors = cursors
    this.#embeddedTables = embeddedTables
  }

  /** Return configured public database metadata. / 設定済み database の公開 metadata を返します。 */
  listDatabases(): readonly DatabaseSummary[] {
    return this.#config.contentDatabases.map((database) => ({
      id: database.id,
      name: database.name,
      defaultTemplate: database.defaultTemplate,
      templates: [...database.templates],
    }))
  }

  /**
   * List one allowlisted database with opaque article identifiers.
   * 許可された database を opaque article ID 付きで一覧化します。
   */
  async listArticles(
    databaseId: string,
    cursor: string | undefined,
    pageSize: number,
  ): Promise<ArticlePage> {
    const database = this.#getDatabase(databaseId)
    const context = listCursorContext(database.id, pageSize)
    const cursorState = cursor ? this.#cursors.resolve(cursor, "article-list", context) : undefined
    if (cursor && cursorState?.kind !== "article-list") {
      throw new ReaderRequestError("Invalid article cursor")
    }
    const page = await this.#adapter.listArticles(database, {
      ...(cursorState?.kind === "article-list" ? { cursor: cursorState.sourceCursor } : {}),
      pageSize,
    })
    return {
      items: page.items.map((article) => this.#mapSummary(database, article)),
      nextCursor: page.nextCursor
        ? this.#cursors.issue(context, {
            kind: "article-list",
            sourceCursor: page.nextCursor,
          })
        : null,
    }
  }

  /**
   * Resolve and return one allowlisted article.
   * 許可された article を解決して返します。
   *
   * Raises:
   *   ReaderNotFoundError: The opaque ID is unknown or outside its configured database.
   */
  async getArticle(readerArticleId: string): Promise<Article> {
    const resource = this.#database.getResource(readerArticleId, "page")
    if (!resource?.databaseReaderId) {
      throw new ReaderNotFoundError()
    }
    const database = this.#getDatabase(resource.databaseReaderId)
    const source = await this.#adapter.getArticle(database, resource.sourceId)
    if (!source || source.sourceDataSourceId !== database.sourceDataSourceId) {
      throw new ReaderNotFoundError()
    }
    const summary = this.#mapSummary(database, source)
    return {
      ...summary,
      titleRichText: [...source.titleRichText],
      variables: resolveProperties(database, source.properties, this.#database),
      blocks: source.blocks.flatMap((block) => {
        const mapped = this.#mapBlock(block, readerArticleId)
        return mapped ? [mapped] : []
      }),
      defaultTemplate: database.defaultTemplate,
      templates: [...database.templates],
    }
  }

  /**
   * Continue one child-database table through article-bound opaque handles.
   * 記事に結び付いた opaque handle を通して子データベース表を追加取得します。
   */
  async getEmbeddedTablePage(
    readerArticleId: string,
    tableId: string,
    cursor: string,
  ): Promise<EmbeddedTablePage> {
    const table = this.#embeddedTables.resolve(tableId, readerArticleId)
    if (!table) throw new ReaderRequestError("Invalid embedded table")
    const context = embeddedTableCursorContext(readerArticleId, tableId)
    const cursorState = this.#cursors.resolve(cursor, "embedded-table", context)
    if (cursorState?.kind !== "embedded-table" || cursorState.tableId !== tableId) {
      throw new ReaderRequestError("Invalid embedded table cursor")
    }
    const page = await this.#adapter.getEmbeddedTablePage(
      table.sourceTableId,
      table.columns,
      cursorState.sourceCursor,
      EMBEDDED_TABLE_PAGE_SIZE,
    )
    if (!page) throw new ReaderRequestError("Embedded table is unavailable")
    return {
      rows: page.rows.map((row) => [...row]),
      nextCursor: page.nextCursor
        ? this.#cursors.issue(context, {
            kind: "embedded-table",
            tableId,
            sourceCursor: page.nextCursor,
          })
        : null,
    }
  }

  /**
   * Search configured databases using allowlisted Reader fields only.
   * 許可された Reader field だけで設定済み database を検索します。
   */
  async search(request: SearchRequest): Promise<ArticlePage> {
    const selected = request.databaseIds?.length
      ? request.databaseIds.map((id) => this.#getDatabase(id))
      : this.#config.contentDatabases
    const mappedFilters = selected.map((database) =>
      request.filters.map((filter) => this.#mapFilter(database, filter)),
    )
    const context = searchCursorContext(request, selected)
    const resolvedCursor = request.cursor
      ? this.#cursors.resolve(request.cursor, "search", context)
      : undefined
    if (request.cursor && resolvedCursor?.kind !== "search") {
      throw new ReaderRequestError("Invalid search cursor")
    }
    const cursor =
      resolvedCursor?.kind === "search"
        ? resolvedCursor
        : { kind: "search" as const, databaseIndex: 0 }
    if (cursor.databaseIndex > selected.length) {
      throw new ReaderRequestError("Invalid search cursor")
    }

    const items: ArticleSummary[] = []
    let databaseIndex = cursor.databaseIndex
    let sourceCursor = cursor.sourceCursor
    while (items.length < request.pageSize && databaseIndex < selected.length) {
      const database = selected[databaseIndex]
      if (!database) {
        break
      }
      const filters = mappedFilters[databaseIndex] ?? []
      const page = await this.#adapter.listArticles(database, {
        ...(request.query ? { query: request.query } : {}),
        filters,
        ...(sourceCursor ? { cursor: sourceCursor } : {}),
        pageSize: request.pageSize - items.length,
      })
      items.push(...page.items.map((article) => this.#mapSummary(database, article)))
      if (page.nextCursor) {
        sourceCursor = page.nextCursor
        break
      }
      databaseIndex += 1
      sourceCursor = undefined
    }

    const hasMore = sourceCursor !== undefined || databaseIndex < selected.length
    return {
      items,
      nextCursor: hasMore
        ? this.#cursors.issue(context, {
            kind: "search",
            databaseIndex,
            ...(sourceCursor ? { sourceCursor } : {}),
          })
        : null,
    }
  }

  /**
   * Resolve one opaque asset identifier through the active adapter.
   * opaque asset ID を active adapter 経由で解決します。
   */
  async getAsset(readerAssetId: string) {
    const resource = this.#database.getResource(readerAssetId, "asset")
    if (!resource) {
      throw new ReaderNotFoundError()
    }
    const asset = await this.#adapter.getAsset(resource.sourceId)
    if (!asset) {
      throw new ReaderNotFoundError()
    }
    return asset
  }

  #getDatabase(id: string): ContentDatabaseConfig {
    const database = this.#config.contentDatabases.find((entry) => entry.id === id)
    if (!database) {
      throw new ReaderNotFoundError()
    }
    return database
  }

  #mapSummary(
    database: ContentDatabaseConfig,
    source: {
      sourceId: string
      sourceDataSourceId: string
      title: string
      icon?: SourceIcon
      createdTime: string
      lastEditedTime: string
    },
  ): ArticleSummary {
    if (source.sourceDataSourceId !== database.sourceDataSourceId) {
      throw new ReaderNotFoundError()
    }
    const resource = this.#database.getOrCreateResource(source.sourceId, "page", database.id)
    const icon = this.#mapIcon(source.icon)
    return {
      id: resource.readerId,
      databaseId: database.id,
      title: source.title,
      ...(icon ? { icon } : {}),
      createdTime: source.createdTime,
      lastEditedTime: source.lastEditedTime,
    }
  }

  #mapIcon(icon: SourceIcon | undefined): ReaderIcon | undefined {
    if (!icon) {
      return undefined
    }
    if (icon.kind === "emoji") {
      return icon
    }
    return {
      kind: "asset",
      assetId: this.#database.getOrCreateResource(icon.sourceAssetId, "asset").readerId,
    }
  }

  #mapBlock(block: SourceBlock, readerArticleId: string): ArticleBlock | undefined {
    if (block.type === "image" || block.type === "file") {
      const assetId = this.#database.getOrCreateResource(block.sourceAssetId, "asset").readerId
      return block.type === "image"
        ? { type: "image", assetId, caption: [...block.caption] }
        : { type: "file", assetId, name: block.name }
    }
    if (block.type === "link") {
      const url = safeWebUrl(block.url)
      return url ? { ...block, url } : undefined
    }
    if (block.type === "callout") {
      const icon = this.#mapIcon(block.icon)
      return {
        type: "callout",
        content: [...block.content],
        ...(icon ? { icon } : {}),
        ...(block.color ? { color: block.color } : {}),
        ...(block.children?.length
          ? {
              children: block.children.flatMap((child) => {
                const mapped = this.#mapBlock(child, readerArticleId)
                return mapped ? [mapped] : []
              }),
            }
          : {}),
      }
    }
    if (block.type === "bulletedList" || block.type === "numberedList") {
      return { ...block, items: block.items.map((item) => [...item]) }
    }
    if (block.type === "table") {
      return {
        ...block,
        rows: block.rows.map((row) => row.map((cell) => [...cell])),
      }
    }
    if (block.type === "code") {
      return {
        type: "code",
        code: block.code,
        ...(block.language ? { language: block.language } : {}),
        caption: [...block.caption],
      }
    }
    if (block.type === "math") {
      return { type: "math", expression: block.expression }
    }
    if (block.type === "embeddedDatabase") {
      return {
        type: "embeddedDatabase",
        title: block.title,
        tables: block.tables.map((table) => {
          if (table.status === "unavailable") return { ...table }
          const tableId = this.#embeddedTables.issue({
            readerArticleId,
            sourceTableId: table.sourceTableId,
            columns: table.columns,
          })
          const context = embeddedTableCursorContext(readerArticleId, tableId)
          return {
            status: "available" as const,
            tableId,
            title: table.title,
            columns: table.columns.map((column) => column.label),
            rows: table.rows.map((row) => [...row]),
            nextCursor: table.nextCursor
              ? this.#cursors.issue(context, {
                  kind: "embedded-table",
                  tableId,
                  sourceCursor: table.nextCursor,
                })
              : null,
          }
        }),
      }
    }
    if ("content" in block) {
      return { ...block, content: [...block.content] }
    }
    return undefined
  }

  #mapFilter(database: ContentDatabaseConfig, filter: SearchFilter): SourceFilter {
    const mapping = database.filters[filter.fieldId]
    if (!mapping?.operators.includes(filter.operator)) {
      throw new ReaderRequestError(`Filter ${filter.fieldId} is not allowed`)
    }
    if (filter.operator === "isEmpty") {
      return {
        propertyId: mapping.propertyId,
        type: mapping.type,
        sourceType: mapping.sourceType,
        operator: filter.operator,
      }
    }

    let value: string | number | boolean = filter.value
    const valid =
      mapping.sourceType === "checkbox"
        ? typeof value === "boolean"
        : mapping.sourceType === "number"
          ? typeof value === "number" && Number.isFinite(value)
          : mapping.sourceType === "date"
            ? typeof value === "string" && FilterDateValueSchema.safeParse(value).success
            : typeof value === "string" && value.length > 0
    if (!valid) {
      throw new ReaderRequestError(`Filter ${filter.fieldId} value is invalid`)
    }

    if (mapping.sourceType === "relation") {
      if (typeof value !== "string" || !ReaderIdSchema.safeParse(value).success) {
        throw new ReaderRequestError(`Relation filter ${filter.fieldId} is invalid`)
      }
      const resource = this.#database.getResource(value, "page")
      if (!resource) {
        throw new ReaderRequestError(`Relation filter ${filter.fieldId} is invalid`)
      }
      value = resource.sourceId
    }
    return {
      propertyId: mapping.propertyId,
      type: mapping.type,
      sourceType: mapping.sourceType,
      operator: filter.operator,
      ...(value !== undefined ? { value } : {}),
    }
  }
}
