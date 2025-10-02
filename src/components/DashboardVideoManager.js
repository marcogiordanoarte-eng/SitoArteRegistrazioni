import React, { useState, useRef } from "react";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const DashboardVideoManager = ({ onBack }) => {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!videoUrl) return;
    setSaving(true);
    try {
      const db = getFirestore();
      await setDoc(doc(db, "site", "config"), { studioVideoUrl: videoUrl }, { merge: true });
      alert("Video salvato!");
    } catch (e) {
      alert("Errore salvataggio: " + e.message);
    }
    setSaving(false);
  };
  const [videoUrl, setVideoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showOverlay, setShowOverlay] = useState(false);
  const fileInputRef = useRef();

  const handleDrop = async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("video")) {
      uploadVideo(file);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith("video")) {
      uploadVideo(file);
    }
  };

  const uploadVideo = (file) => {
    setUploading(true);
    const storage = getStorage();
    const storageRef = ref(storage, `studioVideos/${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const percent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setProgress(percent);
      },
      (error) => {
        setUploading(false);
        alert("Errore upload: " + error.message);
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then((url) => {
          setVideoUrl(url);
          setUploading(false);
        });
      }
    );
  };

  const handleLogoClick = () => {
    if (videoUrl) setShowOverlay(true);
  };

  const handleOverlayClose = () => {
    setShowOverlay(false);
  };

  return (
    <div className="dashboard-video-manager">
      <h2>Video Presentazione Studio</h2>
      <div
        className="video-drop-area"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        style={{ border: "2px dashed #888", padding: 32, borderRadius: 12, marginBottom: 16 }}
      >
        <p>Trascina qui il video oppure <button onClick={() => fileInputRef.current.click()}>seleziona file</button></p>
        <input
          type="file"
          accept="video/*"
          style={{ display: "none" }}
          ref={fileInputRef}
          onChange={handleFileChange}
        />
        {uploading && <div>Caricamento: {progress.toFixed(0)}%</div>}
        {videoUrl && <video src={videoUrl} controls width={320} style={{ marginTop: 16 }} />}
      </div>
      <div style={{ margin: "24px 0", display: "flex", gap: 16 }}>
        <button className="logo-trigger" onClick={handleLogoClick} disabled={!videoUrl}>
          Attiva Overlay da Logo/Disco
        </button>
        <button onClick={handleSave} disabled={!videoUrl || saving} style={{ background: '#ffd700', color: '#222', fontWeight: 700, borderRadius: 8, padding: '8px 18px', border: 'none' }}>
          {saving ? "Salvataggio…" : "Salva"}
        </button>
      </div>
      {showOverlay && (
        <div className="video-overlay" style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <video src={videoUrl} controls autoPlay style={{ maxWidth: "80vw", maxHeight: "80vh" }} />
          <button onClick={handleOverlayClose} style={{ position: "absolute", top: 32, right: 32, fontSize: 24 }}>✕</button>
        </div>
      )}
      <button onClick={onBack} style={{ marginTop: 32 }}>Torna al menu</button>
    </div>
  );
};

export default DashboardVideoManager;
