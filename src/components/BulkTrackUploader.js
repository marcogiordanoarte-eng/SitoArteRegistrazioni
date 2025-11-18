import React, { useState } from 'react';
import { parseBlob } from 'music-metadata-browser';
import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// SEMPLICE CARICATORE MASSIVO
// Obiettivo: trascina/incolla molti file audio (MP3/AAC/WAV) e ottieni un array di { title, streamAudioUrl }
// Nessun codice da inserire manualmente: titolo = filename senza estensione.
// Upload SEQUENZIALE per ridurre errori CORS / retry alti.
// Genera callback onComplete(lista) per salvare in ArtistPageEditable.

function guessExtType(file) {
  const n = file.name.toLowerCase();
  if (n.endsWith('.mp3')) return { ext:'mp3', ct:'audio/mpeg' };
  if (n.endsWith('.m4a')) return { ext:'m4a', ct:'audio/mp4' };
  if (n.endsWith('.aac')) return { ext:'aac', ct:'audio/aac' };
  if (n.endsWith('.wav')) return { ext:'wav', ct:'audio/wav' };
  if (n.endsWith('.ogg')) return { ext:'ogg', ct:'audio/ogg' };
  return { ext:'mp3', ct:'audio/mpeg' };
}

export default function BulkTrackUploader({ artistName='artista', onComplete }) {
  const [files, setFiles] = useState([]);
  const [progress, setProgress] = useState({ done:0, total:0, currentPct:0 });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);

  function handleSelect(list) {
    const filtered = list.filter(f => /\.(mp3|m4a|aac|wav|ogg)$/i.test(f.name));
    setFiles(filtered);
    setProgress({ done:0, total: filtered.length, currentPct:0 });
    setResults([]);
  }

  async function startUpload() {
    if (!files.length || uploading) return;
    setUploading(true); setError(null); setResults([]);
    const out = [];
    for (let i=0;i<files.length;i++) {
      const f = files[i];
      try {
        const { ext, ct } = guessExtType(f);
        let base = f.name.replace(/\.[^.]+$/, '');
        // Estrai metadati (titolo, ISRC) se presenti nei tag
        try {
          const mm = await parseBlob(f);
          const t = (mm.common && mm.common.title) ? String(mm.common.title).trim() : '';
          if (t) base = t;
          const isrcTag = Array.isArray(mm.common?.isrc) ? mm.common.isrc[0] : (mm.common?.isrc || null);
          if (isrcTag) {
            // Normalizza form: con o senza trattini, upper-case
            const norm = String(isrcTag).toUpperCase().replace(/[^A-Z0-9-]/g,'');
            f.__parsedIsrc = norm;
          }
        } catch (e) {
          // metadati assenti o non leggibili → ignora
        }
        const safeArtist = artistName.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,40)||'artista';
        const safeTitle = base.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,60)||'traccia';
        const path = `bulk/${safeArtist}/${Date.now()}_${i}_${safeTitle}.${ext}`;
        const r = ref(storage, path);
        // Upload grezzo (simple) per evitare preflight complicati
        await uploadBytes(r, f, { contentType: ct });
        const url = await getDownloadURL(r);
        out.push({ title: base, streamAudioUrl: url, isrc: f.__parsedIsrc || undefined });
      } catch (e) {
        console.warn('Errore upload bulk file', f.name, e);
        setError(e.message || String(e));
      }
      setProgress(p => ({ ...p, done: i+1, currentPct: 0 }));
    }
    setResults(out);
    setUploading(false);
    if (onComplete) onComplete(out);
  }

  return (
    <div style={{ width:'100%', maxWidth:700, margin:'24px auto', background:'#121212', border:'1px solid #333', borderRadius:16, padding:18 }}>
      <h3 style={{ color:'#ffd700', textAlign:'center', marginTop:0 }}>Caricamento Massivo Tracce (SEMPLICE)</h3>
      <div
        onDragOver={e=>e.preventDefault()}
        onDrop={e=>{ e.preventDefault(); const list = Array.from(e.dataTransfer.files||[]); handleSelect(list); }}
        style={{ border:'2px dashed #ffd700', borderRadius:12, padding:24, textAlign:'center', background:'#181818', cursor:'pointer' }}
        onClick={()=>{ const inp=document.createElement('input'); inp.type='file'; inp.accept='audio/*,.mp3,.m4a,.aac,.wav,.ogg'; inp.multiple=true; inp.onchange=()=>{ handleSelect(Array.from(inp.files||[])); }; inp.click(); }}
      >
        {files.length === 0 ? (
          <span style={{ color:'#ffd700' }}>Trascina o clicca per scegliere molte tracce audio</span>
        ) : (
          <span style={{ color:'#ffd700' }}>{files.length} file pronti</span>
        )}
      </div>
      {files.length > 0 && !uploading && (
        <button onClick={startUpload} style={{ marginTop:12, background:'#ffd700', color:'#222', border:'none', borderRadius:8, padding:'10px 18px', fontWeight:700, cursor:'pointer' }}>Avvia Upload Sequenziale</button>
      )}
      {uploading && (
        <div style={{ marginTop:12, color:'#ffd700' }}>Caricamento... {progress.done}/{progress.total}</div>
      )}
      {error && (
        <div style={{ marginTop:12, color:'#ff6666' }}>Errore: {error}</div>
      )}
      {results.length > 0 && (
        <div style={{ marginTop:16 }}>
          <div style={{ color:'#70bd89', fontSize:13 }}>Completato: {results.length} tracce</div>
          <ul style={{ listStyle:'none', padding:0, marginTop:8, maxHeight:180, overflowY:'auto' }}>
            {results.map((r,i)=>(
              <li key={i} style={{ fontSize:12, color:'#ffd700', display:'flex', justifyContent:'space-between', gap:8, alignItems:'center' }}>
                <span>{r.title}{r.isrc ? <em style={{ color:'#9ad1ff', marginLeft:8, fontStyle:'normal', fontSize:11 }}>ISRC: {r.isrc}</em> : null}</span>
                <a href={r.streamAudioUrl} target='_blank' rel='noopener noreferrer' style={{ color:'#888' }}>aprI</a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div style={{ marginTop:16, fontSize:11, color:'#999', lineHeight:1.4 }}>
        Salva l'artista dopo l'upload: le tracce saranno incluse automaticamente (solo titolo + streamAudioUrl). Puoi aggiungere metadati in seguito se necessario.
      </div>
    </div>
  );
}
