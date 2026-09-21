import type { ArticleBlock } from "@foundation-like-notion/contracts"
import { createElement } from "react"
import { RichText } from "./RichText.js"

function Block({ block }: { block: ArticleBlock }) {
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
      <aside className="callout">
        <span>{block.icon?.kind === "emoji" ? block.icon.value : ""}</span>
        <p>
          <RichText value={block.content} />
        </p>
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
        <img className="article-image" src={`/api/assets/${block.assetId}`} alt="" />
        {block.caption.length > 0 && (
          <figcaption>
            <RichText value={block.caption} />
          </figcaption>
        )}
      </figure>
    )
  }
  if (block.type === "math") return <pre className="math-block">{block.expression}</pre>
  if (block.type === "file")
    return (
      <p>
        <a href={`/api/assets/${block.assetId}`}>{block.name}</a>
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
  return null
}

/** Render safe structured article blocks. / 安全な構造化 article block を描画します。 */
export function ArticleRenderer({ blocks }: { blocks: readonly ArticleBlock[] }) {
  return (
    <div className="article-body">
      {blocks.map((block, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: Reader blocks are immutable and have no local component state.
        <Block key={index} block={block} />
      ))}
    </div>
  )
}
