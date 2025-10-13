import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function NavBar() {
  const location = useLocation();
  const isActive = (to) => location.pathname === to;

  return (
    <nav className="glow-menu glow-menu--grid" aria-label="Navigazione principale">
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

      {/* Riga 4: Buy Music singolo (grande) */}
      <div className="nav-row nav-row--single">
        <Link
          to="/buy"
          className={`glow-btn glow-btn--lg${isActive("/buy") ? " glow-btn--active" : ""}`}
        >
          Buy Music
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

      {/* Pulsante blu Dashboard Artista (sempre visibile) */}
      <div className="nav-row nav-row--single nav-row--tail">
        <Link
          to="/artist-dashboard"
          className="glow-btn glow-btn--blue"
          title="Dashboard Artista"
          aria-label="Dashboard Artista"
        >
          Dashboard Artista
        </Link>
      </div>
    </nav>
  );
}
