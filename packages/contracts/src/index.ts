import { z } from "zod"

export const TemplateIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/)

const PresentationTextSchema = z.string().min(1).max(240)
const PresentationColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/)
const PresentationLocaleSchema = z
  .string()
  .min(2)
  .max(35)
  .refine((locale) => {
    try {
      return Intl.getCanonicalLocales(locale).length === 1
    } catch {
      return false
    }
  }, "Invalid locale")

export const HeaderFieldSchema = z
  .object({
    variable: z.string().min(1).max(64),
    label: z.string().min(1).max(80),
    width: z.enum(["third", "half", "full"]).default("half"),
    emphasis: z.enum(["normal", "strong"]).default("normal"),
    showIcon: z.boolean().default(true),
  })
  .strict()

const HeaderTitleSchema = z
  .object({
    placement: z.enum(["header", "content"]).default("content"),
    alignment: z.enum(["start", "center", "end"]).default("center"),
  })
  .strict()

const HeaderBaseShape = {
  name: z.string().min(1).max(80),
  title: HeaderTitleSchema,
  tone: z.enum(["flat", "panel", "accent"]).default("panel"),
  density: z.enum(["compact", "comfortable"]).default("comfortable"),
}

export const ArticleHeaderSchema = z.discriminatedUnion("renderer", [
  z
    .object({
      ...HeaderBaseShape,
      renderer: z.literal("field-grid"),
      fields: z.array(HeaderFieldSchema).max(12),
    })
    .strict(),
  z
    .object({
      ...HeaderBaseShape,
      renderer: z.literal("compact-emblem"),
      emblemVariable: z.string().min(1).max(64),
      headlineVariable: z.string().min(1).max(64),
      headlineLabel: z.string().min(1).max(80).default("Code name"),
      headlineFallback: z.literal("title").default("title"),
      caption: z.string().min(1).max(120).optional(),
      fields: z.array(HeaderFieldSchema).max(6),
    })
    .strict(),
  z
    .object({
      ...HeaderBaseShape,
      renderer: z.literal("cactus-study"),
      headlineVariable: z.string().min(1).max(64),
      headlineLabel: z.string().min(1).max(80).default("Code name"),
      headlineFallback: z.literal("title").default("title"),
      seriesMark: z.string().min(1).max(4).default("Ⅶ"),
      seriesLabel: z.string().min(1).max(80).default("Reference file"),
      caption: z.string().min(1).max(120).optional(),
      fields: z.array(HeaderFieldSchema).max(3),
    })
    .strict(),
])

const defaultMessages = {
  navHome: "Home",
  navSearch: "Search",
  navLogout: "Logout",
  loginEyebrow: "Private library",
  loginTitle: "Notion Reader",
  loginPrompt: "Reader password を入力してください。",
  passwordLabel: "Password",
  loginButton: "Login",
  loginPending: "Signing in…",
  homeEyebrow: "Personal reference",
  homeTitle: "Your Notion, shaped for reading.",
  homeDescription: "許可された Database を read-only で表示します。",
  librariesHeading: "Libraries",
  databaseEyebrow: "Database",
  templatesSuffix: "templates",
  recentHeading: "Recently read",
  clearRecent: "Clear",
  emptyRecent: "最近読んだ記事はありません。",
  libraryEyebrow: "Library",
  backHome: "← Home",
  backLibrary: "← Library",
  loadMore: "Load more",
  loading: "Loading…",
  emptyLibrary: "記事がありません。",
  searchEyebrow: "Registered databases only",
  searchTitle: "Title & property search",
  searchDescription: "本文全文検索ではありません。",
  searchPlaceholder: "Title",
  searchInputLabel: "Title search",
  searchButton: "Search",
  tagFilterLabel: "Tag",
  emptySearch: "該当する記事はありません。",
  templateLabel: "Template",
  demoTitle: "Explore the Reader demo",
  demoDescription: "公開用のダミーデータだけを使用する静的デモです。",
  demoStart: "デモを開始",
  demoBadge: "Demo data",
  demoExit: "Exit demo",
} as const

const PresentationMessagesSchema = z
  .object(
    Object.fromEntries(
      Object.entries(defaultMessages).map(([key, value]) => [
        key,
        PresentationTextSchema.default(value),
      ]),
    ) as { [Key in keyof typeof defaultMessages]: z.ZodDefault<typeof PresentationTextSchema> },
  )
  .strict()

