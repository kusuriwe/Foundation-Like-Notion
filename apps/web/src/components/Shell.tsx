import type { ReactNode } from "react"
import { Link, NavLink } from "react-router-dom"
import { useReaderRuntime } from "../reader-runtime.js"

/** Render shared authenticated navigation and content. / 認証後の共通 navigation と content を描画します。 */
export function Shell({ children, onLogout }: { children: ReactNode; onLogout: () => void }) {
  const { mode, presentation } = useReaderRuntime()
  const { messages } = presentation
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/">
          {presentation.brand.name.toUpperCase()}
        </Link>
        <nav aria-label="Main navigation">
          {mode === "demo" && <span className="demo-badge">{messages.demoBadge}</span>}
          <NavLink to="/">{messages.navHome}</NavLink>
          <NavLink to="/search">{messages.navSearch}</NavLink>
          <button type="button" className="text-button" onClick={onLogout}>
            {mode === "demo" ? messages.demoExit : messages.navLogout}
          </button>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  )
}
