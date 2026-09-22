import {
  PresentationInputSchema,
  type Article,
  type PresentationConfig,
} from "@foundation-like-notion/contracts"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { ReaderClient } from "../reader-client.js"
import { ReaderRuntimeProvider } from "../reader-runtime.js"
import { TemplateHeader } from "./TemplateHeader.js"

const article: Article = {
  id: "article_12345678",
  databaseId: "database_12345678",
  titleRichText: [{ text: "Article title" }],
  title: "炎色反応",
  createdTime: "2026-01-01T00:00:00.000Z",
  lastEditedTime: "2026-01-01T00:00:00.000Z",
  variables: {
    codeName: { type: "string", value: "FLAME TEST" },
    mainClass: {
      type: "reference",
      value: { readerId: "reference_12345678", title: "CHEMISTRY" },
    },
  },
  blocks: [],
  defaultTemplate: "simple",
  templates: ["simple", "compact-emblem"],
}

const unavailableClient = {} as ReaderClient

function renderWithPresentation(templateId: string, presentation: PresentationConfig) {
  return render(
    <ReaderRuntimeProvider
      value={{
        client: unavailableClient,
        mode: "reader",
        presentation,
        storageNamespace: "reader",
      }}
    >
      <TemplateHeader article={article} templateId={templateId} />
    </ReaderRuntimeProvider>,
  )
}

describe("TemplateHeader", () => {
  it("omits missing optional fields in the Simple template", () => {
    render(<TemplateHeader article={article} templateId="simple" />)
    expect(screen.getByText("CHEMISTRY")).toBeInTheDocument()
    expect(screen.queryByText("Sub-class")).not.toBeInTheDocument()
  })

  it("renders Compact Emblem without requiring missing fields", () => {
    render(<TemplateHeader article={article} templateId="compact-emblem" />)
    expect(screen.getByTestId("compact-emblem-header")).toHaveTextContent("FLAME TEST")
    expect(screen.getByTestId("compact-emblem-header")).toHaveTextContent("CHEMISTRY")
  })

  it("renders configured field order and a rich title exactly once in the header", () => {
    const presentation = PresentationInputSchema.parse({
      articleHeaders: {
        "custom-grid": {
          name: "Custom grid",
          renderer: "field-grid",
          title: { placement: "header", alignment: "start" },
          fields: [
            { variable: "codeName", label: "First", width: "half" },
            { variable: "mainClass", label: "Second", width: "half" },
          ],
        },
      },
    })
    const { container } = renderWithPresentation("custom-grid", presentation)

    const header = container.querySelector('[data-testid="simple-header"]')
    if (!header) throw new Error("Configured header was not rendered")
    expect(header).toHaveTextContent("Article title")
    expect(header.textContent?.indexOf("First")).toBeLessThan(
      header.textContent?.indexOf("Second") ?? 0,
    )
    expect(header?.querySelectorAll("h1")).toHaveLength(1)
  })
})