const defaultColors = {
  background: "#0b0d10",
  panel: "#11151b",
  panelAlt: "#171c24",
  line: "#2a313c",
  text: "#edf2f7",
  muted: "#98a2b3",
  accent: "#d8ff5f",
  accentSecondary: "#7cecff",
  danger: "#ff7a90",
} as const

const lightColors = {
  background: "#f5f7fa",
  panel: "#ffffff",
  panelAlt: "#ebeff4",
  line: "#cbd5e1",
  text: "#17202c",
  muted: "#475569",
  accent: "#365314",
  accentSecondary: "#075985",
  danger: "#b4233d",
} as const

const PresentationThemeSchema = z
  .object({
    colorScheme: z.enum(["dark", "light"]).default("dark"),
    colors: z
      .object(
        Object.fromEntries(
          Object.entries(defaultColors).map(([key, value]) => [
            key,
            PresentationColorSchema.default(value),
          ]),
        ) as { [Key in keyof typeof defaultColors]: z.ZodDefault<typeof PresentationColorSchema> },
      )
      .strict()
      .default(defaultColors),
  })
  .strict()

const defaultArticleHeaders = {
  simple: {
    name: "Simple",
    renderer: "field-grid",
    title: { placement: "content", alignment: "center" },
    tone: "panel",
    density: "comfortable",
    fields: [
      { variable: "mainClass", label: "Main-class", width: "third" },
      { variable: "subClass", label: "Sub-class", width: "third" },
      { variable: "codeName", label: "Code name", width: "third", emphasis: "strong" },
    ],
  },
  "compact-emblem": {
    name: "Compact Emblem",
    renderer: "compact-emblem",
    title: { placement: "content", alignment: "center" },
    tone: "panel",
    density: "compact",
    emblemVariable: "mainClass",
    headlineVariable: "codeName",
    headlineLabel: "Code name",
    headlineFallback: "title",
    fields: [
      { variable: "mainClass", label: "Main-class", width: "half" },
      { variable: "subClass", label: "Sub-class", width: "half" },
    ],
  },
  "cactus-study": {
    name: "Cactus Study",
    renderer: "cactus-study",
    title: { placement: "content", alignment: "center" },
    tone: "panel",
    density: "comfortable",
    headlineVariable: "codeName",
    headlineLabel: "Code name",
    headlineFallback: "title",
    seriesMark: "Ⅶ",
    seriesLabel: "Reference file",
    caption: "Classification record",
    fields: [
      { variable: "mainClass", label: "Main-class", width: "half" },
      { variable: "subClass", label: "Sub-class", width: "half" },
      { variable: "tags", label: "Tag", width: "half", showIcon: false },
    ],
  },
} as const

const PresentationBrandSchema = z
  .object({
    name: z.string().min(1).max(80).default("Notion Reader"),
    shortName: z.string().min(1).max(32).default("Reader"),
    eyebrow: PresentationTextSchema.default("Personal reference"),
    tagline: PresentationTextSchema.default("Your Notion, shaped for reading."),
  })
  .strict()

const PresentationInputObjectSchema = z
  .object({
    version: z.literal(1).default(1),
    locale: PresentationLocaleSchema.default("ja-JP"),
    brand: PresentationBrandSchema.partial().optional(),
    theme: z
      .object({
        colorScheme: z.enum(["dark", "light"]).optional(),
        colors: PresentationThemeSchema.shape.colors.removeDefault().partial().optional(),
      })
      .strict()
      .optional(),
    messages: PresentationMessagesSchema.partial().optional(),
    articleHeaders: z.record(TemplateIdSchema, ArticleHeaderSchema).optional(),
  })
  .strict()

export const PresentationConfigSchema = z
  .object({
    version: z.literal(1),
    locale: PresentationLocaleSchema,
    brand: PresentationBrandSchema,
    theme: PresentationThemeSchema,
    messages: PresentationMessagesSchema,
    articleHeaders: z.record(TemplateIdSchema, ArticleHeaderSchema),
  })
  .strict()

export const defaultPresentation = PresentationConfigSchema.parse({
  version: 1,
  locale: "ja-JP",
  brand: {},
  theme: { colors: defaultColors },
  messages: {},
  articleHeaders: defaultArticleHeaders,
})

