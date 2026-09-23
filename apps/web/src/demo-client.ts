import type {
  Article,
  ArticleBlock,
  ArticlePage,
  DemoDataset,
  EmbeddedTable,
  ReaderValue,
  SearchFilter,
  SearchRequest,
} from "@foundation-like-notion/contracts"
import type { ReaderClient } from "./reader-client.js"

function searchable(value: ReaderValue | undefined): readonly (string | number | boolean)[] {
  if (!value) return []
  if (value.type === "date") return [value.value.start]
  if (value.type === "reference") return [value.value.readerId, value.value.title]
  if (value.type === "reference[]") {
    return value.value.flatMap((entry) => [entry.readerId, entry.title])
  }
  return Array.isArray(value.value) ? value.value : [value.value]
}

function matchesFilter(article: Article, filter: SearchFilter): boolean {
  const values = searchable(article.variables[filter.fieldId])
  if (filter.operator === "isEmpty") return values.length === 0
  if (filter.operator === "contains") {
    return values.some((value) =>
      String(value).toLocaleLowerCase().includes(filter.value.toLocaleLowerCase()),
    )
  }
  if (filter.operator === "equals") return values.some((value) => value === filter.value)
  const first = values[0]
  if (typeof first === "number" && typeof filter.value === "number") {
    if (filter.operator === "greaterThan") return first > filter.value
    if (filter.operator === "greaterThanOrEqual") return first >= filter.value
    if (filter.operator === "lessThan") return first < filter.value
    if (filter.operator === "lessThanOrEqual") return first <= filter.value
  }
  if (typeof first === "string" && (filter.operator === "before" || filter.operator === "after")) {
    const left = Date.parse(first)
    const right = Date.parse(filter.value)
    return filter.operator === "before" ? left < right : left > right
  }
  return false
}

function randomCursor(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("")
  return `cur_${btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")}`
}

/** Create an in-browser Reader client backed only by validated public demo data. / 検証済み公開demo dataだけを使うbrowser内Reader clientを作成します。 */
export function createStaticDemoClient(dataset: DemoDataset, basePath: string): ReaderClient {
  const cursors = new Map<string, number>()
  const embeddedCursors = new Map<
    string,
    Readonly<{ articleId: string; tableId: string; offset: number }>
  >()
  const paginate = (
    items: readonly Article[],
    cursor: string | undefined,
    pageSize: number,
  ): ArticlePage => {
    const offset = cursor ? cursors.get(cursor) : 0
    if (offset === undefined) throw new Error("Demo cursor is invalid")
    const page = items.slice(offset, offset + pageSize)
    const nextOffset = offset + page.length
    let nextCursor: string | null = null
    if (nextOffset < items.length) {
      nextCursor = randomCursor()
      cursors.set(nextCursor, nextOffset)
    }
    return {
      items: page.map(
        ({ titleRichText: _rich, variables: _variables, blocks: _blocks, ...summary }) => summary,
      ),
      nextCursor,
    }
  }
  return {
    getPresentation: async () => dataset.presentation,
    getSession: async () => true,
    login: async () => undefined,
    logout: async () => undefined,
    getDatabases: async () => [...dataset.databases],
    getArticles: async (databaseId, cursor) =>
      paginate(
        dataset.articles.filter((article) => article.databaseId === databaseId),
        cursor,
        20,
      ),
    getArticle: async (articleId) => {
      const article = dataset.articles.find((entry) => entry.id === articleId)
      if (!article) throw new Error("Demo article is unavailable")
      const prepareBlock = (block: ArticleBlock): ArticleBlock => {
        if (block.type === "callout" && block.children) {
          return { ...block, children: block.children.map(prepareBlock) }
        }
        if (block.type !== "embeddedDatabase") return block
        return {
          ...block,
          tables: block.tables.map((table) => {
            if (table.status === "unavailable" || table.rows.length <= 50) return table
            const nextCursor = randomCursor()
            embeddedCursors.set(nextCursor, { articleId, tableId: table.tableId, offset: 50 })
            return { ...table, rows: table.rows.slice(0, 50), nextCursor }
          }),
        }
      }
      return { ...article, blocks: article.blocks.map(prepareBlock) }
    },
    getEmbeddedTablePage: async (articleId, tableId, cursor) => {
      const state = embeddedCursors.get(cursor)
      if (!state || state.articleId !== articleId || state.tableId !== tableId) {
        throw new Error("Demo embedded-table cursor is invalid")
      }
      const article = dataset.articles.find((entry) => entry.id === articleId)
      const findTable = (
        blocks: readonly ArticleBlock[],
      ): Extract<EmbeddedTable, { status: "available" }> | undefined => {
        for (const block of blocks) {
          if (block.type === "embeddedDatabase") {
            const table = block.tables.find(
              (entry) => entry.status === "available" && entry.tableId === tableId,
            )
            if (table?.status === "available") return table
          }
          if (block.type === "callout" && block.children) {
            const nested: Extract<EmbeddedTable, { status: "available" }> | undefined = findTable(
              block.children,
            )
            if (nested) return nested
          }
        }
        return undefined
      }
      const table = article ? findTable(article.blocks) : undefined
      if (!table) throw new Error("Demo embedded table is unavailable")
      const rows = table.rows.slice(state.offset, state.offset + 50)
      const nextOffset = state.offset + rows.length
      let nextCursor: string | null = null
      if (nextOffset < table.rows.length) {
        nextCursor = randomCursor()
        embeddedCursors.set(nextCursor, { articleId, tableId, offset: nextOffset })
      }
      return { rows, nextCursor }
    },
    searchArticles: async (request: SearchRequest) => {
      const selected = dataset.articles
        .filter(
          (article) =>
            !request.databaseIds?.length || request.databaseIds.includes(article.databaseId),
        )
        .filter(
          (article) =>
            !request.query ||
            article.title.toLocaleLowerCase().includes(request.query.toLocaleLowerCase()),
        )
        .filter((article) => request.filters.every((filter) => matchesFilter(article, filter)))
      return paginate(selected, request.cursor, request.pageSize)
    },
    assetUrl: (assetId) => {
      const assetPath = dataset.assets[assetId]
      if (!assetPath) throw new Error("Demo asset is unavailable")
      return `${basePath}${assetPath}`
    },
  }
}
