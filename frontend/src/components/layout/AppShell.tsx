import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="app-header__brand">
          MarketScope
        </Link>
        <nav className="app-header__nav">
          <Link to="/">Markets</Link>
          <Link to="/upload">New Market</Link>
        </nav>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
