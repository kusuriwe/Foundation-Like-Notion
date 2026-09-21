import type {
  Article,
  ArticleBlock,
  ArticlePage,
  ArticleSummary,
  DatabaseSummary,
  ReaderIcon,
  SearchFilter,
  SearchRequest,
} from "@foundation-like-notion/contracts"
import type { ContentAdapter, SourceBlock, SourceIcon } from "./adapters/content-adapter.js"
import type { ContentDatabaseConfig, ReaderConfig } from "./config.js"
import type { ReaderDatabase } from "./database.js"
import { resolveProperties } from "./domain/property-resolver.js"

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

type SearchCursor = Readonly<{ databaseIndex: number; sourceCursor?: string }>

function encodeSearchCursor(cursor: SearchCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url")
}

function decodeSearchCursor(cursor: string | undefined): SearchCursor {
  if (!cursor) {
    return { databaseIndex: 0 }
  }
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "databaseIndex" in parsed &&
      typeof parsed.databaseIndex === "number" &&
      Number.isSafeInteger(parsed.databaseIndex) &&
      parsed.databaseIndex >= 0 &&
      (!("sourceCursor" in parsed) || typeof parsed.sourceCursor === "string")
    ) {
      return parsed as SearchCursor
    }
  } catch {
    // The public error below deliberately hides cursor internals.
  }
  throw new ReaderRequestError("Invalid search cursor")
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

  constructor(config: ReaderConfig, database: ReaderDatabase, adapter: ContentAdapter) {
    this.#config = config
    this.#database = database
    this.#adapter = adapter
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
    const page = await this.#adapter.listArticles(database, {
      ...(cursor ? { cursor } : {}),
      pageSize,
    })
    return {
      items: page.items.map((article) => this.#mapSummary(database, article)),
      nextCursor: page.nextCursor,
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
      variables: resolveProperties(database, source.properties, this.#database),
      blocks: source.blocks.flatMap((block) => {
        const mapped = this.#mapBlock(block)
        return mapped ? [mapped] : []
      }),
      defaultTemplate: database.defaultTemplate,
      templates: [...database.templates],
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
    const cursor = decodeSearchCursor(request.cursor)
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
      const filters = request.filters.map((filter) => this.#mapFilter(database, filter))
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
        ? encodeSearchCursor({
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

  #mapBlock(block: SourceBlock): ArticleBlock | undefined {
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
    if ("content" in block) {
      return { ...block, content: [...block.content] }
    }
    return undefined
  }

  #mapFilter(database: ContentDatabaseConfig, filter: SearchFilter) {
    const mapping = database.filters[filter.fieldId]
    if (!mapping?.operators.includes(filter.operator)) {
      throw new ReaderRequestError(`Filter ${filter.fieldId} is not allowed`)
    }
    let value = filter.value
    if (mapping.sourceType === "relation" && typeof value === "string") {
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
