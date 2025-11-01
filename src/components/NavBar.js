import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

export default function NavBar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Close menu on route change
    setOpen(false);
  }, [location.pathname]);

  const isActive = (path) => location.pathname === path;

  return (
    <div className="navbar-wrap">
      <div className="menu-toggle-bar">
        <button
          type="button"
          className="glow-btn menu-toggle-btn"
          aria-expanded={open}
          aria-controls="main-nav"
          onClick={() => setOpen((o) => !o)}
        >
          Menu
        </button>
      </div>

      <nav
        id="main-nav"
        className={`glow-menu glow-menu--grid menu-collapsible ${open ? "is-open" : ""}`}
        aria-label="Navigazione principale"
        aria-hidden={!open}
      >
        <div className="nav-row nav-row--single">
          <Link
            to="/artisti"
            className={`glow-btn glow-btn--lg glow-btn--blue${isActive("/artisti") ? " glow-btn--active" : ""}`}
          >
            ARTISTS LABEL
          </Link>
        </div>

        {/* Riga 1: Festival + Podcast (medio, affiancati) */}
        <div className="nav-row nav-row--pair">
          <Link
            to="/festival"
            className={`glow-btn glow-btn--md${isActive("/festival") ? " glow-btn--active" : ""}`}
          >
            Festival
          </Link>
          <Link
            to="/podcast"
            className={`glow-btn glow-btn--md${isActive("/podcast") ? " glow-btn--active" : ""}`}
          >
            Podcast
          </Link>
        </div>

        {/* Riga 2: Countdown singolo (medio) */}
        <div className="nav-row nav-row--single">
          <Link
            to="/countdown"
            className={`glow-btn glow-btn--md${isActive("/countdown") ? " glow-btn--active" : ""}`}
          >
            Countdown
          </Link>
        </div>

        {/* Riga 3: Sounds singolo (grande) */}
        <div className="nav-row nav-row--single">
          <Link
            to="/sounds"
            className={`glow-btn glow-btn--lg${isActive("/sounds") ? " glow-btn--active" : ""}`}
          >
            Sounds
          </Link>
        </div>

        {/* Riga 4: Contatti (più piccolo, opzionale in coda) */}
        <div className="nav-row nav-row--single nav-row--tail">
          <Link
            to="/contatti"
            className={`glow-btn glow-btn--sm${isActive("/contatti") ? " glow-btn--active" : ""}`}
          >
            Contatti
          </Link>
        </div>
      </nav>
    </div>
  );
}
