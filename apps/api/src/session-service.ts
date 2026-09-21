import { createHash, randomBytes } from "node:crypto"
import argon2 from "argon2"
import type { ReaderDatabase } from "./database.js"

const SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex")
}

/**
 * Authenticate the reader password and manage server-side sessions.
 * Reader password を認証し、server-side session を管理します。
 */
export class SessionService {
  readonly #database: ReaderDatabase
  readonly #passwordHash: string

  constructor(database: ReaderDatabase, passwordHash: string) {
    this.#database = database
    this.#passwordHash = passwordHash
  }

  /**
   * Verify a password and create a fixed-lifetime random session.
   * password を検証し、固定 lifetime の random session を作成します。
   *
   * Args:
   *   password: Candidate reader password.
   *   now: Session creation time in Unix milliseconds.
   *
   * Returns:
   *   Raw token for the cookie, or undefined when verification fails.
   */
  async login(password: string, now = Date.now()): Promise<string | undefined> {
    const valid = await argon2.verify(this.#passwordHash, password)
    if (!valid) {
      return undefined
    }
    const token = randomBytes(32).toString("base64url")
    this.#database.createSession(hashToken(token), now + SESSION_LIFETIME_MS)
    return token
  }

  /**
   * Validate a raw session token against server-side state.
   * raw session token を server-side state に対して検証します。
   *
   * Args:
   *   token: Raw cookie token, if present.
   *   now: Current Unix time in milliseconds.
   *
   * Returns:
   *   Whether the session exists and has not expired.
   */
  isAuthenticated(token: string | undefined, now = Date.now()): boolean {
    return token ? this.#database.hasSession(hashToken(token), now) : false
  }

  /** Revoke a session token when present. / 存在する session token を失効させます。 */
  logout(token: string | undefined): void {
    if (token) {
      this.#database.deleteSession(hashToken(token))
    }
  }
}

export const sessionLifetimeSeconds = SESSION_LIFETIME_MS / 1000
