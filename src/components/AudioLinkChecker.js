import React from 'react';
import { db, storage } from './firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { ref, listAll } from 'firebase/storage';

// Small helper to test URLs without downloading the full file
async function probeUrl(url) {
  const result = { url, ok: false, status: null, contentType: null, method: 'HEAD', note: '' };
  try {
    // Try HEAD first (fast, minimal)
    const head = await fetch(url, { method: 'HEAD' });
    result.status = head.status;
    result.contentType = head.headers.get('Content-Type');
    if (head.ok && /audio|octet-stream/i.test(result.contentType || '')) {
      result.ok = true;
      return result;
    }
    // If HEAD not allowed or content-type missing, try a tiny ranged GET
    if (!head.ok || head.status === 405 || !result.contentType) {
      const getResp = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' } });
      result.method = 'GET';
      result.status = getResp.status;
      result.contentType = getResp.headers.get('Content-Type');
      if ((getResp.ok || getResp.status === 206) && /audio|octet-stream/i.test(result.contentType || '')) {
        result.ok = true;
        return result;
      }
    }
    // Not OK
    return result;
  } catch (e) {
    result.note = e?.message || String(e);
    return result;
  }
}

function uniqBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const it of arr) {
    const k = keyFn(it);
    if (k && !seen.has(k)) { seen.add(k); out.push(it); }
  }
  return out;
}

function collectFromTrack(track, ctx) {
  const urls = [];
  const candidates = [
    track?.previewUrl,
    track?.previewAudioUrl,
    track?.fullAudioUrl,
    track?.audioUrl,
    track?.url,
    track?.fileUrl,
    track?.streamUrl,
    // Nuovo campo unificato streaming completo
    track?.streamAudioUrl,
    track?.link,
  ].filter(Boolean);
  for (const u of candidates) {
    urls.push({ url: u, title: track?.title || track?.name || ctx?.albumTitle || 'Track', source: ctx?.source || 'album.track', album: ctx?.albumTitle || null });
  }
  return urls;
}

function collectCandidates(artistDoc, subTracks) {
  const list = [];
  // From subcollection tracks
  for (const t of subTracks) {
    list.push(...collectFromTrack(t, { source: 'subcollection.track' }));
  }
  // From albums
  const albums = Array.isArray(artistDoc?.albums) ? artistDoc.albums : [];
  for (const alb of albums) {
    // album-level play/download buttons (may be direct audio links)
    if (Array.isArray(alb?.buttons)) {
      for (const b of alb.buttons) {
        if (b?.link) list.push({ url: b.link, title: b.name || 'button', source: 'album.button', album: alb.title || null });
      }
    }
    const tracks = Array.isArray(alb?.tracks) ? alb.tracks : [];
    for (const t of tracks) {
      list.push(...collectFromTrack(t, { source: 'album.track', albumTitle: alb.title || null }));
    }
  }
  // Unique by URL
  return uniqBy(list.filter(x => typeof x.url === 'string' && x.url.trim()), x => x.url.trim());
}

