import type { RichText as RichTextValue } from "@foundation-like-notion/contracts"
import type { ReactNode } from "react"
import { MathExpression } from "./MathExpression.js"

/** Render normalized rich-text spans without raw HTML. / raw HTML を使わず正規化済み rich-text span を描画します。 */
export function RichText({ value }: { value: readonly RichTextValue[] }) {
  return value.map((entry, index) => {
    if ("type" in entry) {
      return (
        <MathExpression
          // biome-ignore lint/suspicious/noArrayIndexKey: Rich-text spans are immutable and have no local state.
          key={`${index}-${entry.expression}`}
          expression={entry.expression}
        />
      )
    }
    let content: ReactNode = entry.text
    if (entry.annotations?.code) content = <code>{content}</code>
    if (entry.annotations?.bold) content = <strong>{content}</strong>
    if (entry.annotations?.italic) content = <em>{content}</em>
    if (entry.annotations?.strikethrough) content = <s>{content}</s>
    if (entry.annotations?.underline) content = <u>{content}</u>
    return entry.href ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: Rich-text spans are immutable and have no local state.
      <a key={`${index}-${entry.text}`} href={entry.href} target="_blank" rel="noreferrer noopener">
        {content}
      </a>
    ) : (
      // biome-ignore lint/suspicious/noArrayIndexKey: Rich-text spans are immutable and have no local state.
      <span key={`${index}-${entry.text}`}>{content}</span>
    )
  })
}
