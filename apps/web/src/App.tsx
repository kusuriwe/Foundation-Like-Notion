import { useEffect, useState } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { getSession, logout } from "./api.js"
import { Shell } from "./components/Shell.js"
import { ArticlePage } from "./pages/ArticlePage.js"
import { HomePage } from "./pages/HomePage.js"
import { LibraryPage } from "./pages/LibraryPage.js"
import { LoginPage } from "./pages/LoginPage.js"
import { SearchPage } from "./pages/SearchPage.js"

/** Render the authenticated Reader router. / 認証済み Reader router を描画します。 */
export function App() {
  const [authenticated, setAuthenticated] = useState<boolean>()

  useEffect(() => {
    getSession()
      .then(setAuthenticated)
      .catch(() => setAuthenticated(false))
  }, [])

  if (authenticated === undefined) {
    return <main className="loading-state">Loading…</main>
  }
  if (!authenticated) {
    return <LoginPage onAuthenticated={() => setAuthenticated(true)} />
  }

  const signOut = async () => {
    await logout()
    setAuthenticated(false)
  }

  return (
    <BrowserRouter>
      <Shell onLogout={() => void signOut()}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/library/:databaseId" element={<LibraryPage />} />
          <Route path="/article/:articleId" element={<ArticlePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  )
}
