import type { ArticleSummary } from "@foundation-like-notion/contracts"
import { type FormEvent, useCallback, useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { ReaderIcon } from "../components/ReaderIcon.js"
import { useReaderRuntime } from "../reader-runtime.js"

/** Render title and allowlisted property search. / title と許可済み property search を描画します。 */
export function SearchPage() {
  const { client, presentation } = useReaderRuntime()
  const { messages } = presentation
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get("q") ?? "")
  const [articles, setArticles] = useState<ArticleSummary[]>([])
  const [error, setError] = useState<string>()
  const searchQuery = params.get("q") ?? ""
  const tag = params.get("tag") ?? ""
  const databaseId = params.get("database") ?? ""

  const run = useCallback(
    async (nextQuery: string, searchTag: string) => {
      setError(undefined)
      try {
        const page = await client.searchArticles({
          ...(nextQuery ? { query: nextQuery } : {}),
          ...(databaseId ? { databaseIds: [databaseId] } : {}),
          filters: searchTag ? [{ fieldId: "tags", operator: "contains", value: searchTag }] : [],
          pageSize: 20,
        })
        setArticles(page.items)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "検索できませんでした。")
      }
    },
    [client, databaseId],
  )

  useEffect(() => {
    void run(searchQuery, tag)
  }, [run, searchQuery, tag])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const next = new URLSearchParams()
    if (query.trim()) next.set("q", query.trim())
    if (tag) next.set("tag", tag)
    if (databaseId) next.set("database", databaseId)
    setParams(next)
  }

  return (
    <div className="page narrow-page">
      <span className="eyebrow">{messages.searchEyebrow}</span>
      <h1>{messages.searchTitle}</h1>
      <p className="search-note">{messages.searchDescription}</p>
      <form className="search-form" onSubmit={submit}>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={messages.searchPlaceholder}
          aria-label="Title search"
        />
        <button className="primary-button" type="submit">
          {messages.searchButton}
        </button>
      </form>
      {tag && (
        <div className="active-filter">
          Tag: <strong>{tag}</strong>
          <button type="button" onClick={() => setParams(query ? { q: query } : {})}>
            ×
          </button>
        </div>
      )}
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <div className="article-list">
        {articles.map((article) => (
          <Link to={`/article/${article.id}`} className="article-row" key={article.id}>
            <span className="article-icon">
              <ReaderIcon icon={article.icon} />
            </span>
            <span>
              <strong>{article.title}</strong>
              <small>{article.databaseId}</small>
            </span>
          </Link>
        ))}
      </div>
      {!error && articles.length === 0 && <p className="empty-state">{messages.emptySearch}</p>}
    </div>
  )
}
