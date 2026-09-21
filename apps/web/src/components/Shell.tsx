import type { ReactNode } from "react"
import { Link, NavLink } from "react-router-dom"

/** Render shared authenticated navigation and content. / 認証後の共通 navigation と content を描画します。 */
export function Shell({ children, onLogout }: { children: ReactNode; onLogout: () => void }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/">
          NOTION READER
        </Link>
        <nav aria-label="Main navigation">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/search">Search</NavLink>
          <button type="button" className="text-button" onClick={onLogout}>
            Logout
          </button>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  )
}
