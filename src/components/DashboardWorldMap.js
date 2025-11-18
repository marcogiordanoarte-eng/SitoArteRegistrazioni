import React, { useEffect, useState, useMemo } from 'react';
import { db, fetchArtistData, fetchAppleArtistData } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
// Removed unused httpsCallable/functions imports to satisfy ESLint no-unused-vars

// Same capitals list as public component (keep in sync)
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

// Default local tuning
const DEFAULT_TUNING = {
  __regions: {
    americas: { dx: 0, dy: 0 },
    europe: { dx: 0, dy: 0 },
    rest: { dx: 0, dy: 0 }
  },
  'New York': { dx: 1.2, dy: 0.8 },
  'Roma': { dx: 0.8, dy: 1.0 },
  'Tokyo': { dx: -0.6, dy: 0.8 }
};

export default function DashboardWorldMap({ artists }) {
  const [selectedArtistId, setSelectedArtistId] = useState('');
  const [artistData, setArtistData] = useState(null);
  const [loadingArtist, setLoadingArtist] = useState(false);
  const [metrics, setMetrics] = useState({ total: 0, countries: {} });
  const [tuning, setTuning] = useState(DEFAULT_TUNING);
  const [saving, setSaving] = useState(false);
  const [loadErr, setLoadErr] = useState('');
  const [saveMsg, setSaveMsg] = useState('');

  // Load persisted tuning (site/worldMapTuning)
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'site', 'worldMapTuning'));
        if (snap.exists()) {
          const data = snap.data() || {};
          if (active) setTuning(prev => ({ ...prev, ...data }));
        }
      } catch (e) {
        console.warn('WorldMapTuning load failed', e);
      }
    })();
    return () => { active = false; };
  }, []);

  // Fetch streaming metrics for selected artist (similar heuristic)
  useEffect(() => {
    let aborted = false;
    async function run() {
      if (!selectedArtistId) { setArtistData(null); setMetrics({ total:0, countries:{} }); return; }
      try {
        setLoadingArtist(true); setLoadErr('');
        const ref = doc(db, 'artisti', selectedArtistId);
        const snap = await getDoc(ref);
        if (!snap.exists()) throw new Error('Artista non trovato');
        const data = { id: snap.id, ...snap.data() };
        if (aborted) return;
        setArtistData(data);
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
          fetchAppleArtistData(appleLink || lookup).catch(() => null)
        ]);
        const followers = (sp && sp.artist && typeof sp.artist.followers === 'number') ? sp.artist.followers : 0;
        const popularityBoost = (sp && sp.artist && typeof sp.artist.popularity === 'number') ? sp.artist.popularity * 1000 : 0;
        const previews = (ap && ap.topTracks) ? ap.topTracks.filter(t => Array.isArray(t.previews) && t.previews.length > 0).length : 0;
        const total = followers + popularityBoost + previews * 500;
        // Fake distribution across subset
        const countries = {};
        const sample = CAPITALS.slice(0, 14);
        const base = Math.max(1, Math.floor(total / sample.length));
        sample.forEach((cap, idx) => {
          const cKey = cap.country;
          countries[cKey] = (countries[cKey] || 0) + base + (idx % 3 === 0 ? Math.floor(base * 0.25) : 0);
        });
        if (!aborted) setMetrics({ total, countries });
      } catch (e) {
        if (!aborted) { setLoadErr(e.message || 'Errore'); setArtistData(null); }
      } finally {
        if (!aborted) setLoadingArtist(false);
      }
    }
    run();
    return () => { aborted = true; };
  }, [selectedArtistId]);

  const markers = useMemo(() => {
    const items = [];
    CAPITALS.forEach((cap) => {
      const value = metrics.countries[cap.country] || 0;
      if (!value) return;
      let x = (cap.lon + 180) / 360 * 100;
      let y = (90 - cap.lat) / 180 * 100;
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

  // Compressione tuning: salva solo voci con dx/dy non zero (regioni + città)
  function compressTuning(full) {
    const out = { __regions: {} };
    if (full.__regions) {
      for (const [reg, val] of Object.entries(full.__regions)) {
        if (!val) continue;
        const dx = Number(val.dx)||0, dy = Number(val.dy)||0;
        if (dx !== 0 || dy !== 0) out.__regions[reg] = { dx, dy };
      }
      if (Object.keys(out.__regions).length === 0) delete out.__regions;
    }
    for (const [city, conf] of Object.entries(full)) {
      if (city === '__regions') continue;
      if (!conf) continue;
      const dx = Number(conf.dx)||0, dy = Number(conf.dy)||0;
      if (dx !== 0 || dy !== 0) out[city] = { dx, dy };
    }
    return out;
  }

  const handleSaveTuning = async () => {
    setSaving(true); setSaveMsg('');
    try {
      const compressed = compressTuning(tuning);
      await setDoc(doc(db, 'site', 'worldMapTuning'), compressed, { merge: false });
      setSaveMsg('Tuning compresso salvato. Offset zero omessi.');
    } catch (e) {
      setSaveMsg('Errore salvataggio: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  // Autosave con debounce 600ms
  useEffect(() => {
    if (saving) return; // evita conflitti mentre salva
    const h = setTimeout(() => { handleSaveTuning(); }, 600);
    return () => clearTimeout(h);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tuning]);

  const citiesShown = Object.keys({ ...DEFAULT_TUNING, ...tuning });

  return (
    <div>
      <p style={{ color:'#bbb', marginTop:0 }}>Seleziona un artista per vedere una stima degli ascolti e regolare l'allineamento dei marker sulla mappa. Premi Salva per rendere persistenti le modifiche (doc: site/worldMapTuning).</p>
      <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'center', marginBottom:12 }}>
        <select value={selectedArtistId} onChange={e=>setSelectedArtistId(e.target.value)} style={{ padding:8, borderRadius:8, border:'1px solid #444', background:'#111', color:'#fff', minWidth:240 }}>
          <option value=''>-- Seleziona Artista --</option>
          {artists.map(a => <option key={a.id} value={a.id}>{a.nome || a.name}</option>)}
        </select>
        <button className='dash-small-btn dash-small-btn--primary' disabled={!selectedArtistId || loadingArtist} onClick={()=>setSelectedArtistId('')}>Reset Artista</button>
        <button className='dash-small-btn' onClick={()=>setTuning(DEFAULT_TUNING)} disabled={saving}>Reset Tuning Default</button>
  <button className='dash-small-btn dash-small-btn--primary' onClick={handleSaveTuning} disabled={saving}>Forza Salvataggio</button>
        <button className='dash-small-btn' onClick={()=>{ try { navigator.clipboard.writeText(JSON.stringify(tuning, null, 2)); } catch{} }}>Copia JSON</button>
      </div>
      {/* Region-level controls: large range for coarse alignment */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:12, marginBottom:12 }}>
        {[
          { key:'americas', label:'Americhe (ancora: New York)' },
          { key:'europe', label:'Europa (ancora: Roma)' },
          { key:'rest', label:'Resto (ancora: Tokyo)' }
        ].map(r => (
          <div key={r.key} style={{ background:'#0b0b0b', border:'1px solid #333', borderRadius:12, padding:10 }}>
            <div style={{ fontWeight:700, color:'#ffd700', marginBottom:6 }}>{r.label}</div>
            <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:12 }}>
              dx
              <input type='range' min='-25' max='25' step='0.2' value={(tuning.__regions?.[r.key]?.dx ?? 0)} onChange={e=>setTuning(t=>({ ...t, __regions: { ...(t.__regions||{}), [r.key]: { ...(t.__regions?.[r.key]||{}), dx: parseFloat(e.target.value) } } }))} style={{ flex:1 }} />
              <span style={{ width:56, textAlign:'right' }}>{(tuning.__regions?.[r.key]?.dx ?? 0).toFixed(1)}%</span>
            </label>
            <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:12 }}>
              dy
              <input type='range' min='-25' max='25' step='0.2' value={(tuning.__regions?.[r.key]?.dy ?? 0)} onChange={e=>setTuning(t=>({ ...t, __regions: { ...(t.__regions||{}), [r.key]: { ...(t.__regions?.[r.key]||{}), dy: parseFloat(e.target.value) } } }))} style={{ flex:1 }} />
              <span style={{ width:56, textAlign:'right' }}>{(tuning.__regions?.[r.key]?.dy ?? 0).toFixed(1)}%</span>
            </label>
          </div>
        ))}
      </div>
  {saveMsg && <div style={{ fontSize:12, color: saveMsg.startsWith('Errore') ? '#ff6464' : '#6fda8b', marginBottom:8 }}>{saveMsg}</div>}
  {!saveMsg && <div style={{ fontSize:11, color:'#888', marginBottom:8 }}>Autosave attivo (600ms debounce) - modifiche salvate in background.</div>}
      {loadErr && <div style={{ fontSize:12, color:'#ff6464', marginBottom:8 }}>{loadErr}</div>}
      {selectedArtistId && artistData && (
        <div style={{ marginBottom:12, fontSize:13, color:'#ffd700' }}>Artista: <strong>{artistData.nome || artistData.name}</strong> – Ascolti totali stimati: <span style={{ color:'#fff' }}>{metrics.total.toLocaleString('it-IT')}</span></div>
      )}
      <div style={{ position:'relative', width:'100%', maxWidth:900, margin:'0 auto 18px', borderRadius:16, overflow:'hidden', boxShadow:'0 4px 18px rgba(0,0,0,0.45)', border:'1px solid rgba(255,255,255,0.08)' }}>
        <img src='/world-map.png' alt='World Map' style={{ width:'100%', display:'block' }} />
        {markers.map((m,i) => (
          <React.Fragment key={i}>
            <div title={`${m.city} ${m.country}: ${m.value.toLocaleString('it-IT')}`}
                 style={{ position:'absolute', left:`calc(${m.x}% - ${m.size/2}px)`, top:`calc(${m.y}% - ${m.size/2}px)`, width:m.size, height:m.size, borderRadius:'50%', background:'radial-gradient(closest-side, rgba(255,215,0,0.9), rgba(255,215,0,0.15), transparent)', boxShadow:'0 0 16px rgba(255,215,0,0.75), 0 0 42px rgba(255,215,0,0.25)' }} />
            {['New York','Roma','Tokyo'].includes(m.city) && (
              <div style={{ position:'absolute', left:`calc(${m.x}% + 6px)`, top:`calc(${m.y}% - ${Math.min(32,m.size)+4}px)`, background:'rgba(0,0,0,0.55)', border:'1px solid rgba(255,255,255,0.15)', color:'#ffd700', padding:'4px 6px', fontSize:12, borderRadius:6, whiteSpace:'nowrap', pointerEvents:'none', fontWeight:600 }}>
                {m.city}
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:12 }}>
        {citiesShown.map(city => (
          <div key={city} style={{ background:'#111', border:'1px solid #333', borderRadius:12, padding:10, display:'flex', flexDirection:'column', gap:8 }}>
            <div style={{ fontWeight:600, color:'#ffd700' }}>{city}</div>
            <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:12 }}>
              dx
              <input type='range' min='-25' max='25' step='0.2' value={(tuning[city]?.dx ?? 0)} onChange={e=>setTuning(t=>({ ...t, [city]: { ...(t[city]||{}), dx: parseFloat(e.target.value) } }))} style={{ flex:1 }} />
              <span style={{ width:56, textAlign:'right' }}>{(tuning[city]?.dx ?? 0).toFixed(1)}%</span>
            </label>
            <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:12 }}>
              dy
              <input type='range' min='-25' max='25' step='0.2' value={(tuning[city]?.dy ?? 0)} onChange={e=>setTuning(t=>({ ...t, [city]: { ...(t[city]||{}), dy: parseFloat(e.target.value) } }))} style={{ flex:1 }} />
              <span style={{ width:56, textAlign:'right' }}>{(tuning[city]?.dy ?? 0).toFixed(1)}%</span>
            </label>
            <button className='dash-small-btn' onClick={()=>{ try { navigator.clipboard.writeText(JSON.stringify(tuning[city]||{}, null, 2)); } catch{} }}>Copia {city}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
