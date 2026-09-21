import { readFile } from "node:fs/promises"
import path from "node:path"
import { FilterOperatorSchema } from "@foundation-like-notion/contracts"
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

const VariableMappingSchema = z
  .object({
    propertyId: z.string().min(1),
    type: VariableTypeSchema,
    required: z.boolean().default(false),
    fallback: z.string().optional(),
  })
  .strict()

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

export const ContentDatabaseConfigSchema = z
  .object({
    id: z.string().min(8).max(128),
    name: z.string().min(1).max(200),
    sourceDataSourceId: z.string().min(1),
    titlePropertyId: z.string().min(1),
    defaultTemplate: z.string().min(1),
    templates: z.array(z.enum(["simple", "compact-emblem"])).min(1),
    sort: z
      .array(SortSchema)
      .min(1)
      .default([{ field: "created_time", direction: "ascending" }]),
    variables: z.record(z.string(), VariableMappingSchema),
    filters: z.record(z.string(), FilterMappingSchema).default({}),
  })
  .strict()
  .superRefine((value, context) => {
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
  })

export const ReaderConfigSchema = z
  .object({
    version: z.literal(1),
    source: z.enum(["fixture", "notion"]),
    contentDatabases: z.array(ContentDatabaseConfigSchema).min(1),
    relationSources: z.array(z.string().min(1)).default([]),
  })
  .strict()
  .superRefine((value, context) => {
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
      if (!database.templates.includes(database.defaultTemplate as "simple" | "compact-emblem")) {
        context.addIssue({
          code: "custom",
          path: ["contentDatabases", index, "defaultTemplate"],
          message: "Default template must be listed in templates",
        })
      }
      ids.add(database.id)
      sourceIds.add(database.sourceDataSourceId)
    }
  })

export type ReaderConfig = z.infer<typeof ReaderConfigSchema>
export type ContentDatabaseConfig = z.infer<typeof ContentDatabaseConfigSchema>
export type VariableMapping = z.infer<typeof VariableMappingSchema>

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
 * Load process settings without exposing secret values.
 * Secret 値を公開せずに process 設定を読み込みます。
 *
 * Returns:
 *   Validated runtime configuration.
 *
 * Raises:
 *   Error: A required setting is missing or unsafe.
 */
export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  const environmentValue = process.env.NODE_ENV ?? "development"
  const environment = z.enum(["development", "test", "production"]).parse(environmentValue)
  const configPath = path.resolve(process.env.READER_CONFIG_PATH ?? "config/reader.example.yaml")
  const reader = await loadReaderConfig(configPath)
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
