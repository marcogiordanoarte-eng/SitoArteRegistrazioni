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
      {/* Tasto Menu (sempre visibile) */}
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
          {/* Riga 1: Home + Artisti (medio, affiancati) */}
          <div className="nav-row nav-row--pair">
            <Link
              to="/"
              className={`glow-btn glow-btn--md${isActive("/") ? " glow-btn--active" : ""}`}
            >
              Home
            </Link>
            <Link
              to="/artisti"
              className={`glow-btn glow-btn--md${isActive("/artisti") ? " glow-btn--active" : ""}`}
            >
              Artisti
            </Link>
          </div>

          {/* Riga 2: Festival + Podcast (medio, affiancati) */}
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

          {/* Riga 3: Countdown singolo (medio) */}
          <div className="nav-row nav-row--single">
            <Link
              to="/countdown"
              className={`glow-btn glow-btn--md${isActive("/countdown") ? " glow-btn--active" : ""}`}
            >
              Countdown
            </Link>
          </div>


          {/* Riga 4: Sounds singolo (grande) */}
          <div className="nav-row nav-row--single">
            <Link
              to="/sounds"
              className={`glow-btn glow-btn--lg${isActive("/sounds") ? " glow-btn--active" : ""}`}
            >
              Sounds
            </Link>
          </div>

          {/* Riga 5: Contatti (più piccolo, opzionale in coda) */}
          <div className="nav-row nav-row--single nav-row--tail">
            <Link
              to="/contatti"
              className={`glow-btn glow-btn--sm${isActive("/contatti") ? " glow-btn--active" : ""}`}
            >
              Contatti
            </Link>
          </div>

          {/* (Rimosso) Pulsante blu Dashboard Artista */}
        </nav>
      )}
    </div>
  );
}
