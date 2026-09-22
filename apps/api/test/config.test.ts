import path from "node:path"
import { describe, expect, it } from "vitest"
import { loadReaderConfig, ReaderConfigInputSchema, ReaderConfigSchema } from "../src/config.js"

describe("Reader configuration", () => {
  it("loads the tracked fixture example", async () => {
    const config = await loadReaderConfig(
      path.resolve(import.meta.dirname, "../../../config/reader.example.yaml"),
    )
    expect(config.source).toBe("fixture")
    expect(config.contentDatabases[0]?.sort).toEqual([
      { field: "created_time", direction: "ascending" },
    ])
    expect(config.presentation.articleHeaders.simple?.renderer).toBe("field-grid")
  })

  it("keeps presentation optional while validating custom header references", () => {
    const database = {
      id: "database-one",
      name: "One",
      sourceDataSourceId: "source-one",
      titlePropertyId: "title",
      defaultTemplate: "custom-header",
      templates: ["custom-header"],
      variables: {},
      filters: {},
    }
    const result = ReaderConfigSchema.safeParse({
      version: 1,
      source: "fixture",
      contentDatabases: [database],
      presentation: {
        articleHeaders: {
          "custom-header": {
            name: "Custom",
            renderer: "field-grid",
            title: { placement: "content", alignment: "center" },
            fields: [{ variable: "typo", label: "Typo" }],
          },
        },
      },
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain(
        "Article header references an unknown Reader variable",
      )
    }
  })

  it("rejects an unmapped variable when a built-in header ID is overridden", () => {
    const result = ReaderConfigSchema.safeParse({
      version: 1,
      source: "fixture",
      contentDatabases: [
        {
          id: "database-one",
          name: "One",
          sourceDataSourceId: "source-one",
          titlePropertyId: "title",
          defaultTemplate: "simple",
          templates: ["simple"],
          variables: {},
          filters: {},
        },
      ],
      presentation: {
        articleHeaders: {
          simple: {
            name: "Custom simple",
            renderer: "field-grid",
            title: { placement: "content", alignment: "center" },
            fields: [{ variable: "codeName", label: "Code" }],
          },
        },
      },
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain(
        "Article header references an unknown Reader variable",
      )
    }
  })

  it("rejects duplicate database IDs", () => {
    const database = {
      id: "duplicate-db",
      name: "One",
      sourceDataSourceId: "source-one",
      titlePropertyId: "title",
      defaultTemplate: "simple",
      templates: ["simple"],
      variables: {},
      filters: {},
    }
    expect(() =>
      ReaderConfigSchema.parse({
        version: 1,
        source: "fixture",
        contentDatabases: [database, { ...database, sourceDataSourceId: "source-two" }],
      }),
    ).toThrow(/unique/i)
  })

  it("rejects unknown keys instead of silently ignoring typos", () => {
    const database = {
      id: "database-one",
      name: "One",
      sourceDataSourceId: "source-one",
      titlePropertyId: "title",
      defaultTemplate: "simple",
      templates: ["simple"],
      variables: {},
      filters: {},
    }
    const result = ReaderConfigSchema.safeParse({
      version: 1,
      source: "fixture",
      contentDatabases: [database],
      unexpectedSetting: true,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ code: "unrecognized_keys", keys: ["unexpectedSetting"] }),
      )
    }
  })

  it("rejects incompatible filters and unmapped sort fields at startup", () => {
    const result = ReaderConfigSchema.safeParse({
      version: 1,
      source: "fixture",
      contentDatabases: [
        {
          id: "database-one",
          name: "One",
          sourceDataSourceId: "source-one",
          titlePropertyId: "title",
          defaultTemplate: "simple",
          templates: ["simple"],
          sort: [{ field: "typo", direction: "ascending" }],
          variables: {},
          filters: {
            published: {
              propertyId: "published",
              type: "boolean",
              sourceType: "checkbox",
              operators: ["contains"],
            },
          },
        },
      ],
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toEqual(
        expect.arrayContaining([
          "Operator contains is not valid for checkbox",
          "Sort field must be a timestamp or configured Reader field",
        ]),
      )
    }
  })

  it("rejects Reader filter types that do not match their source types", () => {
    const result = ReaderConfigSchema.safeParse({
      version: 1,
      source: "fixture",
      contentDatabases: [
        {
          id: "database-one",
          name: "One",
          sourceDataSourceId: "source-one",
          titlePropertyId: "title",
          defaultTemplate: "simple",
          templates: ["simple"],
          variables: {},
          filters: {
            amount: {
              propertyId: "amount",
              type: "string",
              sourceType: "number",
              operators: ["equals"],
            },
          },
        },
      ],
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain(
        "Reader type string is not valid for number",
      )
    }
  })

  it("accepts mixed Property IDs and names for Notion input", () => {
    const result = ReaderConfigInputSchema.parse({
      version: 1,
      source: "notion",
      contentDatabases: [
        {
          id: "database-one",
          name: "One",
          sourceDataSourceId: "source-one",
          titlePropertyName: "Name",
          defaultTemplate: "simple",
          templates: ["simple"],
          variables: {
            codeName: { propertyId: "code-id", type: "string" },
            tags: { propertyName: "Tags", type: "string[]" },
          },
          filters: {},
        },
      ],
    })

    expect(result.contentDatabases[0]?.titlePropertyName).toBe("Name")
    expect(result.contentDatabases[0]?.variables.codeName?.propertyId).toBe("code-id")
    expect(result.contentDatabases[0]?.variables.tags?.propertyName).toBe("Tags")
  })

  it("requires exactly one Property locator", () => {
    const base = {
      id: "database-one",
      name: "One",
      sourceDataSourceId: "source-one",
      defaultTemplate: "simple",
      templates: ["simple"],
      variables: {},
      filters: {},
    }
    expect(
      ReaderConfigInputSchema.safeParse({
        version: 1,
        source: "notion",
        contentDatabases: [{ ...base, titlePropertyId: "id", titlePropertyName: "Name" }],
      }).success,
    ).toBe(false)
    expect(
      ReaderConfigInputSchema.safeParse({
        version: 1,
        source: "notion",
        contentDatabases: [{ ...base }],
      }).success,
    ).toBe(false)
  })

  it("requires Property IDs for fixture input", () => {
    const result = ReaderConfigInputSchema.safeParse({
      version: 1,
      source: "fixture",
      contentDatabases: [
        {
          id: "database-one",
          name: "One",
          sourceDataSourceId: "source-one",
          titlePropertyName: "Name",
          defaultTemplate: "simple",
          templates: ["simple"],
          variables: {},
          filters: {},
        },
      ],
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain(
        "Fixture configuration requires Property IDs",
      )
    }
  })
})
