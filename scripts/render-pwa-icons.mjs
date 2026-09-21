import { readFile } from "node:fs/promises"
import path from "node:path"

process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.resolve(".cache/ms-playwright")
const { chromium } = await import("@playwright/test")

const source = path.resolve("apps/web/public/icon.svg")
const outputs = [
  { size: 180, file: "apple-touch-icon.png" },
  { size: 192, file: "icon-192.png" },
  { size: 512, file: "icon-512.png" },
]
const svgSource = await readFile(source, "utf8")

const browser = await chromium.launch()
try {
  for (const output of outputs) {
    const page = await browser.newPage({
      viewport: { width: output.size, height: output.size },
      deviceScaleFactor: 1,
    })
    await page.setContent(svgSource)
    await page.evaluate(() => {
      document.documentElement.style.background = "#0b0d10"
      document.body.style.margin = "0"
      const svg = document.querySelector("svg")
      if (!svg) throw new Error("PWA icon SVG is missing")
      svg.style.display = "block"
      svg.style.width = "100vw"
      svg.style.height = "100vh"
    })
    await page.screenshot({
      path: path.resolve("apps/web/public", output.file),
      omitBackground: false,
    })
    await page.close()
  }
} finally {
  await browser.close()
}
