import React, { useEffect, useMemo, useState } from 'react';
import { db, storage } from './firebase';
import { collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { useAuth } from './AuthContext';
import { ADMIN_UIDS } from './config';
import { useNavigate } from 'react-router-dom';

function monthKey(date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${y}-${m}`;
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function buildMonthGrid(date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const total = daysInMonth(date.getFullYear(), date.getMonth());
  const days = [];
  for (let d = 1; d <= total; d++) {
    const cur = new Date(date.getFullYear(), date.getMonth(), d);
    days.push({ d, date: cur });
  }
  const startWeekday = (first.getDay() + 6) % 7; // Monday=0
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (const day of days) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return { cells, label: date.toLocaleString(undefined, { month: 'long', year: 'numeric' }) };
}

export default function CalendArte() {
  const navigate = useNavigate();
  const [start, setStart] = useState(() => new Date());
  const [months, setMonths] = useState(3);
  const [notes, setNotes] = useState({}); // { 'YYYY-MM': { 'DD': 'text' } }
  const { user } = useAuth();
  const isAdmin = !!(user && ADMIN_UIDS.includes(user.uid));
  const [query, setQuery] = useState('');

  const monthDates = useMemo(() => {
    const arr = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      arr.push(d);
    }
    return arr;
  }, [start, months]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = {};
      for (const d of monthDates) {
        const key = monthKey(d);
        const ref = doc(collection(db, 'calendArte'), key);
        const snap = await getDoc(ref);
        all[key] = snap.exists() ? (snap.data().days || {}) : {};
      }
      if (!cancelled) setNotes(all);
    })();
    return () => { cancelled = true; };
  }, [monthDates]);

  function normalizeDayData(raw) {
    if (!raw) return { text: '', attachments: [], history: [] };
    if (typeof raw === 'string') return { text: raw, attachments: [], history: [] };
    const text = typeof raw.text === 'string' ? raw.text : '';
    const attachments = Array.isArray(raw.attachments) ? raw.attachments : [];
    const history = Array.isArray(raw.history) ? raw.history : [];
    return { text, attachments, history };
  }

  async function persistDay(key, day, nextDayObj, prevDayObj) {
    // push previous state into history (bounded to last 10 entries)
    const ts = Date.now();
    const prevEntry = prevDayObj ? { text: prevDayObj.text || '', attachments: prevDayObj.attachments || [], ts } : null;
    const history = [...(nextDayObj.history || [])];
    if (prevEntry) history.unshift(prevEntry);
    while (history.length > 10) history.pop();
    const toSave = { ...nextDayObj, history };
    setNotes(prev => ({ ...prev, [key]: { ...(prev[key] || {}), [day]: toSave } }));
    try {
      const ref = doc(collection(db, 'calendArte'), key);
      await setDoc(ref, { days: { ...(notes[key] || {}), [day]: toSave } }, { merge: true });
    } catch (e) {
      console.warn('Errore salvataggio nota', e);
    }
  }

  const saveNote = async (key, day, newText) => {
    const current = normalizeDayData((notes[key] || {})[day]);
    const next = { ...current, text: newText };
    await persistDay(key, day, next, current);
  };

  const addLink = async (key, day) => {
    const url = window.prompt('Inserisci URL (http/https):');
    if (!url) return;
    const title = window.prompt('Titolo (opzionale):') || '';
    const current = normalizeDayData((notes[key] || {})[day]);
    const next = { ...current, attachments: [...current.attachments, { type: 'link', url, title, ts: Date.now() }] };
    await persistDay(key, day, next, current);
  };

  const addImage = async (key, day, file) => {
    if (!file) return;
    try {
      const monthPath = key; // YYYY-MM
      const dayPath = day; // DD
      const filename = `${Date.now()}-${(file.name || 'img').replace(/[^a-zA-Z0-9_.-]+/g, '_')}`;
      const path = `calend-arte/${monthPath}/${dayPath}/${filename}`;
      const sref = storageRef(storage, path);
      await uploadBytes(sref, file, { contentType: file.type || 'application/octet-stream' });
  const url = await getDownloadURL(sref);
      const current = normalizeDayData((notes[key] || {})[day]);
  const next = { ...current, attachments: [...current.attachments, { type: 'image', url, path, name: file.name || filename, ts: Date.now() }] };
      await persistDay(key, day, next, current);
    } catch (e) {
      console.warn('Errore upload immagine', e);
      alert('Upload immagine non riuscito.');
    }
  };

  const removeAttachment = async (key, day, idx) => {
    const current = normalizeDayData((notes[key] || {})[day]);
    const att = current.attachments[idx];
    // Try to delete from Storage if we have a path for images
    if (att && att.type === 'image' && att.path) {
      try { await deleteObject(storageRef(storage, att.path)); } catch (e) { console.warn('Delete storage failed (non-blocking):', e?.message || e); }
    }
    const next = { ...current, attachments: current.attachments.filter((_, i) => i !== idx) };
    await persistDay(key, day, next, current);
  };

  const undoLast = async (key, day) => {
    const current = normalizeDayData((notes[key] || {})[day]);
    const [last, ...restHistory] = current.history || [];
    if (!last) return;
    const next = { text: last.text || '', attachments: last.attachments || [], history: restHistory };
    setNotes(prev => ({ ...prev, [key]: { ...(prev[key] || {}), [day]: next } }));
    try {
      const ref = doc(collection(db, 'calendArte'), key);
      await setDoc(ref, { days: { ...(notes[key] || {}), [day]: next } }, { merge: true });
    } catch (e) {
      console.warn('Errore annulla ultima modifica', e);
    }
  };

  const restoreFromHistory = async (key, day, index) => {
    const current = normalizeDayData((notes[key] || {})[day]);
    const hist = current.history || [];
    if (!hist[index]) return;
    const selected = hist[index];
    const next = { text: selected.text || '', attachments: selected.attachments || [], history: hist.slice(index + 1) };
    setNotes(prev => ({ ...prev, [key]: { ...(prev[key] || {}), [day]: next } }));
    try {
      const ref = doc(collection(db, 'calendArte'), key);
      await setDoc(ref, { days: { ...(notes[key] || {}), [day]: next } }, { merge: true });
    } catch (e) {
      console.warn('Errore ripristino da cronologia', e);
    }
  };

  return (
    <div className="publicpage" style={{ padding: '30px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', position:'relative' }}>
      {/* Back arrow */}
      <button
        onClick={() => navigate(-1)}
        aria-label="Torna indietro"
        title="Indietro"
        style={{ position:'fixed', top:'12px', left:'12px', zIndex:100002, background:'rgba(0,0,0,0.55)', border:'1px solid #ffd700', color:'#ffd700', borderRadius:'50%', width:46, height:46, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', boxShadow:'0 0 12px #000' }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      {/* Always show logo */}
      <div className="logo-wrapper" style={{ position:'relative', marginBottom: 10 }}>
        <div className="logo-stack">
          <img src="/disco.png" alt="Disco" className="disco-img" />
          <img src="/logo.png" alt="Logo Arte Registrazioni" className="logo-img" />
        </div>
      </div>
      <div style={{ width: '100%', maxWidth: 1080 }}>
        <h1 className="publicsite-title" style={{ marginBottom: 6 }}>CalendArte</h1>
        <p style={{ color: '#9fe8c4', marginTop: 0, marginBottom: 16 }}>Appunti e note giorno per giorno. Visibile a tutti; modificabile solo dagli amministratori.</p>
        {/* Search notes */}
        <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom: 10 }}>
          <input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Cerca nelle note..." style={{ flex:1, maxWidth: 320, background:'transparent', color:'#9fe8c4', border:'1px solid rgba(159,232,196,0.3)', borderRadius:6, padding:'8px 10px' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <button className="dash-small-btn" onClick={() => setStart(new Date(start.getFullYear(), start.getMonth() - 1, 1))}>{'←'} Mese precedente</button>
          <button className="dash-small-btn" onClick={() => setStart(new Date())}>Oggi</button>
          <button className="dash-small-btn" onClick={() => setStart(new Date(start.getFullYear(), start.getMonth() + 1, 1))}>Mese successivo {'→'}</button>
          <span style={{ marginLeft: 'auto', color: '#9fe8c4' }}>Mostra
            <select value={months} onChange={(e) => setMonths(parseInt(e.target.value || '3'))} style={{ marginLeft: 6 }}>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={6}>6</option>
            </select>
            {' '}mesi
          </span>
        </div>

        {monthDates.map((d) => {
          const key = monthKey(d);
          const grid = buildMonthGrid(d);
          const monthNotes = notes[key] || {};
          return (
            <div key={key} style={{ marginBottom: 24, border: '1px solid rgba(255,215,0,0.25)', borderRadius: 10, padding: 10, background: 'rgba(0,0,0,0.35)' }}>
              <h2 className="publicsite-title" style={{ fontSize: '1.2rem', margin: '6px 4px 10px' }}>{grid.label}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                {['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map(w => (
                  <div key={w} style={{ color: '#ffd700', opacity: 0.8, fontSize: 12, textAlign: 'center' }}>{w}</div>
                ))}
                {grid.cells.map((cell, idx) => {
                  if (!cell) return <div key={idx} style={{ padding: 10 }} />;
                  const day = String(cell.d).padStart(2, '0');
                  const dayObj = normalizeDayData(monthNotes[day]);
                  const text = dayObj.text || '';
                  const isToday = (() => { const t = new Date(); return t.getFullYear()===cell.date.getFullYear() && t.getMonth()===cell.date.getMonth() && t.getDate()===cell.date.getDate(); })();
                  if (query && !text.toLowerCase().includes(query.toLowerCase())) {
                    // If searching and no match, hide empty cells to focus results
                    return <div key={idx} style={{ padding: 10, opacity: 0.25, border:'1px dashed rgba(255,255,255,0.08)', borderRadius: 8 }} />;
                  }
                  return (
                    <div key={idx} style={{ border: isToday ? '2px solid #ffd700' : '1px solid rgba(255,215,0,0.2)', borderRadius: 8, padding: 8, minHeight: 120, display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.2)', gap: 6 }}>
                      <div style={{ fontWeight: 700, color: isToday ? '#000' : '#ffd700', background: isToday ? '#ffd700' : 'transparent', display:'inline-block', padding:'2px 6px', borderRadius: 6, marginBottom: 6 }}>{cell.d}</div>
                      {isAdmin ? (
                        <textarea
                          value={text}
                          onChange={(e) => saveNote(key, day, e.target.value)}
                          placeholder="Nota..."
                          style={{ flex: 1, resize: 'vertical', minHeight: 54, background: 'transparent', color: '#9fe8c4', border: '1px solid rgba(159,232,196,0.3)', borderRadius: 6, padding: 6 }}
                        />
                      ) : (
                        <div style={{ whiteSpace: 'pre-wrap', color: '#9fe8c4' }}>{text}</div>
                      )}
                      {/* Attachments */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {(dayObj.attachments || []).length > 0 && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {dayObj.attachments.map((att, i) => (
                              <div key={i} style={{ border: '1px solid rgba(255,215,0,0.2)', borderRadius: 6, padding: 6, background: 'rgba(0,0,0,0.25)' }}>
                                {att.type === 'image' ? (
                                  <a href={att.url} target="_blank" rel="noreferrer" title={att.name || 'Immagine'}>
                                    <img src={att.url} alt={att.name || 'img'} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4 }} />
                                  </a>
                                ) : (
                                  <a href={att.url} target="_blank" rel="noreferrer" style={{ color: '#9fe8c4', textDecoration: 'underline' }}>
                                    {att.title || att.url}
                                  </a>
                                )}
                                {isAdmin && (
                                  <div>
                                    <button className="dash-small-btn" onClick={() => removeAttachment(key, day, i)} style={{ marginTop: 4 }}>Rimuovi</button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {isAdmin && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <label className="dash-small-btn" style={{ cursor: 'pointer' }}>
                              Aggiungi immagine
                              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) { addImage(key, day, f); e.target.value = ''; } }} />
                            </label>
                            <button className="dash-small-btn" onClick={() => addLink(key, day)}>Aggiungi link</button>
                            <button className="dash-small-btn" disabled={!(dayObj.history && dayObj.history.length)} onClick={() => undoLast(key, day)}>Annulla ultima</button>
                            {dayObj.history && dayObj.history.length > 1 && (
                              <details>
                                <summary style={{ cursor:'pointer' }}>Cronologia ({dayObj.history.length})</summary>
                                <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:160, overflow:'auto' }}>
                                  {dayObj.history.map((h, i) => (
                                    <button key={i} className="dash-small-btn" onClick={() => restoreFromHistory(key, day, i)}>
                                      Ripristina #{i+1} — {new Date(h.ts||Date.now()).toLocaleString('it-IT')}
                                    </button>
                                  ))}
                                </div>
                              </details>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
