import React from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n } from '../i18n';

export default function LangSwitchTop() {
  const { lang, setLang } = useI18n();
  const location = useLocation();

  // Hide on Sounds home which already has its own switch
  const hideOn = ['/'];
  if (hideOn.includes(location.pathname)) return null;

  // Responsive dynamic positioning: move further left to avoid overlap with new compact dashboard badge.
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const wrapStyle = {
    position: 'fixed',
    top: 10,
    // On large screens push further left, on small keep enough gap from right square badge
    right: vw > 900 ? 148 : (vw > 640 ? 120 : 100),
    zIndex: 100003,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: 'rgba(13,16,20,0.72)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: '5px 8px',
    backdropFilter: 'blur(8px) saturate(140%)',
    WebkitBackdropFilter: 'blur(8px) saturate(140%)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.55)',
  };
  const btnStyle = (active) => ({
    appearance: 'none',
    background: active ? 'linear-gradient(180deg,#2a6ed0,#1d4fa3)' : 'rgba(0,0,0,0.35)',
    color: active ? '#ffffff' : '#c5ced8',
    border: `1px solid ${active ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.12)'}`,
    borderRadius: 10,
    padding: '6px 12px',
    cursor: 'pointer',
    fontWeight: 700,
    letterSpacing: 0.4,
    fontSize: '0.78rem',
    boxShadow: active ? '0 0 10px rgba(255,255,255,0.35), 0 0 16px rgba(25,118,210,0.55)' : 'none',
    transition: 'background .25s, box-shadow .25s, color .25s',
  });

  return (
    <div className="global-lang-switch" style={wrapStyle}>
      <button type="button" style={btnStyle(lang==='it')} aria-pressed={lang==='it'} onClick={() => setLang('it')}>IT</button>
      <button type="button" style={btnStyle(lang==='en')} aria-pressed={lang==='en'} onClick={() => setLang('en')}>EN</button>
    </div>
  );
}
