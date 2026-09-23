import { randomBytes } from "node:crypto"
import type { SourceEmbeddedColumn } from "./adapters/content-adapter.js"

const DEFAULT_TABLE_TTL_MS = 30 * 60 * 1000
const DEFAULT_MAX_TABLES = 1_024

export type EmbeddedTableState = Readonly<{
  readerArticleId: string
  sourceTableId: string
  columns: readonly SourceEmbeddedColumn[]
}>

type Entry = Readonly<EmbeddedTableState & { expiresAt: number }>

type Options = Readonly<{
  ttlMs?: number
  maxEntries?: number
  now?: () => number
  createToken?: () => string
}>

function defaultToken(): string {
  return `tbl_${randomBytes(32).toString("base64url")}`
}

/**
 * Keep discovered child-database identifiers behind short-lived Reader tokens.
 * 検出した子データベースの識別子を短寿命の Reader token の背後だけに保持します。
 */
export class EmbeddedTableRegistry {
  readonly #entries = new Map<string, Entry>()
  readonly #ttlMs: number
  readonly #maxEntries: number
  readonly #now: () => number
  readonly #createToken: () => string

  constructor(options: Options = {}) {
    this.#ttlMs = options.ttlMs ?? DEFAULT_TABLE_TTL_MS
    this.#maxEntries = options.maxEntries ?? DEFAULT_MAX_TABLES
    this.#now = options.now ?? Date.now
    this.#createToken = options.createToken ?? defaultToken
  }

  /** Issue a bounded opaque table token. / 上限付きの opaque table token を発行します。 */
  issue(state: EmbeddedTableState): string {
    const now = this.#now()
    this.#prune(now)
    while (this.#entries.size >= this.#maxEntries) {
      const oldest = this.#entries.keys().next().value
      if (oldest === undefined) break
      this.#entries.delete(oldest)
    }
    let token = this.#createToken()
    while (this.#entries.has(token)) token = this.#createToken()
    this.#entries.set(token, {
      ...state,
      columns: state.columns.map((column) => ({ ...column })),
      expiresAt: now + this.#ttlMs,
    })
    return token
  }

  /** Resolve a token only for its owning article. / 所有する記事に対してだけ token を解決します。 */
  resolve(token: string, readerArticleId: string): EmbeddedTableState | undefined {
    const now = this.#now()
    this.#prune(now)
    const entry = this.#entries.get(token)
    if (!entry || entry.readerArticleId !== readerArticleId || entry.expiresAt <= now) {
      return undefined
    }
    return {
      readerArticleId: entry.readerArticleId,
      sourceTableId: entry.sourceTableId,
      columns: entry.columns.map((column) => ({ ...column })),
    }
  }

  #prune(now: number): void {
    for (const [token, entry] of this.#entries) {
      if (entry.expiresAt <= now) this.#entries.delete(token)
    }
  }
}
