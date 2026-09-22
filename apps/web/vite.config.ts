import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  DemoDatasetSchema,
  DemoManifestSchema,
  type DemoDataset,
} from "@foundation-like-notion/contracts"
import react from "@vitejs/plugin-react"
import yaml from "js-yaml"
import type { Plugin } from "vite"
import { VitePWA } from "vite-plugin-pwa"
import { defineConfig } from "vitest/config"

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url))
const demoRoot = path.join(repositoryRoot, "demo")

function loadDemoDataset(): DemoDataset {
  const manifest = DemoManifestSchema.parse(
    yaml.load(readFileSync(path.join(demoRoot, "demo.yaml"), "utf8")),
  )
  const articles = manifest.articleFiles.map((relativePath) => {
    const absolutePath = path.resolve(demoRoot, relativePath)
    if (!absolutePath.startsWith(`${demoRoot}${path.sep}`)) {
      throw new Error("Demo article path escapes the demo directory")
    }
    return yaml.load(readFileSync(absolutePath, "utf8"))
  })
  const dataset = DemoDatasetSchema.parse({
    presentation: manifest.presentation,
    databases: manifest.databases,
    articles,
    assets: manifest.assets,
  })
  const publicRoot = path.join(repositoryRoot, "apps", "web", "public")
  for (const relativePath of Object.values(dataset.assets)) {
    const absolutePath = path.resolve(publicRoot, relativePath)
    if (!absolutePath.startsWith(`${publicRoot}${path.sep}`)) {
      throw new Error("Demo asset path escapes the public directory")
    }
    readFileSync(absolutePath)
  }
  return dataset
}

function demoDataPlugin(dataset: DemoDataset): Plugin {
  const publicId = "virtual:demo-data"
  const resolvedId = `\0${publicId}`
  return {
    name: "foundation-reader-demo-data",
    resolveId(id) {
      return id === publicId ? resolvedId : undefined
    },
    load(id) {
      return id === resolvedId ? `export default ${JSON.stringify(dataset)}` : undefined
    },
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        return html.replace("/src/main.tsx", "/src/main.demo.tsx")
      },
    },
    generateBundle() {
      const { brand, theme, locale } = dataset.presentation
      const base = "/Foundation-Like-Notion/"
      this.emitFile({
        type: "asset",
        fileName: "manifest.webmanifest",
        source: JSON.stringify({
          name: brand.name,
          short_name: brand.shortName,
          description: brand.tagline,
          id: base,
          lang: locale,
          theme_color: theme.colors.background,
          background_color: theme.colors.background,
          display: "standalone",
          start_url: base,
          icons: [
            { src: `${base}icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
            { src: `${base}icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
            {
              src: `${base}icon-512.png`,
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
            { src: `${base}icon.svg`, sizes: "any", type: "image/svg+xml", purpose: "any" },
          ],
        }),
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const demo = mode === "demo"
  const dataset = demo ? loadDemoDataset() : undefined
  const base = demo ? "/Foundation-Like-Notion/" : "/"
  return {
    base,
    plugins: [
      react(),
      ...(dataset ? [demoDataPlugin(dataset)] : []),
      VitePWA({
        registerType: "autoUpdate",
        manifest: false,
        includeAssets: ["icon.svg", "icon-192.png", "icon-512.png", "apple-touch-icon.png"],
        workbox: {
          globPatterns: ["**/*.{js,css,html,webmanifest,ico,png,svg,woff,woff2}"],
          ...(demo
            ? {}
            : {
                navigateFallbackDenylist: [/^\/api\//],
                runtimeCaching: [
                  {
                    urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith("/api/"),
                    handler: "NetworkOnly" as const,
                  },
                ],
              }),
        },
      }),
    ],
    build: { outDir: demo ? "dist-demo" : "dist" },
    server: {
      proxy: {
        "/api": { target: "http://127.0.0.1:3000", changeOrigin: false },
        "/manifest.webmanifest": { target: "http://127.0.0.1:3000", changeOrigin: false },
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
    },
  }
})
