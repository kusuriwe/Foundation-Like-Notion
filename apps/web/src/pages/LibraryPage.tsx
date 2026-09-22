import type { ArticleSummary } from "@foundation-like-notion/contracts"
import { useCallback, useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ReaderIcon } from "../components/ReaderIcon.js"
import { useReaderRuntime } from "../reader-runtime.js"

/** Render a paginated Reader database. / Reader database を pagination 付きで描画します。 */
export function LibraryPage() {
  const { client, presentation } = useReaderRuntime()
  const { messages } = presentation
  const { databaseId = "" } = useParams()
  const [articles, setArticles] = useState<ArticleSummary[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(true)

  const load = useCallback(
    async (next?: string) => {
      setLoading(true)
      try {
        const page = await client.getArticles(databaseId, next)
        setArticles((current) => (next ? [...current, ...page.items] : page.items))
        setCursor(page.nextCursor)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "記事一覧を取得できませんでした。")
      } finally {
        setLoading(false)
      }
    },
    [client, databaseId],
  )

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="page narrow-page">
      <Link className="back-link" to="/">
        {messages.backHome}
      </Link>
      <span className="eyebrow">{messages.libraryEyebrow}</span>
      <h1>{databaseId}</h1>
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
              <small>{new Date(article.createdTime).toLocaleDateString(presentation.locale)}</small>
            </span>
          </Link>
        ))}
      </div>
      {cursor && (
        <button
          className="secondary-button"
          type="button"
          disabled={loading}
          onClick={() => void load(cursor)}
        >
          {loading ? messages.loading : messages.loadMore}
        </button>
      )}
      {!cursor && !loading && articles.length === 0 && (
        <p className="empty-state">{messages.emptyLibrary}</p>
      )}
    </div>
  )
}