export default function AudioLinkChecker({ artistId }) {
  const [loading, setLoading] = React.useState(false);
  const [items, setItems] = React.useState([]);
  const [results, setResults] = React.useState([]);
  const [error, setError] = React.useState('');
  const [storageFiles, setStorageFiles] = React.useState([]);

  const loadData = React.useCallback(async () => {
    if (!artistId) return;
    setLoading(true);
    setError('');
    try {
      const ref = doc(db, 'artisti', artistId);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error('Artista non trovato');
      const artist = { id: snap.id, ...snap.data() };
      let sub = [];
      try {
        const tSnap = await getDocs(collection(db, 'artisti', snap.id, 'tracks'));
        sub = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch {}
      const candidates = collectCandidates(artist, sub);
      // Carica elenco file nella cartella audio/ (best effort)
      try {
        const audioRef = ref(storage, 'audio');
        const listing = await listAll(audioRef);
        const names = listing.items.map(i => i.name);
        setStorageFiles(names);
      } catch {}
      setItems(candidates);
      setResults([]);
    } catch (e) {
      setError(e?.message || 'Errore caricamento dati');
    } finally {
      setLoading(false);
    }
  }, [artistId]);

  const runChecks = React.useCallback(async () => {
    setLoading(true);
    try {
      const checks = await Promise.all(items.map(async (it) => {
        const r = await probeUrl(it.url);
        return { ...it, ...r };
      }));
      setResults(checks);
    } finally {
      setLoading(false);
    }
  }, [items]);

  const rerunFailed = React.useCallback(async () => {
    setLoading(true);
    try {
      const failed = results.filter(r => !r.ok);
      const checks = await Promise.all(failed.map(async (it) => {
        const r = await probeUrl(it.url);
        return { ...it, ...r };
      }));
      const merged = results.map(r => {
        const upd = checks.find(x => x.url === r.url);
        return upd ? upd : r;
      });
      setResults(merged);
    } finally {
      setLoading(false);
    }
  }, [results]);

  React.useEffect(() => { loadData(); }, [loadData]);

  const okCount = results.filter(r => r.ok).length;
  const failCount = results.length ? results.length - okCount : 0;

  return (
    <div style={{ marginTop: 24, padding: 16, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, background: 'rgba(0,0,0,0.5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, color: '#ffd700' }}>Verifica link audio</h3>
        <button disabled={loading} onClick={loadData} className="dash-btn dash-btn--ghost">Ricarica dati</button>
        <button disabled={loading || !items.length} onClick={runChecks} className="dash-btn dash-btn--primary">Scansiona {items.length ? `(${items.length})` : ''}</button>
        {results.length > 0 && (
          <>
            <span style={{ color: okCount === results.length ? '#9fe89f' : (failCount ? '#ffd700' : '#9fe89f') }}>
              OK: {okCount} · Problematici: {failCount}
            </span>
            {failCount > 0 && <button disabled={loading} onClick={rerunFailed} className="dash-btn">Riprova i falliti</button>}
          </>
        )}
      </div>
      {error && <div style={{ marginTop: 8, color: 'tomato' }}>{error}</div>}
      <div style={{ marginTop: 12, maxHeight: 360, overflow: 'auto', borderTop: '1px dashed rgba(255,255,255,0.15)', paddingTop: 8 }}>
        {(results.length ? results : items).map((it, i) => {
          const ok = it.ok === true;
          const warn = it.ok !== true && (it.status && it.status !== 404) && (it.contentType && !/audio|octet-stream/i.test(it.contentType));
          const bad = it.ok !== true && (!it.status || it.status === 404 || warn);
          const color = ok ? '#9fe89f' : (warn ? '#ffd700' : 'tomato');
          // Suggerimento nome simile se 404
          let suggestion = null;
            if (!ok && it.status === 404 && storageFiles.length) {
              const targetName = decodeURIComponent(it.url.split('/').pop().split('?')[0] || '').toLowerCase();
              // prova ad estrarre solo il filename finale (può includere %2F)
              const fileOnly = targetName.split('%2F').pop();
              let best = null, bestScore = 0;
              for (const name of storageFiles) {
                const nLow = name.toLowerCase();
                // punteggio semplice: token match / Levenshtein minimale (approssimazione distanza per lunghezze simili)
                let score = 0;
                if (nLow === fileOnly) score = 1;
                else if (nLow.replace(/\.[a-z0-9]+$/, '') === fileOnly.replace(/\.[a-z0-9]+$/, '')) score = 0.9;
                else if (nLow.includes(fileOnly) || fileOnly.includes(nLow)) score = 0.7;
                if (score > bestScore) { bestScore = score; best = name; }
              }
              if (best && bestScore >= 0.7) suggestion = best;
            }
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
              <div style={{ overflow: 'hidden' }}>
                <div style={{ color: '#e5e7eb', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.title || '—'} <span style={{ color: '#94a3b8' }}>({it.source || 'n/a'})</span></div>
                <div style={{ color: '#9ca3af', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.url}</div>
                {it.status && <div style={{ color: '#94a3b8', fontSize: 12 }}>HTTP {it.status}{it.contentType ? ` · ${it.contentType}` : ''}{it.method ? ` · ${it.method}` : ''}{it.note ? ` · ${it.note}` : ''}{suggestion ? ` · Suggerito: ${suggestion}` : ''}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <a href={it.url} target="_blank" rel="noopener noreferrer" className="dash-btn dash-btn--ghost">Apri</a>
                {it.ok !== true && <button className="dash-btn" onClick={async () => {
                  const r = await probeUrl(it.url);
                  setResults(prev => {
                    const copy = [...(prev.length ? prev : items)];
                    const idx = copy.findIndex(x => x.url === it.url);
                    const merged = { ...(copy[idx] || it), ...r };
                    if (idx >= 0) copy[idx] = merged; else copy.push(merged);
                    return copy;
                  });
                }}>Riprova</button>}
              </div>
            </div>
          );
        })}
        {(!items.length && !loading && !error) && (
          <div style={{ color: '#94a3b8' }}>Nessun URL audio trovato nei tuoi dati. Aggiungi tracce nella tua dashboard.</div>
        )}
      </div>
      <div style={{ marginTop: 8, color: '#9ca3af', fontSize: 12 }}>
        Suggerimento: per URL Firebase Storage preferisci link con <code>alt=media&token=...</code>. Se vedi 404, controlla nome file (maiuscole/minuscole) e percorso in Storage. Se compare "Suggerito:" puoi aggiornare il link con quel nome.
      </div>
    </div>
  );
}
