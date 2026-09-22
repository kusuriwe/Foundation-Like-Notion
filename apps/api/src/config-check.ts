import argon2 from "argon2"
import { type Client, isNotionClientError } from "@notionhq/client"
import { ZodError } from "zod"
import { ReaderConfigInputSchema, type ReaderConfigInput } from "./config.js"
import { resolvePropertyNames, type SourcePropertySchema } from "./property-name-resolver.js"

export type CheckFailureCategory =
  | "invalid_config"
  | "missing_password_hash"
  | "invalid_password_hash"
  | "missing_notion_token"
  | "source_unavailable"
  | "property_no_match"
  | "property_type_mismatch"

export class ConfigurationCheckError extends Error {
  constructor(
    readonly category: CheckFailureCategory,
    readonly path?: string,
    readonly status?: number,
  ) {
    super(category)
    this.name = "ConfigurationCheckError"
  }
}

export class SourceSchemaError extends Error {
  constructor(readonly status?: number) {
    super("source_unavailable")
    this.name = "SourceSchemaError"
  }
}

/** Retrieve only Data Source schemas through the official read API. / 公式read APIでData Source schemaだけを取得します。 */
export function notionSchemaRetriever(client: Pick<Client["dataSources"], "retrieve">) {
  return async (dataSourceId: string): Promise<readonly SourcePropertySchema[]> => {
    try {
      const schema = await client.retrieve({ data_source_id: dataSourceId })
      return Object.entries(schema.properties).map(([name, property]) => ({
        name,
        id: property.id,
        type: property.type,
      }))
    } catch (error) {
      const status =
        isNotionClientError(error) && "status" in error && typeof error.status === "number"
          ? error.status
          : undefined
      throw new SourceSchemaError(status)
    }
  }
}

export type ConfigurationCheckResult = Readonly<{
  ok: true
  source: "fixture" | "notion"
  dataSourcesChecked: number
  mappingsChecked: number
}>

/** Hide user-defined Reader field keys in diagnostic paths. / 診断パス内の利用者定義field名を伏せます。 */
function safePath(path: string): string {
  const mapping = path.match(/^(.+?\.(?:variables|filters))(?:\.|$)/)
  return mapping?.[1] ?? path
}

/** Convert any failure into a value-free diagnostic. / 任意の失敗を設定値を含まない診断結果に変換します。 */
export function safeCheckFailure(error: unknown): Readonly<{
  ok: false
  category: string
  path?: string
  status?: number
}> {
  if (error instanceof ConfigurationCheckError) {
    return {
      ok: false,
      category: error.category,
      ...(error.path ? { path: safePath(error.path) } : {}),
      ...(error.status ? { status: error.status } : {}),
    }
  }
  if (error instanceof ZodError) {
    const path = error.issues[0]?.path.join(".")
    return { ok: false, category: "invalid_config", ...(path ? { path: safePath(path) } : {}) }
  }
  if (error instanceof Error && "code" in error && error.code === "ENOENT") {
    return { ok: false, category: "missing_config" }
  }
  return { ok: false, category: "invalid_config" }
}

/**
 * Validate local settings and read-only Notion schemas without starting the server.
 * サーバーを起動せず、ローカル設定と読み取り専用の Notion schema を検証します。
 *
 * Args:
 *   input: Unresolved Reader configuration and environment secrets.
 *   retrieveSchema: Read-only Data Source schema retrieval.
 *   verifyHash: Argon2id verifier, replaceable in tests.
 *
 * Returns:
 *   A summary containing counts but no configured values.
 *
 * Raises:
 *   ConfigurationCheckError: Configuration, hash, access, or mapping is invalid.
 */
export async function checkConfiguration(
  input: Readonly<{
    reader: ReaderConfigInput
    passwordHash: string
    notionToken?: string
  }>,
  retrieveSchema: (dataSourceId: string) => Promise<readonly SourcePropertySchema[]>,
  verifyHash: (hash: string) => Promise<unknown> = (hash) => argon2.verify(hash, "config-check"),
): Promise<ConfigurationCheckResult> {
  const parsed = ReaderConfigInputSchema.safeParse(input.reader)
  if (!parsed.success) throw new ConfigurationCheckError("invalid_config")
  const reader = parsed.data
  if (!input.passwordHash) throw new ConfigurationCheckError("missing_password_hash")
  if (!input.passwordHash.startsWith("$argon2id$")) {
    throw new ConfigurationCheckError("invalid_password_hash")
  }
  try {
    await verifyHash(input.passwordHash)
  } catch {
    throw new ConfigurationCheckError("invalid_password_hash")
  }
  const mappingsChecked = reader.contentDatabases.reduce(
    (count, database) =>
      count + 1 + Object.keys(database.variables).length + Object.keys(database.filters).length,
    0,
  )
  if (reader.source === "fixture") {
    return { ok: true, source: "fixture", dataSourcesChecked: 0, mappingsChecked }
  }
  if (!input.notionToken) throw new ConfigurationCheckError("missing_notion_token")

  const schemas = new Map<string, readonly SourcePropertySchema[]>()
  const sources = [
    ...reader.contentDatabases.map((database, index) => ({
      id: database.sourceDataSourceId,
      path: `contentDatabases[${index}].sourceDataSourceId`,
    })),
    ...reader.relationSources.map((id, index) => ({ id, path: `relationSources[${index}]` })),
  ]
  for (const source of sources) {
    if (schemas.has(source.id)) continue
    try {
      schemas.set(source.id, await retrieveSchema(source.id))
    } catch (error) {
      throw new ConfigurationCheckError(
        "source_unavailable",
        source.path,
        error instanceof SourceSchemaError ? error.status : undefined,
      )
    }
  }
  const resolved = resolvePropertyNames(reader, schemas)
  const issue = resolved.issues[0]
  if (issue) {
    throw new ConfigurationCheckError(
      issue.issue === "type_mismatch" ? "property_type_mismatch" : "property_no_match",
      issue.path,
    )
  }
  return { ok: true, source: "notion", dataSourcesChecked: schemas.size, mappingsChecked }
}
