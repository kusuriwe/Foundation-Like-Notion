import { readFile } from "node:fs/promises"
import path from "node:path"
import {
  FilterOperatorSchema,
  PresentationInputSchema,
  TemplateIdSchema,
  defaultPresentation,
  type ArticleHeader,
  type PresentationConfig,
} from "@foundation-like-notion/contracts"
import yaml from "js-yaml"
import { z } from "zod"

const VariableTypeSchema = z.enum([
  "string",
  "string[]",
  "number",
  "boolean",
  "date",
  "reference",
  "reference[]",
])

const propertyLocatorShape = {
  propertyId: z.string().min(1).optional(),
  propertyName: z.string().min(1).optional(),
}

function validatePropertyLocator(
  value: { propertyId?: string | undefined; propertyName?: string | undefined },
  context: z.RefinementCtx,
): void {
  if ((value.propertyId === undefined) === (value.propertyName === undefined)) {
    context.addIssue({
      code: "custom",
      message: "Exactly one of propertyId or propertyName is required",
    })
  }
}

const VariableMappingSchema = z
  .object({
    propertyId: z.string().min(1),
    type: VariableTypeSchema,
    required: z.boolean().default(false),
    fallback: z.string().optional(),
  })
  .strict()

const VariableMappingInputSchema = z
  .object({
    ...propertyLocatorShape,
    type: VariableTypeSchema,
    required: z.boolean().default(false),
    fallback: z.string().optional(),
  })
  .strict()
  .superRefine(validatePropertyLocator)

const FilterMappingSchema = z
  .object({
    propertyId: z.string().min(1),
    type: VariableTypeSchema,
    sourceType: z.enum([
      "title",
      "rich_text",
      "select",
      "status",
      "multi_select",
      "checkbox",
      "number",
      "date",
      "relation",
    ]),
    operators: z.array(FilterOperatorSchema).min(1),
  })
  .strict()

const FilterMappingInputSchema = z
  .object({
    ...propertyLocatorShape,
    type: VariableTypeSchema,
    sourceType: z.enum([
      "title",
      "rich_text",
      "select",
      "status",
      "multi_select",
      "checkbox",
      "number",
      "date",
      "relation",
    ]),
    operators: z.array(FilterOperatorSchema).min(1),
  })
  .strict()
  .superRefine(validatePropertyLocator)

const SortSchema = z
  .object({
    field: z.string().min(1),
    direction: z.enum(["ascending", "descending"]),
  })
  .strict()

const filterOperatorsBySource = {
  title: ["equals", "contains", "isEmpty"],
  rich_text: ["equals", "contains", "isEmpty"],
  select: ["equals", "isEmpty"],
  status: ["equals", "isEmpty"],
  multi_select: ["contains", "isEmpty"],
  checkbox: ["equals"],
  number: ["equals", "greaterThan", "greaterThanOrEqual", "lessThan", "lessThanOrEqual", "isEmpty"],
  date: ["equals", "before", "after", "isEmpty"],
  relation: ["equals", "contains", "isEmpty"],
} as const

const readerTypesByFilterSource = {
  title: ["string"],
  rich_text: ["string"],
  select: ["string"],
  status: ["string"],
  multi_select: ["string[]"],
  checkbox: ["boolean"],
  number: ["number"],
  date: ["date"],
  relation: ["reference", "reference[]"],
} as const

function validateDatabaseMappings(
  value: {
    variables: Record<
      string,
      { type: z.infer<typeof VariableTypeSchema>; fallback?: string | undefined }
    >
    filters: Record<
      string,
      {
        type: z.infer<typeof VariableTypeSchema>
        sourceType: keyof typeof filterOperatorsBySource
        operators: readonly z.infer<typeof FilterOperatorSchema>[]
      }
    >
    sort: readonly { field: string }[]
  },
  context: z.RefinementCtx,
): void {
  for (const [variable, mapping] of Object.entries(value.variables)) {
    if (mapping.fallback !== undefined && mapping.type !== "string") {
      context.addIssue({
        code: "custom",
        path: ["variables", variable, "fallback"],
        message: "Fallback is supported only for string variables",
      })
    }
  }
  for (const [field, mapping] of Object.entries(value.filters)) {
    const allowed = filterOperatorsBySource[mapping.sourceType] as readonly string[]
    const allowedTypes = readerTypesByFilterSource[mapping.sourceType] as readonly string[]
    if (!allowedTypes.includes(mapping.type)) {
      context.addIssue({
        code: "custom",
        path: ["filters", field, "type"],
        message: `Reader type ${mapping.type} is not valid for ${mapping.sourceType}`,
      })
    }
    for (const [index, operator] of mapping.operators.entries()) {
      if (!allowed.includes(operator)) {
        context.addIssue({
          code: "custom",
          path: ["filters", field, "operators", index],
          message: `Operator ${operator} is not valid for ${mapping.sourceType}`,
        })
      }
    }
  }
  for (const [index, sort] of value.sort.entries()) {
    if (
      sort.field !== "created_time" &&
      sort.field !== "last_edited_time" &&
      !value.variables[sort.field] &&
      !value.filters[sort.field]
    ) {
      context.addIssue({
        code: "custom",
        path: ["sort", index, "field"],
        message: "Sort field must be a timestamp or configured Reader field",
      })
    }
  }
}

