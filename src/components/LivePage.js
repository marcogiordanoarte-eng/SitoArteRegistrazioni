import React from 'react';
import { getApp } from 'firebase/app';
import NavBar from './NavBar';
import Footer from './Footer';
import { db } from '../services/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

// Minimal mapping from ISO country codes to rough lat/lon (subset for MVP)
const COUNTRY_LATLON = {
  // Italy reference set to Torino for alignment
  IT: { lat: 45.07, lon: 7.69 },
  US: { lat: 39.8, lon: -98.6 },
  GB: { lat: 52.5, lon: -1.9 },
  FR: { lat: 46.7, lon: 2.5 },
  DE: { lat: 51.1, lon: 10.4 },
  ES: { lat: 40.3, lon: -3.7 },
  BR: { lat: -14.2, lon: -51.9 },
  JP: { lat: 36.2, lon: 138.3 },
  AU: { lat: -25.3, lon: 133.8 },
  CA: { lat: 56.1, lon: -106.3 }
};

// Known cities for finer placement when available in events (e.city or e.meta.city)
const CITIES_LATLON = {
  torino: { lat: 45.07, lon: 7.69 },
  turin: { lat: 45.07, lon: 7.69 },
  milano: { lat: 45.4642, lon: 9.19 },
  milan: { lat: 45.4642, lon: 9.19 },
  roma: { lat: 41.9028, lon: 12.4964 },
  rome: { lat: 41.9028, lon: 12.4964 },
  napoli: { lat: 40.8518, lon: 14.2681 },
  naples: { lat: 40.8518, lon: 14.2681 },
  parigi: { lat: 48.8566, lon: 2.3522 },
  paris: { lat: 48.8566, lon: 2.3522 },
  londra: { lat: 51.5074, lon: -0.1278 },
  london: { lat: 51.5074, lon: -0.1278 }
};

function useRecentEvents(max = 500) {
  const [events, setEvents] = React.useState([]);
  React.useEffect(() => {
    const q = query(collection(db, 'analytics_events'), orderBy('createdAt', 'desc'), limit(max));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEvents(list);
    });
    return () => unsub();
  }, [max]);
  return events;
}

