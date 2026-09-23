import { createHash, randomBytes } from "node:crypto"

const DEFAULT_CURSOR_TTL_MS = 30 * 60 * 1000
const DEFAULT_MAX_ENTRIES = 1_024

export type ReaderCursorState =
  | Readonly<{ kind: "article-list"; sourceCursor: string }>
  | Readonly<{ kind: "search"; databaseIndex: number; sourceCursor?: string }>
  | Readonly<{ kind: "embedded-table"; tableId: string; sourceCursor: string }>

type CursorEntry = Readonly<{
  contextHash: string
  expiresAt: number
  state: ReaderCursorState
}>

type CursorRegistryOptions = Readonly<{
  ttlMs?: number
  maxEntries?: number
  now?: () => number
  createToken?: () => string
}>

function contextHash(context: unknown): string {
  return createHash("sha256").update(JSON.stringify(context), "utf8").digest("hex")
}

function defaultToken(): string {
  return `cur_${randomBytes(32).toString("base64url")}`
}

/**
 * Keep upstream cursor state behind bounded, expiring Reader-owned handles.
 * upstream cursor state を上限・期限付きの Reader-owned handle の背後に保持します。
 */
export class CursorRegistry {
  readonly #entries = new Map<string, CursorEntry>()
  readonly #ttlMs: number
  readonly #maxEntries: number
  readonly #now: () => number
  readonly #createToken: () => string

  constructor(options: CursorRegistryOptions = {}) {
    this.#ttlMs = options.ttlMs ?? DEFAULT_CURSOR_TTL_MS
    this.#maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES
    this.#now = options.now ?? Date.now
    this.#createToken = options.createToken ?? defaultToken
  }

  /**
   * Issue a random public handle for one context-bound cursor state.
   * context に結び付いた cursor state の random public handle を発行します。
   *
   * Args:
   *   context: Reader-owned request context used to prevent cross-query reuse.
   *   state: Upstream cursor state retained only in process memory.
   *
   * Returns:
   *   A 256-bit Reader cursor token.
   */
  issue(context: unknown, state: ReaderCursorState): string {
    const now = this.#now()
    this.#prune(now)
    while (this.#entries.size >= this.#maxEntries) {
      const oldest = this.#entries.keys().next().value
      if (oldest === undefined) break
      this.#entries.delete(oldest)
    }

    let token = this.#createToken()
    while (this.#entries.has(token)) {
      token = this.#createToken()
    }
    this.#entries.set(token, {
      contextHash: contextHash(context),
      expiresAt: now + this.#ttlMs,
      state: { ...state },
    })
    return token
  }

  /**
   * Resolve a handle only when its kind, context, and lifetime remain valid.
   * kind・context・期限が有効な場合だけ handle を解決します。
   *
   * Args:
   *   token: Reader cursor received from the browser.
   *   kind: Expected endpoint cursor kind.
   *   context: Current Reader-owned request context.
   *
   * Returns:
   *   A copy of the internal state, or undefined for every invalid case.
   */
  resolve(
    token: string,
    kind: ReaderCursorState["kind"],
    context: unknown,
  ): ReaderCursorState | undefined {
    const now = this.#now()
    this.#prune(now)
    const entry = this.#entries.get(token)
    if (
      !entry ||
      entry.state.kind !== kind ||
      entry.contextHash !== contextHash(context) ||
      entry.expiresAt <= now
    ) {
      return undefined
    }
    return { ...entry.state }
  }

  #prune(now: number): void {
    for (const [token, entry] of this.#entries) {
      if (entry.expiresAt <= now) {
        this.#entries.delete(token)
      }
    }
  }
}
