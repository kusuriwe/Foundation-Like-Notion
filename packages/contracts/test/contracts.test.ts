import { describe, expect, it } from "vitest"
import {
  DemoDatasetSchema,
  DemoManifestSchema,
  PresentationInputSchema,
  ReaderCursorSchema,
  ReaderValueSchema,
  RichTextSchema,
  RichTextTextSchema,
  SearchRequestSchema,
} from "../src/index.js"
import { defaultPresentationValue } from "../src/presentation-default.js"

const demoDataset = {
  presentation: {},
  databases: [
    {
      id: "demo_database",
      name: "Demo",
      defaultTemplate: "simple",
      templates: ["simple"],
    },
  ],
  articles: [
    {
      id: "demo_article",
      databaseId: "demo_database",
      title: "Demo article",
      titleRichText: [{ text: "Demo article" }],
      createdTime: "2026-01-01T00:00:00.000+00:00",
      lastEditedTime: "2026-01-01T00:00:00.000+00:00",
      variables: {},
      blocks: [],
      defaultTemplate: "simple",
      templates: ["simple"],
    },
  ],
  assets: {},
}

describe("Reader contracts", () => {
  it("uses a light palette when only the light scheme is configured", () => {
    const presentation = PresentationInputSchema.parse({ theme: { colorScheme: "light" } })
    expect(presentation.theme.colors.background).toBe("#f5f7fa")
    expect(presentation.theme.colors.text).toBe("#17202c")
    expect(presentation.theme.colors.accent).toBe("#365314")
  })

  it("rejects a locale that would throw during date formatting", () => {
    expect(() => PresentationInputSchema.parse({ locale: "not_a_locale" })).toThrow()
    expect(PresentationInputSchema.parse({ locale: "en-US" }).locale).toBe("en-US")
  })

  it("rejects private or unknown top-level demo manifest fields", () => {
    const manifest = {
      presentation: {},
      databases: [],
      articleFiles: ["articles/example.yaml"],
      assets: {},
    }
    expect(DemoManifestSchema.parse(manifest).articleFiles).toHaveLength(1)
    expect(() => DemoManifestSchema.parse({ ...manifest, notionToken: "must-not-build" })).toThrow()
    expect(() => DemoManifestSchema.parse({ ...manifest, sourceDataSourceId: "private" })).toThrow()
  })

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

  it("resolves safe presentation defaults and rejects executable styling inputs", () => {
    const presentation = PresentationInputSchema.parse({
      brand: { name: "Public demo" },
      theme: { colors: { accent: "#123ABC" } },
    })
    expect(presentation.brand.name).toBe("Public demo")
    expect(presentation.brand.shortName).toBe("Reader")
    expect(presentation.articleHeaders.simple?.renderer).toBe("field-grid")
    expect(presentation.articleHeaders["cactus-study"]?.renderer).toBe("cactus-study")
    expect(presentation.theme.colors.accent).toBe("#123ABC")
    expect(PresentationInputSchema.parse({})).toEqual(defaultPresentationValue)

    expect(() =>
      PresentationInputSchema.parse({ theme: { colors: { accent: "url(javascript:alert(1))" } } }),
    ).toThrow()
    expect(() =>
      PresentationInputSchema.parse({ stylesheetUrl: "https://example.invalid" }),
    ).toThrow()
    expect(() =>
      PresentationInputSchema.parse({
        articleHeaders: {
          "Invalid Header": {
            name: "Invalid",
            renderer: "field-grid",
            title: { placement: "content", alignment: "center" },
            fields: [],
          },
        },
      }),
    ).toThrow()
    expect(() =>
      PresentationInputSchema.parse({
        articleHeaders: {
          "wide-cactus": {
            name: "Wide",
            renderer: "cactus-study",
            title: { placement: "content", alignment: "center" },
            headlineVariable: "codeName",
            seriesMark: "OVERSIZED",
            fields: [],
          },
        },
      }),
    ).toThrow()
    expect(() =>
      PresentationInputSchema.parse({
        articleHeaders: {
          "unsafe-cactus": {
            name: "Unsafe",
            renderer: "cactus-study",
            title: { placement: "content", alignment: "center" },
            headlineVariable: "codeName",
            seriesMark: "Ⅶ",
            seriesLabel: "Reference file",
            fields: [],
            html: "<script>alert(1)</script>",
          },
        },
      }),
    ).toThrow()
  })

  it("rejects broken public demo references before bundling", () => {
    expect(DemoDatasetSchema.parse(demoDataset).articles).toHaveLength(1)
    expect(() =>
      DemoDatasetSchema.parse({
        ...demoDataset,
        articles: [{ ...demoDataset.articles[0], databaseId: "demo_missing" }],
      }),
    ).toThrow(/database/i)
    expect(() =>
      DemoDatasetSchema.parse({
        ...demoDataset,
        articles: [
          {
            ...demoDataset.articles[0],
            blocks: [{ type: "image", assetId: "demo_missing", caption: [] }],
          },
        ],
      }),
    ).toThrow(/asset/i)
    expect(() =>
      DemoDatasetSchema.parse({
        ...demoDataset,
        articles: [{ ...demoDataset.articles[0], sourceDataSourceId: "private-source-id" }],
      }),
    ).toThrow()
  })
})
