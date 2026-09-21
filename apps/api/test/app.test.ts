import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import argon2 from "argon2"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { FixtureAdapter } from "../src/adapters/fixture-adapter.js"
import { buildApp, sessionCookiePolicy } from "../src/app.js"
import { loadReaderConfig, type RuntimeConfig } from "../src/config.js"

describe("Reader API", () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let workingDirectory: string

  beforeEach(async () => {
    workingDirectory = await mkdtemp(path.join(tmpdir(), "notion-reader-test-"))
    const reader = await loadReaderConfig(
      path.resolve(import.meta.dirname, "../../../config/reader.example.yaml"),
    )
    const passwordHash = await argon2.hash("correct-password", {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    })
    const runtime: RuntimeConfig = {
      reader,
      environment: "test",
      host: "127.0.0.1",
      port: 3000,
      databasePath: path.join(workingDirectory, "reader.sqlite"),
      passwordHash,
      serveWeb: false,
    }
    app = await buildApp({ runtime, adapter: new FixtureAdapter(), logger: false })
  })

  afterEach(async () => {
    await app.close()
  })

  async function login(): Promise<string> {
    const response = await app.inject({
      method: "POST",
      url: "/api/session",
      payload: { password: "correct-password" },
    })
    expect(response.statusCode).toBe(204)
    const header = response.headers["set-cookie"]
    const value = Array.isArray(header) ? header[0] : header
    return (value ?? "").split(";")[0] ?? ""
  }

  it("protects content routes and marks API responses no-store", async () => {
    const response = await app.inject({ method: "GET", url: "/api/databases" })
    expect(response.statusCode).toBe(401)
    expect(response.headers["cache-control"]).toBe("no-store")
  })

  it("uses a host-only secure production cookie policy", () => {
    expect(sessionCookiePolicy("production")).toEqual({
      name: "__Host-reader_session",
      options: { httpOnly: true, secure: true, sameSite: "strict", path: "/" },
    })
  })

  it("rejects cross-origin state-changing requests", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/session",
      headers: { host: "localhost:3000", origin: "https://attacker.invalid" },
      payload: { password: "correct-password" },
    })
    expect(response.statusCode).toBe(403)
  })

  it("serves a fixture article without leaking source IDs", async () => {
    const cookie = await login()
    const list = await app.inject({
      method: "GET",
      url: "/api/databases/chemistry-notes/articles?pageSize=1",
      headers: { cookie },
    })
    expect(list.statusCode).toBe(200)
    expect(list.body).not.toContain("fixture-page")
    const page = list.json<{ items: Array<{ id: string }>; nextCursor: string | null }>()
    expect(page.nextCursor).not.toBeNull()

    const article = await app.inject({
      method: "GET",
      url: `/api/articles/${page.items[0]?.id}`,
      headers: { cookie },
    })
    expect(article.statusCode).toBe(200)
    expect(article.body).toContain("FLAME TEST")
    expect(article.body).not.toContain("fixture-page-flame-test")
    expect(article.headers["cache-control"]).toBe("no-store")
  })

  it("allows only configured Reader filters and has no generic Notion proxy", async () => {
    const cookie = await login()
    const search = await app.inject({
      method: "POST",
      url: "/api/search",
      headers: { cookie },
      payload: {
        query: "炎色",
        filters: [{ fieldId: "tags", operator: "contains", value: "chemistry" }],
      },
    })
    expect(search.statusCode).toBe(200)
    expect(search.json<{ items: unknown[] }>().items).toHaveLength(1)

    const rejected = await app.inject({
      method: "POST",
      url: "/api/search",
      headers: { cookie },
      payload: {
        filters: [{ fieldId: "notion-property-id", operator: "equals", value: "secret" }],
      },
    })
    expect(rejected.statusCode).toBe(400)

    const proxy = await app.inject({
      method: "POST",
      url: "/api/notion",
      headers: { cookie },
      payload: { endpoint: "/v1/pages/anything" },
    })
    expect(proxy.statusCode).toBe(404)

    const unknown = await app.inject({
      method: "GET",
      url: "/api/articles/art_unknown",
      headers: { cookie },
    })
    expect(unknown.statusCode).toBe(404)
  })

  it("does not persist fixture content in SQLite", async () => {
    const cookie = await login()
    const list = await app.inject({
      method: "GET",
      url: "/api/databases/chemistry-notes/articles",
      headers: { cookie },
    })
    expect(list.statusCode).toBe(200)
    const bytes = await readFile(path.join(workingDirectory, "reader.sqlite"))
    expect(bytes.toString("utf8")).not.toContain("炎色反応")
    expect(bytes.toString("utf8")).not.toContain("FLAME TEST")
  })
})
