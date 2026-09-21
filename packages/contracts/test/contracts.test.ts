import { describe, expect, it } from "vitest"
import {
  ReaderCursorSchema,
  ReaderValueSchema,
  RichTextSchema,
  RichTextTextSchema,
  SearchRequestSchema,
} from "../src/index.js"

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

  it("accepts only Reader-owned cursor tokens", () => {
    expect(ReaderCursorSchema.parse(`cur_${"a".repeat(43)}`)).toHaveLength(47)
    expect(() => ReaderCursorSchema.parse("next-notion-cursor")).toThrow()
    expect(() => ReaderCursorSchema.parse(`cur_${"a".repeat(42)}!`)).toThrow()
  })

  it("accepts text and inline-equation rich text without changing the text wire shape", () => {
    expect(RichTextSchema.parse({ text: "energy" })).toEqual({ text: "energy" })
    expect(
      RichTextSchema.parse({ type: "equation", expression: "E=mc^2", text: "E=mc^2" }),
    ).toEqual({
      type: "equation",
      expression: "E=mc^2",
      text: "E=mc^2",
    })
    expect(
      RichTextTextSchema.parse({ type: "equation", expression: "E=mc^2", text: "E=mc^2" }),
    ).toEqual({ text: "E=mc^2" })
  })

  it("requires operator-specific filter values", () => {
    expect(
      SearchRequestSchema.parse({ filters: [{ fieldId: "empty", operator: "isEmpty" }] }),
    ).toBeDefined()
    expect(
      SearchRequestSchema.parse({
        filters: [{ fieldId: "number", operator: "greaterThan", value: 10 }],
      }),
    ).toBeDefined()
    expect(
      SearchRequestSchema.parse({
        filters: [{ fieldId: "date", operator: "before", value: "2026-09-21" }],
      }),
    ).toBeDefined()

    expect(() =>
      SearchRequestSchema.parse({
        filters: [{ fieldId: "empty", operator: "isEmpty", value: "unexpected" }],
      }),
    ).toThrow()
    expect(() =>
      SearchRequestSchema.parse({ filters: [{ fieldId: "number", operator: "greaterThan" }] }),
    ).toThrow()
    expect(() =>
      SearchRequestSchema.parse({
        filters: [{ fieldId: "number", operator: "greaterThan", value: "10" }],
      }),
    ).toThrow()
    expect(() =>
      SearchRequestSchema.parse({
        filters: [{ fieldId: "date", operator: "after", value: "tomorrow" }],
      }),
    ).toThrow()
  })
})
