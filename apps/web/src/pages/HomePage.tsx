import type { Article, DatabaseSummary } from "@foundation-like-notion/contracts"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { getArticle, getDatabases } from "../api.js"
import { ReaderIcon } from "../components/ReaderIcon.js"
import { clearRecent, readRecent, removeRecent } from "../recent.js"

/** Render configured libraries and device-local recents. / 設定済み library と端末内 recent を描画します。 */
export function HomePage() {
  const [databases, setDatabases] = useState<DatabaseSummary[]>([])
  const [recent, setRecent] = useState<Article[]>([])
  const [error, setError] = useState<string>()

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const [databaseValues, articleValues] = await Promise.all([
          getDatabases(),
          Promise.allSettled(readRecent().map((entry) => getArticle(entry.readerArticleId))),
        ])
        if (!active) return
        setDatabases(databaseValues)
        const found: Article[] = []
        articleValues.forEach((result, index) => {
          if (result.status === "fulfilled") found.push(result.value)
          else {
            const stale = readRecent()[index]
            if (stale) removeRecent(stale.readerArticleId)
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
  }, [])

  const clear = () => {
    clearRecent()
    setRecent([])
  }

  return (
    <div className="page page-home">
      <section className="hero">
        <span className="eyebrow">Personal reference</span>
        <h1>Your Notion, shaped for reading.</h1>
        <p>許可された Database を read-only で表示します。</p>
      </section>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <section>
        <h2>Libraries</h2>
        <div className="card-grid">
          {databases.map((database) => (
            <Link className="library-card" to={`/library/${database.id}`} key={database.id}>
              <span className="eyebrow">Database</span>
              <strong>{database.name}</strong>
              <span>{database.templates.length} templates</span>
            </Link>
          ))}
        </div>
      </section>
      <section>
        <div className="section-heading">
          <h2>Recently read</h2>
          {recent.length > 0 && (
            <button className="text-button" type="button" onClick={clear}>
              Clear
            </button>
          )}
        </div>
        {recent.length === 0 ? (
          <p className="empty-state">最近読んだ記事はありません。</p>
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
