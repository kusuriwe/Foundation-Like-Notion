import type { ReaderIcon, ReaderValue, Reference } from "@foundation-like-notion/contracts"
import type { ContentDatabaseConfig, VariableMapping } from "../config.js"
import type { ReaderDatabase } from "../database.js"
import type { SourceIcon, SourceReference, SourceValue } from "../adapters/content-adapter.js"

export class MappingError extends Error {
  readonly variable: string

  constructor(variable: string, expected: string, actual: string) {
    super(`Variable ${variable} expects ${expected}, received ${actual}`)
    this.name = "MappingError"
    this.variable = variable
  }
}

function mapIcon(icon: SourceIcon | undefined, database: ReaderDatabase): ReaderIcon | undefined {
  if (!icon) {
    return undefined
  }
  if (icon.kind === "emoji") {
    return icon
  }
  return {
    kind: "asset",
    assetId: database.getOrCreateResource(icon.sourceAssetId, "asset").readerId,
  }
}

function mapReference(reference: SourceReference, database: ReaderDatabase): Reference {
  const record = database.getOrCreateResource(reference.sourceId, "page")
  const icon = mapIcon(reference.icon, database)
  return {
    readerId: record.readerId,
    title: reference.title,
    ...(icon ? { icon } : {}),
  }
}

function fallbackValue(mapping: VariableMapping): ReaderValue | undefined {
  if (mapping.fallback === undefined) {
    return undefined
  }
  if (mapping.type !== "string") {
    throw new MappingError("fallback", mapping.type, "string")
  }
  return { type: "string", value: mapping.fallback }
}

function mapValue(
  variable: string,
  mapping: VariableMapping,
  value: SourceValue | undefined,
  database: ReaderDatabase,
): ReaderValue | undefined {
  if (!value) {
    return fallbackValue(mapping)
  }
  if (value.type !== mapping.type) {
    throw new MappingError(variable, mapping.type, value.type)
  }
  if (value.type === "reference") {
    return { type: "reference", value: mapReference(value.value, database) }
  }
  if (value.type === "reference[]") {
    return {
      type: "reference[]",
      value: value.value.map((reference) => mapReference(reference, database)),
    }
  }
  if (value.type === "string[]") {
    return { type: "string[]", value: [...value.value] }
  }
  return value
}

/**
 * Convert source properties into configured Reader values without cardinality coercion.
 * cardinality を暗黙変換せず、source property を設定済み Reader value へ変換します。
 *
 * Args:
 *   config: Allowlisted variable mappings for the content database.
 *   properties: Source values keyed by source property ID.
 *   database: Opaque Reader ID store.
 *
 * Returns:
 *   Reader-owned values keyed by template variable.
 *
 * Raises:
 *   MappingError: A configured type or cardinality does not match.
 */
export function resolveProperties(
  config: ContentDatabaseConfig,
  properties: Readonly<Record<string, SourceValue>>,
  database: ReaderDatabase,
): Readonly<Record<string, ReaderValue>> {
  const resolved: Record<string, ReaderValue> = {}
  for (const [variable, mapping] of Object.entries(config.variables)) {
    const value = mapValue(variable, mapping, properties[mapping.propertyId], database)
    if (value !== undefined) {
      resolved[variable] = value
    }
  }
  return resolved
}
