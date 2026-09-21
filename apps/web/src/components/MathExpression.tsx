import katex from "katex"
import "katex/dist/katex.min.css"
import "katex/contrib/mhchem"
import { useLayoutEffect, useRef } from "react"

/**
 * Render trusted-display-disabled TeX and fall back to inert text on failure.
 * trust を無効にした TeX を描画し、失敗時は安全なテキストへフォールバックします。
 *
 * Args:
 *   expression: TeX expression supplied by the normalized Reader contract.
 *   displayMode: Whether to use KaTeX display mode.
 *
 * Returns:
 *   A KaTeX-owned span or a text-only fallback.
 */
export function MathExpression({
  expression,
  displayMode = false,
}: {
  expression: string
  displayMode?: boolean
}) {
  const target = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const element = target.current
    if (!element) return
    element.classList.remove("math-expression-error")
    try {
      katex.render(expression, element, {
        displayMode,
        output: "htmlAndMathml",
        trust: false,
        strict: "error",
        throwOnError: true,
        maxExpand: 1_000,
        maxSize: 20,
      })
    } catch {
      element.replaceChildren(document.createTextNode(expression))
      element.classList.add("math-expression-error")
    }
  }, [displayMode, expression])

  return (
    <span
      ref={target}
      className={displayMode ? "math-expression math-expression-display" : "math-expression"}
      data-testid={displayMode ? "display-equation" : "inline-equation"}
    />
  )
}
