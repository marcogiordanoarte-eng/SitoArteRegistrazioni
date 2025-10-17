import React, { useEffect, useState } from 'react';
import { db, storage } from './firebase';
import { doc, getDoc, setDoc, getDocs, collection } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Admin panel to manage global game music config stored in site/gameMusic document
export default function DashboardGameMusic() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    loopUrl: '',
    startSfxUrl: '',
    overSfxUrl: '',
    playlist: [], // [{title, url}]
  });
  const [dragOverStart, setDragOverStart] = useState(false);
  const [dragOverOver, setDragOverOver] = useState(false);
  const [dragOverLoop, setDragOverLoop] = useState(false);
  const [musicaTracks, setMusicaTracks] = useState([]); // for playlist source selection
  const [lastResolvedCount, setLastResolvedCount] = useState(null);
  const [resolvedPreview, setResolvedPreview] = useState([]);
  const [computingPreview, setComputingPreview] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'site', 'gameMusic'));
        if (!active) return;
        if (snap.exists()) {
          const data = snap.data() || {};
          setConfig({
            loopUrl: data.loopUrl || '',
            startSfxUrl: data.startSfxUrl || '',
            overSfxUrl: data.overSfxUrl || '',
            playlist: Array.isArray(data.playlist) ? data.playlist.map(x => ({ title: x.title || 'Traccia', url: x.url || '' })) : [],
            loopVolume: typeof data.loopVolume === 'number' ? Math.max(0, Math.min(1, data.loopVolume)) : 0.35,
            sfxVolume: typeof data.sfxVolume === 'number' ? Math.max(0, Math.min(1, data.sfxVolume)) : 1.0,
            // new lists and playlist source
            startList: Array.isArray(data.startList) ? data.startList : [],
            overList: Array.isArray(data.overList) ? data.overList : [],
            loopList: Array.isArray(data.loopList) ? data.loopList : [],
            playlistMode: data.playlistMode || 'all', // 'all' | 'selected' | 'manual'
            playlistSelectedIds: Array.isArray(data.playlistSelectedIds) ? data.playlistSelectedIds : [],
          });
        }
      } catch (e) {
        // ignore
      } finally {
        if (active) setLoading(false);
      }
    })();
    // fetch musicaTracks once for selection UI
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'musicaTracks'));
        const list = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
        if (!active) return;
        setMusicaTracks(list);
      } catch { /* ignore */ }
    })();
    return () => { active = false; };
  }, []);

  const handleAddTrack = () => {
    setConfig(c => ({ ...c, playlist: [...(c.playlist || []), { title: '', url: '' }] }));
  };
  const handleRemoveTrack = (idx) => {
    setConfig(c => ({ ...c, playlist: (c.playlist || []).filter((_, i) => i !== idx) }));
  };

  const handleUpload = async (file, kind) => {
    if (!file) return;
    try {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const path = `game/${kind}_${Date.now()}.${ext || 'bin'}`;
      const r = ref(storage, path);
      await uploadBytes(r, file);
      const url = await getDownloadURL(r);
      // set legacy single field and also append to corresponding list (enabled)
      setConfig(c => {
        const next = { ...c, [`${kind}Url`]: url };
        if (kind === 'startSfx') {
          next.startList = [...(c.startList || []), { title: file.name, url, enabled: true }];
        } else if (kind === 'overSfx') {
          next.overList = [...(c.overList || []), { title: file.name, url, enabled: true }];
        } else if (kind === 'loop') {
          next.loopList = [...(c.loopList || []), { title: file.name, url, enabled: true }];
        }
        return next;
      });
    } catch (e) {
      alert('Errore upload: ' + (e && e.message ? e.message : 'sconosciuto'));
    }
  };

  const isAudioFile = (f) => !!f && (
    f.type.startsWith('audio/') || /\.(wav|mp3|ogg|m4a|aac|oga|webm|mp4)$/i.test(f.name || '')
  );

  const save = async () => {
    try {
      setSaving(true);
      // Build resolved playlist according to selected mode so the public game doesn't need musicaTracks read permissions
      let playlistResolved = [];
      const mode = config.playlistMode || 'all';
      if (mode === 'manual') {
        playlistResolved = (config.playlist || []).filter(t => (t.url || '').trim()).map(t => ({ title: (t.title || 'Traccia').trim(), url: t.url.trim() }));
      } else if (mode === 'all') {
        try {
          const all = await getDocs(collection(db, 'musicaTracks'));
          const items = [];
          all.docs.forEach(d => {
            const td = d.data() || {};
            const url = td.fullAudioUrl || td.audioUrl || '';
            if (typeof url === 'string' && url.match(/\.(mp3|m4a|aac|wav|ogg|oga|webm|mp4)(\?.*)?$/i)) {
              items.push({ title: td.title || 'Traccia', url });
            }
          });
          playlistResolved = items;
        } catch { /* ignore */ }
      } else if (mode === 'selected') {
        const ids = Array.isArray(config.playlistSelectedIds) ? config.playlistSelectedIds : [];
        const items = [];
        for (const id of ids) {
          try {
            const ds = await getDoc(doc(db, 'musicaTracks', id));
            if (ds.exists()) {
              const td = ds.data() || {};
              const url = td.fullAudioUrl || td.audioUrl || '';
              if (typeof url === 'string' && url.match(/\.(mp3|m4a|aac|wav|ogg|oga|webm|mp4)(\?.*)?$/i)) {
                items.push({ title: td.title || 'Traccia', url });
              }
            }
          } catch { /* ignore */ }
        }
        playlistResolved = items;
      }
      setLastResolvedCount(Array.isArray(playlistResolved) ? playlistResolved.length : 0);
      const payload = {
        loopUrl: config.loopUrl || null,
        startSfxUrl: config.startSfxUrl || null,
        overSfxUrl: config.overSfxUrl || null,
        playlist: (config.playlist || []).filter(t => (t.url || '').trim()).map(t => ({ title: (t.title || 'Traccia').trim(), url: t.url.trim() })),
        // Denormalized playlist used by public game
        playlistResolved: Array.isArray(playlistResolved) ? playlistResolved : [],
        loopVolume: typeof config.loopVolume === 'number' ? Math.max(0, Math.min(1, config.loopVolume)) : 0.35,
        sfxVolume: typeof config.sfxVolume === 'number' ? Math.max(0, Math.min(1, config.sfxVolume)) : 1.0,
        startList: Array.isArray(config.startList) ? config.startList.filter(x => x && x.url).map(x => ({ title: x.title || 'Intro', url: x.url, enabled: !!x.enabled })) : [],
        overList: Array.isArray(config.overList) ? config.overList.filter(x => x && x.url).map(x => ({ title: x.title || 'GameOver', url: x.url, enabled: !!x.enabled })) : [],
        loopList: Array.isArray(config.loopList) ? config.loopList.filter(x => x && x.url).map(x => ({ title: x.title || 'Loop', url: x.url, enabled: !!x.enabled })) : [],
        playlistMode: config.playlistMode || 'all',
        playlistSelectedIds: Array.isArray(config.playlistSelectedIds) ? config.playlistSelectedIds : [],
        updatedAt: new Date(),
      };
      await setDoc(doc(db, 'site', 'gameMusic'), payload, { merge: true });
      alert(`Impostazioni salvate. Playlist risolta: ${Array.isArray(playlistResolved) ? playlistResolved.length : 0} brani.`);
    } catch (e) {
      alert('Errore salvataggio: ' + (e && e.message ? e.message : 'sconosciuto'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ color: '#bbb' }}>Carico impostazioni…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
        <label style={{ color: '#ffd700' }}>
          Loop di gioco (MP3/WAV/OGG)
        </label>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOverLoop(true); }}
          onDragLeave={() => setDragOverLoop(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverLoop(false);
            const f = e.dataTransfer.files && e.dataTransfer.files[0];
            if (!isAudioFile(f)) { alert('Trascina un file audio valido (WAV/MP3/OGG).'); return; }
            handleUpload(f, 'loop');
          }}
          style={{
            marginTop: 6,
            padding: 12,
            borderRadius: 10,
            border: `2px dashed ${dragOverLoop ? '#22c55e' : '#444'}`,
            background: dragOverLoop ? 'rgba(34,197,94,0.12)' : '#111',
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="url" placeholder="https://…/GameSong.mp3" value={config.loopUrl} onChange={e => setConfig(c => ({ ...c, loopUrl: e.target.value }))} style={{ flex: 1, minWidth: 240, padding: 8, borderRadius: 8, border: '1px solid #444', background: '#000', color: '#fff' }} />
            <input id="upload-loop" type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => handleUpload(e.target.files && e.target.files[0], 'loop')} />
            <button className="dash-small-btn dash-small-btn--primary" onClick={() => document.getElementById('upload-loop').click()}>Carica</button>
          </div>
          <div style={{ color:'#bbb', fontSize:12, marginTop:8 }}>Trascina qui un file .wav / .mp3 da usare come loop di gioco. Si avvia automaticamente quando il player è fermo.</div>
          {config.loopUrl && (
            <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:8 }}>
              <audio controls src={config.loopUrl} style={{ maxWidth: '100%' }} />
              <a className="dash-small-btn" href={config.loopUrl} target="_blank" rel="noreferrer">Apri</a>
            </div>
          )}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 12, marginTop: 10 }}>
            <div>
              <label style={{ color:'#ffd700', display:'flex', justifyContent:'space-between' }}>
                Volume Loop
                <span style={{ color:'#9fe8c4', fontSize:12 }}>{Math.round(((config.loopVolume ?? 0.35) * 100))}%</span>
              </label>
              <input type="range" min={0} max={100} value={Math.round(((config.loopVolume ?? 0.35) * 100))} onChange={e => setConfig(c => ({ ...c, loopVolume: Math.max(0, Math.min(1, Number(e.target.value) / 100)) }))} />
            </div>
            <div>
              <label style={{ color:'#ffd700', display:'flex', justifyContent:'space-between' }}>
                Volume SFX
                <span style={{ color:'#9fe8c4', fontSize:12 }}>{Math.round(((config.sfxVolume ?? 1.0) * 100))}%</span>
              </label>
              <input type="range" min={0} max={100} value={Math.round(((config.sfxVolume ?? 1.0) * 100))} onChange={e => setConfig(c => ({ ...c, sfxVolume: Math.max(0, Math.min(1, Number(e.target.value) / 100)) }))} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <label style={{ color: '#ffd700' }}>Musica Intro / SFX Start (WAV/MP3)</label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOverStart(true); }}
              onDragLeave={() => setDragOverStart(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverStart(false);
                const f = e.dataTransfer.files && e.dataTransfer.files[0];
                if (!isAudioFile(f)) { alert('Trascina un file audio valido (WAV/MP3/OGG).'); return; }
                handleUpload(f, 'startSfx');
              }}
              style={{
                marginTop: 6,
                padding: 12,
                borderRadius: 10,
                border: `2px dashed ${dragOverStart ? '#22c55e' : '#444'}`,
                background: dragOverStart ? 'rgba(34,197,94,0.12)' : '#111',
              }}
            >
              <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom: 8 }}>
                <input type="url" placeholder="https://…/GameSong_IntroStart.wav" value={config.startSfxUrl} onChange={e => setConfig(c => ({ ...c, startSfxUrl: e.target.value }))} style={{ flex: 1, minWidth: 200, padding: 8, borderRadius: 8, border: '1px solid #444', background: '#000', color: '#fff' }} />
                <input id="upload-start" type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => handleUpload(e.target.files && e.target.files[0], 'startSfx')} />
                <button className="dash-small-btn" onClick={() => document.getElementById('upload-start').click()}>Carica</button>
              </div>
              <div style={{ color:'#bbb', fontSize:12 }}>Trascina qui un file .wav / .mp3 per impostare la musica di intro. Verrà caricato e salvato automaticamente.</div>
              {config.startSfxUrl && (
                <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:8 }}>
                  <audio controls src={config.startSfxUrl} style={{ maxWidth: '100%' }} />
                  <a className="dash-small-btn" href={config.startSfxUrl} target="_blank" rel="noreferrer">Apri</a>
                </div>
              )}
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 260 }}>
            <label style={{ color: '#ffd700' }}>Musica Game Over (WAV/MP3)</label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOverOver(true); }}
              onDragLeave={() => setDragOverOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverOver(false);
                const f = e.dataTransfer.files && e.dataTransfer.files[0];
                if (!isAudioFile(f)) { alert('Trascina un file audio valido (WAV/MP3/OGG).'); return; }
                handleUpload(f, 'overSfx');
              }}
              style={{
                marginTop: 6,
                padding: 12,
                borderRadius: 10,
                border: `2px dashed ${dragOverOver ? '#22c55e' : '#444'}`,
                background: dragOverOver ? 'rgba(34,197,94,0.12)' : '#111',
              }}
            >
              <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom: 8 }}>
                <input type="url" placeholder="https://…/GameSong_GameOver.wav" value={config.overSfxUrl} onChange={e => setConfig(c => ({ ...c, overSfxUrl: e.target.value }))} style={{ flex: 1, minWidth: 200, padding: 8, borderRadius: 8, border: '1px solid #444', background: '#000', color: '#fff' }} />
                <input id="upload-over" type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => handleUpload(e.target.files && e.target.files[0], 'overSfx')} />
                <button className="dash-small-btn" onClick={() => document.getElementById('upload-over').click()}>Carica</button>
              </div>
              <div style={{ color:'#bbb', fontSize:12 }}>Trascina qui un file .wav / .mp3 per impostare la musica di Game Over. Verrà caricato e salvato automaticamente.</div>
              {config.overSfxUrl && (
                <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:8 }}>
                  <audio controls src={config.overSfxUrl} style={{ maxWidth: '100%' }} />
                  <a className="dash-small-btn" href={config.overSfxUrl} target="_blank" rel="noreferrer">Apri</a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <h4 className="dash-section-title" style={{ marginTop: 0 }}>Sorgente Playlist</h4>
        <p style={{ color:'#8aa', margin:'4px 0 8px' }}>Alla pressione di "Salva impostazioni" viene calcolata e salvata una playlist risolta (solo URL audio validi), usata direttamente dal gioco.</p>
        <div style={{ display:'flex', gap:16, flexWrap:'wrap', alignItems:'center' }}>
          <label style={{ color:'#ddd' }}>
            <input type="radio" name="plmode" checked={(config.playlistMode||'all')==='all'} onChange={()=>setConfig(c=>({ ...c, playlistMode:'all' }))} /> Tutti i brani (musicaTracks)
          </label>
          <label style={{ color:'#ddd' }}>
            <input type="radio" name="plmode" checked={(config.playlistMode||'all')==='selected'} onChange={()=>setConfig(c=>({ ...c, playlistMode:'selected' }))} /> Seleziona da musicaTracks
          </label>
          <label style={{ color:'#ddd' }}>
            <input type="radio" name="plmode" checked={(config.playlistMode||'all')==='manual'} onChange={()=>setConfig(c=>({ ...c, playlistMode:'manual' }))} /> Manuale (lista personalizzata)
          </label>
        </div>
        <div style={{ marginTop: 8, display:'flex', gap:8, alignItems:'center' }}>
          <button className="dash-small-btn" onClick={async () => {
            try {
              setComputingPreview(true);
              // compute preview based on current config and available musicaTracks
              const mode = config.playlistMode || 'all';
              let items = [];
              if (mode === 'manual') {
                items = (config.playlist || []).filter(t => (t.url || '').trim()).map(t => ({ title: (t.title || 'Traccia').trim(), url: t.url.trim() }));
              } else if (mode === 'all') {
                // use already fetched musicaTracks if available
                items = (musicaTracks || []).map(t => ({ title: t.title || 'Traccia', url: t.fullAudioUrl || t.audioUrl || '' })).filter(t => t.url && t.url.match(/\.(mp3|m4a|aac|wav|ogg|oga|webm|mp4)(\?.*)?$/i));
              } else if (mode === 'selected') {
                const ids = Array.isArray(config.playlistSelectedIds) ? config.playlistSelectedIds : [];
                items = (musicaTracks || []).filter(m => ids.includes(m.id)).map(t => ({ title: t.title || 'Traccia', url: t.fullAudioUrl || t.audioUrl || '' })).filter(t => t.url && t.url.match(/\.(mp3|m4a|aac|wav|ogg|oga|webm|mp4)(\?.*)?$/i));
              }
              setResolvedPreview(items);
            } finally { setComputingPreview(false); }
          }}>{computingPreview ? 'Ricalcolo…' : 'Ricalcola adesso'}</button>
          <div style={{ color:'#bbb', fontSize:13 }}>Anteprima playlist risolta (non salvata)</div>
        </div>
        {resolvedPreview && resolvedPreview.length > 0 && (
          <div style={{ marginTop:8, maxHeight:220, overflow:'auto', border:'1px dashed #333', borderRadius:8, padding:8 }}>
            <div style={{ color:'#9fe8c4', fontSize:13, marginBottom:6 }}>Anteprima - {resolvedPreview.length} brani</div>
            <ul style={{ listStyle:'none', padding:0, margin:0 }}>
              {resolvedPreview.map((t,i) => (
                <li key={`pv_${i}`} style={{ padding:'6px 4px', borderBottom: '1px solid rgba(255,255,255,0.03)', display:'flex', justifyContent:'space-between', gap:8 }}>
                  <span style={{ color:'#ddd', fontSize:13, overflow:'hidden', textOverflow:'ellipsis' }}>{t.title || (t.url||'')}</span>
                  <a href={t.url} target="_blank" rel="noreferrer" style={{ color:'#9fe8c4', fontSize:12 }}>Apri</a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {config.playlistMode === 'selected' && (
          <div style={{ marginTop:8, maxHeight: 280, overflow:'auto', border:'1px dashed #333', borderRadius:10, padding:8 }}>
            {musicaTracks.length === 0 ? (
              <div style={{ color:'#888' }}>Nessun brano in musicaTracks.</div>
            ) : (
              <ul style={{ listStyle:'none', padding:0, margin:0, display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {musicaTracks.map(t => (
                  <li key={t.id} style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <input type="checkbox" checked={(config.playlistSelectedIds||[]).includes(t.id)} onChange={e => {
                      const on = e.target.checked;
                      setConfig(c => {
                        const cur = new Set(c.playlistSelectedIds || []);
                        if (on) cur.add(t.id); else cur.delete(t.id);
                        return { ...c, playlistSelectedIds: Array.from(cur) };
                      });
                    }} />
                    <span style={{ color:'#ddd', fontSize:13 }}>{t.title || 'Senza titolo'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      {lastResolvedCount !== null && (
        <div style={{ color:'#9fe8c4', fontSize:12, marginTop:6 }}>
          Playlist risolta (ultimo salvataggio): {lastResolvedCount} brani
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <h4 className="dash-section-title" style={{ marginTop: 0 }}>Tracce Intro (Start)</h4>
        {(config.startList||[]).map((it, idx) => (
          <div key={`st_${idx}`} style={{ display:'grid', gridTemplateColumns:'auto 1fr 2fr auto', gap:8, alignItems:'center', marginBottom:8 }}>
            <label style={{ color:'#bbb', fontSize:12 }}>
              <input type="checkbox" checked={!!it.enabled} onChange={e=>setConfig(c=>({ ...c, startList: c.startList.map((x,i)=> i===idx? { ...x, enabled: e.target.checked } : x) }))} /> Abilita
            </label>
            <input type="text" placeholder="Titolo" value={it.title||''} onChange={e=>setConfig(c=>({ ...c, startList: c.startList.map((x,i)=> i===idx? { ...x, title: e.target.value } : x) }))} style={{ padding:8, borderRadius:8, border:'1px solid #444', background:'#111', color:'#fff' }} />
            <input type="url" placeholder="https://…/intro.wav" value={it.url||''} onChange={e=>setConfig(c=>({ ...c, startList: c.startList.map((x,i)=> i===idx? { ...x, url: e.target.value } : x) }))} style={{ padding:8, borderRadius:8, border:'1px solid #444', background:'#111', color:'#fff' }} />
            <button className="dash-small-btn dash-small-btn--danger" onClick={()=>setConfig(c=>({ ...c, startList: c.startList.filter((_,i)=>i!==idx) }))}>Rimuovi</button>
          </div>
        ))}
        <button className="dash-small-btn" onClick={()=>setConfig(c=>({ ...c, startList: [...(c.startList||[]), { title:'', url:'', enabled:true }] }))}>+ Aggiungi traccia intro</button>
      </div>

      <div style={{ marginTop: 16 }}>
        <h4 className="dash-section-title" style={{ marginTop: 0 }}>Tracce Loop</h4>
        {(config.loopList||[]).map((it, idx) => (
          <div key={`lp_${idx}`} style={{ display:'grid', gridTemplateColumns:'auto 1fr 2fr auto', gap:8, alignItems:'center', marginBottom:8 }}>
            <label style={{ color:'#bbb', fontSize:12 }}>
              <input type="checkbox" checked={!!it.enabled} onChange={e=>setConfig(c=>({ ...c, loopList: c.loopList.map((x,i)=> i===idx? { ...x, enabled: e.target.checked } : x) }))} /> Abilita
            </label>
            <input type="text" placeholder="Titolo" value={it.title||''} onChange={e=>setConfig(c=>({ ...c, loopList: c.loopList.map((x,i)=> i===idx? { ...x, title: e.target.value } : x) }))} style={{ padding:8, borderRadius:8, border:'1px solid #444', background:'#111', color:'#fff' }} />
            <input type="url" placeholder="https://…/loop.mp3" value={it.url||''} onChange={e=>setConfig(c=>({ ...c, loopList: c.loopList.map((x,i)=> i===idx? { ...x, url: e.target.value } : x) }))} style={{ padding:8, borderRadius:8, border:'1px solid #444', background:'#111', color:'#fff' }} />
            <button className="dash-small-btn dash-small-btn--danger" onClick={()=>setConfig(c=>({ ...c, loopList: c.loopList.filter((_,i)=>i!==idx) }))}>Rimuovi</button>
          </div>
        ))}
        <button className="dash-small-btn" onClick={()=>setConfig(c=>({ ...c, loopList: [...(c.loopList||[]), { title:'', url:'', enabled:true }] }))}>+ Aggiungi traccia loop</button>
      </div>

      <div style={{ marginTop: 16 }}>
        <h4 className="dash-section-title" style={{ marginTop: 0 }}>Tracce Game Over</h4>
        {(config.overList||[]).map((it, idx) => (
          <div key={`ov_${idx}`} style={{ display:'grid', gridTemplateColumns:'auto 1fr 2fr auto', gap:8, alignItems:'center', marginBottom:8 }}>
            <label style={{ color:'#bbb', fontSize:12 }}>
              <input type="checkbox" checked={!!it.enabled} onChange={e=>setConfig(c=>({ ...c, overList: c.overList.map((x,i)=> i===idx? { ...x, enabled: e.target.checked } : x) }))} /> Abilita
            </label>
            <input type="text" placeholder="Titolo" value={it.title||''} onChange={e=>setConfig(c=>({ ...c, overList: c.overList.map((x,i)=> i===idx? { ...x, title: e.target.value } : x) }))} style={{ padding:8, borderRadius:8, border:'1px solid #444', background:'#111', color:'#fff' }} />
            <input type="url" placeholder="https://…/over.wav" value={it.url||''} onChange={e=>setConfig(c=>({ ...c, overList: c.overList.map((x,i)=> i===idx? { ...x, url: e.target.value } : x) }))} style={{ padding:8, borderRadius:8, border:'1px solid #444', background:'#111', color:'#fff' }} />
            <button className="dash-small-btn dash-small-btn--danger" onClick={()=>setConfig(c=>({ ...c, overList: c.overList.filter((_,i)=>i!==idx) }))}>Rimuovi</button>
          </div>
        ))}
        <button className="dash-small-btn" onClick={()=>setConfig(c=>({ ...c, overList: [...(c.overList||[]), { title:'', url:'', enabled:true }] }))}>+ Aggiungi traccia game over</button>
      </div>
      {(config.playlistMode || 'all') === 'manual' && (
        <div style={{ marginTop: 16 }}>
          <h4 className="dash-section-title" style={{ marginTop: 0 }}>Playlist (manuale)</h4>
          <p style={{ color: '#bbb', marginTop: 0 }}>Se impostata, il player in alto userà questi brani (titolo + URL audio). Se vuota, proverà a usare la playlist dell'artista (se sei entrato da una pagina artista) o i parametri URL <code>?bg</code>, <code>?bg2</code>.</p>
          {(config.playlist || []).map((t, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <input type="text" placeholder="Titolo" value={t.title} onChange={e => setConfig(c => ({ ...c, playlist: c.playlist.map((x, i) => i === idx ? { ...x, title: e.target.value } : x) }))} style={{ padding: 8, borderRadius: 8, border: '1px solid #444', background: '#111', color: '#fff' }} />
              <input type="url" placeholder="https://…/brano.mp3" value={t.url} onChange={e => setConfig(c => ({ ...c, playlist: c.playlist.map((x, i) => i === idx ? { ...x, url: e.target.value } : x) }))} style={{ padding: 8, borderRadius: 8, border: '1px solid #444', background: '#111', color: '#fff' }} />
              <button className="dash-small-btn dash-small-btn--danger" onClick={() => handleRemoveTrack(idx)}>Rimuovi</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="dash-small-btn" onClick={handleAddTrack}>+ Aggiungi brano</button>
          </div>
        </div>
      )}

      <div>
        <button className="dash-btn dash-btn--primary" disabled={saving} onClick={save}>{saving ? 'Salvataggio…' : 'Salva impostazioni'}</button>
      </div>

      <div style={{ color: '#888', fontSize: 12 }}>
        Suggerimento: per i file ospitati su Firebase Storage, incolla direttamente l'URL pubblico oppure usa i pulsanti Carica.
      </div>
    </div>
  );
}
