import type { ContentDatabaseConfig } from "../config.js"
import type {
  ContentAdapter,
  SourceArticle,
  SourceArticleSummary,
  SourceAsset,
  SourceFilter,
  SourcePage,
  SourceQuery,
  SourceValue,
} from "./content-adapter.js"

const fixtureArticles: readonly SourceArticle[] = [
  {
    sourceId: "fixture-page-flame-test",
    sourceDataSourceId: "fixture-chemistry-notes",
    title: "炎色反応 E=h\\nu",
    titleRichText: [
      { text: "炎色反応 " },
      { type: "equation", expression: "E=h\\nu", text: "E=h\\nu" },
    ],
    icon: { kind: "emoji", value: "🔥" },
    createdTime: "2026-01-10T09:00:00.000Z",
    lastEditedTime: "2026-09-01T12:00:00.000Z",
    properties: {
      "fixture-title": { type: "string", value: "炎色反応 E=h\\nu" },
      "fixture-main-class": {
        type: "reference",
        value: {
          sourceId: "fixture-ref-chemistry",
          sourceDataSourceId: "fixture-classifications",
          title: "CHEMISTRY",
          icon: { kind: "emoji", value: "✦" },
        },
      },
      "fixture-sub-class": {
        type: "reference",
        value: {
          sourceId: "fixture-ref-atomic-emission",
          sourceDataSourceId: "fixture-classifications",
          title: "ATOMIC EMISSION",
          icon: { kind: "emoji", value: "Ⅶ" },
        },
      },
      "fixture-code-name": { type: "string", value: "FLAME TEST" },
      "fixture-tags": {
        type: "string[]",
        value: ["chemistry", "atomic-emission", "spectroscopy", "flame-test"],
      },
    },
    blocks: [
      {
        type: "paragraph",
        content: [
          {
            text: "炎色反応は、金属元素やその塩を炎の中で加熱したとき、元素ごとに特徴的な色の光が現れる現象です。",
          },
          { text: " 光子のエネルギーは " },
          { type: "equation", expression: "E=h\\nu", text: "E=h\\nu" },
          { text: " で表せます。" },
        ],
      },
      { type: "math", expression: "\\ce{Na+ ->[heat] Na^{*} -> Na+ + h\\nu}" },
      { type: "heading", level: 2, content: [{ text: "観察" }] },
      {
        type: "paragraph",
        content: [
          {
            text: "ナトリウムの黄色は非常に強く、微量でも観察されるため、他の元素の色を隠すことがあります。",
          },
        ],
      },
      {
        type: "table",
        hasColumnHeader: true,
        hasRowHeader: false,
        rows: [
          [[{ text: "元素" }], [{ text: "代表的な炎色" }]],
          [[{ text: "Na" }], [{ text: "黄" }]],
          [[{ text: "K" }], [{ text: "淡紫" }]],
          [[{ text: "Cu" }], [{ text: "青緑" }]],
        ],
      },
      { type: "heading", level: 2, content: [{ text: "原理" }] },
      {
        type: "paragraph",
        content: [
          {
            text: "励起された電子が低いエネルギー準位へ戻る際、エネルギー差に対応する光子を放出します。",
          },
        ],
      },
    ],
  },
  {
    sourceId: "fixture-page-periodic-table",
    sourceDataSourceId: "fixture-chemistry-notes",
    title: "周期表の読み方",
    titleRichText: [{ text: "周期表の読み方" }],
    icon: { kind: "emoji", value: "⚛️" },
    createdTime: "2026-02-14T09:00:00.000Z",
    lastEditedTime: "2026-08-20T12:00:00.000Z",
    properties: {
      "fixture-title": { type: "string", value: "周期表の読み方" },
      "fixture-main-class": {
        type: "reference",
        value: {
          sourceId: "fixture-ref-chemistry",
          sourceDataSourceId: "fixture-classifications",
          title: "CHEMISTRY",
          icon: { kind: "emoji", value: "✦" },
        },
      },
      "fixture-sub-class": {
        type: "reference",
        value: {
          sourceId: "fixture-ref-periodicity",
          sourceDataSourceId: "fixture-classifications",
          title: "PERIODICITY",
          icon: { kind: "emoji", value: "◫" },
        },
      },
      "fixture-code-name": { type: "string", value: "PERIODIC TABLE" },
      "fixture-tags": { type: "string[]", value: ["chemistry", "elements"] },
    },
    blocks: [
      {
        type: "paragraph",
        content: [{ text: "周期表は元素を原子番号の順に並べ、性質の周期性を示した表です。" }],
      },
      {
        type: "callout",
        icon: { kind: "emoji", value: "💡" },
        content: [{ text: "同じ族の元素は似た化学的性質を示します。" }],
      },
    ],
  },
]

