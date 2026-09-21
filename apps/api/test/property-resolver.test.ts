import { describe, expect, it } from "vitest"
import type { ContentDatabaseConfig } from "../src/config.js"
import { ReaderDatabase } from "../src/database.js"
import { MappingError, resolveProperties } from "../src/domain/property-resolver.js"

const config: ContentDatabaseConfig = {
  id: "database-test",
  name: "Test",
  sourceDataSourceId: "source",
  titlePropertyId: "title",
  defaultTemplate: "simple",
  templates: ["simple"],
  sort: [{ field: "created_time", direction: "ascending" }],
  variables: {
    title: { propertyId: "title", type: "string", required: true },
    category: { propertyId: "category", type: "reference", required: false },
  },
  filters: {},
}

describe("property resolver", () => {
  it("omits missing values instead of inventing placeholders", () => {
    const database = new ReaderDatabase(":memory:")
    expect(resolveProperties(config, {}, database)).toEqual({})
    database.close()
  })

  it("rejects cardinality mismatches", () => {
    const database = new ReaderDatabase(":memory:")
    expect(() =>
      resolveProperties(
        config,
        {
          category: {
            type: "reference[]",
            value: [{ sourceId: "source-reference", title: "Reference" }],
          },
        },
        database,
      ),
    ).toThrow(MappingError)
    database.close()
  })
})
