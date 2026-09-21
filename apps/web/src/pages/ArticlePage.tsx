import type { Article, ReaderValue } from "@foundation-like-notion/contracts"
import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { getArticle } from "../api.js"
import { ArticleRenderer } from "../components/ArticleRenderer.js"
import { TemplateHeader } from "../components/TemplateHeader.js"
import { recordRecent } from "../recent.js"
import { preferredTemplate, savePreferredTemplate } from "../template-preference.js"

function tags(value: ReaderValue | undefined): readonly string[] {
  if (value?.type === "string[]") return value.value
  if (value?.type === "reference[]") return value.value.map((entry) => entry.title)
  return []
}

/** Load and render an article selected by opaque route ID. / opaque route ID で選択された article を読み込み描画します。 */
export function ArticlePage() {
  const { articleId = "" } = useParams()
  const navigate = useNavigate()
  const [article, setArticle] = useState<Article>()
  const [templateId, setTemplateId] = useState("")
  const [error, setError] = useState<string>()

  useEffect(() => {
    let active = true
    getArticle(articleId)
      .then((value) => {
        if (!active) return
        setArticle(value)
        setTemplateId(preferredTemplate(value.databaseId, value.templates, value.defaultTemplate))
        recordRecent(value.id)
      })
      .catch((reason: unknown) => {
        if (active)
          setError(reason instanceof Error ? reason.message : "記事を取得できませんでした。")
      })
    return () => {
      active = false
    }
  }, [articleId])

  if (error)
    return (
      <div className="page narrow-page">
        <p className="error-message" role="alert">
          {error}
        </p>
      </div>
    )
  if (!article) return <div className="page loading-state">Loading…</div>

  const selectTemplate = (selected: string) => {
    setTemplateId(selected)
    savePreferredTemplate(article.databaseId, selected)
  }

  return (
    <article className="article-page">
      <div className="article-toolbar">
        <Link className="back-link" to={`/library/${article.databaseId}`}>
          ← Library
        </Link>
        <label>
          Template{" "}
          <select value={templateId} onChange={(event) => selectTemplate(event.target.value)}>
            {article.templates.map((template) => (
              <option value={template} key={template}>
                {template}
              </option>
            ))}
          </select>
        </label>
      </div>
      <TemplateHeader article={article} templateId={templateId} />
      <div className="article-content">
        <h1>{article.title}</h1>
        <div className="tag-list">
          {tags(article.variables.tags).map((tag) => (
            <button
              type="button"
              key={tag}
              onClick={() =>
                navigate(
                  `/search?tag=${encodeURIComponent(tag)}&database=${encodeURIComponent(article.databaseId)}`,
                )
              }
            >
              {tag}
            </button>
          ))}
        </div>
        <ArticleRenderer blocks={article.blocks} />
      </div>
    </article>
  )
}
