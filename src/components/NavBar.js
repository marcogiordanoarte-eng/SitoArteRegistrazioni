import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useI18n } from "../i18n";

export default function NavBar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { t, lang, setLang } = useI18n();

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
          {t('nav_menu')}
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
            {t('nav_artists_label')}
          </Link>
        </div>

        {/* Riga 1: Festival + Podcast (medio, affiancati) */}
        <div className="nav-row nav-row--pair">
          <Link
            to="/festival"
            className={`glow-btn glow-btn--md${isActive("/festival") ? " glow-btn--active" : ""}`}
          >
            {t('nav_festival')}
          </Link>
          <Link
            to="/podcast"
            className={`glow-btn glow-btn--md${isActive("/podcast") ? " glow-btn--active" : ""}`}
          >
            {t('nav_podcast')}
          </Link>
        </div>

        {/* Riga 2: Countdown singolo (medio) */}
        <div className="nav-row nav-row--single">
          <Link
            to="/countdown"
            className={`glow-btn glow-btn--md${isActive("/countdown") ? " glow-btn--active" : ""}`}
          >
            {t('nav_countdown')}
          </Link>
        </div>

        {/* Home unica: mantiene label Sounds */}
        <div className="nav-row nav-row--single">
          <Link
            to="/"
            className={`glow-btn glow-btn--lg${isActive("/") ? " glow-btn--active" : ""}`}
          >
            {t('nav_sounds')}
          </Link>
        </div>

        {/* Riga 4: Contatti (più piccolo, opzionale in coda) */}
        <div className="nav-row nav-row--single nav-row--tail">
          <Link
            to="/contatti"
            className={`glow-btn glow-btn--sm${isActive("/contatti") ? " glow-btn--active" : ""}`}
          >
            {t('nav_contacts')}
          </Link>
        </div>

        {/* Lingua switch */}
        <div className="nav-row nav-row--tail" style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <span style={{ color: '#9aa3b2', fontSize: 12 }}>{t('nav_language')}:</span>
          <button type="button" className={`glow-btn glow-btn--sm${lang==='it' ? ' glow-btn--active' : ''}`} onClick={() => setLang('it')} aria-pressed={lang==='it'}>
            {t('lang_it')}
          </button>
          <button type="button" className={`glow-btn glow-btn--sm${lang==='en' ? ' glow-btn--active' : ''}`} onClick={() => setLang('en')} aria-pressed={lang==='en'}>
            {t('lang_en')}
          </button>
        </div>
      </nav>
    </div>
  );
}
