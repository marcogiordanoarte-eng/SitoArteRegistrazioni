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
  ,
    // Contacts
    contacts_title: 'Contatti',
    contacts_phone: 'Telefono',
    contacts_call: 'Chiama',
    contacts_write_message: 'Scrivi un messaggio',
    contacts_address: 'Indirizzo',
    contacts_open_maps: 'Apri su Google Maps',

    // Terms
    terms_title: 'Termini e Condizioni',
    terms_p1: 'Arte Registrazioni — Partita IVA 12531290018. Vendiamo contenuti musicali digitali e licenze d’uso royalty‑free per progetti multimediali.',
    terms_p2: 'Prodotti e prezzi: i prezzi sono indicati accanto a ciascun brano nella sezione Buy Music. Gli importi sono mostrati in euro e visibili prima dell’acquisto.',
    terms_p3: 'Acquisto e pagamento: l’acquisto avviene tramite link di pagamento sicuri (Stripe Payment Links) e, se previsto, con metodi alternativi indicati nella pagina del brano.',
    terms_p4: 'Consegna: trattandosi di beni digitali, il download è disponibile subito dopo il pagamento o tramite pagina/collegamento inviato all’utente.',
    terms_p5: 'Licenza d’uso: l’acquisto include una licenza non esclusiva, non trasferibile, per l’utilizzo del brano nei limiti descritti nella pagina Licenza.',
    terms_p6: 'Diritto di recesso: ai sensi della normativa sui contenuti digitali, il recesso non si applica dopo l’inizio del download/streaming del contenuto acquistato.',
    terms_p7: 'Assistenza: per supporto o fatturazione contattaci dalla pagina Contatti.',

    // Privacy
    privacy_title: 'Informativa Privacy',
    privacy_p1: 'Questa informativa illustra come trattiamo i dati personali degli utenti che acquistano o interagiscono con il sito di Arte Registrazioni.',
    privacy_p2: 'Titolare: Arte Registrazioni — Partita IVA 12531290018 — contatti sulla pagina Contatti.',
    privacy_p3: 'Dati trattati: dati di contatto forniti dall’utente (es. email), dati tecnici anonimi di navigazione, ed eventuali dati di pagamento gestiti da provider terzi (Stripe) su propri sistemi.',
    privacy_p4: 'Finalità: evasione degli ordini, assistenza clienti, adempimenti contabili e di legge, sicurezza e prevenzione abusi.',
    privacy_p5: 'Base giuridica: esecuzione di un contratto e adempimenti legali; legittimo interesse per sicurezza/frode; consenso ove richiesto.',
    privacy_p6: 'Conservazione: per il tempo necessario all’erogazione del servizio e adempimenti di legge.',
    privacy_p7: 'Diritti: accesso, rettifica, cancellazione, limitazione, opposizione, portabilità nei limiti di legge; per esercitarli contattaci.',
    privacy_p8: 'Cookie/terze parti: strumenti di terzi possono impostare cookie tecnici/di funzionalità. Le pagine di pagamento Stripe sono gestite da Stripe.',

    // License
    license_title: 'Licenza d’uso e Recesso',
    license_p1: 'Licenza d’uso: con l’acquisto ottieni una licenza non esclusiva, non trasferibile, per utilizzare il brano in contenuti video, social, podcast e progetti multimediali. Non è consentita la rivendita o redistribuzione del file audio come brano singolo.',
    license_p2: 'Ambito: la licenza copre usi online e multimediali standard. Per utilizzi broadcast/advertising o tirature elevate, contattaci per una licenza personalizzata.',
    license_p3: 'Recesso: per i contenuti digitali, una volta iniziato il download/streaming, il diritto di recesso non si applica (art. 59 Codice del Consumo).',
    license_p4: 'Per domande sulla licenza o necessità specifiche, scrivici dalla pagina Contatti.',

    // Podcast
    podcast_title: 'Podcast',
    podcast_intro1: 'Benvenuti nella pagina Podcast di Arte Registrazioni!',
    podcast_intro2: 'Qui potete seguire le interviste agli artisti di Arte Registrazioni scegliendo tra i filmati.',
    podcast_cta_text: 'Per partecipare dal vivo ai podcast o fare una richiesta contattaci qui',
    podcast_cta_btn: 'Contatti',
    podcast_no_video: 'Video non disponibile',
    podcast_untitled: 'Senza titolo',
    podcast_no_content: 'Nessun contenuto disponibile.',

    // Countdown
    countdown_title: 'Countdown',
    countdown_loading: 'Caricamento…',
    countdown_error_prefix: 'Errore:',
    countdown_none: 'Nessun countdown imminente. Torna presto! ',
    countdown_recent: 'Uscite recenti',
    countdown_out_now: 'Fuori ora! puoi ascoltare',
    countdown_available_now: 'Disponibile ora',
    calend_arte: 'CalendArte →',

    // BuyMusic
    buymusic_title: 'Compra Musica',
    buymusic_how_title: 'Come funziona',
    buymusic_toggle_show_en: 'Mostra traduzione inglese',
    buymusic_toggle_hide_en: 'Nascondi traduzione inglese',
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
  ,
    // Contacts
    contacts_title: 'Contacts',
    contacts_phone: 'Phone',
    contacts_call: 'Call',
    contacts_write_message: 'Write a message',
    contacts_address: 'Address',
    contacts_open_maps: 'Open in Google Maps',

    // Terms
    terms_title: 'Terms and Conditions',
    terms_p1: 'Arte Registrazioni — VAT 12531290018. We sell digital music content and royalty‑free licenses for media projects.',
    terms_p2: 'Products and pricing: prices are shown next to each track in the Buy Music section. Amounts are in euros and visible before purchase.',
    terms_p3: 'Purchase and payment: purchases are made via secure payment links (Stripe Payment Links) and, if applicable, alternative methods indicated on the track page.',
    terms_p4: 'Delivery: as digital goods, downloads are available immediately after payment or via a page/link sent to the user.',
    terms_p5: 'License: the purchase includes a non‑exclusive, non‑transferable license to use the track within the limits described on the License page.',
    terms_p6: 'Right of withdrawal: under digital content regulations, withdrawal does not apply after starting the download/streaming of the purchased content.',
    terms_p7: 'Support: for assistance or invoicing, contact us via the Contacts page.',

    // Privacy
    privacy_title: 'Privacy Policy',
    privacy_p1: 'This notice explains how we process personal data of users who purchase or interact with Arte Registrazioni’s site.',
    privacy_p2: 'Controller: Arte Registrazioni — VAT 12531290018 — contacts on the Contacts page.',
    privacy_p3: 'Data processed: contact data provided by users (e.g. email), anonymous technical navigation data, and any payment data handled by third‑party providers (Stripe) on their own systems.',
    privacy_p4: 'Purposes: order fulfillment, customer support, accounting and legal compliance, security and abuse prevention.',
    privacy_p5: 'Legal basis: performance of a contract and legal compliance; legitimate interest for security/fraud; consent where required.',
    privacy_p6: 'Retention: for as long as needed to provide the service and for legal obligations.',
    privacy_p7: 'Rights: access, rectification, erasure, restriction, objection, portability within legal limits; to exercise them, contact us.',
    privacy_p8: 'Cookies/third parties: third‑party tools may set technical/functional cookies. Stripe payment pages are operated by Stripe.',

    // License
    license_title: 'License and Withdrawal',
    license_p1: 'License: upon purchase you obtain a non‑exclusive, non‑transferable license to use the track in videos, social media, podcasts and multimedia projects. Resale or redistribution of the audio file as a standalone track is not permitted.',
    license_p2: 'Scope: the license covers standard online and multimedia uses. For broadcast/advertising or high‑volume uses, contact us for a custom license.',
    license_p3: 'Withdrawal: for digital content, once download/streaming has started, the right of withdrawal does not apply (Art. 59 Consumer Code).',
    license_p4: 'For questions about the license or specific needs, write to us via the Contacts page.',

    // Podcast
    podcast_title: 'Podcast',
    podcast_intro1: 'Welcome to the Arte Registrazioni Podcast page!',
    podcast_intro2: 'Here you can follow interviews with Arte Registrazioni artists by choosing from the videos.',
    podcast_cta_text: 'To join live or make a request contact us here',
    podcast_cta_btn: 'Contacts',
    podcast_no_video: 'Video not available',
    podcast_untitled: 'Untitled',
    podcast_no_content: 'No content available.',

    // Countdown
    countdown_title: 'Countdown',
    countdown_loading: 'Loading…',
    countdown_error_prefix: 'Error:',
    countdown_none: 'No upcoming countdowns. Check back soon!',
    countdown_recent: 'Recent Releases',
    countdown_out_now: 'Out now! you can listen',
    countdown_available_now: 'Available now',
    calend_arte: 'CalendArte →',

    // BuyMusic
    buymusic_title: 'Buy Music',
    buymusic_how_title: 'How it works',
    buymusic_toggle_show_en: 'Show English translation',
    buymusic_toggle_hide_en: 'Hide English translation',
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
