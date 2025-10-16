import React, { useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { ADMIN_UIDS, ADMIN_EMAILS } from './config';
import { db } from './firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function extOf(file) { return (file?.name?.split('.')?.pop() || '').toLowerCase(); }

export default function AdminSeed() {
  const { user } = useAuth();
  const isAdmin = useMemo(() => !!(user && (ADMIN_UIDS.includes(user.uid) || (((user.email)||'').toLowerCase() && ADMIN_EMAILS.includes(((user.email)||'').toLowerCase())))), [user]);
  const [files, setFiles] = useState({
    homeVideo: null,
    studioVideo: null,
    logoVideo: null,
    festivalPdf: null,
  });
  const [tracks, setTracks] = useState([
    { title: 'Track 1', file: null },
    { title: 'Track 2', file: null },
  ]);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);
  const [result, setResult] = useState(null);

  if (!isAdmin) {
    return <div style={{ color:'#ffd700', textAlign:'center', marginTop:80 }}>Solo gli amministratori possono accedere a questa pagina.</div>;
  }

  const onPick = (key) => (e) => setFiles(prev => ({ ...prev, [key]: (e.target.files && e.target.files[0]) || null }));
  const onPickTrack = (idx) => (e) => setTracks(prev => prev.map((t, i) => i === idx ? { ...t, file: (e.target.files && e.target.files[0]) || null } : t));
  const onTitleTrack = (idx) => (e) => setTracks(prev => prev.map((t, i) => i === idx ? { ...t, title: e.target.value } : t));
  const addTrack = () => setTracks(prev => ([ ...prev, { title: `Track ${prev.length + 1}`, file: null } ]));
  const removeTrack = (idx) => setTracks(prev => prev.filter((_, i) => i !== idx));

  async function uploadIfPresent(file, destBase, fallbackExt) {
    if (!file) return null;
    const ex = extOf(file) || fallbackExt;
    const path = `${destBase}.${ex}`;
    const r = ref(storage, path);
    setLog(l => [...l, `Upload ${path}...`]);
    const snap = await uploadBytes(r, file, { contentType: file.type || undefined });
    const url = await getDownloadURL(snap.ref);
    setLog(l => [...l, `✓ Caricato: ${path}`]);
    return url;
  }

  async function onSeed(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setResult(null);
    setLog([]);
    try {
      // 1) Carica su Storage i media scelti
      const [homeVideoUrl, studioVideoUrl, logoVideoUrl, festivalPdfUrl] = await Promise.all([
        uploadIfPresent(files.homeVideo, 'public/videos/home', 'mp4'),
        uploadIfPresent(files.studioVideo, 'public/videos/studio', 'mp4'),
        uploadIfPresent(files.logoVideo, 'public/videos/logo', 'mp4'),
        uploadIfPresent(files.festivalPdf, 'public/pdfs/festival', 'pdf'),
      ]);

      // Carica tutte le tracce dinamicamente
      const uploadedTracks = [];
      for (let i = 0; i < tracks.length; i++) {
        const t = tracks[i];
        if (!t?.file) continue;
        const url = await uploadIfPresent(t.file, `public/audio/track-${i + 1}`, extOf(t.file) || 'mp3');
        if (url) uploadedTracks.push({ title: t.title || `Track ${i + 1}`, link: url });
      }

      // 2) Scrivi config sito
      const config = {};
      if (homeVideoUrl) config.homeVideoUrl = homeVideoUrl;
      if (studioVideoUrl) config.studioVideoUrl = studioVideoUrl;
      if (logoVideoUrl) config.logoVideoUrl = logoVideoUrl;
      if (festivalPdfUrl) config.festivalPdfUrl = festivalPdfUrl;
      if (Object.keys(config).length > 0) {
        await setDoc(doc(db, 'site', 'config'), config, { merge: true });
        setLog(l => [...l, '✓ Aggiornato Firestore: site/config']);
      }

      // 3) Crea un artista demo con un album e 1-2 tracce
      const albums = [
        {
          title: 'Demo Album',
          year: new Date().getFullYear().toString(),
          genre: 'Jazz',
          cover: '/logo.png',
          tracks: uploadedTracks,
          buttons: [],
        },
      ];
      await setDoc(doc(db, 'artisti', 'artista-demo'), {
        nome: 'Artista Demo',
        bio: 'Artista di esempio per verificare layout e player.',
        photo: '/logo.png',
        steps: ['/logo.png'],
        albums,
        createdAt: serverTimestamp(),
      }, { merge: true });
      setLog(l => [...l, '✓ Creato/aggiornato artista: artista-demo']);

  setResult({ ok: true, homeVideoUrl, studioVideoUrl, logoVideoUrl, tracks: uploadedTracks.length, festivalPdfUrl });
    } catch (err) {
      console.error(err);
      setResult({ ok: false, error: err?.message || String(err) });
      setLog(l => [...l, `Errore: ${err?.message || String(err)}`]);
    } finally {
      setBusy(false);
    }
  }

  async function onSeedFromAssets() {
    if (busy) return;
    setBusy(true);
    setResult(null);
    setLog([]);
    try {
      // 1) Usa festival.pdf nel public se presente
      const festivalPdfUrl = '/festival.pdf';
      await setDoc(doc(db, 'site', 'config'), {
        festivalPdfUrl,
      }, { merge: true });
      setLog(l => [...l, '✓ Aggiornato Firestore: site/config (festivalPdfUrl)']);

      // 2) Leggi artists-data.json dal public e crea almeno un artista
      const res = await fetch('/artists-data.json', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json) ? json : [];
        for (const entry of list) {
          const artistId = entry.id || (entry.name || '').toLowerCase().replace(/\s+/g, '-');
          const cover = entry.releases && entry.releases.length ? (`/${entry.releases[0].cover}`.replace(/\/+/g, '/')) : '/logo.png';
          const photo = entry.photo ? (`/${entry.photo}`.replace(/\/+/g, '/')) : cover;
          const albums = [
            {
              title: entry.releases && entry.releases.length ? entry.releases[0].title : 'Album',
              year: new Date().getFullYear().toString(),
              genre: entry.releases && entry.releases.length ? (entry.releases[0].genre || 'Jazz') : 'Jazz',
              cover,
              tracks: [], // niente audio locale presente, verranno aggiunte in seguito
              buttons: [],
            },
          ];
          await setDoc(doc(db, 'artisti', artistId), {
            nome: entry.name || 'Artista',
            bio: entry.bio || '',
            photo,
            steps: [photo],
            albums,
            createdAt: serverTimestamp(),
          }, { merge: true });
          setLog(l => [...l, `✓ Artista creato/aggiornato: ${artistId}`]);
        }
      } else {
        setLog(l => [...l, 'artists-data.json non trovato nel public/']);
      }

      setResult({ ok: true, seededFromAssets: true });
    } catch (err) {
      console.error(err);
      setResult({ ok: false, error: err?.message || String(err) });
      setLog(l => [...l, `Errore: ${err?.message || String(err)}`]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="publicsite-bg" style={{ padding: 24 }}>
      <div style={{ maxWidth: 780, margin: '0 auto', background: 'rgba(20,20,20,0.9)', border: '1px solid #333', borderRadius: 16, padding: 20 }}>
        <h1 style={{ color:'#ffd700', marginTop: 0 }}>Seed contenuti minimi</h1>
        <p style={{ color:'#ddd' }}>Carica file locali per popolare rapidamente l'app: video home/studio/logo, 2 tracce audio e PDF del festival. I file saranno salvati in Firebase Storage sotto <code>public/</code> e le URL scritte in Firestore.</p>
        <form onSubmit={onSeed} style={{ display:'grid', gap: 14 }}>
          <label style={{ color:'#fff' }}>Home video (mp4)
            <input type="file" accept="video/mp4,video/*" onChange={onPick('homeVideo')} />
          </label>
          <label style={{ color:'#fff' }}>Studio video (mp4)
            <input type="file" accept="video/mp4,video/*" onChange={onPick('studioVideo')} />
          </label>
          <label style={{ color:'#fff' }}>Logo video (mp4)
            <input type="file" accept="video/mp4,video/*" onChange={onPick('logoVideo')} />
          </label>
          <div style={{ marginTop: 4 }}>
            <div style={{ color:'#fff', fontWeight:700, marginBottom: 6 }}>Tracce (mp3/m4a/wav)</div>
            {tracks.map((t, idx) => (
              <div key={idx} style={{ display:'grid', gap: 8, gridTemplateColumns:'1fr auto', alignItems:'center', marginBottom: 8 }}>
                <input
                  type="text"
                  value={t.title}
                  onChange={onTitleTrack(idx)}
                  placeholder={`Track ${idx + 1} title`}
                  style={{ padding:'8px 10px', borderRadius:8, border:'1px solid #444', background:'#111', color:'#fff' }}
                />
                <button type="button" onClick={() => removeTrack(idx)} disabled={tracks.length <= 1} style={{ background:'transparent', color:'#ffd700', border:'1px solid #444', borderRadius:8, padding:'6px 10px', cursor:'pointer' }}>Rimuovi</button>
                <input
                  type="file"
                  accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/*"
                  onChange={onPickTrack(idx)}
                  style={{ gridColumn:'1 / span 2' }}
                />
              </div>
            ))}
            <button type="button" onClick={addTrack} style={{ background:'transparent', color:'#7ad', border:'1px dashed #335', borderRadius:8, padding:'6px 10px', cursor:'pointer' }}>+ Aggiungi traccia</button>
          </div>
          <label style={{ color:'#fff' }}>Festival PDF
            <input type="file" accept="application/pdf" onChange={onPick('festivalPdf')} />
          </label>
          <button type="submit" disabled={busy} style={{ background:'#ffd700', color:'#222', fontWeight:700, padding:'10px 16px', borderRadius:10, border:'none', cursor:'pointer' }}>{busy ? 'Caricamento…' : 'Esegui seed (carica file)'}</button>
          <button type="button" onClick={onSeedFromAssets} disabled={busy} style={{ background:'#0b3d1f', color:'#d5ffe8', fontWeight:700, padding:'10px 16px', borderRadius:10, border:'1px solid #19c97d', cursor:'pointer' }}>Seed da assets locali (senza upload)</button>
        </form>
        <div style={{ marginTop: 16, color:'#9ad' }}>
          <div style={{ fontWeight:700, color:'#fff' }}>Log:</div>
          <pre style={{ whiteSpace:'pre-wrap' }}>{log.join('\n')}</pre>
        </div>
        {result && (
          <div style={{ marginTop: 12, padding: 10, borderRadius: 10, background: result.ok ? 'rgba(0,60,0,0.5)' : 'rgba(60,0,0,0.5)', color:'#fff' }}>
            {result.ok ? 'Seed completato' : `Seed fallito: ${result.error}`}
          </div>
        )}
      </div>
    </div>
  );
}
