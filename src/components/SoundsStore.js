import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import './SoundsStore.css';

export default function SoundsStore() {
  useEffect(() => {
    // Mobile menu toggle (scoped)
    const wrap = document.querySelector('.sounds-store');
    const toggle = wrap?.querySelector('.nav-toggle');
    const list = wrap?.querySelector('#nav-list');
    const onClick = () => {
      if (!list || !toggle) return;
      const open = list.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle?.addEventListener('click', onClick);

    // Reveal observer + play-on-view animations
    const reveals = wrap?.querySelectorAll('.reveal') || [];
    const animBlocks = wrap?.querySelectorAll('[data-animate-on-view]') || [];
    let io;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            if (e.target.hasAttribute('data-animate-on-view')) {
              e.target.classList.add('is-live');
            }
            io.unobserve(e.target);
          }
        }
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
      reveals.forEach(el => io.observe(el));
      animBlocks.forEach(el => io.observe(el));
    } else {
      reveals.forEach(el => el.classList.add('is-visible'));
      animBlocks.forEach(el => el.classList.add('is-live'));
    }

    // Match logo width to text width (logo above, same width as writings)
    const brandText = document.querySelector('.sounds-store .brand-text');
    const brandLogo = document.querySelector('.sounds-store .brand-logo');
    const applyLogoWidth = () => {
      if (!brandText || !brandLogo) return;
      const w = brandText.getBoundingClientRect().width;
      if (w > 0) {
        brandLogo.style.width = `${Math.round(w)}px`;
      }
    };
    // Observe size changes
    let ro;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(applyLogoWidth);
      if (brandText) ro.observe(brandText);
    } else {
      window.addEventListener('resize', applyLogoWidth);
    }
    // Initial sync after fonts load
    window.requestAnimationFrame(applyLogoWidth);

    return () => {
      toggle?.removeEventListener('click', onClick);
      io?.disconnect();
      ro?.disconnect?.();
      window.removeEventListener?.('resize', applyLogoWidth);
    };
  }, []);

  return (
    <div className="sounds-store">
      <header className="site-header" role="banner">
        <div className="container header-inner">
          <Link to="/sounds" className="brand" aria-label="Sounds di Arte Registrazioni - Home">
            <img
              className="brand-logo"
              src="/soundslogo.jpg"
              alt="Logo Sounds"
              decoding="async"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <span className="brand-text">
              <span className="brand-sounds">Sounds</span>{' '}
              <span className="brand-by">di</span>{' '}
              <span className="brand-arte">Arte Registrazioni</span>
            </span>
          </Link>
          <nav className="main-nav" aria-label="Menu principale">
            <button className="nav-toggle" aria-expanded="false" aria-controls="nav-list" aria-label="Apri menù">☰</button>
            <ul id="nav-list" className="nav-list">
              <li><a href="#" className="active">Home</a></li>
              <li><a href="#distribuzione">Distribuzione</a></li>
              <li><a href="#editing">Editing</a></li>
              <li><a href="#negozio">Negozio</a></li>
              <li><a href="#unisciti">Unisciti</a></li>
              <li className="sep"></li>
              <li><a href="#login" className="login">Login</a></li>
            </ul>
          </nav>
          <Link className="btn btn-label" to="/" title="Vai alla Label (home attuale)">Label</Link>
        </div>
      </header>

      <main>
        <section className="hero" aria-label="Intro">
          <div className="hero-media">
            <video className="hero-video" autoPlay muted loop playsInline preload="metadata" aria-hidden="true" />
          </div>
          <div className="hero-overlay container">
            <h1 className="reveal">Suona. Edita. Venditi.</h1>
            <p className="lead reveal">La piattaforma italiana per distribuire la tua musica, curare l'editing editoriale e vendere direttamente ai tuoi fan.</p>
            <div className="cta-row reveal">
              <a className="btn btn-primary" href="#unisciti">Carica il tuo brano</a>
              <a className="btn btn-ghost" href="#come-funziona">Come funziona</a>
            </div>
          </div>
        </section>

        {/* SOCIAL SOUNDS: la rete privata dei musicisti */}
        <section id="social" className="social-sounds container" aria-labelledby="social-title">
          <div className="social-card reveal" data-animate-on-view>
            <div className="social-head">
              <h2 id="social-title" className="social-title">SOCIAL SOUNDS</h2>
              <p className="social-sub">Dove i tuoi concerti prendono vita. Posta il volantino, annuncia la data, fatti trovare.</p>
            </div>
            <div className="social-icons" role="list" aria-label="Funzioni principali">
              <div className="social-icon megaphone" role="listitem" aria-label="Annuncia live">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M3 11l12-6v14L3 13V11Z" stroke="#60a5fa" strokeWidth="1.6" strokeLinejoin="round"/>
                  <path d="M8 14.5 7 20" stroke="#60a5fa" strokeWidth="1.6" strokeLinecap="round"/>
                  <path d="M18 8c1.2.8 2 2.1 2 3.6s-.8 2.8-2 3.6" stroke="#60a5fa" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
                <span>Live</span>
              </div>
              <div className="social-icon map" role="listitem" aria-label="Eventi vicini">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M12 2C8.7 2 6 4.7 6 8c0 4.5 6 12 6 12s6-7.5 6-12c0-3.3-2.7-6-6-6Zm0 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" stroke="#60a5fa" strokeWidth="1.6"/>
                </svg>
                <span>Vicino a te</span>
                <span className="ping" aria-hidden="true"></span>
              </div>
              <div className="social-icon chat" role="listitem" aria-label="RSVP e chat">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M4 6h16v9a3 3 0 0 1-3 3H9l-5 3V6Z" stroke="#60a5fa" strokeWidth="1.6" strokeLinejoin="round"/>
                  <circle cx="9" cy="11" r="1" fill="#60a5fa"/>
                  <circle cx="12" cy="11" r="1" fill="#60a5fa"/>
                  <circle cx="15" cy="11" r="1" fill="#60a5fa"/>
                </svg>
                <span>RSVP</span>
              </div>
            </div>
            <div className="social-cta">
              <a className="btn btn-join" href="/social">Entra ora</a>
            </div>
          </div>
        </section>

        <section id="come-funziona" className="how container" aria-labelledby="how-title">
          <h2 id="how-title" className="section-title reveal">Come funziona</h2>
          <div className="cards">
            <article className="card reveal">
              <div className="icon-wrap" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 16V4m0 0 4 4m-4-4-4 4" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3>Carica</h3>
              <p>Inserisci audio, metadati e cover — validati in tempo reale.</p>
            </article>
            <article className="card reveal">
              <div className="icon-wrap" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4Z" stroke="#60a5fa" strokeWidth="1.5"/>
                  <path d="m9 12 2 2 4-4" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3>Edita</h3>
              <p>Diventiamo editori tuoi. Royalties, diritti, tutto incluso.</p>
            </article>
            <article id="distribuzione" className="card reveal">
              <div className="icon-wrap" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="4" y="5" width="3" height="14" rx="1.5" stroke="#60a5fa" strokeWidth="1.5"/>
                  <rect x="10.5" y="8" width="3" height="11" rx="1.5" stroke="#60a5fa" strokeWidth="1.5"/>
                  <rect x="17" y="3" width="3" height="16" rx="1.5" stroke="#60a5fa" strokeWidth="1.5"/>
                </svg>
              </div>
              <h3>Distribuisci</h3>
              <p>Uscita su 150 store. Una tantum, zero abbonamento.</p>
            </article>
            <article id="negozio" className="card reveal">
              <div className="icon-wrap" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 5h2l1.6 9.2A2 2 0 0 0 8.6 16h7.8a2 2 0 0 0 2-1.6L20 9H6" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="10" cy="19" r="1.5" stroke="#60a5fa" strokeWidth="1.5"/>
                  <circle cx="17" cy="19" r="1.5" stroke="#60a5fa" strokeWidth="1.5"/>
                </svg>
              </div>
              <h3>Vendi</h3>
              <p>Download €0.99 sul tuo Sounds Store. 100% netto.</p>
            </article>
          </div>
        </section>

        <section className="store-teaser container" aria-labelledby="store-title">
          <h2 id="store-title" className="section-title reveal">Scopri il Negozio</h2>
          <p className="muted reveal">Un assaggio del tuo futuro storefront. Copertine grandi, anteprime rapide, acquisto immediato.</p>
          <div className="album-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="album-card reveal" aria-label="Album placeholder">
                <div className="cover"></div>
                <div className="meta">
                  <span className="title">Titolo Brano</span>
                  <span className="artist">Nome Artista</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="unisciti" className="join container" aria-labelledby="join-title">
          <h2 id="join-title" className="section-title reveal">Unisciti a Sounds</h2>
          <p className="lead reveal">Apri il tuo store, distribuisci sui principali servizi e affida a noi l'editing editoriale.</p>
          <form className="join-form reveal" action="#" method="get" onSubmit={(e)=>{ e.preventDefault(); const email = e.currentTarget.querySelector('input[type="email"]').value.trim(); alert(email ? `Grazie! Ti contatteremo all'indirizzo: ${email}` : 'Grazie! Ti contatteremo presto.'); }}>
            <label className="field">
              <span>La tua email</span>
              <input type="email" placeholder="tu@esempio.com" required />
            </label>
            <label className="field">
              <span>Link a un brano di esempio (opzionale)</span>
              <input type="url" placeholder="https://…" />
            </label>
            <div className="actions">
              <button className="btn btn-primary" type="submit">Richiedi invito</button>
              <a className="btn btn-ghost" href="#come-funziona">Vedi dettagli</a>
            </div>
          </form>
        </section>
      </main>

      <footer className="site-footer" role="contentinfo">
        <div className="container footer-inner">
          <div className="legal">
            <div className="badges">
              <span className="badge">SIAE Licensed</span>
              <span className="badge">P.IVA 12531290018</span>
            </div>
            <div className="links">
              <a href="#privacy">Privacy</a>
              <span className="dot" aria-hidden="true">•</span>
              <a href="#cookie">Cookie</a>
            </div>
            <div className="copy">2025 © Arte Registrazioni</div>
          </div>
          <div className="social">
            <a href="#" aria-label="Instagram" className="social-link">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="3" width="18" height="18" rx="5" stroke="#94a3b8" strokeWidth="1.5"/>
                <circle cx="12" cy="12" r="4" stroke="#94a3b8" strokeWidth="1.5"/>
                <circle cx="17.5" cy="6.5" r="1" fill="#94a3b8"/>
              </svg>
            </a>
            <a href="#" aria-label="TikTok" className="social-link">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 3v8.2a3.8 3.8 0 1 1-3.8-3.8" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M14 6c1.2 1.8 3.1 3 5 3" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </a>
            <a href="#" aria-label="Telegram" className="social-link">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 5 10 13l-2 6 3-4 10-10Z" stroke="#94a3b8" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M21 5 4 11l5 2" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
