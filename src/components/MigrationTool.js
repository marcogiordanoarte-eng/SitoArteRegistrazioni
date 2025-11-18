import React, { useState } from 'react';
import { db, storage } from './firebase';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';

function isPlayable(url) {
  if (!url || typeof url !== 'string') return false;
  const clean = url.split('?')[0].toLowerCase();
  return ['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.oga'].some(ext => clean.endsWith(ext));
}

function normalizeToHttps(url) {
  // Accept gs:// or https; return https download URL if possible
  try {
    if (url.startsWith('gs://')) {
      const r = ref(storage, url);
      return getDownloadURL(r);
    }
    return Promise.resolve(url);
  } catch {
    return Promise.resolve(url);
  }
}

export default function MigrationTool() {
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]);
  const [dryRun, setDryRun] = useState(true);
  const [counter, setCounter] = useState({ artists: 0, albumsUpdated: 0, tracksUpdated: 0, musicaUpdated: 0 });

  const append = (line) => setLog(prev => [...prev, line]);

  async function runMigration() {
    if (running) return;
    setRunning(true);
    setLog([]);
    setCounter({ artists: 0, albumsUpdated: 0, tracksUpdated: 0, musicaUpdated: 0 });
    try {
      const artistsSnap = await getDocs(collection(db, 'artisti'));
      let albumsUpd = 0, tracksUpd = 0, musicaUpd = 0;
      setCounter(p => ({ ...p, artists: artistsSnap.size }));
      for (const artistDoc of artistsSnap.docs) {
        const aid = artistDoc.id;
        const artist = artistDoc.data();
        // 1) Albums array inside artist document
        let changed = false;
        const albums = Array.isArray(artist.albums) ? artist.albums.map(a => ({ ...a })) : [];
        for (let i = 0; i < albums.length; i++) {
          const alb = albums[i] || {};
          if (!alb.streamAudioUrl) {
            const candidates = [alb.streamAudioUrl, alb.fullAudioUrl, alb.downloadLink].filter(Boolean);
            // If album contains tracks[], consider first playable link or streamAudioUrl
            if (Array.isArray(alb.tracks)) {
              const t1 = alb.tracks.find(t => isPlayable(t?.streamAudioUrl))?.streamAudioUrl;
              if (t1) candidates.push(t1);
              const t2 = alb.tracks.find(t => isPlayable(t?.link))?.link;
              if (t2) candidates.push(t2);
            }
            // If Play button exists, consider it
            const playBtn = Array.isArray(alb.buttons) && alb.buttons.find(b => (b?.name||'').toLowerCase()==='play' && b.link);
            if (playBtn) candidates.push(playBtn.link);
            let chosen = '';
            for (const c of candidates) {
              if (!c) continue;
              const https = await normalizeToHttps(c);
              if (isPlayable(https)) { chosen = https; break; }
            }
            if (chosen) {
              albums[i].streamAudioUrl = chosen;
              changed = true; albumsUpd++;
              append(`[album] ${aid}#${i} -> streamAudioUrl set`);
            }
          }
          // Normalize any gs:// in videoUrl/downloadLink to https for consistency (best-effort)
          if (alb.downloadLink && alb.downloadLink.startsWith('gs://')) {
            try { albums[i].downloadLink = await normalizeToHttps(alb.downloadLink); changed = true; } catch {}
          }
        }
        if (changed && !dryRun) {
          await setDoc(doc(db, 'artisti', aid), { albums }, { merge: true });
        }
        // 2) Tracks subcollection per artist
        const tracksSnap = await getDocs(collection(db, 'artisti', aid, 'tracks'));
        for (const tdoc of tracksSnap.docs) {
          const t = tdoc.data();
          if (!t.streamAudioUrl) {
            const candidates = [t.streamAudioUrl, t.previewAudioUrl, t.fullAudioUrl, t.downloadLink].filter(Boolean);
            let chosen = '';
            for (const c of candidates) {
              const https = await normalizeToHttps(c);
              if (isPlayable(https)) { chosen = https; break; }
            }
            if (chosen) {
              tracksUpd++;
              append(`[track] ${aid}/${tdoc.id} -> streamAudioUrl set`);
              if (!dryRun) {
                await setDoc(doc(db, 'artisti', aid, 'tracks', tdoc.id), { streamAudioUrl: chosen }, { merge: true });
              }
            }
          }
        }
        // 3) musicaTracks mirror
        // If exists, update streamAudioUrl consistent with main source refs
        const musicaIdPrefix = `artist_${aid}_`;
        // We don't know track ids list here—optional scan by separate collection read
        const musicaSnap = await getDocs(collection(db, 'musicaTracks'));
        for (const mdoc of musicaSnap.docs) {
          if (!mdoc.id.startsWith(musicaIdPrefix)) continue;
          const m = mdoc.data();
          const candidates = [m.streamAudioUrl, m.previewAudioUrl, m.fullAudioUrl, m.downloadLink].filter(Boolean);
          let chosen = '';
          for (const c of candidates) {
            const https = await normalizeToHttps(c);
            if (isPlayable(https)) { chosen = https; break; }
          }
          if (chosen && m.streamAudioUrl !== chosen) {
            musicaUpd++;
            append(`[musica] ${mdoc.id} -> streamAudioUrl set`);
            if (!dryRun) {
              await setDoc(doc(db, 'musicaTracks', mdoc.id), { streamAudioUrl: chosen }, { merge: true });
            }
          }
        }
      }
      setCounter({ artists: artistsSnap.size, albumsUpdated: albumsUpd, tracksUpdated: tracksUpd, musicaUpdated: musicaUpd });
      append(`FATTO. Artists: ${artistsSnap.size}, Albums upd: ${albumsUpd}, Tracks upd: ${tracksUpd}, Musica upd: ${musicaUpd}`);
    } catch (e) {
      append('Errore: ' + (e?.message || String(e)));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={{ background:'#101010', border:'1px solid #333', borderRadius:12, padding:16 }}>
      <h4 style={{ color:'#ffd700', marginTop:0 }}>Migrazione Audio → streamAudioUrl</h4>
      <p style={{ color:'#bbb', fontSize:13, lineHeight:1.5 }}>
        Questo strumento cerca audio già caricati (preview/full/download) e imposta <code>streamAudioUrl</code> per lo streaming completo.
        Converte anche eventuali URL <code>gs://</code> in link HTTPS.
      </p>
      <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
        <label style={{ color:'#ddd', fontSize:12 }}>
          <input type="checkbox" checked={dryRun} onChange={e=>setDryRun(e.target.checked)} /> Dry-run (simula, non scrive)
        </label>
        <button disabled={running} onClick={runMigration} style={{ background: running?'#444':'#ffd700', color: running?'#ccc':'#222', border:'none', borderRadius:8, padding:'8px 12px', fontWeight:700, cursor: running?'default':'pointer' }}>
          {running ? 'Esecuzione…' : (dryRun ? 'Simula migrazione' : 'Esegui migrazione')}
        </button>
        <span style={{ color:'#888', fontSize:12 }}>Artisti: {counter.artists} | Albums: {counter.albumsUpdated} | Tracks: {counter.tracksUpdated} | Musica: {counter.musicaUpdated}</span>
      </div>
      <div style={{ marginTop:12, maxHeight:260, overflow:'auto', background:'#0b0b0b', border:'1px solid #222', borderRadius:8, padding:8 }}>
        {log.length === 0 ? (
          <div style={{ color:'#666', fontSize:12 }}>Nessun output ancora.</div>
        ) : (
          <pre style={{ color:'#ddd', fontSize:12, whiteSpace:'pre-wrap', margin:0 }}>{log.join('\n')}</pre>
        )}
      </div>
      <div style={{ marginTop:10, color:'#999', fontSize:11 }}>
        Nota: lo streaming di file WAV è consentito, ma può pesare molto su banda e tempi di avvio. Valuta MP3/AAC per fruizione più rapida.
      </div>
    </div>
  );
}
