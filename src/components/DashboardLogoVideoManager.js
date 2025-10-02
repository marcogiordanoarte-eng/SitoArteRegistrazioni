import React, { useState, useRef } from 'react';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

// Gestione video dedicato al LOGO (diverso dal video studio).
// Salva campo Firestore: logoVideoUrl in document site/config
export default function DashboardLogoVideoManager({ onBack }) {
  const [videoUrl, setVideoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const fileInputRef = useRef();

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file && file.type.startsWith('video')) uploadVideo(file);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file && file.type.startsWith('video')) uploadVideo(file);
  };
  const uploadVideo = (file) => {
    setUploading(true);
    const storage = getStorage();
    const storageRef = ref(storage, `logoVideos/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(storageRef, file);
    task.on('state_changed', (snap) => {
      setProgress((snap.bytesTransferred / snap.totalBytes) * 100);
    }, (err) => {
      alert('Errore upload: ' + err.message);
      setUploading(false);
    }, () => {
      getDownloadURL(task.snapshot.ref).then(u => { setVideoUrl(u); setUploading(false); });
    });
  };
  const handleSave = async () => {
    if (!videoUrl) return;
    try {
      setSaving(true);
      const db = getFirestore();
      await setDoc(doc(db, 'site', 'config'), { logoVideoUrl: videoUrl }, { merge: true });
      alert('Video Logo salvato.');
    } catch (e) { alert('Errore salvataggio: ' + e.message); }
    finally { setSaving(false); }
  };
  return (
    <div className="dashboard-video-manager">
      <h2 style={{ marginTop:0 }}>Video Logo</h2>
      <p style={{ opacity:.85, lineHeight:1.4 }}>Questo video verrà mostrato quando l'utente clicca sul logo / disco animato. È separato dal "Video Presentazione Studio" richiamato dal pulsante Arte Registrazioni.</p>
      <div onDrop={handleDrop} onDragOver={(e)=>e.preventDefault()} style={{ border:'2px dashed #666', padding:32, borderRadius:14, marginBottom:16 }}>
        <p style={{ marginTop:0 }}>Trascina qui il video oppure <button type="button" onClick={()=>fileInputRef.current.click()}>seleziona file</button></p>
        <input ref={fileInputRef} type="file" accept="video/*" style={{ display:'none' }} onChange={handleFileChange} />
        {uploading && <div style={{ marginTop:12 }}>Caricamento: {progress.toFixed(0)}%</div>}
        {videoUrl && <video src={videoUrl} controls width={360} style={{ marginTop:16, borderRadius:8, maxWidth:'100%' }} />}
      </div>
      <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
        <button onClick={()=>{ if(videoUrl) setShowOverlay(true); }} disabled={!videoUrl} className="dash-small-btn">Anteprima Overlay</button>
        <button onClick={handleSave} disabled={!videoUrl || saving} className="dash-small-btn dash-small-btn--primary">{saving ? 'Salvataggio…' : 'Salva'}</button>
        <button onClick={onBack} className="dash-small-btn">Torna al menu</button>
      </div>
      {showOverlay && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }} onClick={()=>setShowOverlay(false)}>
          <video src={videoUrl} autoPlay controls loop playsInline style={{ maxWidth:'80vw', maxHeight:'80vh' }} onClick={(e)=>e.stopPropagation()} />
          <button onClick={()=>setShowOverlay(false)} style={{ position:'absolute', top:24, right:32, fontSize:28, background:'none', border:'none', color:'#fff', cursor:'pointer' }}>×</button>
        </div>
      )}
    </div>
  );
}
