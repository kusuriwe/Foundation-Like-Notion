import { copyFile, readFile, rename, rm, writeFile } from "node:fs/promises"
import yaml from "js-yaml"
import {
  type ReaderConfig,
  type ReaderConfigInput,
  ReaderConfigInputSchema,
  ReaderConfigSchema,
  type VariableMapping,
} from "./config.js"

export type SourcePropertySchema = Readonly<{
  name: string
  id: string
  type: string
}>

export type PropertyResolutionChange = Readonly<{
  path: string
  actualType: string
}>

export type PropertyResolutionIssue = Readonly<{
  path: string
  issue: "schema_unavailable" | "no_exact_match" | "type_mismatch"
  expectedTypes?: readonly string[]
  actualType?: string
}>

export type PropertyResolutionSummary = Readonly<{
  written: boolean
  changes: readonly PropertyResolutionChange[]
  issues: readonly PropertyResolutionIssue[]
  backupCreated: boolean
}>

type ResolutionResult = Readonly<{
  config: ReaderConfig
  changes: readonly PropertyResolutionChange[]
  issues: readonly PropertyResolutionIssue[]
}>

type PropertyLocator = Readonly<{
  propertyId?: string | undefined
  propertyName?: string | undefined
}>

const sourceTypesByReaderType: Readonly<Record<VariableMapping["type"], readonly string[]>> = {
  string: ["title", "rich_text", "select", "status"],
  "string[]": ["multi_select"],
  number: ["number"],
  boolean: ["checkbox"],
  date: ["date"],
  reference: ["relation"],
  "reference[]": ["relation"],
}

/** A redacted startup failure that never includes configured names or IDs. */
export class PropertyConfigurationError extends Error {
  readonly issues: readonly PropertyResolutionIssue[]

  constructor(issues: readonly PropertyResolutionIssue[]) {
    super(
      `Property configuration invalid: ${issues.map(({ path, issue }) => `${issue} at ${path}`).join(", ")}`,
    )
    this.name = "PropertyConfigurationError"
    this.issues = issues
  }
}

function resolveProperty(
  locator: PropertyLocator,
  path: string,
  expectedTypes: readonly string[],
  properties: readonly SourcePropertySchema[],
  changes: PropertyResolutionChange[],
  issues: PropertyResolutionIssue[],
  allowLegacyNameInId: boolean,
): string {
  const existing = locator.propertyId
    ? properties.find((property) => property.id === locator.propertyId)
    : undefined
  const configuredName =
    locator.propertyName ?? (allowLegacyNameInId && !existing ? locator.propertyId : undefined)
  const nameMatches = configuredName
    ? properties.filter((property) => property.name === configuredName)
    : []
  if (!existing && nameMatches.length !== 1) {
    issues.push({ path, issue: "no_exact_match" })
    return locator.propertyId ?? locator.propertyName ?? "unresolved-property"
  }
  const property = existing ?? nameMatches[0]
  if (!property) {
    issues.push({ path, issue: "no_exact_match" })
    return locator.propertyId ?? locator.propertyName ?? "unresolved-property"
  }
  if (!expectedTypes.includes(property.type)) {
    issues.push({
      path,
      issue: "type_mismatch",
      expectedTypes: [...expectedTypes],
      actualType: property.type,
    })
    return property.id
  }
  if (!existing) {
    changes.push({ path, actualType: property.type })
  }
  return property.id
}

/**
 * Resolve configured Property locators within each selected Data Source.
 * 選択済み Data Source ごとに設定された Property locator を解決します。
 *
 * Args:
 *   config: Validated Reader input configuration.
 *   schemas: Property schemas keyed by configured Data Source ID.
 *   allowLegacyNameInId: Whether the migration command may treat an unmatched ID as an old name.
 *
 * Returns:
 *   An ID-only configuration plus redacted change and issue summaries.
 */
