import { APIErrorCode, Client, ClientErrorCode, isNotionClientError } from "@notionhq/client"
import type { CalloutColor, RichText } from "@foundation-like-notion/contracts"
import type { ContentDatabaseConfig, ReaderConfig } from "../config.js"
import { ContentAdapterError } from "./content-adapter.js"
import type {
  ContentAdapter,
  SourceArticle,
  SourceArticleSummary,
  SourceAsset,
  SourceBlock,
  SourceEmbeddedColumn,
  SourceEmbeddedTable,
  SourceEmbeddedTablePage,
  SourceFilter,
  SourceIcon,
  SourcePage,
  SourceQuery,
  SourceReference,
  SourceValue,
} from "./content-adapter.js"

type UnknownRecord = Record<string, unknown>

const EMBEDDED_TABLE_PAGE_SIZE = 50
const MAX_BLOCK_DEPTH = 5
const MAX_BLOCKS_PER_ARTICLE = 500
const CALLOUT_COLORS = new Set<CalloutColor>([
  "default",
  "gray",
  "brown",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "red",
  "gray_background",
  "brown_background",
  "orange_background",
  "yellow_background",
  "green_background",
  "blue_background",
  "purple_background",
  "pink_background",
  "red_background",
])

function notionFailure(error: unknown): ContentAdapterError {
  if (!isNotionClientError(error)) {
    return new ContentAdapterError("unavailable")
  }
  if (
    error.code === APIErrorCode.ObjectNotFound ||
    error.code === APIErrorCode.RestrictedResource
  ) {
    return new ContentAdapterError("not_found")
  }
  if (error.code === APIErrorCode.RateLimited) {
    return new ContentAdapterError("rate_limited")
  }
  if (error.code === ClientErrorCode.RequestTimeout || error.code === APIErrorCode.GatewayTimeout) {
    return new ContentAdapterError("timeout")
  }
  return new ContentAdapterError("unavailable")
}

function record(value: unknown): UnknownRecord | undefined {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : undefined
}

