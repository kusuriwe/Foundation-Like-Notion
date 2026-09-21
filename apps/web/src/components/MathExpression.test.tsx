import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ArticleRenderer } from "./ArticleRenderer.js"
import { MathExpression } from "./MathExpression.js"
import { RichText } from "./RichText.js"

describe("MathExpression", () => {
  it("renders inline, display, and mhchem equations with accessible MathML", () => {
    const { container } = render(
      <>
        <RichText
          value={[{ text: "Energy " }, { type: "equation", expression: "E=mc^2", text: "E=mc^2" }]}
        />
        <ArticleRenderer blocks={[{ type: "math", expression: "\\ce{H2O}" }]} />
      </>,
    )

    expect(screen.getByTestId("inline-equation").querySelector(".katex")).not.toBeNull()
    expect(screen.getByTestId("display-equation").querySelector(".katex-display")).not.toBeNull()
    expect(container.querySelectorAll("math").length).toBeGreaterThanOrEqual(2)
    expect(container.textContent).toContain("H2O")
  })

  it("falls back to inert TeX without logging parser details", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const { container } = render(<MathExpression expression="\\notARealCommand{" />)

    expect(container.querySelector(".math-expression-error")).toHaveTextContent(
      "\\notARealCommand{",
    )
    expect(container.querySelector(".katex")).toBeNull()
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it("does not create a link for an untrusted TeX URL", () => {
    const { container } = render(
      <MathExpression expression="\\href{javascript:alert(1)}{unsafe}" />,
    )

    expect(container.querySelector("a")).toBeNull()
  })
})
