import type { Article } from "@foundation-like-notion/contracts"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { TemplateHeader } from "./TemplateHeader.js"

const article: Article = {
  id: "article_12345678",
  databaseId: "database_12345678",
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
})