export const PresentationInputSchema = PresentationInputObjectSchema.transform((value) =>
  PresentationConfigSchema.parse({
    version: value.version,
    locale: value.locale,
    brand: { ...defaultPresentation.brand, ...value.brand },
    theme: {
      colorScheme: value.theme?.colorScheme ?? defaultPresentation.theme.colorScheme,
      colors: {
        ...(value.theme?.colorScheme === "light" ? lightColors : defaultPresentation.theme.colors),
        ...value.theme?.colors,
      },
    },
    messages: { ...defaultPresentation.messages, ...value.messages },
    articleHeaders: { ...defaultPresentation.articleHeaders, ...value.articleHeaders },
  }),
)

export const ReaderIdSchema = z.string().min(8).max(128)

export const ReaderCursorSchema = z.string().regex(/^cur_[A-Za-z0-9_-]{43}$/)

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

export const RichTextTextSchema = z.object({
  text: z.string(),
  href: z.url().nullable().optional(),
  annotations: RichTextAnnotationSchema.optional(),
})

export const RichTextEquationSchema = z.object({
  type: z.literal("equation"),
  expression: z.string(),
  text: z.string(),
})

export const RichTextSchema = z.union([RichTextEquationSchema, RichTextTextSchema])

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
  titleRichText: z.array(RichTextSchema),
  variables: z.record(z.string(), ReaderValueSchema),
  blocks: z.array(ArticleBlockSchema),
  defaultTemplate: z.string(),
  templates: z.array(z.string()).min(1),
})

