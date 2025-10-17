import React, { useEffect, useMemo, useState } from 'react';
import { db } from './firebase';
import { collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { ADMIN_UIDS } from './config';

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
  const [start, setStart] = useState(() => new Date());
  const [months, setMonths] = useState(3);
  const [notes, setNotes] = useState({}); // { 'YYYY-MM': { 'DD': 'text' } }
  const { user } = useAuth();
  const isAdmin = !!(user && ADMIN_UIDS.includes(user.uid));

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

  const saveNote = async (key, day, value) => {
    setNotes(prev => ({ ...prev, [key]: { ...(prev[key] || {}), [day]: value } }));
    try {
      const ref = doc(collection(db, 'calendArte'), key);
      await setDoc(ref, { days: { ...(notes[key] || {}), [day]: value } }, { merge: true });
    } catch (e) {
      console.warn('Errore salvataggio nota', e);
    }
  };

  return (
    <div className="publicpage" style={{ padding: '30px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 1080 }}>
        <h1 className="publicsite-title" style={{ marginBottom: 6 }}>CalendArte</h1>
        <p style={{ color: '#9fe8c4', marginTop: 0, marginBottom: 16 }}>Appunti e note giorno per giorno. Visibile a tutti; modificabile solo dagli amministratori.</p>
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
                  const text = monthNotes[day] || '';
                  return (
                    <div key={idx} style={{ border: '1px solid rgba(255,215,0,0.2)', borderRadius: 8, padding: 8, minHeight: 96, display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.2)' }}>
                      <div style={{ fontWeight: 600, color: '#ffd700', marginBottom: 6 }}>{cell.d}</div>
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
