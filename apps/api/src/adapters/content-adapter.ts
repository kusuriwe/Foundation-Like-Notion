import type { FilterOperator, ReaderDate, RichText } from "@foundation-like-notion/contracts"
import type { ContentDatabaseConfig } from "../config.js"

export type ContentAdapterErrorCategory = "not_found" | "rate_limited" | "timeout" | "unavailable"

/**
 * Represent a backend-neutral upstream content failure.
 * backend に依存しない upstream content failure を表します。
 */
export class ContentAdapterError extends Error {
  readonly category: ContentAdapterErrorCategory

  constructor(category: ContentAdapterErrorCategory) {
    super(`Content adapter failed: ${category}`)
    this.name = "ContentAdapterError"
    this.category = category
  }
}

export type SourceIcon =
  | Readonly<{ kind: "emoji"; value: string }>
  | Readonly<{ kind: "asset"; sourceAssetId: string }>

export type SourceReference = Readonly<{
  sourceId: string
  sourceDataSourceId?: string
  title: string
  icon?: SourceIcon
}>

export type SourceValue =
  | Readonly<{ type: "string"; value: string }>
  | Readonly<{ type: "string[]"; value: readonly string[] }>
  | Readonly<{ type: "number"; value: number }>
  | Readonly<{ type: "boolean"; value: boolean }>
  | Readonly<{ type: "date"; value: ReaderDate }>
  | Readonly<{ type: "reference"; value: SourceReference }>
  | Readonly<{ type: "reference[]"; value: readonly SourceReference[] }>

export type SourceBlock =
  | Readonly<{ type: "heading"; level: 1 | 2 | 3; content: readonly RichText[] }>
  | Readonly<{ type: "paragraph"; content: readonly RichText[] }>
  | Readonly<{
      type: "bulletedList" | "numberedList"
      items: readonly (readonly RichText[])[]
    }>
  | Readonly<{ type: "quote"; content: readonly RichText[] }>
  | Readonly<{ type: "callout"; content: readonly RichText[]; icon?: SourceIcon }>
  | Readonly<{
      type: "code"
      code: string
      language?: string
      caption: readonly RichText[]
    }>
  | Readonly<{
      type: "table"
      rows: readonly (readonly (readonly RichText[])[])[]
      hasColumnHeader: boolean
      hasRowHeader: boolean
    }>
  | Readonly<{ type: "image"; sourceAssetId: string; caption: readonly RichText[] }>
  | Readonly<{ type: "math"; expression: string }>
  | Readonly<{ type: "file"; sourceAssetId: string; name: string }>
  | Readonly<{ type: "link"; url: string; label: string }>

export type SourceArticleSummary = Readonly<{
  sourceId: string
  sourceDataSourceId: string
  title: string
  icon?: SourceIcon
  createdTime: string
  lastEditedTime: string
}>

export type SourceArticle = SourceArticleSummary &
  Readonly<{
    properties: Readonly<Record<string, SourceValue>>
    blocks: readonly SourceBlock[]
  }>

export type SourceFilter = Readonly<{
  propertyId: string
  type: string
  sourceType:
    | "title"
    | "rich_text"
    | "select"
    | "status"
    | "multi_select"
    | "checkbox"
    | "number"
    | "date"
    | "relation"
  operator: FilterOperator
  value?: string | number | boolean
}>

export type SourceQuery = Readonly<{
  query?: string
  filters?: readonly SourceFilter[]
  cursor?: string
  pageSize: number
}>

export type SourcePage = Readonly<{
  items: readonly SourceArticleSummary[]
  nextCursor: string | null
}>

export type SourceAsset = Readonly<{
  url: string
  kind: "image" | "file"
  name?: string
}>

export interface ContentAdapter {
  listArticles(database: ContentDatabaseConfig, query: SourceQuery): Promise<SourcePage>
  getArticle(
    database: ContentDatabaseConfig,
    sourcePageId: string,
  ): Promise<SourceArticle | undefined>
  getAsset(sourceAssetId: string): Promise<SourceAsset | undefined>
}
