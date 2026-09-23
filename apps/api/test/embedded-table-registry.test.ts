import { describe, expect, it } from "vitest"
import { EmbeddedTableRegistry } from "../src/embedded-table-registry.js"

const state = {
  readerArticleId: "art_reader_article",
  sourceTableId: "private-notion-data-source",
  columns: [{ sourcePropertyId: "private-property", label: "Name" }],
} as const

describe("EmbeddedTableRegistry", () => {
  it("binds an opaque table token to its article and expires it", () => {
    let now = 0
    const registry = new EmbeddedTableRegistry({
      ttlMs: 10,
      now: () => now,
      createToken: () => `tbl_${"a".repeat(43)}`,
    })
    const token = registry.issue(state)
    expect(token).toMatch(/^tbl_[A-Za-z0-9_-]{43}$/)
    expect(registry.resolve(token, state.readerArticleId)).toEqual(state)
    expect(registry.resolve(token, "art_other_article")).toBeUndefined()
    now = 11
    expect(registry.resolve(token, state.readerArticleId)).toBeUndefined()
  })

  it("evicts the oldest entry at its bound", () => {
    let index = 0
    const registry = new EmbeddedTableRegistry({
      maxEntries: 1,
      createToken: () => `tbl_${String.fromCharCode(97 + index++).repeat(43)}`,
    })
    const first = registry.issue(state)
    const second = registry.issue({ ...state, sourceTableId: "second-private-source" })
    expect(registry.resolve(first, state.readerArticleId)).toBeUndefined()
    expect(registry.resolve(second, state.readerArticleId)?.sourceTableId).toBe(
      "second-private-source",
    )
  })
})
