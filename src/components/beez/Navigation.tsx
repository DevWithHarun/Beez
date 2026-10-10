import { useState } from "react";
import { APP_URL } from "./links";

export default function Navigation() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="site-nav">
      <a className="brand" href="#/" aria-label="Beez home">
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <path d="M24 8c-7 0-12 6-12 14 0 9 6 15 12 18 6-3 12-9 12-18 0-8-5-14-12-14Z" />
          <path d="M13 18h22M12 25h24M15 32h18" />
          <path d="M19 8c0-4 3-6 5-6s5 2 5 6" />
          <path d="m11 13-5-4m31 4 5-4M9 21H4m40 0h-5" />
        </svg>
        <span>Beez</span>
      </a>

      <div className={`nav-links${menuOpen ? " is-open" : ""}`} id="site-menu">
        <a href="#/offer" onClick={() => setMenuOpen(false)}>What we offer</a>
        <a href="#/vision" onClick={() => setMenuOpen(false)}>Vision</a>
        <a href="#/features" onClick={() => setMenuOpen(false)}>Features</a>
        <a href="#/faq" onClick={() => setMenuOpen(false)}>FAQ</a>
        <a className="nav-cta" href={APP_URL} rel="noopener noreferrer">
          Launch app
        </a>
      </div>
      <button
        className="menu-toggle"
        type="button"
        aria-controls="site-menu"
        aria-expanded={menuOpen}
        aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span />
        <span />
        <span />
      </button>
    </nav>
  );
}
