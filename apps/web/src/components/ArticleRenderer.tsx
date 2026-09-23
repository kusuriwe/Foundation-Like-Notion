import type { ArticleBlock, EmbeddedTable } from "@foundation-like-notion/contracts"
import { createElement, useState } from "react"
import { useReaderRuntime } from "../reader-runtime.js"
import { MathExpression } from "./MathExpression.js"
import { ReaderIcon } from "./ReaderIcon.js"
import { RichText } from "./RichText.js"

function EmbeddedTableView({ table, articleId }: { table: EmbeddedTable; articleId: string }) {
  const { client, presentation } = useReaderRuntime()
  const [rows, setRows] = useState(table.status === "available" ? table.rows : [])
  const [cursor, setCursor] = useState(table.status === "available" ? table.nextCursor : null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  if (table.status === "unavailable") {
    return (
      <section className="embedded-table-unavailable">
        <h4>{table.title}</h4>
        <p>{presentation.messages.embeddedTableUnavailable}</p>
      </section>
    )
  }
  const loadMore = async () => {
    if (!cursor || loading) return
    setLoading(true)
    setError(false)
    try {
      const page = await client.getEmbeddedTablePage(articleId, table.tableId, cursor)
      setRows((current) => [...current, ...page.rows])
      setCursor(page.nextCursor)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }
  return (
    <section className="embedded-table">
      <h4>{table.title}</h4>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {table.columns.map((column, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: Columns are immutable and ordered.
                <th key={index}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: Rows are immutable and have no client state.
              <tr key={rowIndex}>
                {table.columns.map((_, cellIndex) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: Cells are immutable and ordered.
                  <td key={cellIndex}>{row[cellIndex] ?? ""}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cursor && (
        <button className="secondary-button embedded-table-more" type="button" onClick={loadMore}>
          {loading ? presentation.messages.loading : presentation.messages.loadMore}
        </button>
      )}
      {error && <p className="error-message">{presentation.messages.embeddedTableReload}</p>}
    </section>
  )
}

function Block({
  block,
  assetUrl,
  articleId,
}: {
  block: ArticleBlock
  assetUrl: (assetId: string) => string
  articleId: string
}) {
  if (block.type === "heading") {
    return createElement(`h${block.level}`, {}, <RichText value={block.content} />)
  }
  if (block.type === "paragraph")
    return (
      <p>
        <RichText value={block.content} />
      </p>
    )
  if (block.type === "quote")
    return (
      <blockquote>
        <RichText value={block.content} />
      </blockquote>
    )
  if (block.type === "callout") {
    return (
      <aside className={`callout callout-${block.color ?? "default"}`}>
        <span className="callout-icon">
          <ReaderIcon icon={block.icon} />
        </span>
        <div className="callout-content">
          <p>
            <RichText value={block.content} />
          </p>
          {block.children && (
            <BlockList blocks={block.children} assetUrl={assetUrl} articleId={articleId} />
          )}
        </div>
      </aside>
    )
  }
  if (block.type === "bulletedList" || block.type === "numberedList") {
    const Tag = block.type === "bulletedList" ? "ul" : "ol"
    return (
      <Tag>
        {block.items.map((item, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Notion list items are immutable and have no client state.
          <li key={index}>
            <RichText value={item} />
          </li>
        ))}
      </Tag>
    )
  }
  if (block.type === "code") {
    return (
      <figure className="code-block">
        <pre>
          <code>{block.code}</code>
        </pre>
        {block.caption.length > 0 && (
          <figcaption>
            <RichText value={block.caption} />
          </figcaption>
        )}
      </figure>
    )
  }
  if (block.type === "table") {
    return (
      <div className="table-scroll">
        <table>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: Notion table rows are immutable and ordered.
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => {
                  const Cell = block.hasColumnHeader && rowIndex === 0 ? "th" : "td"
                  return (
                    // biome-ignore lint/suspicious/noArrayIndexKey: Notion table cells are immutable and ordered.
                    <Cell key={cellIndex}>
                      <RichText value={cell} />
                    </Cell>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  if (block.type === "image") {
    return (
      <figure>
        <img className="article-image" src={assetUrl(block.assetId)} alt="" />
        {block.caption.length > 0 && (
          <figcaption>
            <RichText value={block.caption} />
          </figcaption>
        )}
      </figure>
    )
  }
  if (block.type === "math")
    return (
      <div className="math-block">
        <MathExpression expression={block.expression} displayMode />
      </div>
    )
  if (block.type === "file")
    return (
      <p>
        <a href={assetUrl(block.assetId)}>{block.name}</a>
      </p>
    )
  if (block.type === "link")
    return (
      <p>
        <a href={block.url} target="_blank" rel="noreferrer noopener">
          {block.label}
        </a>
      </p>
    )
  if (block.type === "embeddedDatabase") {
    return (
      <section className="embedded-database">
        <h3>{block.title}</h3>
        {block.tables.map((table, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Data sources are immutable and ordered.
          <EmbeddedTableView key={index} table={table} articleId={articleId} />
        ))}
      </section>
    )
  }
  return null
}

function BlockList({
  blocks,
  assetUrl,
  articleId,
}: {
  blocks: readonly ArticleBlock[]
  assetUrl: (assetId: string) => string
  articleId: string
}) {
  return blocks.map((block, index) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: Reader blocks are immutable and have no local component state.
    <Block key={index} block={block} assetUrl={assetUrl} articleId={articleId} />
  ))
}

/** Render safe structured article blocks. / 安全な構造化 article block を描画します。 */
export function ArticleRenderer({
  blocks,
  articleId = "",
}: {
  blocks: readonly ArticleBlock[]
  articleId?: string
}) {
  const runtime = useReaderRuntime()
  const assetUrl = runtime.client.assetUrl
  return (
    <div className="article-body">
      <BlockList blocks={blocks} assetUrl={assetUrl} articleId={articleId} />
    </div>
  )
}
