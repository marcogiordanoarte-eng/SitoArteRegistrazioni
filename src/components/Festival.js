import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import NavBar from './NavBar';
import SocialMinimal from './SocialMinimal';
import Footer from './Footer';
import BrandButton from './BrandButton';
import EnterNowButton from './EnterNowButton';
import LogoPrompt from './LogoPrompt';
import { onSnapshot, doc } from 'firebase/firestore';
import "./Artisti.css";
import { db } from './firebase';

// Placeholder: public page showing festival PDF if available.
export default function Festival({ pdfUrl }) {
  const navigate = useNavigate();
  
  const [finalPdf, setFinalPdf] = useState(pdfUrl || '');
  const [title, setTitle] = useState('Festival');
  const [description, setDescription] = useState('Scarica il Bando di Partecipazione e il PDF con specifiche tecniche.');
  const [bandoUrl, setBandoUrl] = useState('');
  const [specificheUrl, setSpecificheUrl] = useState('');
  const [paymentLink, setPaymentLink] = useState('');
  const [paymentDesc, setPaymentDesc] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const buildViewerUrl = (url) => {
    if (!url) return '';
    return `${url}#page=1&zoom=page-width`;
  };

  useEffect(() => {
    if (pdfUrl) { setFinalPdf(pdfUrl); }
    const unsub = onSnapshot(doc(db, 'site', 'config'), (snap) => {
      const data = snap.exists() ? snap.data() : {};
      setFinalPdf(prev => pdfUrl ? prev : (data?.festivalPdfUrl || ''));
      setTitle(data?.festivalTitle || 'Festival');
      setDescription(data?.festivalDescription || 'Scarica il Bando di Partecipazione e il PDF con specifiche tecniche.');
      setBandoUrl(data?.festivalBandoPdfUrl || '');
      setSpecificheUrl(data?.festivalSpecifichePdfUrl || '');
      setPaymentLink(data?.festivalPaymentLinkUrl || '');
      setPaymentDesc(data?.festivalPaymentDescription || '');
      setVideoUrl(data?.festivalVideoUrl || '');
    }, (e) => {
      console.warn('Impossibile caricare config Festival', e);
    });
    return () => unsub();
  }, [pdfUrl]);

  return (
    <div className="publicsite-bg page-festival">
        {/* Intro vocale rimossa */}
      <Link to="/login" className="dash-badge">Dashboard</Link>
  <div className="logo-wrapper" style={{ position:'relative' }}>
  <LogoPrompt show={false} text="Premi" position="top" />
    <div className="logo-stack" aria-hidden="true">
      <img src="/disco.png" alt="Disco" className="disco-img" />
      <img src="/logo.png" alt="Logo Arte Registrazioni" className="logo-img" />
    </div>
      </div>
      <button
        onClick={() => navigate(-1)}
        aria-label="Torna indietro"
        title="Indietro"
        style={{ position:'fixed', top:'12px', left:'12px', zIndex:100002, background:'rgba(0,0,0,0.55)', border:'1px solid #ffd700', color:'#ffd700', borderRadius:'50%', width:46, height:46, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', boxShadow:'0 0 12px #000' }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <NavBar />

      <div className="container" style={{ maxWidth: 980, margin: '24px auto', padding: '0 12px' }}>
        <h1 className="publicsite-title">{title}</h1>
        <p className="publicsite-desc" style={{ whiteSpace: 'pre-line' }}>{description}</p>

        {finalPdf ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              <a className="glow-btn" href={finalPdf} target="_blank" rel="noopener noreferrer" style={{ background: '#ffd700', color: '#222', fontWeight: 'bold', borderRadius: 12, padding: '12px 28px', textDecoration: 'none' }}>Scarica il PDF del Festival</a>
              <a className="glow-btn" href={finalPdf} target="_blank" rel="noopener noreferrer" style={{ background: '#111', color: '#ffd700', fontWeight: 'bold', borderRadius: 12, padding: '12px 28px', textDecoration: 'none', border: '1px solid #ffd700' }}>Apri a schermo intero</a>
            </div>
            <div className="pdf-frame-wrap">
              <iframe className="pdf-frame" title="Festival PDF" src={buildViewerUrl(finalPdf)} />
            </div>
          </div>
        ) : (
          <div style={{ color: '#ffd700', textAlign: 'center', marginTop: 24 }}>Il PDF del Festival sarà disponibile a breve.</div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginTop: 20 }}>
          {bandoUrl ? (
            <div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 8 }}>
                <a className="glow-btn" href={bandoUrl} target="_blank" rel="noopener noreferrer" style={{ background: '#ffd700', color: '#222', fontWeight: 'bold', borderRadius: 12, padding: '10px 22px', textDecoration: 'none' }}>Scarica Bando di Partecipazione</a>
                <a className="glow-btn" href={bandoUrl} target="_blank" rel="noopener noreferrer" style={{ background: '#111', color: '#ffd700', fontWeight: 'bold', borderRadius: 12, padding: '10px 22px', textDecoration: 'none', border: '1px solid #ffd700' }}>Apri a schermo intero</a>
              </div>
              <div className="pdf-frame-wrap">
                <iframe className="pdf-frame" title="Bando di Partecipazione" src={buildViewerUrl(bandoUrl)} />
              </div>
            </div>
          ) : null}
          {specificheUrl ? (
            <div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 8 }}>
                <a className="glow-btn" href={specificheUrl} target="_blank" rel="noopener noreferrer" style={{ background: '#ffd700', color: '#222', fontWeight: 'bold', borderRadius: 12, padding: '10px 22px', textDecoration: 'none' }}>Scarica Specifiche Tecniche</a>
                <a className="glow-btn" href={specificheUrl} target="_blank" rel="noopener noreferrer" style={{ background: '#111', color: '#ffd700', fontWeight: 'bold', borderRadius: 12, padding: '10px 22px', textDecoration: 'none', border: '1px solid #ffd700' }}>Apri a schermo intero</a>
              </div>
              <div className="pdf-frame-wrap">
                <iframe className="pdf-frame" title="Specifiche Tecniche" src={buildViewerUrl(specificheUrl)} />
              </div>
            </div>
          ) : null}
          {!bandoUrl && !specificheUrl ? (
            <div style={{ color: '#ffd700', textAlign: 'center', marginTop: 8 }}>
              A breve verrà caricato il Bando Di Concorso e le Specifiche tecniche
            </div>
          ) : null}
        </div>

        {paymentLink ? (
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            {paymentDesc ? <div style={{ color: '#ffd700', textAlign: 'center' }}>{paymentDesc}</div> : null}
            <a className="glow-btn" href={paymentLink} target="_blank" rel="noopener noreferrer" style={{ background: '#ffd700', color: '#222', fontWeight: 'bold', borderRadius: 12, padding: '14px 32px', textDecoration: 'none' }}>Paga Iscrizione Festival</a>
          </div>
        ) : null}

        {videoUrl ? (
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <h3 style={{ color: '#ffd700', marginBottom: 0 }}>Video di presentazione</h3>
            <video src={videoUrl} controls style={{ width: '100%', maxWidth: 980, borderRadius: 12 }} />
          </div>
        ) : null}
      </div>
      <SocialMinimal />
      <div style={{ marginTop: 12, display:'flex', justifyContent:'center' }}>
        <BrandButton />
      </div>
      <div style={{ marginTop: 8, display:'flex', justifyContent:'center' }}>
        <EnterNowButton />
      </div>
  <Footer showArteButton={false} />
    </div>
  );
}