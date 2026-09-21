import { copyFile, readFile, rename, rm, writeFile } from "node:fs/promises"
import yaml from "js-yaml"
import { type ReaderConfig, ReaderConfigSchema, type VariableMapping } from "./config.js"

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

const sourceTypesByReaderType: Readonly<Record<VariableMapping["type"], readonly string[]>> = {
  string: ["title", "rich_text", "select", "status"],
  "string[]": ["multi_select"],
  number: ["number"],
  boolean: ["checkbox"],
  date: ["date"],
  reference: ["relation"],
  "reference[]": ["relation"],
}

function resolveProperty(
  configuredPropertyId: string,
  setPropertyId: (propertyId: string) => void,
  path: string,
  expectedTypes: readonly string[],
  properties: readonly SourcePropertySchema[],
  changes: PropertyResolutionChange[],
  issues: PropertyResolutionIssue[],
): void {
  const existing = properties.find((property) => property.id === configuredPropertyId)
  const nameMatches = existing
    ? []
    : properties.filter((property) => property.name === configuredPropertyId)
  if (!existing && nameMatches.length !== 1) {
    issues.push({ path, issue: "no_exact_match" })
    return
  }
  const property = existing ?? nameMatches[0]
  if (!property) {
    issues.push({ path, issue: "no_exact_match" })
    return
  }
  if (!expectedTypes.includes(property.type)) {
    issues.push({
      path,
      issue: "type_mismatch",
      expectedTypes: [...expectedTypes],
      actualType: property.type,
    })
    return
  }
  if (!existing) {
    setPropertyId(property.id)
    changes.push({ path, actualType: property.type })
  }
}

/**
 * Resolve configured Property names within each selected Data Source.
 * 選択済み Data Source ごとに、設定された Property 名を解決します。
 *
 * Args:
 *   config: Validated Reader configuration containing IDs or exact Property names.
 *   schemas: Property schemas keyed by configured Data Source ID.
 *
 * Returns:
 *   A cloned configuration plus redacted change and issue summaries.
 */
export function resolvePropertyNames(
  config: ReaderConfig,
  schemas: ReadonlyMap<string, readonly SourcePropertySchema[]>,
): ResolutionResult {
  const resolved = structuredClone(config)
  const changes: PropertyResolutionChange[] = []
  const issues: PropertyResolutionIssue[] = []

  for (const [databaseIndex, database] of resolved.contentDatabases.entries()) {
    const properties = schemas.get(database.sourceDataSourceId)
    if (!properties) {
      issues.push({
        path: `contentDatabases[${databaseIndex}]`,
        issue: "schema_unavailable",
      })
      continue
    }
    resolveProperty(
      database.titlePropertyId,
      (propertyId) => {
        database.titlePropertyId = propertyId
      },
      `contentDatabases[${databaseIndex}].titlePropertyId`,
      ["title"],
      properties,
      changes,
      issues,
    )
    for (const [field, mapping] of Object.entries(database.variables)) {
      resolveProperty(
        mapping.propertyId,
        (propertyId) => {
          mapping.propertyId = propertyId
        },
        `contentDatabases[${databaseIndex}].variables.${field}.propertyId`,
        sourceTypesByReaderType[mapping.type],
        properties,
        changes,
        issues,
      )
    }
    for (const [field, mapping] of Object.entries(database.filters)) {
      resolveProperty(
        mapping.propertyId,
        (propertyId) => {
          mapping.propertyId = propertyId
        },
        `contentDatabases[${databaseIndex}].filters.${field}.propertyId`,
        [mapping.sourceType],
        properties,
        changes,
        issues,
      )
    }
  }

  return { config: resolved, changes, issues }
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
  const config = ReaderConfigSchema.parse(yaml.load(sourceText))
  if (config.source !== "notion") {
    throw new Error("Property name resolution requires source: notion")
  }

  const schemas = new Map<string, readonly SourcePropertySchema[]>()
  for (const database of config.contentDatabases) {
    schemas.set(database.sourceDataSourceId, await retrieveSchema(database.sourceDataSourceId))
  }
  const result = resolvePropertyNames(config, schemas)
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