export const ArticlePageSchema = z.object({
  items: z.array(ArticleSummarySchema),
  nextCursor: ReaderCursorSchema.nullable(),
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

const SearchFilterFieldSchema = z.string().min(1).max(64)
const SearchFilterStringValueSchema = z.string().min(1)
const SearchFilterDateValueSchema = z.union([z.iso.date(), z.iso.datetime({ offset: true })])

export const SearchFilterSchema = z.discriminatedUnion("operator", [
  z
    .object({
      fieldId: SearchFilterFieldSchema,
      operator: z.literal("isEmpty"),
      value: z.never().optional(),
    })
    .strict(),
  z
    .object({
      fieldId: SearchFilterFieldSchema,
      operator: z.literal("equals"),
      value: z.union([SearchFilterStringValueSchema, z.number().finite(), z.boolean()]),
    })
    .strict(),
  z
    .object({
      fieldId: SearchFilterFieldSchema,
      operator: z.literal("contains"),
      value: SearchFilterStringValueSchema,
    })
    .strict(),
  z
    .object({
      fieldId: SearchFilterFieldSchema,
      operator: z.enum(["greaterThan", "greaterThanOrEqual", "lessThan", "lessThanOrEqual"]),
      value: z.number().finite(),
    })
    .strict(),
  z
    .object({
      fieldId: SearchFilterFieldSchema,
      operator: z.enum(["before", "after"]),
      value: SearchFilterDateValueSchema,
    })
    .strict(),
])

export const SearchRequestSchema = z.object({
  query: z.string().trim().max(200).optional(),
  databaseIds: z.array(ReaderIdSchema).max(20).optional(),
  filters: z.array(SearchFilterSchema).max(20).default([]),
  cursor: ReaderCursorSchema.optional(),
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

export const PresentationResponseSchema = PresentationConfigSchema

const DemoIdSchema = z.string().regex(/^demo_[a-z0-9_-]{3,120}$/)
const DemoAssetPathSchema = z
  .string()
  .min(1)
  .max(240)
  .refine(
    (value) => !value.startsWith("/") && !value.includes("..") && !value.includes(":"),
    "Demo asset paths must be safe relative paths",
  )

export const DemoArticleSchema = ArticleSchema.extend({
  id: DemoIdSchema,
  databaseId: DemoIdSchema,
}).strict()

export const DemoDatabaseSchema = DatabaseSummarySchema.extend({ id: DemoIdSchema }).strict()

export const DemoManifestSchema = z
  .object({
    presentation: z.unknown(),
    databases: z.unknown(),
    articleFiles: z.array(z.string().min(1)).min(1).max(200),
    assets: z.unknown(),
  })
  .strict()

export const DemoDatasetSchema = z
  .object({
    presentation: PresentationInputSchema,
    databases: z.array(DemoDatabaseSchema).min(1).max(20),
    articles: z.array(DemoArticleSchema).min(1).max(200),
    assets: z.record(DemoIdSchema, DemoAssetPathSchema).default({}),
  })
  .strict()
  .superRefine((value, context) => {
    const databaseIds = new Set<string>()
    const databaseById = new Map(value.databases.map((database) => [database.id, database]))
    for (const [index, database] of value.databases.entries()) {
      if (databaseIds.has(database.id)) {
        context.addIssue({
          code: "custom",
          path: ["databases", index, "id"],
          message: "Duplicate demo database ID",
        })
      }
      databaseIds.add(database.id)
      if (!database.templates.includes(database.defaultTemplate)) {
        context.addIssue({
          code: "custom",
          path: ["databases", index, "defaultTemplate"],
          message: "Default template must be allowed",
        })
      }
      for (const templateId of database.templates) {
        if (!value.presentation.articleHeaders[templateId]) {
          context.addIssue({
            code: "custom",
            path: ["databases", index, "templates"],
            message: "Demo template is not configured",
          })
        }
      }
    }
    const articleIds = new Set<string>()
    const validateAssetIcon = (icon: ReaderIcon | undefined, path: (string | number)[]) => {
      if (icon?.kind === "asset" && !value.assets[icon.assetId]) {
        context.addIssue({ code: "custom", path, message: "Demo icon asset mapping is missing" })
      }
    }
    for (const [index, article] of value.articles.entries()) {
      if (articleIds.has(article.id)) {
        context.addIssue({
          code: "custom",
          path: ["articles", index, "id"],
          message: "Duplicate demo article ID",
        })
      }
      articleIds.add(article.id)
      const database = databaseById.get(article.databaseId)
      if (!database) {
        context.addIssue({
          code: "custom",
          path: ["articles", index, "databaseId"],
          message: "Demo article database is unknown",
        })
      }
      if (!article.templates.includes(article.defaultTemplate)) {
        context.addIssue({
          code: "custom",
          path: ["articles", index, "defaultTemplate"],
          message: "Demo article default template must be allowed",
        })
      }
      validateAssetIcon(article.icon, ["articles", index, "icon"])
      for (const [variableName, variable] of Object.entries(article.variables)) {
        const references =
          variable.type === "reference"
            ? [variable.value]
            : variable.type === "reference[]"
              ? variable.value
              : []
        for (const reference of references) {
          if (!DemoIdSchema.safeParse(reference.readerId).success) {
            context.addIssue({
              code: "custom",
              path: ["articles", index, "variables", variableName],
              message: "Demo reference ID must use the demo_ prefix",
            })
          }
          validateAssetIcon(reference.icon, ["articles", index, "variables", variableName])
        }
      }
      for (const templateId of article.templates) {
        if (!value.presentation.articleHeaders[templateId]) {
          context.addIssue({
            code: "custom",
            path: ["articles", index, "templates"],
            message: "Demo article template is unknown",
          })
        }
        if (database && !database.templates.includes(templateId)) {
          context.addIssue({
            code: "custom",
            path: ["articles", index, "templates"],
            message: "Demo article template is not allowed by its database",
          })
        }
      }
      for (const block of article.blocks) {
        if ((block.type === "image" || block.type === "file") && !value.assets[block.assetId]) {
          context.addIssue({
            code: "custom",
            path: ["articles", index, "blocks"],
            message: "Demo asset mapping is missing",
          })
        }
        if (block.type === "callout") {
          validateAssetIcon(block.icon, ["articles", index, "blocks"])
        }
      }
    }
  })

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
  }),
})

export type ReaderIcon = z.infer<typeof ReaderIconSchema>
export type ReaderCursor = z.infer<typeof ReaderCursorSchema>
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
export type TemplateId = z.infer<typeof TemplateIdSchema>
export type HeaderField = z.infer<typeof HeaderFieldSchema>
export type ArticleHeader = z.infer<typeof ArticleHeaderSchema>
export type PresentationConfig = z.infer<typeof PresentationConfigSchema>
export type PresentationResponse = z.infer<typeof PresentationResponseSchema>
export type DemoDataset = z.infer<typeof DemoDatasetSchema>
