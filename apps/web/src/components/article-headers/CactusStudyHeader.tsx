/*
 * SPDX-License-Identifier: CC-BY-SA-3.0
 * "Cactus Study header" adapts the SCP Wiki Anomaly Classification System (ACS).
 * Attribution and modification details: NOTICE and LICENSES/README.md.
 */
import type {
  ArticleHeader,
  HeaderField as HeaderFieldDefinition,
  ReaderValue,
} from "@foundation-like-notion/contracts"
import { ReaderIcon as Icon } from "../ReaderIcon.js"
import { HeaderTitle, displayValue, valueIcon } from "./shared.js"
import styles from "./cactus-study.module.css"
import type { HeaderRendererProps } from "./types.js"

type CactusDefinition = Extract<ArticleHeader, { renderer: "cactus-study" }>

function CactusCell({
  field,
  value,
  slot,
}: {
  field: HeaderFieldDefinition
  value: ReaderValue
  slot: number
}) {
  const rendered = displayValue(value)
  if (!rendered) return null
  const icon = field.showIcon ? valueIcon(value) : undefined
  const symbols = ["✦", "◐", "✧"]
  return (
    <div className={styles.cell}>
      <div className={styles.cellText}>
        <span className={styles.cellLabel}>{field.label}</span>
        <strong className={styles.cellValue}>{rendered}</strong>
      </div>
      <span className={styles.symbol} aria-hidden="true">
        {icon ? <Icon icon={icon} /> : symbols[slot]}
      </span>
    </div>
  )
}

/** Render an ACS-inspired, configurable classification header. / ACS風の設定可能な分類headerを描画します。 */
export function CactusStudyHeader({ article, definition }: HeaderRendererProps) {
  const config = definition as CactusDefinition
  const headline = displayValue(article.variables[config.headlineVariable])
  const fields = config.fields
    .map((field) => ({ field, value: article.variables[field.variable] }))
    .filter((item): item is { field: HeaderFieldDefinition; value: ReaderValue } =>
      Boolean(displayValue(item.value)),
    )
  return (
    <header
      className={styles.cactus}
      data-density={config.density}
      data-testid="cactus-study-header"
    >
      {headline && config.title.placement === "header" && (
        <HeaderTitle article={article} alignment={config.title.alignment} />
      )}
      <div className={styles.top}>
        <div className={styles.name}>
          <span className={styles.topLabel}>{config.headlineLabel}</span>
          <div className={styles.code}>
            {headline ? (
              <strong>{headline}</strong>
            ) : (
              <HeaderTitle article={article} alignment={config.title.alignment} />
            )}
          </div>
          <span className={styles.bars} aria-hidden="true" />
        </div>
        <div className={styles.series}>
          <strong>{config.seriesMark}</strong>
          <span>{config.seriesLabel}</span>
        </div>
      </div>
      {fields.length > 0 && (
        <div className={styles.classification}>
          <div className={styles.cells}>
            {fields.map(({ field, value }, index) => (
              <CactusCell
                key={`${field.variable}:${field.label}`}
                field={field}
                value={value}
                slot={index}
              />
            ))}
          </div>
          <div className={styles.seal} aria-hidden="true">
            <span data-testid="cactus-article-icon">
              {article.icon ? <Icon icon={article.icon} /> : config.seriesMark}
            </span>
          </div>
        </div>
      )}
      {config.caption && <p className={styles.caption}>{config.caption}</p>}
    </header>
  )
}