function matchesFilter(value: SourceValue | undefined, filter: SourceFilter): boolean {
  if (filter.operator === "isEmpty") {
    return (
      value === undefined ||
      ("value" in value && Array.isArray(value.value) && value.value.length === 0)
    )
  }
  if (!value || filter.value === undefined) {
    return false
  }
  if (filter.operator === "contains") {
    return Array.isArray(value.value)
      ? value.value.some((entry) =>
          typeof entry === "string"
            ? entry.toLocaleLowerCase().includes(String(filter.value).toLocaleLowerCase())
            : false,
        )
      : String(value.value).toLocaleLowerCase().includes(String(filter.value).toLocaleLowerCase())
  }
  if (filter.operator === "equals") {
    if (value.type === "reference") {
      return value.value.title.toLocaleLowerCase() === String(filter.value).toLocaleLowerCase()
    }
    return value.value === filter.value
  }
  if (value.type === "number" && typeof filter.value === "number") {
    const comparisons = {
      greaterThan: value.value > filter.value,
      greaterThanOrEqual: value.value >= filter.value,
      lessThan: value.value < filter.value,
      lessThanOrEqual: value.value <= filter.value,
    }
    return comparisons[filter.operator as keyof typeof comparisons] ?? false
  }
  if (value.type === "date" && typeof filter.value === "string") {
    const left = Date.parse(value.value.start)
    const right = Date.parse(filter.value)
    return filter.operator === "before" ? left < right : filter.operator === "after" && left > right
  }
  return false
}

function encodeCursor(offset: number): string {
  return Buffer.from(String(offset), "utf8").toString("base64url")
}

function decodeCursor(cursor: string | undefined): number {
  if (!cursor) {
    return 0
  }
  const offset = Number.parseInt(Buffer.from(cursor, "base64url").toString("utf8"), 10)
  return Number.isSafeInteger(offset) && offset >= 0 ? offset : 0
}

function sortableValue(article: SourceArticle, database: ContentDatabaseConfig, field: string) {
  if (field === "created_time") return article.createdTime
  if (field === "last_edited_time") return article.lastEditedTime
  const propertyId = database.variables[field]?.propertyId ?? database.filters[field]?.propertyId
  const value = propertyId ? article.properties[propertyId] : undefined
  if (!value) return ""
  if (value.type === "reference") return value.value.title
  if (value.type === "reference[]") return value.value.map((entry) => entry.title).join("\u0000")
  if (value.type === "date") return value.value.start
  if (value.type === "string[]") return value.value.join("\u0000")
  return value.value
}

/**
 * Serve deterministic in-memory content through the production adapter contract.
 * 本番 adapter contract を通して決定的な memory 内 content を提供します。
 */
export class FixtureAdapter implements ContentAdapter {
  async listArticles(database: ContentDatabaseConfig, query: SourceQuery): Promise<SourcePage> {
    const filtered = fixtureArticles
      .filter((article) => article.sourceDataSourceId === database.sourceDataSourceId)
      .filter(
        (article) =>
          !query.query ||
          article.title.toLocaleLowerCase().includes(query.query.toLocaleLowerCase()),
      )
      .filter((article) =>
        (query.filters ?? []).every((filter) =>
          matchesFilter(article.properties[filter.propertyId], filter),
        ),
      )

    const sorted = [...filtered].sort((left, right) => {
      for (const sort of database.sort) {
        const leftValue = sortableValue(left, database, sort.field)
        const rightValue = sortableValue(right, database, sort.field)
        const comparison =
          typeof leftValue === "number" && typeof rightValue === "number"
            ? leftValue - rightValue
            : String(leftValue).localeCompare(String(rightValue))
        if (comparison !== 0) {
          return comparison * (sort.direction === "descending" ? -1 : 1)
        }
      }
      return 0
    })
    const offset = decodeCursor(query.cursor)
    const items = sorted.slice(offset, offset + query.pageSize)
    const nextOffset = offset + items.length
    return {
      items: items.map(({ properties: _properties, blocks: _blocks, ...summary }) => summary),
      nextCursor: nextOffset < sorted.length ? encodeCursor(nextOffset) : null,
    }
  }

  async getArticle(
    database: ContentDatabaseConfig,
    sourcePageId: string,
  ): Promise<SourceArticle | undefined> {
    return fixtureArticles.find(
      (article) =>
        article.sourceDataSourceId === database.sourceDataSourceId &&
        article.sourceId === sourcePageId,
    )
  }

  async getAsset(_sourceAssetId: string): Promise<SourceAsset | undefined> {
    return undefined
  }
}

export const fixtureArticleSummaries: readonly SourceArticleSummary[] = fixtureArticles