function text(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

function boolean(value: unknown): boolean {
  return value === true
}

function richText(value: unknown): RichText[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.flatMap<RichText>((item) => {
    const entry = record(item)
    if (entry?.type === "equation") {
      const expression = text(record(entry.equation)?.expression)
      return expression === undefined
        ? []
        : [{ type: "equation" as const, expression, text: expression }]
    }
    const plainText = text(entry?.plain_text)
    if (plainText === undefined) {
      return []
    }
    const annotations = record(entry?.annotations)
    const href = entry?.href === null ? null : text(entry?.href)
    return [
      {
        text: plainText,
        ...(href !== undefined ? { href } : {}),
        ...(annotations
          ? {
              annotations: {
                bold: boolean(annotations.bold),
                italic: boolean(annotations.italic),
                strikethrough: boolean(annotations.strikethrough),
                underline: boolean(annotations.underline),
                code: boolean(annotations.code),
              },
            }
          : {}),
      },
    ]
  })
}

function plainText(value: unknown): string {
  return richText(value)
    .map((entry) => ("type" in entry ? entry.expression : entry.text))
    .join("")
}

function sourceParentId(page: UnknownRecord): string | undefined {
  const parent = record(page.parent)
  return text(parent?.data_source_id)
}

function findProperty(page: UnknownRecord, propertyId: string): UnknownRecord | undefined {
  const properties = record(page.properties)
  return Object.values(properties ?? {})
    .map(record)
    .find((property) => property?.id === propertyId)
}

function pageTitle(page: UnknownRecord): string {
  const properties = record(page.properties)
  for (const property of Object.values(properties ?? {})) {
    const item = record(property)
    if (item?.type === "title") {
      return plainText(item.title)
    }
  }
  return ""
}

function notionIcon(iconValue: unknown, sourceAssetId: string): SourceIcon | undefined {
  const icon = record(iconValue)
  if (icon?.type === "emoji") {
    const value = text(icon.emoji)
    return value ? { kind: "emoji", value } : undefined
  }
  if (icon?.type === "file" || icon?.type === "custom_emoji") {
    return { kind: "asset", sourceAssetId }
  }
  if (icon?.type === "icon" && notionNativeIconAsset(icon)) {
    return { kind: "asset", sourceAssetId }
  }
  return undefined
}

function pageIcon(page: UnknownRecord): SourceIcon | undefined {
  const id = text(page.id)
  return id ? notionIcon(page.icon, `page-icon:${id}`) : undefined
}

const NOTION_ICON_COLORS = new Set([
  "gray",
  "lightgray",
  "brown",
  "yellow",
  "orange",
  "green",
  "blue",
  "purple",
  "pink",
  "red",
])

function notionNativeIconAsset(iconValue: unknown): SourceAsset | undefined {
  const icon = record(iconValue)
  const metadata = record(icon?.icon)
  const name = text(metadata?.name)?.replaceAll(" ", "_")
  const color = text(metadata?.color)
  if (
    icon?.type !== "icon" ||
    !name ||
    !/^[a-z0-9_-]{1,80}$/.test(name) ||
    !color ||
    !NOTION_ICON_COLORS.has(color)
  ) {
    return undefined
  }
  return {
    url: `https://www.notion.so/icons/${encodeURIComponent(name)}_${color}.svg?mode=light`,
    kind: "image",
    fetchProfile: "notion-icon",
  }
}

function iconAsset(iconValue: unknown): SourceAsset | undefined {
  const icon = record(iconValue)
  if (icon?.type === "file") {
    const url = safeHttpsUrl(record(icon.file)?.url)
    return url ? { url, kind: "image" } : undefined
  }
  if (icon?.type === "custom_emoji") {
    const url = safeHttpsUrl(record(icon.custom_emoji)?.url)
    return url ? { url, kind: "image" } : undefined
  }
  if (icon?.type === "icon") return notionNativeIconAsset(icon)
  return undefined
}

function calloutColor(value: unknown): CalloutColor | undefined {
  const candidate = text(value) as CalloutColor | undefined
  return candidate && CALLOUT_COLORS.has(candidate) ? candidate : undefined
}

function scalarPropertyText(value: unknown): string | undefined {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  const item = record(value)
  if (!item) return undefined
  const type = text(item.type)
  if (type === "string") return text(item.string) ?? ""
  if (type === "number") return item.number === null ? "" : scalarPropertyText(item.number)
  if (type === "boolean") return item.boolean === true ? "Yes" : "No"
  if (type === "date") {
    const date = record(item.date)
    const start = text(date?.start) ?? ""
    const end = text(date?.end)
    return end ? `${start} – ${end}` : start
  }
  if (type === "array" && Array.isArray(item.array)) {
    return item.array.map(scalarPropertyText).filter(Boolean).join(", ")
  }
  return type ? propertyText(item) : undefined
}

function clipped(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : value.slice(0, maxLength)
}

function propertyText(property: UnknownRecord | undefined): string {
  if (!property) return ""
  const type = text(property.type)
  if (!type) return "—"
  if (type === "title" || type === "rich_text") return plainText(property[type])
  if (type === "number")
    return property.number === null ? "" : (scalarPropertyText(property.number) ?? "")
  if (type === "checkbox") return property.checkbox === true ? "Yes" : "No"
  if (type === "select" || type === "status") return text(record(property[type])?.name) ?? ""
  if (type === "multi_select") {
    return Array.isArray(property.multi_select)
      ? property.multi_select
          .map((item) => text(record(item)?.name))
          .filter(Boolean)
          .join(", ")
      : ""
  }
  if (type === "date") {
    const date = record(property.date)
    const start = text(date?.start) ?? ""
    const end = text(date?.end)
    return end ? `${start} – ${end}` : start
  }
  if (type === "url" || type === "email" || type === "phone_number") {
    return text(property[type]) ?? ""
  }
  if (type === "created_time" || type === "last_edited_time") return text(property[type]) ?? ""
  if (type === "created_by" || type === "last_edited_by") {
    return text(record(property[type])?.name) ?? ""
  }
  if (type === "people") {
    return Array.isArray(property.people)
      ? property.people
          .map((item) => text(record(item)?.name))
          .filter(Boolean)
          .join(", ")
      : ""
  }
  if (type === "files") {
    return Array.isArray(property.files)
      ? property.files
          .map((item) => text(record(item)?.name))
          .filter(Boolean)
          .join(", ")
      : ""
  }
  if (type === "relation") {
    const count = Array.isArray(property.relation) ? property.relation.length : 0
    return count === 0 ? "" : `${count} reference${count === 1 ? "" : "s"}`
  }
  if (type === "formula") return scalarPropertyText(property.formula) ?? "—"
  if (type === "rollup") return scalarPropertyText(property.rollup) ?? "—"
  return "—"
}

function embeddedRows(
  values: readonly unknown[],
  columns: readonly SourceEmbeddedColumn[],
): readonly (readonly string[])[] {
  return values.flatMap((value) => {
    const page = record(value)
    if (page?.object !== "page") return []
    return [
      columns.map((column) =>
        clipped(propertyText(findProperty(page, column.sourcePropertyId)), 4_000),
      ),
    ]
  })
}

function buildSorts(database: ContentDatabaseConfig): UnknownRecord[] {
  return database.sort.map((sort) => {
    if (sort.field === "created_time" || sort.field === "last_edited_time") {
      return { timestamp: sort.field, direction: sort.direction }
    }
    const propertyId =
      database.variables[sort.field]?.propertyId ?? database.filters[sort.field]?.propertyId
    if (!propertyId) {
      throw new Error(`Configured sort field ${sort.field} has no property mapping`)
    }
    return { property: propertyId, direction: sort.direction }
  })
}

function condition(filter: SourceFilter): UnknownRecord {
  const empty = filter.operator === "isEmpty"
  if (filter.sourceType === "checkbox") {
    return { property: filter.propertyId, checkbox: { equals: filter.value } }
  }
  if (filter.sourceType === "number") {
    const operators = {
      equals: "equals",
      greaterThan: "greater_than",
      greaterThanOrEqual: "greater_than_or_equal_to",
      lessThan: "less_than",
      lessThanOrEqual: "less_than_or_equal_to",
    } as const
    const operator = operators[filter.operator as keyof typeof operators]
    return {
      property: filter.propertyId,
      number: empty ? { is_empty: true } : { [operator ?? "equals"]: filter.value },
    }
  }
  if (filter.sourceType === "date") {
    const operator =
      filter.operator === "before" ? "before" : filter.operator === "after" ? "after" : "equals"
    return {
      property: filter.propertyId,
      date: empty ? { is_empty: true } : { [operator]: filter.value },
    }
  }
  if (filter.sourceType === "relation") {
    return {
      property: filter.propertyId,
      relation: empty ? { is_empty: true } : { contains: filter.value },
    }
  }
  if (filter.sourceType === "multi_select") {
    return {
      property: filter.propertyId,
      multi_select: empty ? { is_empty: true } : { contains: filter.value },
    }
  }
  if (filter.sourceType === "select" || filter.sourceType === "status") {
    return {
      property: filter.propertyId,
      [filter.sourceType]: empty ? { is_empty: true } : { equals: filter.value },
    }
  }
  const operator = filter.operator === "contains" ? "contains" : "equals"
  return {
    property: filter.propertyId,
    [filter.sourceType]: empty ? { is_empty: true } : { [operator]: filter.value },
  }
}

function safeHttpsUrl(value: unknown): string | undefined {
  const candidate = text(value)
  if (!candidate) {
    return undefined
  }
  try {
    const parsed = new URL(candidate)
    return parsed.protocol === "https:" ? parsed.toString() : undefined
  } catch {
    return undefined
  }
}

/**
 * Read allowlisted Notion data sources and normalize them into source contracts.
 * 許可された Notion Data Source を読み、source contract へ正規化します。
 */
export class NotionAdapter implements ContentAdapter {
  readonly #client: Client
  readonly #allowedSourceIds: ReadonlySet<string>

  constructor(token: string, config: ReaderConfig, client?: Client) {
    this.#client =
      client ?? new Client({ auth: token, notionVersion: "2026-03-11", logger: () => undefined })
    this.#allowedSourceIds = new Set([
      ...config.contentDatabases.map((database) => database.sourceDataSourceId),
      ...config.relationSources,
    ])
  }

  async #request<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      throw notionFailure(error)
    }
  }

  async listArticles(database: ContentDatabaseConfig, query: SourceQuery): Promise<SourcePage> {
    const filters: UnknownRecord[] = [...(query.filters ?? []).map(condition)]
    if (query.query) {
      filters.unshift({
        property: database.titlePropertyId,
        title: { contains: query.query },
      })
    }
    const response = await this.#request(() =>
      this.#client.dataSources.query({
        data_source_id: database.sourceDataSourceId,
        page_size: query.pageSize,
        ...(query.cursor ? { start_cursor: query.cursor } : {}),
        sorts: buildSorts(database) as never,
        ...(filters.length === 1
          ? { filter: filters[0] as never }
          : filters.length > 1
            ? { filter: { and: filters } as never }
            : {}),
      }),
    )
    const items = response.results.flatMap((item) => {
      const page = record(item)
      if (page?.object !== "page" || sourceParentId(page) !== database.sourceDataSourceId) {
        return []
      }
      return [this.#summary(page, database)]
    })
    return { items, nextCursor: response.next_cursor }
  }

  async getArticle(
    database: ContentDatabaseConfig,
    sourcePageId: string,
  ): Promise<SourceArticle | undefined> {
    const value = await this.#request(() => this.#client.pages.retrieve({ page_id: sourcePageId }))
    const page = record(value)
    if (page?.object !== "page" || sourceParentId(page) !== database.sourceDataSourceId) {
      return undefined
    }
    const referenceCache = new Map<string, Promise<SourceReference | undefined>>()
    const properties = await this.#properties(page, database, referenceCache)
    const blocks = await this.#blocks(sourcePageId)
    const titleProperty = findProperty(page, database.titlePropertyId)
    const titleRichText =
      titleProperty?.type === "title" ? richText(titleProperty.title) : [{ text: pageTitle(page) }]
    return { ...this.#summary(page, database), titleRichText, properties, blocks }
  }

  async getAsset(sourceAssetId: string): Promise<SourceAsset | undefined> {
    if (sourceAssetId.startsWith("page-icon:")) {
      const pageId = sourceAssetId.slice("page-icon:".length)
      const page = record(
        await this.#request(() => this.#client.pages.retrieve({ page_id: pageId })),
      )
      return iconAsset(page?.icon)
    }
    if (sourceAssetId.startsWith("block-icon:")) {
      const blockId = sourceAssetId.slice("block-icon:".length)
      const block = record(
        await this.#request(() => this.#client.blocks.retrieve({ block_id: blockId })),
      )
      const data = block ? record(block.callout) : undefined
      return iconAsset(data?.icon)
    }
    if (!sourceAssetId.startsWith("block:")) {
      return undefined
    }
    const blockId = sourceAssetId.slice("block:".length)
    const block = record(
      await this.#request(() => this.#client.blocks.retrieve({ block_id: blockId })),
    )
    const type = text(block?.type)
    if (type !== "image" && type !== "file") {
      return undefined
    }
    const data = record(block?.[type])
    const file = data?.type === "file" ? record(data.file) : undefined
    const url = safeHttpsUrl(file?.url)
    if (!url) {
      return undefined
    }
    const name = type === "file" ? text(data?.name) : undefined
    return { url, kind: type, ...(name ? { name } : {}) }
  }

  async getEmbeddedTablePage(
    sourceTableId: string,
    columns: readonly SourceEmbeddedColumn[],
    cursor: string | undefined,
    pageSize: number,
  ): Promise<SourceEmbeddedTablePage | undefined> {
    if (pageSize !== EMBEDDED_TABLE_PAGE_SIZE) return undefined
    const response = await this.#request(() =>
      this.#client.dataSources.query({
        data_source_id: sourceTableId,
        page_size: pageSize,
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
    )
    return {
      rows: embeddedRows(response.results, columns),
      nextCursor: response.next_cursor,
    }
  }

  #summary(page: UnknownRecord, database: ContentDatabaseConfig): SourceArticleSummary {
    const sourceId = text(page.id)
    const createdTime = text(page.created_time)
    const lastEditedTime = text(page.last_edited_time)
    if (!sourceId || !createdTime || !lastEditedTime) {
      throw new Error("Notion returned an incomplete page")
    }
    const titleProperty = findProperty(page, database.titlePropertyId)
    const title = titleProperty?.type === "title" ? plainText(titleProperty.title) : pageTitle(page)
    const icon = pageIcon(page)
    return {
      sourceId,
      sourceDataSourceId: database.sourceDataSourceId,
      title,
      ...(icon ? { icon } : {}),
      createdTime,
      lastEditedTime,
    }
  }

  async #properties(
    page: UnknownRecord,
    database: ContentDatabaseConfig,
    referenceCache: Map<string, Promise<SourceReference | undefined>>,
  ): Promise<Readonly<Record<string, SourceValue>>> {
    const result: Record<string, SourceValue> = {}
    const mappings = Object.values(database.variables)
    for (const mapping of mappings) {
      const property = findProperty(page, mapping.propertyId)
      if (!property) {
        continue
      }
      const type = text(property.type)
      if (type === "title" || type === "rich_text") {
        const value = plainText(property[type])
        if (value) result[mapping.propertyId] = { type: "string", value }
      } else if (type === "number" && typeof property.number === "number") {
        result[mapping.propertyId] = { type: "number", value: property.number }
      } else if (type === "checkbox" && typeof property.checkbox === "boolean") {
        result[mapping.propertyId] = { type: "boolean", value: property.checkbox }
      } else if (type === "date") {
        const date = record(property.date)
        const start = text(date?.start)
        if (start) {
          const endValue = date?.end === null ? null : text(date?.end)
          const zoneValue = date?.time_zone === null ? null : text(date?.time_zone)
          result[mapping.propertyId] = {
            type: "date",
            value: {
              start,
              ...(endValue !== undefined ? { end: endValue } : {}),
              ...(zoneValue !== undefined ? { timeZone: zoneValue } : {}),
            },
          }
        }
      } else if (type === "select" || type === "status") {
        const selected = record(property[type])
        const value = text(selected?.name)
        if (value) result[mapping.propertyId] = { type: "string", value }
      } else if (type === "multi_select" && Array.isArray(property.multi_select)) {
        result[mapping.propertyId] = {
          type: "string[]",
          value: property.multi_select.flatMap((entry) => {
            const name = text(record(entry)?.name)
            return name ? [name] : []
          }),
        }
      } else if (type === "relation" && Array.isArray(property.relation)) {
        const references = (
          await Promise.all(
            property.relation.flatMap((entry) => {
              const pageId = text(record(entry)?.id)
              return pageId ? [this.#reference(pageId, referenceCache)] : []
            }),
          )
        ).filter((entry): entry is SourceReference => entry !== undefined)
        if (mapping.type === "reference" && references.length === 1) {
          result[mapping.propertyId] = {
            type: "reference",
            value: references[0] as SourceReference,
          }
        } else if (references.length > 0 || mapping.type === "reference[]") {
          result[mapping.propertyId] = { type: "reference[]", value: references }
        }
      }
    }
    return result
  }

  #reference(
    pageId: string,
    cache: Map<string, Promise<SourceReference | undefined>>,
  ): Promise<SourceReference | undefined> {
    const cached = cache.get(pageId)
    if (cached) {
      return cached
    }
    const request = this.#client.pages
      .retrieve({ page_id: pageId })
      .then((value) => {
        const page = record(value)
        const sourceDataSourceId = page ? sourceParentId(page) : undefined
        if (!page || !sourceDataSourceId || !this.#allowedSourceIds.has(sourceDataSourceId)) {
          return undefined
        }
        const title = pageTitle(page)
        const icon = pageIcon(page)
        return {
          sourceId: pageId,
          sourceDataSourceId,
          title,
          ...(icon ? { icon } : {}),
        }
      })
      .catch(() => undefined)
    cache.set(pageId, request)
    return request
  }

  async #children(blockId: string): Promise<UnknownRecord[]> {
    const blocks: UnknownRecord[] = []
    let cursor: string | undefined
    do {
      const response = await this.#request(() =>
        this.#client.blocks.children.list({
          block_id: blockId,
          page_size: 100,
          ...(cursor ? { start_cursor: cursor } : {}),
        }),
      )
      blocks.push(
        ...response.results.flatMap((value) =>
          record(value) ? [record(value) as UnknownRecord] : [],
        ),
      )
      cursor = response.next_cursor ?? undefined
    } while (cursor)
    return blocks
  }

  async #blocks(
    pageId: string,
    depth = 0,
    budget: { count: number } = { count: 0 },
  ): Promise<readonly SourceBlock[]> {
    if (depth > MAX_BLOCK_DEPTH) throw new ContentAdapterError("unavailable")
    const source = await this.#children(pageId)
    budget.count += source.length
    if (budget.count > MAX_BLOCKS_PER_ARTICLE) throw new ContentAdapterError("unavailable")
    const result: SourceBlock[] = []
    for (const block of source) {
      const mapped = await this.#block(block, depth, budget)
      if (!mapped) {
        continue
      }
      const previous = result.at(-1)
      if (
        (mapped.type === "bulletedList" || mapped.type === "numberedList") &&
        previous?.type === mapped.type
      ) {
        result[result.length - 1] = { ...previous, items: [...previous.items, ...mapped.items] }
      } else {
        result.push(mapped)
      }
    }
    return result
  }

  async #embeddedDatabase(databaseId: string, fallbackTitle: string): Promise<SourceBlock> {
    const safeFallbackTitle = clipped(fallbackTitle, 240)
    let database: UnknownRecord | undefined
    try {
      database = record(
        await this.#request(() => this.#client.databases.retrieve({ database_id: databaseId })),
      )
    } catch {
      return {
        type: "embeddedDatabase",
        title: safeFallbackTitle,
        tables: [{ status: "unavailable", title: safeFallbackTitle }],
      }
    }
    const sources = Array.isArray(database?.data_sources) ? database.data_sources : []
    if (sources.length > 20) {
      return {
        type: "embeddedDatabase",
        title: safeFallbackTitle,
        tables: [{ status: "unavailable", title: safeFallbackTitle }],
      }
    }
    const tables: SourceEmbeddedTable[] = []
    for (const value of sources) {
      const source = record(value)
      const sourceTableId = text(source?.id)
      const title = clipped(text(source?.name) ?? safeFallbackTitle, 240)
      if (!sourceTableId) {
        tables.push({ status: "unavailable", title })
        continue
      }
      try {
        const schema = record(
          await this.#request(() =>
            this.#client.dataSources.retrieve({ data_source_id: sourceTableId }),
          ),
        )
        const properties = record(schema?.properties)
        const titlePropertyIds = new Set(
          Object.values(properties ?? {}).flatMap((propertyValue) => {
            const property = record(propertyValue)
            const sourcePropertyId = text(property?.id)
            return property?.type === "title" && sourcePropertyId ? [sourcePropertyId] : []
          }),
        )
        const columns = Object.entries(properties ?? {})
          .flatMap<SourceEmbeddedColumn>(([label, propertyValue]) => {
            const property = record(propertyValue)
            const sourcePropertyId = text(property?.id)
            return sourcePropertyId ? [{ sourcePropertyId, label: clipped(label, 240) }] : []
          })
          .sort((left, right) => {
            const leftTitle = titlePropertyIds.has(left.sourcePropertyId)
            const rightTitle = titlePropertyIds.has(right.sourcePropertyId)
            if (leftTitle && !rightTitle) return -1
            if (rightTitle && !leftTitle) return 1
            return left.label.localeCompare(right.label)
          })
        if (columns.length > 500) throw new Error("Embedded table has too many columns")
        const page = await this.getEmbeddedTablePage(
          sourceTableId,
          columns,
          undefined,
          EMBEDDED_TABLE_PAGE_SIZE,
        )
        tables.push(
          page
            ? {
                status: "available",
                sourceTableId,
                title,
                columns,
                rows: page.rows,
                nextCursor: page.nextCursor,
              }
            : { status: "unavailable", title },
        )
      } catch {
        tables.push({ status: "unavailable", title })
      }
    }
    return {
      type: "embeddedDatabase",
      title: safeFallbackTitle,
      tables: tables.length > 0 ? tables : [{ status: "unavailable", title: safeFallbackTitle }],
    }
  }

  async #block(
    block: UnknownRecord,
    depth: number,
    budget: { count: number },
  ): Promise<SourceBlock | undefined> {
    const type = text(block.type)
    const id = text(block.id)
    if (!type || !id) {
      return undefined
    }
    const data = record(block[type])
    if (!data) {
      return undefined
    }
    if (type.startsWith("heading_")) {
      const level = Number.parseInt(type.at(-1) ?? "2", 10) as 1 | 2 | 3
      return { type: "heading", level, content: richText(data.rich_text) }
    }
    if (type === "paragraph") return { type, content: richText(data.rich_text) }
    if (type === "quote") return { type, content: richText(data.rich_text) }
    if (type === "bulleted_list_item" || type === "numbered_list_item") {
      return {
        type: type === "bulleted_list_item" ? "bulletedList" : "numberedList",
        items: [richText(data.rich_text)],
      }
    }
    if (type === "callout") {
      const icon = notionIcon(data.icon, `block-icon:${id}`)
      const color = calloutColor(data.color)
      const children = boolean(block.has_children)
        ? await this.#blocks(id, depth + 1, budget)
        : undefined
      return {
        type: "callout",
        content: richText(data.rich_text),
        ...(icon ? { icon } : {}),
        ...(color ? { color } : {}),
        ...(children?.length ? { children } : {}),
      }
    }
    if (type === "code") {
      const language = text(data.language)
      return {
        type: "code",
        code: plainText(data.rich_text),
        ...(language ? { language } : {}),
        caption: richText(data.caption),
      }
    }
    if (type === "equation") {
      const expression = text(data.expression)
      return expression ? { type: "math", expression } : undefined
    }
    if (type === "image" && data.type === "file") {
      return { type: "image", sourceAssetId: `block:${id}`, caption: richText(data.caption) }
    }
    if (type === "file" && data.type === "file") {
      return { type: "file", sourceAssetId: `block:${id}`, name: text(data.name) ?? "file" }
    }
    if (type === "bookmark" || type === "link_preview") {
      const url = safeHttpsUrl(data.url)
      return url ? { type: "link", url, label: plainText(data.caption) || url } : undefined
    }
    if (type === "table") {
      const children = await this.#children(id)
      budget.count += children.length
      if (budget.count > MAX_BLOCKS_PER_ARTICLE) throw new ContentAdapterError("unavailable")
      const rows = children.flatMap((child) => {
        const rowData = child.type === "table_row" ? record(child.table_row) : undefined
        return Array.isArray(rowData?.cells) ? [rowData.cells.map((cell) => richText(cell))] : []
      })
      return {
        type: "table",
        rows,
        hasColumnHeader: boolean(data.has_column_header),
        hasRowHeader: boolean(data.has_row_header),
      }
    }
    if (type === "child_database") {
      return this.#embeddedDatabase(id, text(data.title) ?? "Database")
    }
    return undefined
  }
}
