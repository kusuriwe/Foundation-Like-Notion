import { z } from "zod"

export const ReaderIdSchema = z.string().min(8).max(128)

export const ReaderIconSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("emoji"), value: z.string().min(1).max(16) }),
  z.object({ kind: z.literal("asset"), assetId: ReaderIdSchema }),
])

export const ReferenceSchema = z.object({
  readerId: ReaderIdSchema,
  title: z.string(),
  icon: ReaderIconSchema.optional(),
})

export const ReaderDateSchema = z.object({
  start: z.union([z.iso.date(), z.iso.datetime({ offset: true })]),
  end: z
    .union([z.iso.date(), z.iso.datetime({ offset: true })])
    .nullable()
    .optional(),
  timeZone: z.string().nullable().optional(),
})

export const ReaderValueSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("string"), value: z.string() }),
  z.object({ type: z.literal("string[]"), value: z.array(z.string()) }),
  z.object({ type: z.literal("number"), value: z.number().finite() }),
  z.object({ type: z.literal("boolean"), value: z.boolean() }),
  z.object({ type: z.literal("date"), value: ReaderDateSchema }),
  z.object({ type: z.literal("reference"), value: ReferenceSchema }),
  z.object({ type: z.literal("reference[]"), value: z.array(ReferenceSchema) }),
])

export const RichTextAnnotationSchema = z.object({
  bold: z.boolean().default(false),
  italic: z.boolean().default(false),
  strikethrough: z.boolean().default(false),
  underline: z.boolean().default(false),
  code: z.boolean().default(false),
})

export const RichTextSchema = z.object({
  text: z.string(),
  href: z.url().nullable().optional(),
  annotations: RichTextAnnotationSchema.optional(),
})

const TextBlockSchema = z.object({ content: z.array(RichTextSchema) })

export const ArticleBlockSchema = z.discriminatedUnion("type", [
  TextBlockSchema.extend({
    type: z.literal("heading"),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  }),
  TextBlockSchema.extend({ type: z.literal("paragraph") }),
  z.object({
    type: z.union([z.literal("bulletedList"), z.literal("numberedList")]),
    items: z.array(z.array(RichTextSchema)),
  }),
  TextBlockSchema.extend({ type: z.literal("quote") }),
  TextBlockSchema.extend({
    type: z.literal("callout"),
    icon: ReaderIconSchema.optional(),
  }),
  z.object({
    type: z.literal("code"),
    code: z.string(),
    language: z.string().optional(),
    caption: z.array(RichTextSchema).default([]),
  }),
  z.object({
    type: z.literal("table"),
    rows: z.array(z.array(z.array(RichTextSchema))),
    hasColumnHeader: z.boolean(),
    hasRowHeader: z.boolean(),
  }),
  z.object({
    type: z.literal("image"),
    assetId: ReaderIdSchema,
    caption: z.array(RichTextSchema).default([]),
  }),
  z.object({ type: z.literal("math"), expression: z.string() }),
  z.object({
    type: z.literal("file"),
    assetId: ReaderIdSchema,
    name: z.string(),
  }),
  z.object({
    type: z.literal("link"),
    url: z.url(),
    label: z.string(),
  }),
])

export const DatabaseSummarySchema = z.object({
  id: ReaderIdSchema,
  name: z.string(),
  defaultTemplate: z.string(),
  templates: z.array(z.string()).min(1),
})

export const ArticleSummarySchema = z.object({
  id: ReaderIdSchema,
  databaseId: ReaderIdSchema,
  title: z.string(),
  icon: ReaderIconSchema.optional(),
  createdTime: z.iso.datetime({ offset: true }),
  lastEditedTime: z.iso.datetime({ offset: true }),
})

export const ArticleSchema = ArticleSummarySchema.extend({
  variables: z.record(z.string(), ReaderValueSchema),
  blocks: z.array(ArticleBlockSchema),
  defaultTemplate: z.string(),
  templates: z.array(z.string()).min(1),
})

export const ArticlePageSchema = z.object({
  items: z.array(ArticleSummarySchema),
  nextCursor: z.string().nullable(),
})

export const FilterOperatorSchema = z.enum([
  "equals",
  "contains",
  "isEmpty",
  "greaterThan",
  "greaterThanOrEqual",
  "lessThan",
  "lessThanOrEqual",
  "before",
  "after",
])

export const SearchFilterSchema = z.object({
  fieldId: z.string().min(1).max(64),
  operator: FilterOperatorSchema,
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
})

export const SearchRequestSchema = z.object({
  query: z.string().trim().max(200).optional(),
  databaseIds: z.array(ReaderIdSchema).max(20).optional(),
  filters: z.array(SearchFilterSchema).max(20).default([]),
  cursor: z.string().max(512).optional(),
  pageSize: z.number().int().min(1).max(100).default(20),
})

export const SessionRequestSchema = z.object({
  password: z.string().min(1).max(1024),
})

export const SessionResponseSchema = z.object({ authenticated: z.boolean() })

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  source: z.enum(["fixture", "notion"]),
})

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
  }),
})

export type ReaderIcon = z.infer<typeof ReaderIconSchema>
export type Reference = z.infer<typeof ReferenceSchema>
export type ReaderDate = z.infer<typeof ReaderDateSchema>
export type ReaderValue = z.infer<typeof ReaderValueSchema>
export type RichText = z.infer<typeof RichTextSchema>
export type ArticleBlock = z.infer<typeof ArticleBlockSchema>
export type DatabaseSummary = z.infer<typeof DatabaseSummarySchema>
export type ArticleSummary = z.infer<typeof ArticleSummarySchema>
export type Article = z.infer<typeof ArticleSchema>
export type ArticlePage = z.infer<typeof ArticlePageSchema>
export type FilterOperator = z.infer<typeof FilterOperatorSchema>
export type SearchFilter = z.infer<typeof SearchFilterSchema>
export type SearchRequest = z.infer<typeof SearchRequestSchema>
export type SessionRequest = z.infer<typeof SessionRequestSchema>
export type SessionResponse = z.infer<typeof SessionResponseSchema>
export type HealthResponse = z.infer<typeof HealthResponseSchema>
export type ApiError = z.infer<typeof ApiErrorSchema>
