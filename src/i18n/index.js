import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';

const I18nContext = createContext({
  lang: 'it',
  setLang: () => {},
  t: (key) => key,
});

const DEFAULT_LANG = 'it';
const STORAGE_KEY = 'lang';

const MESSAGES = {
  it: {
    // Common/nav
    nav_menu: 'Menù',
    nav_artists_label: 'Etichetta Artisti',
    nav_festival: 'Festival',
    nav_podcast: 'Podcast',
    nav_countdown: 'Conto alla rovescia',
    nav_sounds: 'Sounds', // brand, keep
    nav_contacts: 'Contatti',
    nav_login: 'Accedi',
    nav_language: 'Lingua',
    lang_it: 'IT',
    lang_en: 'EN',

    // Footer
    footer_terms: 'Termini',
    footer_privacy: 'Privacy',
    footer_license: 'Licenza',

    // PublicSite
    ps_back: 'Indietro',
    ps_open_logo_video: 'Apri video logo',
    ps_press: 'Premi',
    ps_welcome_title: 'Benvenuto su Arte Registrazioni',
    ps_welcome_desc_line1: "Scopri i nostri artisti, ascolta la loro musica e vivi l'esperienza unica di Arte Registrazioni.",
    ps_welcome_desc_line2: 'Utilizza il menù per navigare tra le pagine e accedere a tutte le funzionalità.',

    // Login
    login_title_login: 'Accedi',
    login_title_signup: 'Registrati',
    login_tab_login: 'Accedi',
    login_tab_signup: 'Registrati',
    login_email: 'Email',
    login_password: 'Password',
    login_password_hint: 'min 6 caratteri',
    login_show_password: 'Mostra password',
    login_hide_password: 'Nascondi password',
    login_submit_login: 'Entra',
    login_submit_signup: 'Crea Account',
    login_attendere: 'Attendere...'
  },
  en: {
    // Common/nav
    nav_menu: 'Menu',
    nav_artists_label: 'Artists Label',
    nav_festival: 'Festival',
    nav_podcast: 'Podcast',
    nav_countdown: 'Countdown',
    nav_sounds: 'Sounds',
    nav_contacts: 'Contacts',
    nav_login: 'Login',
    nav_language: 'Language',
    lang_it: 'IT',
    lang_en: 'EN',

    // Footer
    footer_terms: 'Terms',
    footer_privacy: 'Privacy',
    footer_license: 'License',

    // PublicSite
    ps_back: 'Back',
    ps_open_logo_video: 'Open logo video',
    ps_press: 'Press',
    ps_welcome_title: 'Welcome to Arte Registrazioni',
    ps_welcome_desc_line1: 'Discover our artists, listen to their music and enjoy the Arte Registrazioni experience.',
    ps_welcome_desc_line2: 'Use the menu to navigate pages and access all features.',

    // Login
    login_title_login: 'Login',
    login_title_signup: 'Sign up',
    login_tab_login: 'Login',
    login_tab_signup: 'Sign up',
    login_email: 'Email',
    login_password: 'Password',
    login_password_hint: 'min 6 characters',
    login_show_password: 'Show password',
    login_hide_password: 'Hide password',
    login_submit_login: 'Enter',
    login_submit_signup: 'Create Account',
    login_attendere: 'Please wait...'
  }
};

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;
    } catch {
      return DEFAULT_LANG;
    }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch {}
  }, [lang]);

  const t = useMemo(() => {
    return (key) => {
      const dict = MESSAGES[lang] || MESSAGES[DEFAULT_LANG];
      return (dict && dict[key]) || key;
    };
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

export { MESSAGES };
