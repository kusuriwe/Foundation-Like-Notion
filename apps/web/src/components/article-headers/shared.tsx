import type {
  Article,
  HeaderField as HeaderFieldDefinition,
  ReaderIcon,
  ReaderValue,
} from "@foundation-like-notion/contracts"
import { ReaderIcon as Icon } from "../ReaderIcon.js"
import { RichText } from "../RichText.js"
import styles from "./headers.module.css"

/** Convert a normalized Reader value into display text. / 正規化済み Reader value を表示文字列へ変換します。 */
export function displayValue(value: ReaderValue | undefined): string | undefined {
  if (!value) return undefined
  if (value.type === "string") return value.value
  if (value.type === "number") return String(value.value)
  if (value.type === "boolean") return value.value ? "Yes" : "No"
  if (value.type === "date") return value.value.start
  if (value.type === "reference") return value.value.title
  if (value.type === "string[]") return value.value.join(", ")
  return value.value.map((reference) => reference.title).join(", ")
}

/** Return a display icon only for a single reference value. / 単一 reference value の表示iconだけを返します。 */
export function valueIcon(value: ReaderValue | undefined): ReaderIcon | undefined {
  return value?.type === "reference" ? value.value.icon : undefined
}

/** Render one configured header field, omitting missing values. / 設定済みheader fieldを描画し、欠損値は省略します。 */
export function HeaderField({
  definition,
  value,
}: {
  definition: HeaderFieldDefinition
  value: ReaderValue | undefined
}) {
  const rendered = displayValue(value)
  if (!rendered) return null
  const className = [
    styles.field,
    definition.width === "third" ? styles.fieldThird : "",
    definition.width === "full" ? styles.fieldFull : "",
    definition.emphasis === "strong" ? styles.fieldStrong : "",
  ]
    .filter(Boolean)
    .join(" ")
  return (
    <div className={className}>
      <span className="eyebrow">{definition.label}</span>
      <strong className={styles.value}>
        {definition.showIcon && <Icon icon={valueIcon(value)} />}
        {rendered}
      </strong>
    </div>
  )
}

/** Render the article title with rich text and inline equations. / rich textとinline数式を含む記事titleを描画します。 */
export function HeaderTitle({ article, alignment }: { article: Article; alignment: string }) {
  return (
    <h1 className={styles.title} data-alignment={alignment}>
      {article.titleRichText.length > 0 ? (
        <RichText value={article.titleRichText} />
      ) : (
        article.title
      )}
    </h1>
  )
}