export const ContentDatabaseConfigSchema = z
  .object({
    id: z.string().min(8).max(128),
    name: z.string().min(1).max(200),
    sourceDataSourceId: z.string().min(1),
    titlePropertyId: z.string().min(1),
    defaultTemplate: z.string().min(1),
    templates: z.array(TemplateIdSchema).min(1),
    sort: z
      .array(SortSchema)
      .min(1)
      .default([{ field: "created_time", direction: "ascending" }]),
    variables: z.record(z.string(), VariableMappingSchema),
    filters: z.record(z.string(), FilterMappingSchema).default({}),
  })
  .strict()
  .superRefine(validateDatabaseMappings)

export const ContentDatabaseConfigInputSchema = z
  .object({
    id: z.string().min(8).max(128),
    name: z.string().min(1).max(200),
    sourceDataSourceId: z.string().min(1),
    titlePropertyId: z.string().min(1).optional(),
    titlePropertyName: z.string().min(1).optional(),
    defaultTemplate: z.string().min(1),
    templates: z.array(TemplateIdSchema).min(1),
    sort: z
      .array(SortSchema)
      .min(1)
      .default([{ field: "created_time", direction: "ascending" }]),
    variables: z.record(z.string(), VariableMappingInputSchema),
    filters: z.record(z.string(), FilterMappingInputSchema).default({}),
  })
  .strict()
  .superRefine((value, context) => {
    validatePropertyLocator(
      { propertyId: value.titlePropertyId, propertyName: value.titlePropertyName },
      context,
    )
    validateDatabaseMappings(value, context)
  })

export const ReaderConfigSchema = z
  .object({
    version: z.literal(1),
    source: z.enum(["fixture", "notion"]),
    contentDatabases: z.array(ContentDatabaseConfigSchema).min(1),
    relationSources: z.array(z.string().min(1)).default([]),
    presentation: PresentationInputSchema.optional().transform(
      (presentation) => presentation ?? defaultPresentation,
    ),
  })
  .strict()
  .superRefine(validateReaderDatabases)

function validateReaderDatabases(
  value: {
    source: "fixture" | "notion"
    contentDatabases: readonly z.infer<typeof ContentDatabaseConfigInputSchema>[]
    presentation: PresentationConfig
  },
  context: z.RefinementCtx,
): void {
  const ids = new Set<string>()
  const sourceIds = new Set<string>()
  for (const [index, database] of value.contentDatabases.entries()) {
    if (ids.has(database.id)) {
      context.addIssue({
        code: "custom",
        path: ["contentDatabases", index, "id"],
        message: "Database reader IDs must be unique",
      })
    }
    if (sourceIds.has(database.sourceDataSourceId)) {
      context.addIssue({
        code: "custom",
        path: ["contentDatabases", index, "sourceDataSourceId"],
        message: "Content data source IDs must be unique",
      })
    }
    if (!database.templates.includes(database.defaultTemplate)) {
      context.addIssue({
        code: "custom",
        path: ["contentDatabases", index, "defaultTemplate"],
        message: "Default template must be listed in templates",
      })
    }
    for (const [templateIndex, templateId] of database.templates.entries()) {
      const header = value.presentation.articleHeaders[templateId]
      if (!header) {
        context.addIssue({
          code: "custom",
          path: ["contentDatabases", index, "templates", templateIndex],
          message: "Template must reference a configured article header",
        })
        continue
      }
      for (const variable of headerVariables(header)) {
        const optionalBuiltInVariable =
          (templateId === "simple" ||
            templateId === "compact-emblem" ||
            templateId === "cactus-study") &&
          JSON.stringify(header) ===
            JSON.stringify(defaultPresentation.articleHeaders[templateId]) &&
          ["mainClass", "subClass", "codeName", "tags"].includes(variable)
        if (!database.variables[variable] && !optionalBuiltInVariable) {
          context.addIssue({
            code: "custom",
            path: ["contentDatabases", index, "templates", templateIndex],
            message: "Article header references an unknown Reader variable",
          })
        }
      }
    }
    if (value.source === "fixture") {
      const hasNamedMapping =
        database.titlePropertyName !== undefined ||
        Object.values(database.variables).some((mapping) => mapping.propertyName !== undefined) ||
        Object.values(database.filters).some((mapping) => mapping.propertyName !== undefined)
      if (hasNamedMapping) {
        context.addIssue({
          code: "custom",
          path: ["contentDatabases", index],
          message: "Fixture configuration requires Property IDs",
        })
      }
    }
    ids.add(database.id)
    sourceIds.add(database.sourceDataSourceId)
  }
}

