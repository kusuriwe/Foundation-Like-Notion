import path from "node:path"
import { describe, expect, it } from "vitest"
import { loadReaderConfig, ReaderConfigSchema } from "../src/config.js"

describe("Reader configuration", () => {
  it("loads the tracked fixture example", async () => {
    const config = await loadReaderConfig(
      path.resolve(import.meta.dirname, "../../../config/reader.example.yaml"),
    )
    expect(config.source).toBe("fixture")
    expect(config.contentDatabases[0]?.sort).toEqual([
      { field: "created_time", direction: "ascending" },
    ])
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
})
