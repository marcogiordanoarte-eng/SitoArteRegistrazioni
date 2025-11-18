import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { auth, rtdb, storage } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ref as dbRef, push, set } from 'firebase/database';
import { ref as stRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { httpsCallable, getFunctions } from 'firebase/functions';

export default function RealReels() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [videoFile, setVideoFile] = useState(null);
  const [caption, setCaption] = useState('');
  const [error, setError] = useState('');
  const videoEl = useRef(null);
  const fns = useMemo(() => getFunctions(), []);
  const moderateText = useMemo(() => httpsCallable(fns, 'moderateText'), [fns]);
  const moderateImage = useMemo(() => httpsCallable(fns, 'moderateImage'), [fns]);
  const moderateVideo = useMemo(() => httpsCallable(fns, 'moderateVideo'), [fns]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u || null); setLoading(false); });
    return () => unsub();
  }, []);

  // Load selected video into hidden <video> to capture a frame for thumbnail
  useEffect(() => {
    const v = videoEl.current;
    if (!v || !videoFile) return;
    const url = URL.createObjectURL(videoFile);
    try {
      v.src = url;
      v.load();
    } catch {}
    return () => { try { URL.revokeObjectURL(url); } catch {} };
  }, [videoFile]);

  async function captureThumb(dataUrlWanted = 'image/jpeg', quality = 0.8) {
    return new Promise((resolve, reject) => {
      const v = videoEl.current;
      if (!v) return resolve(null);
      const canvas = document.createElement('canvas');
      const w = v.videoWidth || 720; const h = v.videoHeight || 1280;
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      try { ctx.drawImage(v, 0, 0, w, h); const url = canvas.toDataURL(dataUrlWanted, quality); resolve(url); } catch(e) { resolve(null); }
    });
  }

  async function handlePublish(e) {
    e.preventDefault(); setError('');
    if (!user) { setError('Devi essere autenticato'); return; }
    if (!videoFile) { setError('Seleziona un video'); return; }
    // Moderate caption
    try {
      const cap = (caption || '').slice(0, 500);
      if (cap) {
        const r = await moderateText({ text: cap });
        if (!r.data?.allow) { setError('Testo non consentito (policy)'); return; }
      }
    } catch {}
    // Generate thumbnail (first frame)
    let thumbUrl = null;
    try {
      const dataUrl = await captureThumb();
      if (dataUrl) {
        const res = await fetch(dataUrl); const blob = await res.blob();
        const key = push(dbRef(rtdb, 'posts')).key;
        const path = `social/${user.uid}/${key}/thumb_${Date.now()}.jpg`;
        const sref = stRef(storage, path);
        await uploadBytes(sref, blob, { contentType: 'image/jpeg' });
        thumbUrl = await getDownloadURL(sref);
        // Moderate image
        try {
          const mr = await moderateImage({ storagePath: path });
          if (!mr.data?.allow) { setError('Video bloccato dalla policy (thumb)'); return; }
        } catch {}
      }
    } catch {}
    // Upload video
    try {
      const key = push(dbRef(rtdb, 'posts')).key;
      const path = `social/${user.uid}/${key}/video_${Date.now()}.mp4`;
      const sref = stRef(storage, path);
      await uploadBytes(sref, videoFile, { contentType: videoFile.type || 'video/mp4' });
      const dl = await getDownloadURL(sref);
      // Moderate video content (explicit frames)
      try {
        const mv = await moderateVideo({ storagePath: path, threshold: 0.5 });
        if (!mv.data?.allow) {
          // Delete the uploaded video if blocked
          try { await deleteObject(sref); } catch {}
          setError('Video bloccato dalla policy (contenuti espliciti)');
          return;
        }
      } catch (e) {
        // If moderation pending, allow but note it
      }
      const post = {
        uid: user.uid,
        caption: (caption || '').slice(0, 500),
        mediaType: 'reel',
        videoUrl: dl,
        thumbUrl: thumbUrl || null,
        storagePath: path,
        createdAt: Date.now(),
        viewsCount: 0
      };
      await set(dbRef(rtdb, `posts/${key}`), post);
      setVideoFile(null); setCaption(''); alert('Reel pubblicato!');
    } catch (e) {
      console.error(e); setError('Upload video fallito');
    }
  }

  if (loading) return <div style={{ color:'#ffd700', textAlign:'center', marginTop:80 }}>Caricamento…</div>;
  if (!user) return (
    <div className="publicsite-bg">
      <Link to="/sounds" className="dash-badge">Social</Link>
      <div className="container" style={{ maxWidth: 900, margin:'24px auto' }}>
        <h1 className="publicsite-title" style={{ textAlign:'center' }}>Real Reels</h1>
        <p className="publicsite-desc" style={{ textAlign:'center' }}>Accedi su /sounds per pubblicare i tuoi Real Reels. Solo video umani reali, no AI manipolati – usiamo IA per check, violazioni bannate.</p>
      </div>
    </div>
  );

  return (
    <div className="publicsite-bg">
      <Link to="/" className="dash-badge">Home</Link>
      <div className="container" style={{ maxWidth: 900, margin:'16px auto' }}>
        <h1 className="publicsite-title">Real Reels</h1>
        <p className="publicsite-desc">Solo video umani reali, no AI manipolati – usiamo IA per check (Vision API su thumbnail/frames); violazioni bannate.</p>
        <form onSubmit={handlePublish} className="detail-panel" style={{ padding:16, marginTop:12 }}>
          <label className="field"><span>Video</span><input type="file" accept="video/*" onChange={e=>setVideoFile(e.target.files?.[0] || null)} /></label>
          <label className="field"><span did="caption">Testo</span><textarea value={caption} onChange={e=>setCaption(e.target.value)} rows={3} /></label>
          {error ? <div style={{ color:'#f87171', marginTop:8 }}>{error}</div> : null}
          <div style={{ marginTop:12 }}><button className="btn btn-primary" type="submit">Pubblica Reel</button></div>
        </form>
        <video ref={videoEl} style={{ width:1, height:1, opacity:0, position:'absolute', pointerEvents:'none' }} controls={false} preload="metadata" />
      </div>
    </div>
  );
}
