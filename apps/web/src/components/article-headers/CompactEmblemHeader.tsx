import type { ArticleHeader } from "@foundation-like-notion/contracts"
import { ReaderIcon as Icon } from "../ReaderIcon.js"
import { HeaderField, HeaderTitle, displayValue, valueIcon } from "./shared.js"
import styles from "./headers.module.css"
import type { HeaderRendererProps } from "./types.js"

type CompactDefinition = Extract<ArticleHeader, { renderer: "compact-emblem" }>

/** Render the configurable compact-emblem article header. / 設定可能なcompact-emblem記事headerを描画します。 */
export function CompactEmblemHeader({ article, definition }: HeaderRendererProps) {
  const config = definition as CompactDefinition
  const emblemValue = article.variables[config.emblemVariable]
  const headline = displayValue(article.variables[config.headlineVariable])
  const icon = article.icon ?? valueIcon(emblemValue)
  return (
    <header
      className={`${styles.header} ${styles.emblem}`}
      data-density={config.density}
      data-tone={config.tone}
      data-testid="compact-emblem-header"
    >
      <div className={styles.emblemRow}>
        <div className={styles.emblemIcon} data-testid="compact-emblem-icon">
          {icon ? <Icon icon={icon} /> : <span aria-hidden="true">◐</span>}
        </div>
        <div className={styles.emblemContent}>
          {headline && config.title.placement === "header" && (
            <HeaderTitle article={article} alignment={config.title.alignment} />
          )}
          <div className={styles.headline}>
            <span className="eyebrow">{config.headlineLabel}</span>
            {headline ? (
              <strong>{headline}</strong>
            ) : (
              <HeaderTitle article={article} alignment={config.title.alignment} />
            )}
          </div>
          <div className={styles.emblemFields}>
            {config.fields.map((field) => (
              <HeaderField
                key={`${field.variable}:${field.label}`}
                definition={field}
                value={article.variables[field.variable]}
              />
            ))}
          </div>
        </div>
      </div>
      {config.caption && <div className={styles.emblemCaption}>{config.caption}</div>}
    </header>
  )
}
