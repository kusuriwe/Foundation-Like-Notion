const STORAGE_KEY = "notion-reader:templates:v1"

function readPreferences(): Record<string, string> {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as unknown
    if (typeof value !== "object" || value === null || Array.isArray(value)) return {}
    return Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    )
  } catch {
    return {}
  }
}

/**
 * Return a stored template only when it remains allowlisted.
 * 保存済み template が引き続き許可されている場合だけ返します。
 */
export function preferredTemplate(
  databaseId: string,
  allowed: readonly string[],
  defaultTemplate: string,
): string {
  const selected = readPreferences()[databaseId]
  return selected && allowed.includes(selected) ? selected : defaultTemplate
}

/** Persist one Reader template ID by database. / database ごとに Reader template ID を保存します。 */
export function savePreferredTemplate(databaseId: string, templateId: string): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...readPreferences(), [databaseId]: templateId }),
  )
}
