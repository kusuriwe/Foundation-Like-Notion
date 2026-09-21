export type RecentArticle = Readonly<{ readerArticleId: string; viewedAt: string }>

const STORAGE_KEY = "notion-reader:recent:v1"
const MAX_RECENT = 20

function isRecent(value: unknown): value is RecentArticle {
  return (
    typeof value === "object" &&
    value !== null &&
    "readerArticleId" in value &&
    typeof value.readerArticleId === "string" &&
    "viewedAt" in value &&
    typeof value.viewedAt === "string" &&
    !Number.isNaN(Date.parse(value.viewedAt))
  )
}

/** Return valid device-local recent entries. / 有効な端末内 recent entry を返します。 */
export function readRecent(): RecentArticle[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown
    return Array.isArray(value) ? value.filter(isRecent).slice(0, MAX_RECENT) : []
  } catch {
    return []
  }
}

/**
 * Move an opaque article ID to the front of the bounded recent list.
 * opaque article ID を件数制限付き recent list の先頭へ移動します。
 */
export function recordRecent(readerArticleId: string, now = new Date()): RecentArticle[] {
  const recent = [
    { readerArticleId, viewedAt: now.toISOString() },
    ...readRecent().filter((entry) => entry.readerArticleId !== readerArticleId),
  ].slice(0, MAX_RECENT)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recent))
  return recent
}

/** Remove one article from local history. / local history から article を1件削除します。 */
export function removeRecent(readerArticleId: string): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(readRecent().filter((entry) => entry.readerArticleId !== readerArticleId)),
  )
}

/** Remove all device-local history. / 端末内 history をすべて削除します。 */
export function clearRecent(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export const recentLimit = MAX_RECENT
