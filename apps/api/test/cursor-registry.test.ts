import { describe, expect, it } from "vitest"
import { CursorRegistry } from "../src/cursor-registry.js"

function tokenFactory(...tokens: string[]): () => string {
  let index = 0
  return () => tokens[index++] ?? `cur_${"z".repeat(43)}`
}

describe("CursorRegistry", () => {
  it("resolves reusable state only for the original kind and context", () => {
    const token = `cur_${"a".repeat(43)}`
    const registry = new CursorRegistry({ createToken: tokenFactory(token) })
    const context = ["article-list", "database-one", 20]

    expect(
      registry.issue(context, { kind: "article-list", sourceCursor: "private-source-cursor" }),
    ).toBe(token)
    expect(registry.resolve(token, "search", context)).toBeUndefined()
    expect(registry.resolve(token, "article-list", ["article-list", "database-two", 20])).toBe(
      undefined,
    )
    expect(registry.resolve(token, "article-list", context)).toEqual({
      kind: "article-list",
      sourceCursor: "private-source-cursor",
    })
    expect(registry.resolve(token, "article-list", context)).toEqual({
      kind: "article-list",
      sourceCursor: "private-source-cursor",
    })
  })

  it("expires handles without extending their fixed lifetime", () => {
    let now = 1_000
    const token = `cur_${"b".repeat(43)}`
    const registry = new CursorRegistry({
      ttlMs: 100,
      now: () => now,
      createToken: tokenFactory(token),
    })
    const context = ["search", "query"]
    registry.issue(context, { kind: "search", databaseIndex: 1 })

    now = 1_099
    expect(registry.resolve(token, "search", context)).toEqual({
      kind: "search",
      databaseIndex: 1,
    })
    now = 1_100
    expect(registry.resolve(token, "search", context)).toBeUndefined()
  })

  it("evicts the oldest live handle at the configured capacity", () => {
    const first = `cur_${"c".repeat(43)}`
    const second = `cur_${"d".repeat(43)}`
    const third = `cur_${"e".repeat(43)}`
    const registry = new CursorRegistry({
      maxEntries: 2,
      createToken: tokenFactory(first, second, third),
    })
    const context = ["article-list", "database-one", 20]
    registry.issue(context, { kind: "article-list", sourceCursor: "one" })
    registry.issue(context, { kind: "article-list", sourceCursor: "two" })
    registry.issue(context, { kind: "article-list", sourceCursor: "three" })

    expect(registry.resolve(first, "article-list", context)).toBeUndefined()
    expect(registry.resolve(second, "article-list", context)).toEqual({
      kind: "article-list",
      sourceCursor: "two",
    })
    expect(registry.resolve(third, "article-list", context)).toEqual({
      kind: "article-list",
      sourceCursor: "three",
    })
  })
})