function toXY(lat, lon, width, height) {
  // Equirectangular projection (rough). Background is abstract, so approximation is fine.
  const x = ((lon + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return { x, y };
}

export default function LivePage() {
  const events = useRecentEvents(400);
  const [size, setSize] = React.useState({ w: 1000, h: 520 });
  const ref = React.useRef(null);
  // Map source tries PNG first (your custom image), then SVG if PNG is missing
  const [mapSrc, setMapSrc] = React.useState('/world-map.png');
  const RATIO = 2; // expected width:height ratio of the world image (1200x600)
  // When a custom map image is visible, hide fallback continent shapes to avoid misalignment overlays
  const [imgOk, setImgOk] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const debugMode = React.useMemo(() => {
    try { return new URLSearchParams(window.location.search).get('debug') === '1'; }
    catch { return false; }
  }, []);
  // Optional calibration via URL params (pixels). Example: ?offsetx=-6&offsety=3 or ?offsetx_IT=-3&offsety_IT=2
  const calibration = React.useMemo(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const toNum = (v) => (v === null ? 0 : Number(v) || 0);
      const global = { dx: toNum(sp.get('offsetx')), dy: toNum(sp.get('offsety')) };
      const by = {};
      Object.keys(COUNTRY_LATLON).forEach(cc => {
        const dx = sp.get(`offsetx_${cc}`);
        const dy = sp.get(`offsety_${cc}`);
        if (dx !== null || dy !== null) by[cc] = { dx: toNum(dx), dy: toNum(dy) };
      });
      return { global, by };
    } catch { return { global:{ dx:0, dy:0 }, by:{} }; }
  }, []);
  React.useEffect(() => {
    const onResize = () => {
      const w = Math.min(window.innerWidth - 24, 1200);
      // Keep exact 2:1 for precise alignment with equirectangular projection
      const h = Math.max(320, Math.round(w / RATIO));
      setSize({ w, h });
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  // No probing: we overlay the image and let it fail gracefully to PNG or hide
  // This avoids race conditions where the fallback remained visible.

  // Filter last 24h
  const now = Date.now();
  const recent = events.filter(e => {
    const t = e.createdAt?.toMillis ? e.createdAt.toMillis() : (e.createdAt?.seconds ? e.createdAt.seconds * 1000 : 0);
    return t && (now - t) <= 24 * 60 * 60 * 1000;
  });

  // Create pulse items with fallbacks and optional city mapping + calibration
  const pulses = recent.map((e, idx) => {
    const cc = (e.country || '').toUpperCase();
    const cityKey = (e.city || e.meta?.city || '').toString().toLowerCase().trim();
    const base = (cityKey && CITIES_LATLON[cityKey]) || COUNTRY_LATLON[cc] || COUNTRY_LATLON.IT;
    const pos = toXY(base.lat, base.lon, size.w, size.h);
    const off = calibration.by[cc] || { dx: 0, dy: 0 };
    const x = pos.x + calibration.global.dx + off.dx;
    const y = pos.y + calibration.global.dy + off.dy;
    return { id: e.id || idx, x, y, type: e.type || 'event', cc: cc || 'IT' };
  });

  // Send a one-click debug event (IT) to functions -> analytics_events
  const sendDebugEvent = async () => {
    if (sending) return;
    setSending(true);
    try {
      const projectId = (() => { try { return getApp().options.projectId || 'arteregistrazioni-2025'; } catch { return 'arteregistrazioni-2025'; } })();
      const REC_URL = `https://us-central1-${projectId}.cloudfunctions.net/recordAnalyticsEvent`;
      await fetch(REC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'debug', source: 'live-test', country: 'IT', meta: { page: 'live', note: 'manual-test' } })
      });
    } catch (e) {
      console.warn('LivePage: errore invio evento di test', e);
    } finally {
      setSending(false);
    }
  };

  // Continent labels (approximate centers)
  const continentLabels = [
    { name: 'NORD AMERICA', lat: 45, lon: -100 },
    { name: 'SUD AMERICA', lat: -15, lon: -60 },
    { name: 'EUROPA', lat: 54, lon: 15 },
    { name: 'AFRICA', lat: 6, lon: 20 },
    { name: 'ASIA', lat: 40, lon: 90 },
    { name: 'OCEANIA', lat: -25, lon: 135 }
  ].map((c) => ({ ...c, ...toXY(c.lat, c.lon, size.w, size.h) }));

  return (
    <div className="publicsite-bg" style={{ minHeight: '100vh' }}>
      <a href="/login" className="dash-badge">Dashboard</a>
      <div className="logo-wrapper">
        <div className="logo-stack">
          <img src="/disco.png" alt="Disco" className="disco-img" />
          <img src="/logo.png" alt="Logo Arte Registrazioni" className="logo-img" />
        </div>
      </div>
      <NavBar />
      <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h2 style={{ color: '#ffd700', marginTop: 18 }}>Ascolti – ultime 24 ore</h2>
        <div ref={ref} style={{ position: 'relative', width: size.w, height: size.h, background: '#060606', border: '1px solid #222', borderRadius: 12, overflow: 'hidden', boxShadow: '0 0 20px rgba(255,215,0,0.08)' }}>
          {/* Base fallback always rendered */}
          <svg width={size.w} height={size.h} viewBox="0 0 1000 520" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
            <defs>
              <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0a0a0a" />
                <stop offset="100%" stopColor="#050505" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="1000" height="520" fill="url(#sea)" />
            {/* Fallback continenti stilizzati: mostrali solo se l'immagine mappa non è disponibile */}
            {!imgOk && (
            <g fill="#1a1a1a" stroke="#222" strokeWidth="1.2" opacity="0.9">
              <polygon points="120,140 180,110 230,90 300,95 330,130 320,170 280,190 230,200 180,180 140,160" />
              <polygon points="300,60 330,40 360,55 345,85 315,80" />
              <polygon points="270,240 300,250 320,300 310,350 290,390 270,410 255,370 260,320" />
              <polygon points="420,100 480,85 540,95 600,115 660,145 720,160 760,150 800,165 830,200 800,220 740,210 690,210 640,210 600,195 560,180 520,165 470,140 440,120" />
              <polygon points="520,220 560,235 585,280 575,330 550,360 520,355 505,300 505,255" />
              <polygon points="770,360 810,360 835,380 815,405 775,395 760,380" />
            </g>
            )}
          </svg>
          {/* Overlay world image tries PNG then SVG; hides if both fail */}
          <img
            src={mapSrc}
            alt="Mappa del mondo"
            onError={(e) => {
              if (mapSrc === '/world-map.png') {
                setMapSrc('/world-map.svg');
              } else {
                e.currentTarget.style.display = 'none';
                setImgOk(false);
              }
            }}
            onLoad={() => setImgOk(true)}
            style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'contain', opacity:0.38, filter:'grayscale(100%) contrast(112%) brightness(88%)', zIndex: 1, pointerEvents:'none', userSelect:'none', background:'#060606' }}
          />
          {/* Optional latitude/longitude grid for calibration (?grid=1) */}
          {(() => { try { return new URLSearchParams(window.location.search).get('grid') === '1'; } catch { return false; } })() && (
            <svg width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} style={{ position:'absolute', inset:0, zIndex:1, pointerEvents:'none' }}>
              <g stroke="#333" strokeWidth="0.8" opacity="0.5">
                {Array.from({length:13}).map((_,i)=>{
                  const lon=-180 + i*30; const x=((lon+180)/360)*size.w; return <line key={`v${i}`} x1={x} y1={0} x2={x} y2={size.h} />; })}
                {Array.from({length:7}).map((_,j)=>{
                  const lat=90 - j*30; const y=((90-lat)/180)*size.h; return <line key={`h${j}`} x1={0} y1={y} x2={size.w} y2={y} />; })}
              </g>
            </svg>
          )}
          {/* Continent labels */}
          {continentLabels.map((c) => (
            <div key={c.name}
                 style={{ position:'absolute', left: c.x - 40, top: c.y - 10, color:'#c9c9c9', fontSize: 12, letterSpacing: 1.5, opacity: 0.6, textShadow:'0 0 4px rgba(0,0,0,0.8)', pointerEvents:'none', userSelect:'none' }}>
              {c.name}
            </div>
          ))}
          {/* Pulses */}
          {pulses.map((p, i) => (
            <div key={p.id}
              title={`${p.cc} • ${p.type}`}
              style={{ position: 'absolute', left: p.x - 4, top: p.y - 4, width: 8, height: 8, borderRadius: '50%', background: '#ffd700', boxShadow: '0 0 14px #ffd700', animation: 'pulse 1.8s ease-out infinite', animationDelay: `${(i%12)*0.1}s` }}
            />
          ))}
          {/* Major capitals (reference markers) */}
          {[
            { name: 'Torino', lat: 45.07, lon: 7.69 },
            { name: 'Roma', lat: 41.9028, lon: 12.4964 },
            { name: 'Parigi', lat: 48.8566, lon: 2.3522 },
            { name: 'Londra', lat: 51.5074, lon: -0.1278 },
            { name: 'Madrid', lat: 40.4168, lon: -3.7038 },
            { name: 'Berlino', lat: 52.52, lon: 13.405 },
            { name: 'Vienna', lat: 48.2082, lon: 16.3738 },
            { name: 'Bruxelles', lat: 50.8503, lon: 4.3517 },
            { name: 'Amsterdam', lat: 52.3676, lon: 4.9041 },
            { name: 'Lisboa', lat: 38.7223, lon: -9.1393 },
            { name: 'Atene', lat: 37.9838, lon: 23.7275 },
            { name: 'Varsavia', lat: 52.2297, lon: 21.0122 },
            { name: 'Praga', lat: 50.0755, lon: 14.4378 },
            { name: 'Budapest', lat: 47.4979, lon: 19.0402 },
            { name: 'New York', lat: 40.7128, lon: -74.006 },
            { name: 'São Paulo', lat: -23.5505, lon: -46.6333 },
            { name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
            { name: 'Sydney', lat: -33.8688, lon: 151.2093 },
            { name: 'Ottawa', lat: 45.4215, lon: -75.6972 },
            { name: 'Mosca', lat: 55.7558, lon: 37.6173 }
          ].map((c) => {
            const base = toXY(c.lat, c.lon, size.w, size.h);
            const x = base.x + calibration.global.dx;
            const y = base.y + calibration.global.dy;
            return (
              <React.Fragment key={`city-${c.name}`}>
                <div style={{ position:'absolute', left: x - 2.5, top: y - 2.5, width:5, height:5, borderRadius:'50%', background:'#cbd5e1', opacity:0.55, boxShadow:'0 0 6px rgba(203,213,225,0.65)' }} />
                <div style={{ position:'absolute', left: x + 6, top: y - 10, color:'#ccc', fontSize:10, letterSpacing:0.5, opacity:0.6, textShadow:'0 0 3px rgba(0,0,0,0.9)', pointerEvents:'none' }}>{c.name}</div>
              </React.Fragment>
            );
          })}
          {/* Debug button (only if ?debug=1) */}
          {debugMode && (
            <button onClick={sendDebugEvent}
              title="Genera evento di test (IT)"
              style={{ position:'absolute', right: 12, top: 12, zIndex: 5, background:'#111', color:'#ffd700', border:'1px solid #444', padding:'8px 12px', borderRadius:8, cursor:'pointer', boxShadow:'0 0 10px rgba(255,215,0,0.2)' }}
              disabled={sending}
            >{sending ? 'Invio…' : 'Evento di test'}</button>
          )}
        </div>
        <style>{`
          @keyframes pulse {
            0% { transform: scale(0.7); opacity: 0.25; }
            50% { transform: scale(1.5); opacity: 1; }
            100% { transform: scale(0.7); opacity: 0.25; }
          }
        `}</style>
        <div style={{ color:'#aaa', fontSize: 12, marginTop: 8 }}>
          Fonte: sito - streaming - acquisti (in arrivo). Dati indicativi con aggiornamento continuo.
        </div>
      </div>
      <Footer />
    </div>
  );
}
