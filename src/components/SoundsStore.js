import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './SoundsStore.css';

export default function SoundsStore() {
  const messages = {
    it: {
      nav_home: 'Home',
      nav_distribution: 'Distribuzione',
      nav_editing: 'Editing',
      nav_store: 'Negozio',
      nav_join: 'Unisciti',
      nav_login: 'Login',
      label_btn: 'Label',
      label_title: 'Vai alla Label',
      hero_title: 'Suona. Edita. Vendi.',
      hero_lead: "La piattaforma italiana per distribuire la tua musica, curare l'editing editoriale e vendere direttamente ai tuoi fan.",
      cta_upload: 'Carica il tuo brano',
      cta_how: 'Come funziona',
      social_title: 'SOCIAL SOUNDS',
      social_sub: 'Dove i tuoi concerti prendono vita. Posta il volantino, annuncia la data, fatti trovare.',
      social_live: 'Live',
      social_near: 'Vicino a te',
      social_rsvp: 'RSVP',
      social_join: 'Entra ora',
      how_title: 'Come funziona',
      how_upload: 'Carica',
      how_upload_desc: 'Inserisci audio, metadati e cover — validati in tempo reale.',
      how_edit: 'Edita',
      how_edit_desc: 'Diventiamo editori tuoi. Royalties, diritti, tutto incluso.',
      how_distribute: 'Distribuisci',
      how_distribute_desc: 'Uscita su 150 store. Una tantum, zero abbonamento.',
      how_sell: 'Vendi',
      how_sell_desc: 'Download €0.99 sul tuo Sounds Store. 100% netto.',
      store_title: 'Scopri il Negozio',
      store_desc: 'Un assaggio del tuo futuro storefront. Copertine grandi, anteprime rapide, acquisto immediato.',
      placeholder_track: 'Titolo Brano',
      placeholder_artist: 'Nome Artista',
      join_title: 'Unisciti a Sounds',
      join_lead: "Apri il tuo store, distribuisci sui principali servizi e affida a noi l'editing editoriale.",
      form_email: 'La tua email',
      placeholder_email: 'tu@esempio.com',
      form_demo: 'Link a un brano di esempio (opzionale)',
      placeholder_demo: 'https://…',
      form_submit: 'Richiedi invito',
      form_details: 'Vedi dettagli',
      alert_thanks_email: "Grazie! Ti contatteremo all'indirizzo: ${email}",
      alert_thanks: 'Grazie! Ti contatteremo presto.',
      footer_privacy: 'Privacy',
      footer_cookie: 'Cookie',
      lang_label: 'Lingua',
      lang_it: 'IT',
      lang_en: 'EN',
      nav_aria_open_menu: 'Apri menù',
    },
    en: {
      nav_home: 'Home',
      nav_distribution: 'Distribution',
      nav_editing: 'Editing',
      nav_store: 'Store',
      nav_join: 'Join',
      nav_login: 'Login',
      label_btn: 'Label',
      label_title: 'Go to Label',
      hero_title: 'Play. Edit. Sell.',
      hero_lead: "The Italian platform to distribute your music, handle editorial editing, and sell directly to your fans.",
      cta_upload: 'Upload your track',
      cta_how: 'How it works',
      social_title: 'SOCIAL SOUNDS',
      social_sub: 'Where your gigs come to life. Post your flyer, announce the date, get discovered.',
      social_live: 'Live',
      social_near: 'Near you',
      social_rsvp: 'RSVP',
      social_join: 'Join now',
      how_title: 'How it works',
      how_upload: 'Upload',
      how_upload_desc: 'Add audio, metadata and cover — validated in real time.',
      how_edit: 'Edit',
      how_edit_desc: 'We become your publisher. Royalties, rights, all included.',
      how_distribute: 'Distribute',
      how_distribute_desc: 'Release to 150 stores. One-off, no subscription.',
      how_sell: 'Sell',
      how_sell_desc: 'Download €0.99 on your Sounds Store. 100% net.',
      store_title: 'Discover the Store',
      store_desc: 'A glimpse of your future storefront. Large covers, quick previews, instant purchase.',
      placeholder_track: 'Track Title',
      placeholder_artist: 'Artist Name',
      join_title: 'Join Sounds',
      join_lead: 'Open your store, distribute to the main services and let us handle editorial editing.',
      form_email: 'Your email',
      placeholder_email: 'you@example.com',
      form_demo: 'Link to a sample track (optional)',
      placeholder_demo: 'https://…',
      form_submit: 'Request invite',
      form_details: 'See details',
      alert_thanks_email: "Thanks! We'll reach out at: ${email}",
      alert_thanks: "Thanks! We'll contact you soon.",
      footer_privacy: 'Privacy',
      footer_cookie: 'Cookie',
      lang_label: 'Language',
      lang_it: 'IT',
      lang_en: 'EN',
      nav_aria_open_menu: 'Open menu',
    }
  };

  const [lang, setLang] = useState(typeof window !== 'undefined' ? (localStorage.getItem('lang') || 'it') : 'it');
  useEffect(() => { try { localStorage.setItem('lang', lang); } catch(_) {} }, [lang]);
  const t = (key) => (messages[lang] && messages[lang][key]) || key;
  const format = (template, vars) => template.replace(/\$\{(\w+)\}/g, (_, k) => vars[k] ?? '');
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
          <Link to="/" className="brand" aria-label="Sounds di Arte Registrazioni - Home">
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
            <button className="nav-toggle" aria-expanded="false" aria-controls="nav-list" aria-label={t('nav_aria_open_menu')}>☰</button>
            <ul id="nav-list" className="nav-list">
              <li><a href="/" className="active">{t('nav_home')}</a></li>
              <li><a href="#distribuzione">{t('nav_distribution')}</a></li>
              <li><a href="#editing">{t('nav_editing')}</a></li>
              <li><a href="#negozio">{t('nav_store')}</a></li>
              <li><a href="#unisciti">{t('nav_join')}</a></li>
              <li className="sep"></li>
              <li><a href="#login" className="login">{t('nav_login')}</a></li>
            </ul>
          </nav>
          <div className="right-ctrls">
            <div className="lang-switch" role="group" aria-label={t('lang_label')}>
              <button type="button" className={lang==='it' ? 'active' : ''} aria-pressed={lang==='it'} onClick={() => setLang('it')}>{t('lang_it')}</button>
              <button type="button" className={lang==='en' ? 'active' : ''} aria-pressed={lang==='en'} onClick={() => setLang('en')}>{t('lang_en')}</button>
            </div>
            <Link className="btn btn-label" to="/label" title={t('label_title')}>{t('label_btn')}</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="hero" aria-label="Intro">
          <div className="hero-media">
            <video className="hero-video" autoPlay muted loop playsInline preload="metadata" aria-hidden="true" />
          </div>
          <div className="hero-overlay container">
            <h1 className="reveal">{t('hero_title')}</h1>
            <p className="lead reveal">{t('hero_lead')}</p>
            <div className="cta-row reveal">
              <a className="btn btn-primary" href="#unisciti">{t('cta_upload')}</a>
              <a className="btn btn-ghost" href="#come-funziona">{t('cta_how')}</a>
            </div>
          </div>
        </section>

        {/* SOCIAL SOUNDS: la rete privata dei musicisti */}
        <section id="social" className="social-sounds container" aria-labelledby="social-title">
          <div className="social-card reveal" data-animate-on-view>
            <div className="social-head">
              <h2 id="social-title" className="social-title">{t('social_title')}</h2>
              <p className="social-sub">{t('social_sub')}</p>
            </div>
            <div className="social-icons" role="list" aria-label="Funzioni principali">
              <div className="social-icon megaphone" role="listitem" aria-label="Annuncia live">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M3 11l12-6v14L3 13V11Z" stroke="#60a5fa" strokeWidth="1.6" strokeLinejoin="round"/>
                  <path d="M8 14.5 7 20" stroke="#60a5fa" strokeWidth="1.6" strokeLinecap="round"/>
                  <path d="M18 8c1.2.8 2 2.1 2 3.6s-.8 2.8-2 3.6" stroke="#60a5fa" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
                <span>{t('social_live')}</span>
              </div>
              <div className="social-icon map" role="listitem" aria-label="Eventi vicini">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M12 2C8.7 2 6 4.7 6 8c0 4.5 6 12 6 12s6-7.5 6-12c0-3.3-2.7-6-6-6Zm0 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" stroke="#60a5fa" strokeWidth="1.6"/>
                </svg>
                <span>{t('social_near')}</span>
                <span className="ping" aria-hidden="true"></span>
              </div>
              <div className="social-icon chat" role="listitem" aria-label="RSVP e chat">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M4 6h16v9a3 3 0 0 1-3 3H9l-5 3V6Z" stroke="#60a5fa" strokeWidth="1.6" strokeLinejoin="round"/>
                  <circle cx="9" cy="11" r="1" fill="#60a5fa"/>
                  <circle cx="12" cy="11" r="1" fill="#60a5fa"/>
                  <circle cx="15" cy="11" r="1" fill="#60a5fa"/>
                </svg>
                <span>{t('social_rsvp')}</span>
              </div>
            </div>
            <div className="social-cta">
              <a className="btn btn-join" href="/social">{t('social_join')}</a>
            </div>
          </div>
        </section>

        <section id="come-funziona" className="how container" aria-labelledby="how-title">
          <h2 id="how-title" className="section-title reveal">{t('how_title')}</h2>
          <div className="cards">
            <article className="card reveal">
              <div className="icon-wrap" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 16V4m0 0 4 4m-4-4-4 4" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3>{t('how_upload')}</h3>
              <p>{t('how_upload_desc')}</p>
            </article>
            <article className="card reveal">
              <div className="icon-wrap" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4Z" stroke="#60a5fa" strokeWidth="1.5"/>
                  <path d="m9 12 2 2 4-4" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3>{t('how_edit')}</h3>
              <p>{t('how_edit_desc')}</p>
            </article>
            <article id="distribuzione" className="card reveal">
              <div className="icon-wrap" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="4" y="5" width="3" height="14" rx="1.5" stroke="#60a5fa" strokeWidth="1.5"/>
                  <rect x="10.5" y="8" width="3" height="11" rx="1.5" stroke="#60a5fa" strokeWidth="1.5"/>
                  <rect x="17" y="3" width="3" height="16" rx="1.5" stroke="#60a5fa" strokeWidth="1.5"/>
                </svg>
              </div>
              <h3>{t('how_distribute')}</h3>
              <p>{t('how_distribute_desc')}</p>
            </article>
            <article id="negozio" className="card reveal">
              <div className="icon-wrap" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 5h2l1.6 9.2A2 2 0 0 0 8.6 16h7.8a2 2 0 0 0 2-1.6L20 9H6" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="10" cy="19" r="1.5" stroke="#60a5fa" strokeWidth="1.5"/>
                  <circle cx="17" cy="19" r="1.5" stroke="#60a5fa" strokeWidth="1.5"/>
                </svg>
              </div>
              <h3>{t('how_sell')}</h3>
              <p>{t('how_sell_desc')}</p>
            </article>
          </div>
        </section>

        <section className="store-teaser container" aria-labelledby="store-title">
          <h2 id="store-title" className="section-title reveal">{t('store_title')}</h2>
          <p className="muted reveal">{t('store_desc')}</p>
          <div className="album-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="album-card reveal" aria-label="Album placeholder">
                <div className="cover"></div>
                <div className="meta">
                  <span className="title">{t('placeholder_track')}</span>
                  <span className="artist">{t('placeholder_artist')}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="unisciti" className="join container" aria-labelledby="join-title">
          <h2 id="join-title" className="section-title reveal">{t('join_title')}</h2>
          <p className="lead reveal">{t('join_lead')}</p>
          <form className="join-form reveal" action="#" method="get" onSubmit={(e)=>{ e.preventDefault(); const email = e.currentTarget.querySelector('input[type="email"]').value.trim(); alert(email ? format(t('alert_thanks_email'), { email }) : t('alert_thanks')); }}>
            <label className="field">
              <span>{t('form_email')}</span>
              <input type="email" placeholder={t('placeholder_email')} required />
            </label>
            <label className="field">
              <span>{t('form_demo')}</span>
              <input type="url" placeholder={t('placeholder_demo')} />
            </label>
            <div className="actions">
              <button className="btn btn-primary" type="submit">{t('form_submit')}</button>
              <a className="btn btn-ghost" href="#come-funziona">{t('form_details')}</a>
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
              <a href="#privacy">{t('footer_privacy')}</a>
              <span className="dot" aria-hidden="true">•</span>
              <a href="#cookie">{t('footer_cookie')}</a>
            </div>
            <div className="copy">2025 © Arte Registrazioni</div>
          </div>
          <div className="social">
            <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="social-link">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="3" width="18" height="18" rx="5" stroke="#94a3b8" strokeWidth="1.5"/>
                <circle cx="12" cy="12" r="4" stroke="#94a3b8" strokeWidth="1.5"/>
                <circle cx="17.5" cy="6.5" r="1" fill="#94a3b8"/>
              </svg>
            </a>
            <a href="https://www.tiktok.com/" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="social-link">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 3v8.2a3.8 3.8 0 1 1-3.8-3.8" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M14 6c1.2 1.8 3.1 3 5 3" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </a>
            <a href="https://t.me/" target="_blank" rel="noopener noreferrer" aria-label="Telegram" className="social-link">
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
