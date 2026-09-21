import { describe, expect, it } from "vitest"
import { ReaderValueSchema, SearchRequestSchema } from "../src/index.js"

describe("Reader contracts", () => {
  it("keeps reference cardinality explicit", () => {
    expect(
      ReaderValueSchema.parse({
        type: "reference[]",
        value: [{ readerId: "ref_12345678", title: "Chemistry" }],
      }),
    ).toEqual({
      type: "reference[]",
      value: [{ readerId: "ref_12345678", title: "Chemistry" }],
    })
  })

  it("rejects unbounded search requests", () => {
    expect(() => SearchRequestSchema.parse({ pageSize: 101 })).toThrow()
    expect(() => SearchRequestSchema.parse({ query: "x".repeat(201) })).toThrow()
  })
})
