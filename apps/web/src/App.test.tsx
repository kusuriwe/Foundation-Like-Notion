import { PresentationInputSchema } from "@foundation-like-notion/contracts"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { ReaderClient } from "./reader-client.js"
import { App } from "./App.js"

describe("presentation runtime", () => {
  it("applies light palette, locale, brand, and entry copy", async () => {
    const presentation = PresentationInputSchema.parse({
      locale: "en-US",
      brand: { name: "Demo Library" },
      theme: { colorScheme: "light" },
      messages: { demoTitle: "Try the sample" },
    })
    render(<App client={{} as ReaderClient} mode="demo" initialPresentation={presentation} />)

    expect(await screen.findByRole("heading", { name: "Try the sample" })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe("en-US")
    expect(document.documentElement.style.colorScheme).toBe("light")
    expect(document.documentElement.style.getPropertyValue("--bg")).toBe("#f5f7fa")
    expect(document.documentElement.style.getPropertyValue("--accent-foreground")).toBe("#ffffff")
    expect(document.title).toBe("Demo Library")
  })
})
