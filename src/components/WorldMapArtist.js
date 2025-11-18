import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, fetchArtistData, fetchAppleArtistData, registerLivePlayEvent } from './firebase';
import { doc, getDoc, collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import NavBar from './NavBar';
import Footer from './Footer';
import './Artisti.css';
import './WorldMapArtist.css';

// Minimal capitals dataset (could be expanded)
const CAPITALS = [
  { city: 'Roma', country: 'Italia', lat: 41.9028, lon: 12.4964 },
  { city: 'London', country: 'United Kingdom', lat: 51.5074, lon: -0.1278 },
  { city: 'Paris', country: 'France', lat: 48.8566, lon: 2.3522 },
  { city: 'Madrid', country: 'Spain', lat: 40.4168, lon: -3.7038 },
  { city: 'Berlin', country: 'Germany', lat: 52.52, lon: 13.405 },
  { city: 'New York', country: 'USA', lat: 40.7128, lon: -74.006 },
  { city: 'Los Angeles', country: 'USA', lat: 34.0522, lon: -118.2437 },
  { city: 'Tokyo', country: 'Japan', lat: 35.6762, lon: 139.6503 },
  { city: 'Seoul', country: 'South Korea', lat: 37.5665, lon: 126.978 },
  { city: 'Beijing', country: 'China', lat: 39.9042, lon: 116.4074 },
  { city: 'Sydney', country: 'Australia', lat: -33.8688, lon: 151.2093 },
  { city: 'Toronto', country: 'Canada', lat: 43.6532, lon: -79.3832 },
  { city: 'Mexico City', country: 'Mexico', lat: 19.4326, lon: -99.1332 },
  { city: 'Buenos Aires', country: 'Argentina', lat: -34.6037, lon: -58.3816 },
  { city: 'Rio de Janeiro', country: 'Brazil', lat: -22.9068, lon: -43.1729 },
  { city: 'Johannesburg', country: 'South Africa', lat: -26.2041, lon: 28.0473 },
  { city: 'Cairo', country: 'Egypt', lat: 30.0444, lon: 31.2357 },
  { city: 'Istanbul', country: 'Turkey', lat: 41.0082, lon: 28.9784 },
  { city: 'Moscow', country: 'Russia', lat: 55.7558, lon: 37.6173 },
  { city: 'Delhi', country: 'India', lat: 28.7041, lon: 77.1025 }
];

// Fine-tuning manuale per allineamento visivo sulla nostra immagine world-map.png
// Offsets in percentuale (dx, dy) da sommare alle coordinate equirettangolari calcolate.
const CITY_TUNING = {
  'New York': { dx: 1.2, dy: 0.8 },
  'Roma': { dx: 0.8, dy: 1.0 },
  'Tokyo': { dx: -0.6, dy: 0.8 }
};

function useLocale() {
  const lang = (((typeof navigator !== 'undefined') && navigator.language) || 'it').toLowerCase();
  return lang.startsWith('it') ? 'it' : 'en';
}

function label(t, locale) {
  const map = {
    title: { it: 'Ascolti dal Mondo', en: 'World Listens' },
    back: { it: 'Indietro', en: 'Back' },
    total: { it: 'Ascolti totali (stima):', en: 'Total listens (estimate):' },
    loading: { it: 'Caricamento…', en: 'Loading…' },
    artistNotFound: { it: 'Artista non trovato', en: 'Artist not found' },
  };
  return (map[t] && map[t][locale]) || map[t]?.it || t;
}

export default function WorldMapArtist() {
  const { id } = useParams();
  const navigate = useNavigate();
  const locale = useLocale();
  const [artist, setArtist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metrics, setMetrics] = useState({ total: 0, countries: {} });
  const [tuning, setTuning] = useState(CITY_TUNING);
  const [pulses, setPulses] = useState([]); // live pulses from Firestore livePlays

  useEffect(() => {
    let aborted = false;
    async function run() {
      try {
        setLoading(true);
        const ref = doc(db, 'artisti', id);
        const snap = await getDoc(ref);
        if (!snap.exists()) throw new Error(label('artistNotFound', locale));
        const data = { id: snap.id, ...snap.data() };
        if (!aborted) setArtist(data);
        // streaming lookup
        const appleLink = data.appleLink || '';
        const spotifyLink = data.spotifyLink || '';
        let lookup = (data.nome || data.name || '').trim();
        try {
          const m = appleLink.match(/\/artist\/([^/]+)/i);
          if (m && m[1]) {
            const decoded = decodeURIComponent(m[1]).replace(/-/g, ' ').trim();
            if (decoded.length >= 2) lookup = decoded;
          }
        } catch {}
        const [sp, ap] = await Promise.all([
          fetchArtistData(spotifyLink || lookup).catch(() => null),
          fetchAppleArtistData(appleLink || lookup).catch(() => null),
        ]);
        // Minimal geo heuristic: distribute previews across capitals by continent-ish buckets
        const followers = (sp && sp.artist && typeof sp.artist.followers === 'number') ? sp.artist.followers : 0;
        const popularityBoost = (sp && sp.artist && typeof sp.artist.popularity === 'number') ? sp.artist.popularity * 1000 : 0;
        const previews = (ap && ap.topTracks) ? ap.topTracks.filter(t => Array.isArray(t.previews) && t.previews.length > 0).length : 0;
        const total = followers + popularityBoost + previews * 500;
        // Fake distribution for now (until we have per-country): spread over top capitals
        const countries = {};
        const sample = CAPITALS.slice(0, 14);
        const base = Math.max(1, Math.floor(total / sample.length));
        sample.forEach((cap, idx) => {
          const cKey = cap.country;
          countries[cKey] = (countries[cKey] || 0) + base + (idx % 3 === 0 ? Math.floor(base * 0.25) : 0);
        });
        if (!aborted) setMetrics({ total, countries });
      } catch (e) {
        if (!aborted) setError(e.message || 'Errore');
      } finally {
        if (!aborted) setLoading(false);
      }
    }
    if (id) run();
    return () => { aborted = true; };
  }, [id, locale]);

  // Load persisted tuning from admin (site/worldMapTuning) and merge with defaults
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'site', 'worldMapTuning'));
        if (snap.exists()) {
          const conf = snap.data() || {};
          if (active) setTuning(prev => ({ ...prev, ...conf }));
        }
      } catch (e) {
        // Silent fail: use defaults
      }
    })();
    return () => { active = false; };
  }, []);

  // Live pulses: subscribe to livePlays for this artist and show pulsing waves for recent plays
  useEffect(() => {
    if (!id) return;
    const playsRef = collection(db, 'livePlays');
    // Use basic filter by artist; keep small limit to avoid overfetch
    const q = query(playsRef, where('artistId', '==', id), orderBy('ts', 'desc'), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      const now = Date.now();
      const events = [];
      snap.forEach((d) => {
        const ev = d.data();
        const ts = ev?.ts?.toMillis ? ev.ts.toMillis() : (ev?.ts?.seconds ? ev.ts.seconds * 1000 : 0);
        // Keep only last ~30s for visible pulses
        if (!ts || now - ts > 30000) return;
        events.push({ id: d.id, ...ev, ts });
      });
      setPulses(events);
    }, (err) => {
      console.warn('livePlays subscribe failed', err);
      setPulses([]);
    });
    return () => unsub();
  }, [id]);

  const glowMarkers = useMemo(() => {
    // Translate country metrics to markers on top of static world map
    const items = [];
    CAPITALS.forEach((cap) => {
      const value = metrics.countries[cap.country] || 0;
      if (!value) return;
      // Map lat/lon to percentage overlay positions (very rough equirectangular projection)
      let x = (cap.lon + 180) / 360 * 100; // 0..100
      let y = (90 - cap.lat) / 180 * 100; // 0..100
      // Region grouping: Americas (USA, Canada, Mexico, Brazil, Argentina), Europe (UE+UK+Turkey+Russia), Rest (others)
      const americas = ['USA','Canada','Mexico','Argentina','Brazil'];
      const europe = ['Italia','United Kingdom','France','Spain','Germany','Turkey','Russia'];
      const region = americas.includes(cap.country) ? 'americas' : (europe.includes(cap.country) ? 'europe' : 'rest');
      const regionTune = (tuning.__regions && tuning.__regions[region]) || { dx:0, dy:0 };
      x = Math.min(100, Math.max(0, x + (regionTune.dx || 0)));
      y = Math.min(100, Math.max(0, y + (regionTune.dy || 0)));

      const tune = tuning[cap.city];
      if (tune) {
        x = Math.min(100, Math.max(0, x + (tune.dx || 0)));
        y = Math.min(100, Math.max(0, y + (tune.dy || 0)));
      }
      const size = Math.min(22, 8 + Math.log10(value + 10) * 6);
      items.push({ ...cap, x, y, size, value });
    });
    return items;
  }, [metrics, tuning]);

  if (loading) return <div style={{ color:'#ffd700', textAlign:'center', marginTop:80 }}>{label('loading', locale)}</div>;
  if (error) return <div style={{ color:'tomato', textAlign:'center', marginTop:80 }}>{error}</div>;
  if (!artist) return null;

  return (
    <div className="publicsite-bg" style={{ minHeight:'100vh', display:'flex', flexDirection:'column' }}>
      <NavBar />
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'18px 10px' }}>
        <div style={{ width:'min(980px, 96vw)' }}>
          <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center', marginTop:6, marginBottom:8, minHeight:48 }}>
            <button
              type="button"
              onClick={() => navigate(-1)}
              style={{ position:'absolute', left:0, top:'50%', transform:'translateY(-50%)', background:'#111', border:'1px solid #ffd700', color:'#ffd700', padding:'8px 12px', borderRadius:10, cursor:'pointer', fontWeight:700 }}
            >{label('back', locale)}</button>
            <h2 className="dash-section-title" style={{ margin:0, textAlign:'center', width:'100%', pointerEvents:'none' }}>{label('title', locale)} — {artist.nome || artist.name}</h2>
          </div>
          {/* Debug panel: enable with ?debug=1 */}
          {typeof window !== 'undefined' && /[?&]debug=1/.test(window.location.search) && (
            <div style={{ margin:'8px 0', padding:'8px', background:'rgba(0,0,0,0.5)', border:'1px solid #333', borderRadius:8, color:'#eaeaea' }}>
              <div style={{ fontWeight:700, color:'#ffd700', marginBottom:8 }}>Debug posizioni capitali</div>
              <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                <button type='button' onClick={async()=>{ try { await registerLivePlayEvent({ artistId: id, city: 'Roma', country: 'Italia' }); } catch(e) {} }} style={{ background:'#111', border:'1px solid #555', color:'#6fda8b', borderRadius:6, padding:'6px 10px', cursor:'pointer' }}>Test Pulse Roma</button>
                <button type='button' onClick={async()=>{ try { await registerLivePlayEvent({ artistId: id, city: 'New York', country: 'USA' }); } catch(e) {} }} style={{ background:'#111', border:'1px solid #555', color:'#6fda8b', borderRadius:6, padding:'6px 10px', cursor:'pointer' }}>Test Pulse New York</button>
              </div>
              {/* Region coarse sliders */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:8, marginBottom:6 }}>
                {[
                  { key:'americas', label:'Americhe' },
                  { key:'europe', label:'Europa' },
                  { key:'rest', label:'Resto' }
                ].map(r => (
                  <div key={r.key} style={{ background:'rgba(0,0,0,0.35)', border:'1px solid #333', borderRadius:8, padding:8 }}>
                    <div style={{ fontWeight:700, color:'#ffd700', marginBottom:4 }}>{r.label}</div>
                    <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12 }}>
                      dx
                      <input type="range" min="-25" max="25" step="0.2" value={(tuning.__regions?.[r.key]?.dx ?? 0)} onChange={(e)=>setTuning(t=>({ ...t, __regions: { ...(t.__regions||{}), [r.key]: { ...(t.__regions?.[r.key]||{}), dx: parseFloat(e.target.value) } } }))} />
                      <span style={{ width:44, textAlign:'right' }}>{(tuning.__regions?.[r.key]?.dx ?? 0).toFixed(1)}%</span>
                    </label>
                    <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12 }}>
                      dy
                      <input type="range" min="-25" max="25" step="0.2" value={(tuning.__regions?.[r.key]?.dy ?? 0)} onChange={(e)=>setTuning(t=>({ ...t, __regions: { ...(t.__regions||{}), [r.key]: { ...(t.__regions?.[r.key]||{}), dy: parseFloat(e.target.value) } } }))} />
                      <span style={{ width:44, textAlign:'right' }}>{(tuning.__regions?.[r.key]?.dy ?? 0).toFixed(1)}%</span>
                    </label>
                  </div>
                ))}
              </div>
              {['New York','Roma','Tokyo'].map((c) => (
                <div key={c} style={{ display:'grid', gridTemplateColumns:'120px 1fr 1fr 120px', gap:6, alignItems:'center', marginBottom:6 }}>
                  <div style={{ fontWeight:600 }}>{c}</div>
                  <label style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span>dx</span>
                    <input type="range" min="-25" max="25" step="0.2" value={(tuning[c]?.dx ?? 0)} onChange={(e)=>setTuning(t=>({ ...t, [c]: { ...(t[c]||{}), dx: parseFloat(e.target.value) }}))} />
                    <span style={{ width:44, textAlign:'right' }}>{(tuning[c]?.dx ?? 0).toFixed(1)}%</span>
                  </label>
                  <label style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span>dy</span>
                    <input type="range" min="-25" max="25" step="0.2" value={(tuning[c]?.dy ?? 0)} onChange={(e)=>setTuning(t=>({ ...t, [c]: { ...(t[c]||{}), dy: parseFloat(e.target.value) }}))} />
                    <span style={{ width:44, textAlign:'right' }}>{(tuning[c]?.dy ?? 0).toFixed(1)}%</span>
                  </label>
                  <button type="button" onClick={()=>{
                    try { navigator.clipboard.writeText(JSON.stringify(tuning[c]||{}, null, 2)); } catch {}
                  }} style={{ background:'#111', border:'1px solid #555', color:'#ffd700', borderRadius:6, padding:'6px 10px', cursor:'pointer' }}>Copia JSON</button>
                </div>
              ))}
              <div style={{ display:'flex', gap:8 }}>
                <button type="button" onClick={()=>{ try { navigator.clipboard.writeText(JSON.stringify(tuning, null, 2)); } catch {} }} style={{ background:'#111', border:'1px solid #555', color:'#ffd700', borderRadius:6, padding:'6px 10px', cursor:'pointer' }}>Copia tutti</button>
                <button type="button" onClick={()=>setTuning(CITY_TUNING)} style={{ background:'#111', border:'1px solid #555', color:'#ffd700', borderRadius:6, padding:'6px 10px', cursor:'pointer' }}>Reset</button>
              </div>
            </div>
          )}

          <div style={{ position:'relative', width:'100%', maxWidth:980, margin:'12px auto 8px auto', borderRadius:16, overflow:'hidden', boxShadow:'0 6px 24px rgba(0,0,0,0.45)', border:'1px solid rgba(255,255,255,0.08)' }}>
            <img src="/world-map.png" alt="World map" style={{ display:'block', width:'100%', height:'auto' }} />
            {/* Live pulses overlay */}
            {pulses.map((ev) => {
              // Compute position from event city/country or lat/lon
              let xPerc, yPerc;
              if (typeof ev.lon === 'number' && typeof ev.lat === 'number') {
                xPerc = (ev.lon + 180) / 360 * 100;
                yPerc = (90 - ev.lat) / 180 * 100;
              } else {
                const cap = CAPITALS.find(c => (ev.city && c.city === ev.city) || (ev.country && c.country === ev.country));
                if (cap) {
                  xPerc = (cap.lon + 180) / 360 * 100;
                  yPerc = (90 - cap.lat) / 180 * 100;
                } else {
                  return null;
                }
              }
              // Apply region + city tuning if exists
              const americas = ['USA','Canada','Mexico','Argentina','Brazil'];
              const europe = ['Italia','United Kingdom','France','Spain','Germany','Turkey','Russia'];
              const region = ev.country && (americas.includes(ev.country) ? 'americas' : (europe.includes(ev.country) ? 'europe' : 'rest'));
              const rt = (region && tuning.__regions && tuning.__regions[region]) || { dx:0, dy:0 };
              xPerc = Math.min(100, Math.max(0, xPerc + (rt.dx||0)));
              yPerc = Math.min(100, Math.max(0, yPerc + (rt.dy||0)));
              const ct = tuning[ev.city] || tuning[ev.country] || null;
              if (ct) { xPerc = Math.min(100, Math.max(0, xPerc + (ct.dx||0))); yPerc = Math.min(100, Math.max(0, yPerc + (ct.dy||0))); }
              const key = `pulse-${ev.id}`;
              return (
                <div key={key} style={{ position:'absolute', left:`calc(${xPerc}% - 10px)`, top:`calc(${yPerc}% - 10px)`, width:20, height:20, pointerEvents:'none' }}>
                  <div className="pulse-core" />
                  <div className="pulse-wave" style={{ animationDelay: '0s' }} />
                  <div className="pulse-wave" style={{ animationDelay: '0.6s' }} />
                  <div className="pulse-wave" style={{ animationDelay: '1.2s' }} />
                </div>
              );
            })}
            {/* Glow markers + labels (subset: New York, Roma, Tokyo) */}
            {glowMarkers.map((m, i) => {
              const showLabel = ['New York','Roma','Tokyo'].includes(m.city);
              return (
                <React.Fragment key={i}>
                  <div title={`${m.city} ${m.country}: ${m.value.toLocaleString('it-IT')}`}
                       style={{ position:'absolute', left:`calc(${m.x}% - ${m.size/2}px)`, top:`calc(${m.y}% - ${m.size/2}px)`, width:m.size, height:m.size, borderRadius:'50%', background:'radial-gradient(closest-side, rgba(255,215,0,0.9), rgba(255,215,0,0.15), transparent)', boxShadow:'0 0 18px rgba(255,215,0,0.75), 0 0 42px rgba(255,215,0,0.25)' }} />
                  {showLabel && (
                    <div style={{ position:'absolute', left:`calc(${m.x}% + 6px)`, top:`calc(${m.y}% - ${Math.min(32,m.size)+4}px)`, background:'rgba(0,0,0,0.55)', border:'1px solid rgba(255,255,255,0.15)', color:'#ffd700', padding:'4px 6px', fontSize:12, borderRadius:6, whiteSpace:'nowrap', pointerEvents:'none', fontWeight:600 }}>
                      {m.city}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
          <div style={{ marginTop:10, color:'#fff' }}>
            <div style={{ color:'#ffd700', fontWeight:700, marginBottom:6 }}>{label('total', locale)} <span style={{ color:'#fff' }}>{metrics.total.toLocaleString('it-IT')}</span></div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:10 }}>
              {Object.entries(metrics.countries).sort((a,b)=>b[1]-a[1]).map(([country, value]) => (
                <div key={country} style={{ background:'rgba(0,0,0,0.55)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:'8px 10px' }}>
                  <div style={{ color:'#ffd700', fontWeight:700 }}>{country}</div>
                  <div style={{ color:'#eaeaea' }}>{value.toLocaleString('it-IT')}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
