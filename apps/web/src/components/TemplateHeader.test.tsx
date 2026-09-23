import {
  PresentationInputSchema,
  type Article,
  type PresentationConfig,
} from "@foundation-like-notion/contracts"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { defaultPresentation } from "../presentation.js"
import type { ReaderClient } from "../reader-client.js"
import { ReaderRuntimeProvider } from "../reader-runtime.js"
import { TemplateHeader, templateTitlePlacement } from "./TemplateHeader.js"

const article: Article = {
  id: "article_12345678",
  databaseId: "database_12345678",
  titleRichText: [{ text: "Article title" }],
  title: "炎色反応",
  createdTime: "2026-01-01T00:00:00.000Z",
  lastEditedTime: "2026-01-01T00:00:00.000Z",
  icon: { kind: "emoji", value: "📄" },
  variables: {
    codeName: { type: "string", value: "FLAME TEST" },
    mainClass: {
      type: "reference",
      value: {
        readerId: "reference_12345678",
        title: "CHEMISTRY",
        icon: { kind: "emoji", value: "🧪" },
      },
    },
  },
  blocks: [],
  defaultTemplate: "simple",
  templates: ["simple", "compact-emblem", "cactus-study"],
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
    const { container } = render(<TemplateHeader article={article} templateId="simple" />)
    expect(screen.getByText("CHEMISTRY")).toBeInTheDocument()
    expect(container).toHaveTextContent("🧪")
    expect(screen.queryByText("Sub-class")).not.toBeInTheDocument()
  })

  it("renders Compact Emblem without requiring missing fields", () => {
    const { container } = render(<TemplateHeader article={article} templateId="compact-emblem" />)
    expect(screen.getByTestId("compact-emblem-header")).toHaveTextContent("FLAME TEST")
    expect(screen.getByTestId("compact-emblem-header")).toHaveTextContent("CHEMISTRY")
    expect(screen.getByTestId("compact-emblem-icon")).toHaveTextContent("📄")
    expect(screen.getByTestId("compact-emblem-icon")).not.toHaveTextContent("🧪")
    expect(container).toHaveTextContent("🧪")
  })

  it("uses the empty emblem instead of a class icon when the article has no icon", () => {
    const withoutIcon = { ...article }
    delete withoutIcon.icon
    const { container } = render(
      <TemplateHeader article={withoutIcon} templateId="compact-emblem" />,
    )
    const emblem = container.querySelector('[data-testid="compact-emblem-icon"]')
    expect(emblem).toHaveTextContent("◐")
    expect(emblem).not.toHaveTextContent("🧪")
    expect(container).toHaveTextContent("🧪")
  })

  it("renders the prototype-inspired Cactus Study cells in configured order", () => {
    const presentation = PresentationInputSchema.parse({
      articleHeaders: {
        "cactus-study": {
          name: "Cactus Study",
          renderer: "cactus-study",
          title: { placement: "content", alignment: "center" },
          headlineVariable: "codeName",
          seriesMark: "Ⅶ",
          seriesLabel: "Reference file",
          caption: "Classification record",
          fields: [
            { variable: "mainClass", label: "Main-class" },
            { variable: "subClass", label: "Sub-class" },
          ],
        },
      },
    })
    const { container } = renderWithPresentation("cactus-study", presentation)
    const header = screen.getByTestId("cactus-study-header")
    expect(header).toHaveTextContent("FLAME TEST")
    expect(header).toHaveTextContent("Ⅶ")
    expect(header).toHaveTextContent("CHEMISTRY")
    expect(screen.getByTestId("cactus-article-icon")).toHaveTextContent("📄")
    expect(screen.getByTestId("cactus-article-icon")).not.toHaveTextContent("Ⅶ")
    expect(container).toHaveTextContent("🧪")
    expect(header).not.toHaveTextContent("Sub-class")
    expect(header.textContent?.indexOf("Main-class")).toBeGreaterThan(
      header.textContent?.indexOf("FLAME TEST") ?? 0,
    )
  })

  it("places the rich article title once in Cactus Study when code name is absent", () => {
    const withoutCodeName: Article = {
      ...article,
      variables: {},
      titleRichText: [{ text: "Article " }, { type: "equation", expression: "x^2", text: "x^2" }],
    }
    const { container } = render(
      <ReaderRuntimeProvider
        value={{
          client: unavailableClient,
          mode: "reader",
          presentation: defaultPresentation,
          storageNamespace: "reader",
        }}
      >
        <TemplateHeader article={withoutCodeName} templateId="cactus-study" />
      </ReaderRuntimeProvider>,
    )
    expect(container.querySelectorAll("h1")).toHaveLength(1)
    expect(container.querySelector(".katex")).toBeTruthy()
    expect(
      templateTitlePlacement(defaultPresentation.articleHeaders, "cactus-study", withoutCodeName),
    ).toBe("header")
  })

  it("uses the rich title as the sole headline when code name is missing", () => {
    const withoutCodeName: Article = {
      ...article,
      variables: {},
      titleRichText: [{ text: "Article " }, { type: "equation", expression: "x^2", text: "x^2" }],
    }
    const { container } = render(
      <ReaderRuntimeProvider
        value={{
          client: unavailableClient,
          mode: "reader",
          presentation: defaultPresentation,
          storageNamespace: "reader",
        }}
      >
        <TemplateHeader article={withoutCodeName} templateId="compact-emblem" />
      </ReaderRuntimeProvider>,
    )
    expect(container.querySelectorAll("h1")).toHaveLength(1)
    expect(container.querySelector(".katex")).toBeTruthy()
    expect(
      templateTitlePlacement(defaultPresentation.articleHeaders, "compact-emblem", withoutCodeName),
    ).toBe("header")
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