export const ReaderConfigInputSchema = z
  .object({
    version: z.literal(1),
    source: z.enum(["fixture", "notion"]),
    contentDatabases: z.array(ContentDatabaseConfigInputSchema).min(1),
    relationSources: z.array(z.string().min(1)).default([]),
    presentation: PresentationInputSchema.optional().transform(
      (presentation) => presentation ?? defaultPresentation,
    ),
  })
  .strict()
  .superRefine(validateReaderDatabases)

export type ReaderConfig = z.infer<typeof ReaderConfigSchema>
export type ReaderConfigInput = z.infer<typeof ReaderConfigInputSchema>
export type ContentDatabaseConfig = z.infer<typeof ContentDatabaseConfigSchema>
export type ContentDatabaseConfigInput = z.infer<typeof ContentDatabaseConfigInputSchema>
export type VariableMapping = z.infer<typeof VariableMappingSchema>

function headerVariables(header: ArticleHeader): readonly string[] {
  const fields = header.fields.map((field) => field.variable)
  if (header.renderer === "compact-emblem") {
    return [...fields, header.emblemVariable, header.headlineVariable]
  }
  if (header.renderer === "cactus-study") return [...fields, header.headlineVariable]
  return fields
}

export type RuntimeConfig = Readonly<{
  reader: ReaderConfig
  environment: "development" | "test" | "production"
  host: string
  port: number
  databasePath: string
  passwordHash: string
  notionToken?: string
  serveWeb: boolean
}>

export type RuntimeConfigInput = Omit<RuntimeConfig, "reader"> &
  Readonly<{ reader: ReaderConfigInput }>

/**
 * Load and strictly validate the Reader YAML configuration.
 * Reader YAML 設定を読み込み、厳格に検証します。
 *
 * Args:
 *   filePath: YAML file path.
 *
 * Returns:
 *   Validated immutable configuration.
 *
 * Raises:
 *   Error: The file is unreadable or invalid.
 */
export async function loadReaderConfig(filePath: string): Promise<ReaderConfig> {
  const text = await readFile(filePath, "utf8")
  return ReaderConfigSchema.parse(yaml.load(text))
}

/**
 * Load a Reader YAML that may contain Property names. / Property 名を含められる Reader YAML を読み込みます。
 *
 * Args:
 *   filePath: YAML file path.
 *
 * Returns:
 *   Validated unresolved configuration.
 *
 * Raises:
 *   Error: The file is unreadable or invalid.
 */
export async function loadReaderConfigInput(filePath: string): Promise<ReaderConfigInput> {
  const text = await readFile(filePath, "utf8")
  return ReaderConfigInputSchema.parse(yaml.load(text))
}

/**
 * Load process settings without exposing secret values.
 * Secret 値を公開せずに process 設定を読み込みます。
 *
 * Returns:
 *   Validated runtime configuration.
 *
 * Raises:
 *   Error: A required setting is missing or unsafe.
 */
export async function loadRuntimeConfig(): Promise<RuntimeConfigInput> {
  const environmentValue = process.env.NODE_ENV ?? "development"
  const environment = z.enum(["development", "test", "production"]).parse(environmentValue)
  const configPath = path.resolve(process.env.READER_CONFIG_PATH ?? "config/reader.example.yaml")
  const reader = await loadReaderConfigInput(configPath)
  const passwordHash = process.env.READER_PASSWORD_HASH ?? ""
  if (passwordHash.length === 0) {
    throw new Error("READER_PASSWORD_HASH is required")
  }

  const notionToken = process.env.NOTION_TOKEN
  if (reader.source === "notion" && !notionToken) {
    throw new Error("NOTION_TOKEN is required when source is notion")
  }

  const serveWeb = process.env.SERVE_WEB === "true"
  if (environment === "production" && !serveWeb) {
    throw new Error("Production must serve the PWA from the same origin")
  }

  return {
    reader,
    environment,
    host: process.env.HOST ?? "127.0.0.1",
    port: z.coerce
      .number()
      .int()
      .min(1)
      .max(65535)
      .parse(process.env.PORT ?? 3000),
    databasePath: path.resolve(process.env.READER_DATABASE_PATH ?? ".data/reader.sqlite"),
    passwordHash,
    ...(notionToken ? { notionToken } : {}),
    serveWeb,
  }
}
