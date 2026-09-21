import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import yaml from "js-yaml"
import { afterEach, describe, expect, it } from "vitest"
import type { ReaderConfig, ReaderConfigInput } from "../src/config.js"
import {
  PropertyConfigurationError,
  resolvePropertyNames,
  resolvePropertyNamesInFile,
  resolvePropertyNamesAtStartup,
  type SourcePropertySchema,
} from "../src/property-name-resolver.js"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

function database(id: string, sourceDataSourceId: string) {
  return {
    id,
    name: id,
    sourceDataSourceId,
    titlePropertyName: "Title",
    defaultTemplate: "simple" as const,
    templates: ["simple" as const],
    sort: [{ field: "created_time", direction: "ascending" as const }],
    variables: {
      category: { propertyName: "Category", type: "string" as const, required: false },
    },
    filters: {},
  }
}

describe("Property name resolver", () => {
  it("resolves identical names independently within each Data Source", () => {
    const config: ReaderConfigInput = {
      version: 1,
      source: "notion",
      contentDatabases: [
        database("database-one", "source-one"),
        database("database-two", "source-two"),
      ],
      relationSources: [],
    }
    const schemas = new Map<string, readonly SourcePropertySchema[]>([
      [
        "source-one",
        [
          { name: "Title", id: "title-one", type: "title" },
          { name: "Category", id: "category-one", type: "rich_text" },
        ],
      ],
      [
        "source-two",
        [
          { name: "Title", id: "title-two", type: "title" },
          { name: "Category", id: "category-two", type: "rich_text" },
        ],
      ],
    ])

    const result = resolvePropertyNames(config, schemas)

    expect(result.issues).toEqual([])
    expect(result.config.contentDatabases[0]?.variables.category?.propertyId).toBe("category-one")
    expect(result.config.contentDatabases[1]?.variables.category?.propertyId).toBe("category-two")
    expect(config.contentDatabases[0]?.variables.category?.propertyName).toBe("Category")
  })

  it("keeps the legacy name-in-ID fallback limited to migration mode", () => {
    const config: ReaderConfigInput = {
      version: 1,
      source: "notion",
      contentDatabases: [
        {
          id: "database-one",
          name: "database-one",
          sourceDataSourceId: "source-one",
          titlePropertyId: "Title",
          defaultTemplate: "simple",
          templates: ["simple"],
          sort: [{ field: "created_time", direction: "ascending" }],
          variables: {
            category: { propertyId: "Category", type: "string", required: false },
          },
          filters: {},
        },
      ],
      relationSources: [],
    }
    const schemas = new Map([
      [
        "source-one",
        [
          { name: "Title", id: "title-id", type: "title" },
          { name: "Category", id: "category-id", type: "rich_text" },
        ],
      ],
    ])

    expect(resolvePropertyNames(config, schemas).issues).toContainEqual(
      expect.objectContaining({ issue: "no_exact_match" }),
    )
    expect(resolvePropertyNames(config, schemas, true).config.contentDatabases[0]).toEqual(
      expect.objectContaining({ titlePropertyId: "title-id" }),
    )
  })

  it("refuses a type mismatch without exposing the configured name or ID", () => {
    const config: ReaderConfigInput = {
      version: 1,
      source: "notion",
      contentDatabases: [database("database-one", "source-one")],
      relationSources: [],
    }
    const result = resolvePropertyNames(
      config,
      new Map([
        [
          "source-one",
          [
            { name: "Title", id: "title-secret", type: "title" },
            { name: "Category", id: "category-secret", type: "relation" },
          ],
        ],
      ]),
    )

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        path: "contentDatabases[0].variables.category.propertyName",
        issue: "type_mismatch",
        actualType: "relation",
      }),
    )
    expect(JSON.stringify({ changes: result.changes, issues: result.issues })).not.toMatch(
      /Category|secret/,
    )
  })

  it("writes atomically with a backup only after every mapping passes", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "reader-property-resolver-"))
    temporaryDirectories.push(directory)
    const configPath = path.join(directory, "reader.yaml")
    const config: ReaderConfigInput = {
      version: 1,
      source: "notion",
      contentDatabases: [database("database-one", "source-one")],
      relationSources: [],
    }
    const original = yaml.dump(config)
    await writeFile(configPath, original, "utf8")

    const summary = await resolvePropertyNamesInFile(configPath, async () => [
      { name: "Title", id: "title-id", type: "title" },
      { name: "Category", id: "category-id", type: "rich_text" },
    ])

    expect(summary).toEqual(
      expect.objectContaining({ written: true, backupCreated: true, issues: [] }),
    )
    expect(await readFile(`${configPath}.bak`, "utf8")).toBe(original)
    const resolved = yaml.load(await readFile(configPath, "utf8")) as ReaderConfig
    expect(resolved.contentDatabases[0]?.titlePropertyId).toBe("title-id")
    expect(resolved.contentDatabases[0]?.variables.category?.propertyId).toBe("category-id")
  })

  it("leaves the file untouched when any mapping cannot be resolved", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "reader-property-resolver-"))
    temporaryDirectories.push(directory)
    const configPath = path.join(directory, "reader.yaml")
    const config: ReaderConfigInput = {
      version: 1,
      source: "notion",
      contentDatabases: [database("database-one", "source-one")],
      relationSources: [],
    }
    const original = yaml.dump(config)
    await writeFile(configPath, original, "utf8")

    const summary = await resolvePropertyNamesInFile(configPath, async () => [
      { name: "Title", id: "title-id", type: "title" },
    ])

    expect(summary.written).toBe(false)
    expect(summary.issues).toContainEqual(expect.objectContaining({ issue: "no_exact_match" }))
    expect(await readFile(configPath, "utf8")).toBe(original)
    await expect(readFile(`${configPath}.bak`, "utf8")).rejects.toMatchObject({ code: "ENOENT" })
  })

  it("resolves startup schemas once per Data Source without modifying the input", async () => {
    const config: ReaderConfigInput = {
      version: 1,
      source: "notion",
      contentDatabases: [database("database-one", "source-one")],
      relationSources: [],
    }
    let calls = 0
    const resolved = await resolvePropertyNamesAtStartup(config, async () => {
      calls += 1
      return [
        { name: "Title", id: "title-id", type: "title" },
        { name: "Category", id: "category-id", type: "rich_text" },
      ]
    })

    expect(calls).toBe(1)
    expect(resolved.contentDatabases[0]?.titlePropertyId).toBe("title-id")
    expect(config.contentDatabases[0]?.titlePropertyName).toBe("Title")
  })

  it("fails startup with a redacted diagnostic", async () => {
    const config: ReaderConfigInput = {
      version: 1,
      source: "notion",
      contentDatabases: [database("database-one", "source-one")],
      relationSources: [],
    }

    const failure = await resolvePropertyNamesAtStartup(config, async () => [
      { name: "Title", id: "secret-title-id", type: "title" },
      { name: "Category", id: "secret-category-id", type: "relation" },
    ]).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(PropertyConfigurationError)
    expect(String(failure)).not.toMatch(/Title|Category|secret/)
  })
})
