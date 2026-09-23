import {
  ArticlePageSchema,
  ArticleSchema,
  DatabaseSummarySchema,
  EmbeddedTablePageSchema,
  PresentationResponseSchema,
  SessionResponseSchema,
  type Article,
  type ArticlePage,
  type DatabaseSummary,
  type EmbeddedTablePage,
  type PresentationConfig,
  type SearchRequest,
} from "@foundation-like-notion/contracts"
import type { ZodType } from "zod"
import type { ReaderClient } from "./reader-client.js"

/** Represent a sanitized Reader API failure. / 無害化済み Reader API failure を表します。 */
export class ApiRequestError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiRequestError"
    this.status = status
  }
}

async function request<T>(url: string, schema: ZodType<T>, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  })
  if (!response.ok) {
    let message = "Reader からデータを取得できませんでした。"
    try {
      const body = (await response.json()) as { error?: { message?: string } }
      message = body.error?.message ?? message
    } catch {
      // Keep the generic public message.
    }
    throw new ApiRequestError(response.status, message)
  }
  return schema.parse(await response.json())
}

/** Return whether the current browser session is authenticated. / 現在の browser session の認証状態を返します。 */
export async function getSession(): Promise<boolean> {
  return (await request("/api/session", SessionResponseSchema)).authenticated
}

/** Return the public, display-only Reader presentation. / 公開表示専用の Reader presentation を返します。 */
export function getPresentation(): Promise<PresentationConfig> {
  return request("/api/presentation", PresentationResponseSchema)
}

/**
 * Authenticate with the single-reader password.
 * single-reader password で認証します。
 *
 * Args:
 *   password: Password entered by the reader.
 *
 * Raises:
 *   ApiRequestError: Authentication fails.
 */
export async function login(password: string): Promise<void> {
  const response = await fetch("/api/session", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  })
  if (!response.ok) {
    let message = "Password が正しくありません。"
    try {
      const body = (await response.json()) as { error?: { message?: string } }
      message = body.error?.message ?? message
    } catch {
      // Keep the credential-safe fallback.
    }
    throw new ApiRequestError(response.status, message)
  }
}

/** Revoke the current browser session. / 現在の browser session を失効させます。 */
export async function logout(): Promise<void> {
  const response = await fetch("/api/session", {
    method: "DELETE",
    cache: "no-store",
    credentials: "same-origin",
  })
  if (!response.ok) {
    throw new ApiRequestError(response.status, "Logout できませんでした。")
  }
}

/** Return public metadata for configured databases. / 設定済み database の公開 metadata を返します。 */
export function getDatabases(): Promise<DatabaseSummary[]> {
  return request("/api/databases", DatabaseSummarySchema.array())
}

/**
 * Return one page of articles from an allowlisted database.
 * 許可された database の article を1ページ返します。
 */
export function getArticles(databaseId: string, cursor?: string): Promise<ArticlePage> {
  const params = new URLSearchParams({ pageSize: "20" })
  if (cursor) params.set("cursor", cursor)
  return request(
    `/api/databases/${encodeURIComponent(databaseId)}/articles?${params}`,
    ArticlePageSchema,
  )
}

/** Return one article by opaque Reader ID. / opaque Reader ID から article を1件返します。 */
export function getArticle(articleId: string): Promise<Article> {
  return request(`/api/articles/${encodeURIComponent(articleId)}`, ArticleSchema)
}

/** Load the next page of one article-owned embedded table. / 記事内表の次ページを取得します。 */
export function getEmbeddedTablePage(
  articleId: string,
  tableId: string,
  cursor: string,
): Promise<EmbeddedTablePage> {
  const query = new URLSearchParams({ cursor })
  return request(
    `/api/articles/${encodeURIComponent(articleId)}/embedded-tables/${encodeURIComponent(tableId)}?${query}`,
    EmbeddedTablePageSchema,
  )
}

/** Run a typed, allowlisted Reader search. / 型付き allowlist Reader search を実行します。 */
export function searchArticles(value: SearchRequest): Promise<ArticlePage> {
  return request("/api/search", ArticlePageSchema, {
    method: "POST",
    body: JSON.stringify(value),
  })
}

export const httpReaderClient: ReaderClient = {
  getPresentation,
  getSession,
  login,
  logout,
  getDatabases,
  getArticles,
  getArticle,
  getEmbeddedTablePage,
  searchArticles,
  assetUrl: (assetId) => `/api/assets/${encodeURIComponent(assetId)}`,
}
