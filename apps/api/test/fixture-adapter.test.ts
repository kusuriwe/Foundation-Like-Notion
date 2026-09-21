import type { ContentDatabaseConfig } from "../src/config.js"
import { describe, expect, it } from "vitest"
import { FixtureAdapter } from "../src/adapters/fixture-adapter.js"

const database: ContentDatabaseConfig = {
  id: "chemistry-notes",
  name: "Chemistry Notes",
  sourceDataSourceId: "fixture-chemistry-notes",
  titlePropertyId: "fixture-title",
  defaultTemplate: "simple",
  templates: ["simple", "compact-emblem"],
  sort: [{ field: "codeName", direction: "descending" }],
  variables: {
    codeName: { propertyId: "fixture-code-name", type: "string", required: true },
  },
  filters: {},
}

describe("FixtureAdapter", () => {
  it("applies configured property sorting before pagination", async () => {
    const page = await new FixtureAdapter().listArticles(database, { pageSize: 1 })

    expect(page.items.map((article) => article.title)).toEqual(["周期表の読み方"])
    expect(page.nextCursor).not.toBeNull()
  })
})
