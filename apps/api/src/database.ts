import { randomUUID } from "node:crypto"
import { mkdirSync } from "node:fs"
import path from "node:path"
import BetterSqlite3 from "better-sqlite3"

export type ResourceKind = "page" | "asset"

export type ResourceRecord = Readonly<{
  readerId: string
  sourceId: string
  kind: ResourceKind
  databaseReaderId: string | null
}>

/**
 * Persist only opaque identifiers and hashed sessions in SQLite.
 * opaque ID と hash 化 session だけを SQLite に保存します。
 */
export class ReaderDatabase {
  readonly #database: BetterSqlite3.Database

  constructor(filePath: string) {
    if (filePath !== ":memory:") {
      mkdirSync(path.dirname(filePath), { recursive: true })
    }
    this.#database = new BetterSqlite3(filePath)
    this.#database.pragma("journal_mode = WAL")
    this.#database.pragma("foreign_keys = ON")
    this.#migrate()
  }

  #migrate(): void {
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS resources (
        reader_id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('page', 'asset')),
        database_reader_id TEXT,
        created_at INTEGER NOT NULL,
        UNIQUE (source_id, kind)
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions (expires_at);
    `)
  }

  /**
   * Return a stable opaque Reader ID for a source object.
   * Source object に対応する安定した opaque Reader ID を返します。
   *
   * Args:
   *   sourceId: Backend-only source object identifier.
   *   kind: Resource category.
   *   databaseReaderId: Owning Reader database for articles.
   *
   * Returns:
   *   Existing or newly created opaque resource mapping.
   */
  getOrCreateResource(
    sourceId: string,
    kind: ResourceKind,
    databaseReaderId?: string,
  ): ResourceRecord {
    const existing = this.#database
      .prepare(
        `SELECT reader_id, source_id, kind, database_reader_id
         FROM resources WHERE source_id = ? AND kind = ?`,
      )
      .get(sourceId, kind) as
      | {
          reader_id: string
          source_id: string
          kind: ResourceKind
          database_reader_id: string | null
        }
      | undefined

    if (existing) {
      if (databaseReaderId && existing.database_reader_id !== databaseReaderId) {
        this.#database
          .prepare("UPDATE resources SET database_reader_id = ? WHERE reader_id = ?")
          .run(databaseReaderId, existing.reader_id)
      }
      return {
        readerId: existing.reader_id,
        sourceId: existing.source_id,
        kind: existing.kind,
        databaseReaderId: databaseReaderId ?? existing.database_reader_id,
      }
    }

    const prefix = kind === "page" ? "art" : "asset"
    const readerId = `${prefix}_${randomUUID().replaceAll("-", "")}`
    this.#database
      .prepare(
        `INSERT INTO resources
         (reader_id, source_id, kind, database_reader_id, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(readerId, sourceId, kind, databaseReaderId ?? null, Date.now())
    return { readerId, sourceId, kind, databaseReaderId: databaseReaderId ?? null }
  }

  /**
   * Look up an opaque resource without exposing unrelated mappings.
   * 無関係な mapping を公開せず opaque resource を検索します。
   *
   * Args:
   *   readerId: Browser-safe opaque identifier.
   *   kind: Expected resource category.
   *
   * Returns:
   *   Matching mapping, or undefined.
   */
  getResource(readerId: string, kind: ResourceKind): ResourceRecord | undefined {
    const row = this.#database
      .prepare(
        `SELECT reader_id, source_id, kind, database_reader_id
         FROM resources WHERE reader_id = ? AND kind = ?`,
      )
      .get(readerId, kind) as
      | {
          reader_id: string
          source_id: string
          kind: ResourceKind
          database_reader_id: string | null
        }
      | undefined
    return row
      ? {
          readerId: row.reader_id,
          sourceId: row.source_id,
          kind: row.kind,
          databaseReaderId: row.database_reader_id,
        }
      : undefined
  }

  /**
   * Store a hashed session with a fixed expiry timestamp.
   * hash 化 session を固定 expiry timestamp と共に保存します。
   *
   * Args:
   *   tokenHash: SHA-256 token digest.
   *   expiresAt: Expiry in Unix milliseconds.
   */
  createSession(tokenHash: string, expiresAt: number): void {
    this.deleteExpiredSessions(Date.now())
    this.#database
      .prepare("INSERT INTO sessions (token_hash, expires_at, created_at) VALUES (?, ?, ?)")
      .run(tokenHash, expiresAt, Date.now())
  }

  /**
   * Check whether a hashed session is still valid.
   * hash 化 session が有効か確認します。
   *
   * Args:
   *   tokenHash: SHA-256 token digest.
   *   now: Current Unix time in milliseconds.
   *
   * Returns:
   *   True only for a known unexpired session.
   */
  hasSession(tokenHash: string, now: number): boolean {
    const row = this.#database
      .prepare("SELECT 1 AS present FROM sessions WHERE token_hash = ? AND expires_at > ?")
      .get(tokenHash, now) as { present: number } | undefined
    return row?.present === 1
  }

  /** Delete one hashed session. / hash 化 session を1件削除します。 */
  deleteSession(tokenHash: string): void {
    this.#database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash)
  }

  /** Delete expired sessions. / 失効済み session を削除します。 */
  deleteExpiredSessions(now: number): void {
    this.#database.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now)
  }

  /** Close the SQLite connection. / SQLite connection を閉じます。 */
  close(): void {
    this.#database.close()
  }
}
