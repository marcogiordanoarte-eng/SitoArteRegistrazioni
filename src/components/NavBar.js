import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

export default function NavBar() {
  const location = useLocation();
  const isActive = (to) => location.pathname === to;
  const [open, setOpen] = useState(false);

  // Chiudi il menu quando cambia la route
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div>
      {/* Barra toggle (solo pulsante Menu, sempre visibile) */}
      <div className="menu-toggle-bar">
        <button
          type="button"
          className="glow-btn glow-btn--md menu-toggle-btn"
          aria-expanded={open}
          aria-controls="main-nav"
          onClick={() => setOpen((v) => !v)}
        >
          Menu
        </button>
      </div>

      {/* Navigazione principale a scomparsa */}
      {open && (
        <nav id="main-nav" className="glow-menu glow-menu--grid" aria-label="Navigazione principale">
          {/* Primo tasto: ARTISTS LABEL (rosso fuoco, testo nero) */}
          <div className="nav-row nav-row--single">
            <Link
              to="/artisti"
              className={`glow-btn glow-btn--lg glow-btn--red${isActive("/artisti") ? " glow-btn--active" : ""}`}
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
      )}
    </div>
  );
}
