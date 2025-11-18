import React from 'react';

async function probeUrl(url) {
  const result = { url, ok: false, status: null, contentType: null, method: 'HEAD', note: '' };
  try {
    const head = await fetch(url, { method: 'HEAD' });
    result.status = head.status;
    result.contentType = head.headers.get('Content-Type');
    if (head.ok && /audio|octet-stream/i.test(result.contentType || '')) {
      result.ok = true;
      return result;
    }
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
    return result;
  } catch (e) {
    result.note = e?.message || String(e);
    return result;
  }
}

export default function PlaybackValidator() {
  const [input, setInput] = React.useState('');
  const [running, setRunning] = React.useState(false);
  const [items, setItems] = React.useState([]);

  const run = React.useCallback(async () => {
    const lines = (input || '')
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);
    if (!lines.length) return;
    setRunning(true);
    const results = [];
    try {
      for (const url of lines) {
        const r = { url, probe: null, play: null };
        // 1) Probe (HEAD/Range)
        r.probe = await probeUrl(url);
        // 2) Playback attempt (muted, short)
        r.play = await new Promise((resolve) => {
          const audio = new Audio();
          audio.preload = 'metadata';
          audio.muted = true; // permette autoplay su molti browser
          let done = false;
          let started = false;
          const cleanup = () => {
            try { audio.pause(); } catch {}
            audio.src = '';
          };
          const timeout = setTimeout(() => {
            if (done) return;
            done = true;
            cleanup();
            resolve({ started, error: started ? null : 'timeout_canplay', duration: audio.duration || null });
          }, 5000);
          const onCanPlay = () => {
            if (done) return;
            // prova a partire
            audio.play().then(() => {
              started = true;
              setTimeout(() => {
                if (done) return;
                done = true; clearTimeout(timeout);
                cleanup();
                resolve({ started: true, error: null, duration: isFinite(audio.duration) ? audio.duration : null });
              }, 400);
            }).catch(err => {
              if (done) return;
              done = true; clearTimeout(timeout);
              cleanup();
              resolve({ started: false, error: (err && err.name) || 'play_error', duration: audio.duration || null });
            });
          };
          const onError = () => {
            if (done) return;
            done = true; clearTimeout(timeout);
            cleanup();
            const mediaErr = audio.error;
            resolve({ started: false, error: mediaErr ? mediaErr.message || mediaErr.code : 'media_error' });
          };
          audio.addEventListener('canplay', onCanPlay, { once: true });
          audio.addEventListener('error', onError, { once: true });
          audio.src = url;
          // In alcuni browser serve una gesture utente: l'utente dovrà premere il bottone "Esegui test".
          // L'handler di click chiamerà questa funzione, quindi la gesture è soddisfatta.
        });
        results.push(r);
        setItems(prev => [...prev, r]);
      }
    } finally {
      setRunning(false);
    }
    return results;
  }, [input]);

  return (
    <div style={{ marginTop: 24, padding: 16, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, background: 'rgba(0,0,0,0.5)' }}>
      <h3 style={{ marginTop: 0, color: '#ffd700' }}>Playback Validator (manuale)</h3>
      <p style={{ color: '#bbb', fontSize: 13 }}>Incolla 1 URL audio per riga. Con il pulsante sotto effettuiamo una sonda (HEAD/Range) e tentiamo l'avvio riproduzione silenzioso.</p>
      <textarea
        rows={5}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="https://...mp3\nhttps://...m4a\nhttps://...wav"
        style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #444', background: '#0b0b0b', color: '#fff' }}
      />
      <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="dash-btn dash-btn--primary" disabled={running || !input.trim()} onClick={run}>
          {running ? 'Test in corso…' : 'Esegui test'}
        </button>
        <button className="dash-btn" disabled={running && !items.length} onClick={() => setItems([])}>Pulisci risultati</button>
      </div>
      <div style={{ marginTop: 12, maxHeight: 300, overflow: 'auto', borderTop: '1px dashed rgba(255,255,255,0.15)', paddingTop: 8 }}>
        {items.length === 0 ? (
          <div style={{ color: '#94a3af' }}>Nessun test ancora eseguito.</div>
        ) : (
          items.map((it, idx) => {
            const okProbe = it.probe?.ok === true;
            const okPlay = it.play?.started === true;
            const color = okPlay ? '#9fe89f' : (okProbe ? '#ffd700' : 'tomato');
            return (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ color: '#e5e7eb', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.url}</div>
                  <div style={{ color: '#9ca3af', fontSize: 12 }}>
                    Probe: {okProbe ? 'OK' : `NO (HTTP ${it.probe?.status || '—'} ${it.probe?.contentType || ''})`} · Play: {okPlay ? 'OK' : `NO (${it.play?.error || '—'})`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <a href={it.url} target="_blank" rel="noopener noreferrer" className="dash-btn dash-btn--ghost">Apri</a>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div style={{ marginTop: 8, color: '#9ca3af', fontSize: 12 }}>
        Suggerimento: se la sonda è OK ma Play è NO, verifica le policy di autoplay (potrebbe servire un'interazione utente) o il CORS sul file.
      </div>
    </div>
  );
}
