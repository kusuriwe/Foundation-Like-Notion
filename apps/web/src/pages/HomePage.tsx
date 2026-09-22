import type { Article, DatabaseSummary } from "@foundation-like-notion/contracts"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ReaderIcon } from "../components/ReaderIcon.js"
import { useReaderRuntime } from "../reader-runtime.js"
import { clearRecent, readRecent, removeRecent } from "../recent.js"

/** Render configured libraries and device-local recents. / 設定済み library と端末内 recent を描画します。 */
export function HomePage() {
  const { client, presentation, storageNamespace } = useReaderRuntime()
  const { messages } = presentation
  const [databases, setDatabases] = useState<DatabaseSummary[]>([])
  const [recent, setRecent] = useState<Article[]>([])
  const [error, setError] = useState<string>()

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const [databaseValues, articleValues] = await Promise.all([
          client.getDatabases(),
          Promise.allSettled(
            readRecent(storageNamespace).map((entry) => client.getArticle(entry.readerArticleId)),
          ),
        ])
        if (!active) return
        setDatabases(databaseValues)
        const found: Article[] = []
        articleValues.forEach((result, index) => {
          if (result.status === "fulfilled") found.push(result.value)
          else {
            const stale = readRecent(storageNamespace)[index]
            if (stale) removeRecent(stale.readerArticleId, storageNamespace)
          }
        })
        setRecent(found)
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "読み込めませんでした。")
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [client, storageNamespace])

  const clear = () => {
    clearRecent(storageNamespace)
    setRecent([])
  }

  return (
    <div className="page page-home">
      <section className="hero">
        <span className="eyebrow">{presentation.brand.eyebrow}</span>
        <h1>{presentation.brand.tagline}</h1>
        <p>{messages.homeDescription}</p>
      </section>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <section>
        <h2>{messages.librariesHeading}</h2>
        <div className="card-grid">
          {databases.map((database) => (
            <Link className="library-card" to={`/library/${database.id}`} key={database.id}>
              <span className="eyebrow">{messages.databaseEyebrow}</span>
              <strong>{database.name}</strong>
              <span>
                {database.templates.length} {messages.templatesSuffix}
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section>
        <div className="section-heading">
          <h2>{messages.recentHeading}</h2>
          {recent.length > 0 && (
            <button className="text-button" type="button" onClick={clear}>
              {messages.clearRecent}
            </button>
          )}
        </div>
        {recent.length === 0 ? (
          <p className="empty-state">{messages.emptyRecent}</p>
        ) : (
          <div className="article-list">
            {recent.map((article) => (
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
        )}
      </section>
    </div>
  )
}
