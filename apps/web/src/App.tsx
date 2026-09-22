import type { PresentationConfig } from "@foundation-like-notion/contracts"
import { useEffect, useMemo, useState } from "react"
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from "react-router-dom"
import { Shell } from "./components/Shell.js"
import { ArticlePage } from "./pages/ArticlePage.js"
import { HomePage } from "./pages/HomePage.js"
import { LibraryPage } from "./pages/LibraryPage.js"
import { LoginPage } from "./pages/LoginPage.js"
import { SearchPage } from "./pages/SearchPage.js"
import { defaultPresentation } from "./presentation.js"
import type { ReaderClient } from "./reader-client.js"
import { type ReaderMode, ReaderRuntimeProvider } from "./reader-runtime.js"

const DEMO_SESSION_KEY = "notion-reader:demo:started:v1"

function applyPresentation(presentation: PresentationConfig): void {
  document.documentElement.lang = presentation.locale
  document.documentElement.style.colorScheme = presentation.theme.colorScheme
  document.title = presentation.brand.name
  const variables = {
    "--bg": presentation.theme.colors.background,
    "--panel": presentation.theme.colors.panel,
    "--panel-2": presentation.theme.colors.panelAlt,
    "--line": presentation.theme.colors.line,
    "--text": presentation.theme.colors.text,
    "--muted": presentation.theme.colors.muted,
    "--accent": presentation.theme.colors.accent,
    "--accent-2": presentation.theme.colors.accentSecondary,
    "--danger": presentation.theme.colors.danger,
    "--accent-foreground": presentation.theme.colorScheme === "light" ? "#ffffff" : "#10140a",
  }
  for (const [property, value] of Object.entries(variables)) {
    document.documentElement.style.setProperty(property, value)
  }
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", presentation.theme.colors.background)
  document
    .querySelector('meta[name="apple-mobile-web-app-title"]')
    ?.setAttribute("content", presentation.brand.shortName)
}

function DemoEntry({
  presentation,
  onStart,
}: {
  presentation: PresentationConfig
  onStart: () => void
}) {
  return (
    <main className="login-page">
      <section className="login-card demo-entry">
        <span className="eyebrow">{presentation.messages.demoBadge}</span>
        <h1>{presentation.messages.demoTitle}</h1>
        <p>{presentation.messages.demoDescription}</p>
        <button className="primary-button" type="button" onClick={onStart}>
          {presentation.messages.demoStart}
        </button>
      </section>
    </main>
  )
}

/** Render the Reader using an injected HTTP or static demo client. / 注入されたHTTPまたは静的demo clientでReaderを描画します。 */
export function App({
  client,
  mode,
  initialPresentation,
}: {
  client: ReaderClient
  mode: ReaderMode
  initialPresentation?: PresentationConfig
}) {
  const [presentation, setPresentation] = useState(initialPresentation ?? defaultPresentation)
  const [authenticated, setAuthenticated] = useState<boolean>()

  useEffect(() => {
    let active = true
    if (mode === "demo") {
      setAuthenticated(sessionStorage.getItem(DEMO_SESSION_KEY) === "true")
      return () => {
        active = false
      }
    }
    Promise.all([client.getPresentation().catch(() => defaultPresentation), client.getSession()])
      .then(([nextPresentation, session]) => {
        if (!active) return
        setPresentation(nextPresentation)
        setAuthenticated(session)
      })
      .catch(() => {
        if (active) setAuthenticated(false)
      })
    return () => {
      active = false
    }
  }, [client, mode])

  useEffect(() => applyPresentation(presentation), [presentation])

  const runtime = useMemo(
    () => ({
      client,
      mode,
      presentation,
      storageNamespace: mode === "demo" ? "demo" : "reader",
    }),
    [client, mode, presentation],
  )

  if (authenticated === undefined) {
    return <main className="loading-state">{presentation.messages.loading}</main>
  }

  if (!authenticated) {
    return (
      <ReaderRuntimeProvider value={runtime}>
        {mode === "demo" ? (
          <DemoEntry
            presentation={presentation}
            onStart={() => {
              sessionStorage.setItem(DEMO_SESSION_KEY, "true")
              setAuthenticated(true)
            }}
          />
        ) : (
          <LoginPage onAuthenticated={() => setAuthenticated(true)} />
        )}
      </ReaderRuntimeProvider>
    )
  }

  const signOut = async () => {
    if (mode === "demo") {
      sessionStorage.removeItem(DEMO_SESSION_KEY)
    } else {
      await client.logout()
    }
    setAuthenticated(false)
  }

  const Router = mode === "demo" ? HashRouter : BrowserRouter
  return (
    <ReaderRuntimeProvider value={runtime}>
      <Router>
        <Shell onLogout={() => void signOut()}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/library/:databaseId" element={<LibraryPage />} />
            <Route path="/article/:articleId" element={<ArticlePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Shell>
      </Router>
    </ReaderRuntimeProvider>
  )
}
