import { beforeEach, describe, expect, it } from "vitest"
import { clearRecent, readRecent, recentLimit, recordRecent } from "./recent.js"

describe("recent history", () => {
  beforeEach(clearRecent)

  it("deduplicates and limits records without storing content", () => {
    for (let index = 0; index < recentLimit + 5; index += 1) {
      recordRecent(`article_${index}`, new Date(index * 1_000))
    }
    recordRecent("article_10", new Date(100_000))
    const recent = readRecent()
    expect(recent).toHaveLength(recentLimit)
    expect(recent[0]?.readerArticleId).toBe("article_10")
    expect(Object.keys(recent[0] ?? {})).toEqual(["readerArticleId", "viewedAt"])
  })
})
