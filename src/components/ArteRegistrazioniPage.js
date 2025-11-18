import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import NavBar from './NavBar';
import { db } from './firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export default function ArteRegistrazioniPage() {
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const [arteTextIt, setArteTextIt] = React.useState('');
  const [arteTextEn, setArteTextEn] = React.useState('');

  React.useEffect(() => {
    const unsub = onSnapshot(doc(db, 'site', 'config'), (snap) => {
      const data = snap.exists() ? snap.data() : {};
      setArteTextIt(data?.arteTextIt || '');
      setArteTextEn(data?.arteTextEn || '');
    });
    return () => unsub();
  }, []);

  const currentText = (lang === 'en' ? arteTextEn : arteTextIt) || '';
  const paragraphs = currentText
    ? currentText.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean)
    : null;

  return (
    <div className="publicsite-bg" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Back button (same as PublicSite) */}
      <button
        onClick={() => navigate(-1)}
        aria-label={t('ps_back')}
        title={t('ps_back')}
        style={{ position:'fixed', top:'12px', left:'12px', zIndex:100002, background:'rgba(0,0,0,0.55)', border:'1px solid #ffd700', color:'#ffd700', borderRadius:'50%', width:46, height:46, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', boxShadow:'0 0 12px #000' }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>

      {/* Menu with same language switch style as Sounds (NavBar includes it) */}
      <NavBar />

      {/* Content block styled like Social Sounds intro, but larger and brighter */}
      <div
        className="container"
        style={{
          width: 'min(1000px, 92vw)',
          marginTop: 8,
          marginBottom: 18,
          padding: '22px 20px',
          borderRadius: 14,
          border: '1px solid rgba(147,197,253,0.45)',
          background: 'linear-gradient(180deg, rgba(59,130,246,0.14) 0%, rgba(29,78,216,0.10) 100%)',
          color: '#dbeafe',
          textAlign: 'center',
          textTransform: 'uppercase',
          boxShadow: '0 0 24px rgba(59,130,246,0.25)',
        }}
      >
        <h1 style={{
          margin: '4px 0 10px',
          fontSize: 'clamp(1.4rem, 3.6vw, 2.4rem)',
          fontWeight: 800,
          letterSpacing: '0.6px',
          color: '#eff6ff',
          textShadow: '0 0 14px rgba(147,197,253,0.8), 0 0 24px rgba(191,219,254,0.6)'
        }}>
          {t('arte_title')}
        </h1>
        <div style={{ lineHeight: 1.65, fontSize: 'clamp(0.98rem, 2.2vw, 1.35rem)' }}>
          {paragraphs && paragraphs.length > 0 ? (
            paragraphs.map((p, i) => (
              <p key={i} style={{ margin: '10px 0' }}>{p}</p>
            ))
          ) : (
            <>
              <p style={{ margin: '10px 0' }}>{t('arte_p1')}</p>
              <p style={{ margin: '10px 0' }}>{t('arte_p2')}</p>
              <p style={{ margin: '10px 0' }}>{t('arte_p3')}</p>
              <p style={{ margin: '10px 0' }}>{t('arte_p4')}</p>
              <p style={{ margin: '10px 0' }}>{t('arte_p5')}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