export function resolvePropertyNames(
  config: ReaderConfigInput,
  schemas: ReadonlyMap<string, readonly SourcePropertySchema[]>,
  allowLegacyNameInId = false,
): ResolutionResult {
  const changes: PropertyResolutionChange[] = []
  const issues: PropertyResolutionIssue[] = []
  const contentDatabases = config.contentDatabases.map((database, databaseIndex) => {
    const properties = schemas.get(database.sourceDataSourceId)
    if (!properties) {
      issues.push({
        path: `contentDatabases[${databaseIndex}]`,
        issue: "schema_unavailable",
      })
    }
    const available = properties ?? []
    const titlePath = `contentDatabases[${databaseIndex}].${database.titlePropertyName === undefined ? "titlePropertyId" : "titlePropertyName"}`
    const titlePropertyId = resolveProperty(
      {
        ...(database.titlePropertyId ? { propertyId: database.titlePropertyId } : {}),
        ...(database.titlePropertyName ? { propertyName: database.titlePropertyName } : {}),
      },
      titlePath,
      ["title"],
      available,
      changes,
      issues,
      allowLegacyNameInId,
    )
    const variables = Object.fromEntries(
      Object.entries(database.variables).map(([field, mapping]) => {
        const propertyPath = `contentDatabases[${databaseIndex}].variables.${field}.${mapping.propertyName === undefined ? "propertyId" : "propertyName"}`
        return [
          field,
          {
            propertyId: resolveProperty(
              mapping,
              propertyPath,
              sourceTypesByReaderType[mapping.type],
              available,
              changes,
              issues,
              allowLegacyNameInId,
            ),
            type: mapping.type,
            required: mapping.required,
            ...(mapping.fallback !== undefined ? { fallback: mapping.fallback } : {}),
          },
        ]
      }),
    )
    const filters = Object.fromEntries(
      Object.entries(database.filters).map(([field, mapping]) => {
        const propertyPath = `contentDatabases[${databaseIndex}].filters.${field}.${mapping.propertyName === undefined ? "propertyId" : "propertyName"}`
        return [
          field,
          {
            propertyId: resolveProperty(
              mapping,
              propertyPath,
              [mapping.sourceType],
              available,
              changes,
              issues,
              allowLegacyNameInId,
            ),
            type: mapping.type,
            sourceType: mapping.sourceType,
            operators: [...mapping.operators],
          },
        ]
      }),
    )
    return {
      id: database.id,
      name: database.name,
      sourceDataSourceId: database.sourceDataSourceId,
      titlePropertyId,
      defaultTemplate: database.defaultTemplate,
      templates: [...database.templates],
      sort: database.sort.map((sort) => ({ ...sort })),
      variables,
      filters,
    }
  })
  const resolved = ReaderConfigSchema.parse({
    version: config.version,
    source: config.source,
    contentDatabases,
    relationSources: [...config.relationSources],
    presentation: config.presentation,
  })
  return { config: resolved, changes, issues }
}

/**
 * Resolve a Notion Reader configuration at startup without modifying its YAML.
 * YAML を変更せず、起動時に Notion Reader 設定を解決します。
 *
 * Args:
 *   config: Validated Reader input configuration.
 *   retrieveSchema: Read-only schema loader for one configured Data Source ID.
 *
 * Returns:
 *   Validated ID-only Reader configuration.
 *
 * Raises:
 *   PropertyConfigurationError: Schema retrieval or Property validation fails.
 */
export async function resolvePropertyNamesAtStartup(
  config: ReaderConfigInput,
  retrieveSchema: (dataSourceId: string) => Promise<readonly SourcePropertySchema[]>,
): Promise<ReaderConfig> {
  const schemas = new Map<string, readonly SourcePropertySchema[]>()
  const retrievalIssues: PropertyResolutionIssue[] = []
  for (const [databaseIndex, database] of config.contentDatabases.entries()) {
    try {
      schemas.set(database.sourceDataSourceId, await retrieveSchema(database.sourceDataSourceId))
    } catch {
      retrievalIssues.push({
        path: `contentDatabases[${databaseIndex}]`,
        issue: "schema_unavailable",
      })
    }
  }
  if (retrievalIssues.length > 0) {
    throw new PropertyConfigurationError(retrievalIssues)
  }
  const result = resolvePropertyNames(config, schemas)
  if (result.issues.length > 0) {
    throw new PropertyConfigurationError(result.issues)
  }
  return result.config
}

/**
 * Resolve a local Reader YAML atomically, keeping a recoverable backup.
 * ローカル Reader YAML を解決し、復元可能な backup を残して atomic に更新します。
 *
 * Args:
 *   configPath: Path to an ignored Reader YAML file.
 *   retrieveSchema: Read-only schema loader for one configured Data Source ID.
 *
 * Returns:
 *   A redacted summary that never includes Property names or IDs.
 *
 * Raises:
 *   Error: The YAML is invalid, is not a Notion configuration, or cannot be read or written.
 */
export async function resolvePropertyNamesInFile(
  configPath: string,
  retrieveSchema: (dataSourceId: string) => Promise<readonly SourcePropertySchema[]>,
): Promise<PropertyResolutionSummary> {
  const sourceText = await readFile(configPath, "utf8")
  const config = ReaderConfigInputSchema.parse(yaml.load(sourceText))
  if (config.source !== "notion") {
    throw new Error("Property name resolution requires source: notion")
  }

  const schemas = new Map<string, readonly SourcePropertySchema[]>()
  for (const database of config.contentDatabases) {
    schemas.set(database.sourceDataSourceId, await retrieveSchema(database.sourceDataSourceId))
  }
  const result = resolvePropertyNames(config, schemas, true)
  if (result.issues.length > 0 || result.changes.length === 0) {
    return {
      written: false,
      changes: result.changes,
      issues: result.issues,
      backupCreated: false,
    }
  }

  const output = yaml.dump(result.config, { lineWidth: 100, noRefs: true })
  ReaderConfigSchema.parse(yaml.load(output))
  const backupPath = `${configPath}.bak`
  const temporaryPath = `${configPath}.tmp-${process.pid}`
  await copyFile(configPath, backupPath)
  try {
    await writeFile(temporaryPath, output, "utf8")
    await rename(temporaryPath, configPath)
  } finally {
    await rm(temporaryPath, { force: true })
  }
  return {
    written: true,
    changes: result.changes,
    issues: [],
    backupCreated: true,
  }
}
