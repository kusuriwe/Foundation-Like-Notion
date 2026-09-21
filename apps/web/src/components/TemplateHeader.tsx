import type { Article, ReaderIcon, ReaderValue } from "@foundation-like-notion/contracts"
import { ReaderIcon as Icon } from "./ReaderIcon.js"

function display(value: ReaderValue | undefined): string | undefined {
  if (!value) return undefined
  if (value.type === "string") return value.value
  if (value.type === "number") return String(value.value)
  if (value.type === "boolean") return value.value ? "Yes" : "No"
  if (value.type === "date") return value.value.start
  if (value.type === "reference") return value.value.title
  if (value.type === "string[]") return value.value.join(", ")
  return value.value.map((reference) => reference.title).join(", ")
}

function icon(value: ReaderValue | undefined): ReaderIcon | undefined {
  return value?.type === "reference" ? value.value.icon : undefined
}

function Field({ label, value }: { label: string; value: ReaderValue | undefined }) {
  const rendered = display(value)
  if (!rendered) return null
  return (
    <div className="template-field">
      <span className="eyebrow">{label}</span>
      <strong className="template-value">
        <Icon icon={icon(value)} />
        {rendered}
      </strong>
    </div>
  )
}

/** Render an article header using an allowlisted bundled template. / 許可された同梱 template で article header を描画します。 */
export function TemplateHeader({ article, templateId }: { article: Article; templateId: string }) {
  const values = article.variables
  if (templateId === "compact-emblem") {
    const emblemIcon = icon(values.mainClass) ?? article.icon
    return (
      <header className="emblem-header" data-testid="compact-emblem-header">
        <div className="emblem-icon">
          <Icon icon={emblemIcon} />
        </div>
        <div className="emblem-content">
          <div className="emblem-code">
            <span className="eyebrow">Code name</span>
            <strong>{display(values.codeName) ?? article.title}</strong>
          </div>
          <div className="emblem-classes">
            <Field label="Main-class" value={values.mainClass} />
            <Field label="Sub-class" value={values.subClass} />
          </div>
        </div>
      </header>
    )
  }

  return (
    <header className="simple-header" data-testid="simple-header">
      <Field label="Main-class" value={values.mainClass} />
      <Field label="Sub-class" value={values.subClass} />
      <Field label="Code name" value={values.codeName} />
    </header>
  )
}
