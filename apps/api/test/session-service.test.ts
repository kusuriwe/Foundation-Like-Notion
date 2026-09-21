import argon2 from "argon2"
import { describe, expect, it } from "vitest"
import { ReaderDatabase } from "../src/database.js"
import { SessionService, sessionLifetimeSeconds } from "../src/session-service.js"

describe("SessionService", () => {
  it("stores only a token hash and expires after 24 hours", async () => {
    const database = new ReaderDatabase(":memory:")
    const passwordHash = await argon2.hash("test-password", {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    })
    const sessions = new SessionService(database, passwordHash)
    const token = await sessions.login("test-password", 1_000)
    expect(token).toBeDefined()
    expect(sessions.isAuthenticated(token, 1_000 + sessionLifetimeSeconds * 1_000 - 1)).toBe(true)
    expect(sessions.isAuthenticated(token, 1_000 + sessionLifetimeSeconds * 1_000)).toBe(false)
    expect(await sessions.login("wrong-password", 1_000)).toBeUndefined()
    database.close()
  })
})
