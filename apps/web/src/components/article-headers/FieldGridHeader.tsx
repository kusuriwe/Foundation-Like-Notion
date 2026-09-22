import type { ArticleHeader } from "@foundation-like-notion/contracts"
import { HeaderField, HeaderTitle } from "./shared.js"
import styles from "./headers.module.css"
import type { HeaderRendererProps } from "./types.js"

type FieldGridDefinition = Extract<ArticleHeader, { renderer: "field-grid" }>

/** Render a configurable field-grid article header. / 設定可能なfield-grid記事headerを描画します。 */
export function FieldGridHeader({ article, definition }: HeaderRendererProps) {
  const config = definition as FieldGridDefinition
  return (
    <header
      className={`${styles.header} ${styles.grid}`}
      data-density={config.density}
      data-tone={config.tone}
      data-testid="simple-header"
    >
      {config.title.placement === "header" && (
        <HeaderTitle article={article} alignment={config.title.alignment} />
      )}
      <div className={styles.fieldGrid}>
        {config.fields.map((field) => (
          <HeaderField
            key={`${field.variable}:${field.label}`}
            definition={field}
            value={article.variables[field.variable]}
          />
        ))}
      </div>
    </header>
  )
}
