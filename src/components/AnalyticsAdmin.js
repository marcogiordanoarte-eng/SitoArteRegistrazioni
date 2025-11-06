import React from 'react';
import { db } from '../services/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import Footer from './Footer';

function useEvents(max = 2000) {
  const [events, setEvents] = React.useState([]);
  React.useEffect(() => {
    const q = query(collection(db, 'analytics_events'), orderBy('createdAt', 'desc'), limit(max));
    const unsub = onSnapshot(q, (snap) => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [max]);
  return events;
}

function aggregate(events, days = 30) {
  const now = Date.now();
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const filtered = events.filter(e => {
    const t = e.createdAt?.toMillis ? e.createdAt.toMillis() : (e.createdAt?.seconds ? e.createdAt.seconds * 1000 : 0);
    return t && t >= cutoff;
  });
  const byCountry = {};
  const byType = {};
  filtered.forEach(e => {
    const cc = (e.country || '??').toUpperCase();
    byCountry[cc] = (byCountry[cc] || 0) + 1;
    const tp = e.type || 'event';
    byType[tp] = (byType[tp] || 0) + 1;
  });
  return { total: filtered.length, byCountry, byType };
}

export default function AnalyticsAdmin(){
  const events = useEvents(2000);
  const last24 = aggregate(events, 1);
  const last30 = aggregate(events, 30);

  const topCountries = Object.entries(last30.byCountry).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const topTypes = Object.entries(last30.byType).sort((a,b)=>b[1]-a[1]);

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0a', color:'#ffd700' }}>
      <a href="/dashboard" className="dash-badge">Dashboard</a>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 16px' }}>
        <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Analytics – Admin</h1>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginTop:16 }}>
          <div style={{ background:'#121212', border:'1px solid #333', borderRadius:12, padding:16 }}>
            <h3 style={{ marginTop:0 }}>Ultime 24h</h3>
            <div style={{ fontSize:14 }}>Eventi: <b>{last24.total}</b></div>
            <div style={{ marginTop:8 }}>
              {Object.entries(last24.byType).map(([k,v]) => (
                <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom:'1px dashed #222' }}>
                  <span>{k}</span><b>{v}</b>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background:'#121212', border:'1px solid #333', borderRadius:12, padding:16 }}>
            <h3 style={{ marginTop:0 }}>Ultimi 30 giorni</h3>
            <div style={{ fontSize:14 }}>Eventi: <b>{last30.total}</b></div>
            <div style={{ marginTop:8 }}>
              {topTypes.map(([k,v]) => (
                <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom:'1px dashed #222' }}>
                  <span>{k}</span><b>{v}</b>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ background:'#121212', border:'1px solid #333', borderRadius:12, padding:16, marginTop:16 }}>
          <h3 style={{ marginTop:0 }}>Top Paesi (30 giorni)</h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr', gap:8 }}>
            {topCountries.map(([cc, v]) => (
              <div key={cc} style={{ background:'#0b0b0b', border:'1px solid #222', borderRadius:10, padding:'10px 12px', display:'flex', flexDirection:'column', gap:6 }}>
                <div style={{ fontSize:12, color:'#ccc' }}>{cc}</div>
                <div style={{ height:8, background:'#222', borderRadius:6, overflow:'hidden' }}>
                  <div style={{ width: Math.min(100, v / (topCountries[0]?.[1] || 1) * 100) + '%', height:'100%', background:'#ffd700' }} />
                </div>
                <div style={{ fontWeight:700 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop:16, color:'#bbb', fontSize:12 }}>
          Nota: i dati provengono da eventi del sito e dagli acquisti (Stripe). Integrazioni DSP/YouTube in arrivo.
        </div>
      </div>
      <Footer />
    </div>
  );
}
