import React from 'react';
import { useI18n } from '../i18n';

export default function LanguageSwitchBadge() {
  const { t, lang, setLang } = useI18n();
  return (
    <div
      className="lang-badge"
      role="group"
      aria-label={t('nav_language')}
      style={{
        position: 'fixed',
        top: 12,
        left: 108,
        zIndex: 100002,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: 'rgba(0,0,0,0.55)',
        border: '1px solid #ffd700',
        borderRadius: 10,
        padding: '4px 8px',
        boxShadow: '0 0 12px #000',
        backdropFilter: 'blur(4px)'
      }}
    >
      <span style={{ color: '#ffd700', fontSize: 12 }}>{t('nav_language')}:</span>
      <button
        type="button"
        onClick={() => setLang('it')}
        aria-pressed={lang === 'it'}
        title="Italiano"
        style={{
          background: lang === 'it' ? '#ffd700' : 'transparent',
          color: lang === 'it' ? '#222' : '#ffd700',
          border: '1px solid #ffd700',
          borderRadius: 8,
          padding: '4px 8px',
          fontWeight: 700,
          cursor: 'pointer'
        }}
      >
        {t('lang_it')}
      </button>
      <button
        type="button"
        onClick={() => setLang('en')}
        aria-pressed={lang === 'en'}
        title="English"
        style={{
          background: lang === 'en' ? '#ffd700' : 'transparent',
          color: lang === 'en' ? '#222' : '#ffd700',
          border: '1px solid #ffd700',
          borderRadius: 8,
          padding: '4px 8px',
          fontWeight: 700,
          cursor: 'pointer'
        }}
      >
        {t('lang_en')}
      </button>
    </div>
  );
}
