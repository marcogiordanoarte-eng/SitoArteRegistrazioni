import React, { useState, useEffect } from "react";
import ArtistPageEditable from "./ArtistPageEditable";
import { useAuth } from './AuthContext';
import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from "./firebase";
import { useNavigate } from 'react-router-dom';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
// NOTE: removed backfillCreatedAt / normalize order buttons (obsolete)
import BuyMusicAdmin from './BuyMusicAdmin';
import DashboardTracks from './DashboardTracks';
import PodcastAdmin from './PodcastAdmin';
import CountdownAdmin from './CountdownAdmin';
import DashboardVideoManager from './DashboardVideoManager';
import DashboardLogoVideoManager from './DashboardLogoVideoManager';
import ArtistTracksManager from './ArtistTracksManager';
import { auth, resetPassword } from './firebase';
import { createUserWithEmailAndPassword, fetchSignInMethodsForEmail } from 'firebase/auth';

function Dashboard() {
  const { logout, user, changeCurrentUserPassword } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState("list"); // aggiunto 'videoLogo'
  const [podItems, setPodItems] = useState([]);
  const [podUploading, setPodUploading] = useState(false);
  const [cdItems, setCdItems] = useState([]);
  const [cdUploading, setCdUploading] = useState(false);
  
  const [festivalUploading, setFestivalUploading] = useState(false);
  const [festivalPdfUrl, setFestivalPdfUrl] = useState('');
  const [festivalTitle, setFestivalTitle] = useState('');
  const [festivalDescription, setFestivalDescription] = useState('');
  const [festivalBandoPdfUrl, setFestivalBandoPdfUrl] = useState('');
  const [festivalSpecifichePdfUrl, setFestivalSpecifichePdfUrl] = useState('');
  const [festivalPaymentLinkUrl, setFestivalPaymentLinkUrl] = useState('');
  const [festivalPaymentDescription, setFestivalPaymentDescription] = useState('');
  const [festivalVideoUrl, setFestivalVideoUrl] = useState('');
  const [festivalVideoUploading, setFestivalVideoUploading] = useState(false);
  const [soundsLogoUrl, setSoundsLogoUrl] = useState('');
  const [brandingUploading, setBrandingUploading] = useState(false);
  const [buyIntroIt, setBuyIntroIt] = useState('');
  const [buyIntroEn, setBuyIntroEn] = useState('');
  const [homeVideoUrl, setHomeVideoUrl] = useState('');
  const [homeVideoUploading, setHomeVideoUploading] = useState(false);
  const [artists, setArtists] = useState([]);
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [artistLoginCode, setArtistLoginCode] = useState('');
  const [artistEmail, setArtistEmail] = useState('');
  const [artistPassword, setArtistPassword] = useState('');
  const [creatingArtistUser, setCreatingArtistUser] = useState(false);
  const [artistAuthExists, setArtistAuthExists] = useState(false);
  const [checkingArtistEmail, setCheckingArtistEmail] = useState(false);
  const [artistEmailStatusMsg, setArtistEmailStatusMsg] = useState('');
  const [autoSendReset, setAutoSendReset] = useState(true);
  const [artistActionMessage, setArtistActionMessage] = useState('');
  const [artistActionError, setArtistActionError] = useState('');
  const [adminPwNew, setAdminPwNew] = useState('');
  const [adminPwConfirm, setAdminPwConfirm] = useState('');
  const [adminPwMsg, setAdminPwMsg] = useState('');
  const [adminPwErr, setAdminPwErr] = useState('');
  // removed dedupe logic

  // Helper: normalizza nome per rilevare duplicati
  const normalizeName = (s) => (s || '').toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

  // Sincronizza artisti da Firestore in tempo reale
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "artisti"), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Ordina in memoria: prima per 'order' (asc), poi per 'createdAt' (asc)
      list.sort((a, b) => {
        const ao = Number(a.order ?? Number.POSITIVE_INFINITY);
        const bo = Number(b.order ?? Number.POSITIVE_INFINITY);
        if (ao !== bo) return ao - bo;
        const ams = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : Number.MAX_SAFE_INTEGER);
        const bms = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : Number.MAX_SAFE_INTEGER);
        return ams - bms;
      });
      setArtists(list);
    });
    return () => unsub();
  }, []);


  // (Removed unused buyGenres state/effect; BuyMusicAdmin manages its own data)

  // Carica config sito (festivalPdfUrl)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'site', 'config'), (snap) => {
      const data = snap.exists() ? snap.data() : {};
      setFestivalPdfUrl(data?.festivalPdfUrl || '');
      setFestivalTitle(data?.festivalTitle || '');
      setFestivalDescription(data?.festivalDescription || '');
      setFestivalBandoPdfUrl(data?.festivalBandoPdfUrl || '');
      setFestivalSpecifichePdfUrl(data?.festivalSpecifichePdfUrl || '');
      setFestivalPaymentLinkUrl(data?.festivalPaymentLinkUrl || '');
      setFestivalPaymentDescription(data?.festivalPaymentDescription || '');
      setFestivalVideoUrl(data?.festivalVideoUrl || '');
      setSoundsLogoUrl(data?.soundsLogoUrl || '');
      setBuyIntroIt(data?.buyIntroIt || '');
  setBuyIntroEn(data?.buyIntroEn || '');
  setHomeVideoUrl(data?.homeVideoUrl || '');
    });
    return () => unsub();
  }, []);

  // Carica Podcast in tempo reale quando vista attiva
  useEffect(() => {
    if (view !== 'podcast') return;
    const unsub = onSnapshot(collection(db, 'podcasts'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const ao = Number(a.order ?? Number.POSITIVE_INFINITY);
        const bo = Number(b.order ?? Number.POSITIVE_INFINITY);
        if (ao !== bo) return ao - bo;
        const ams = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : Number.MAX_SAFE_INTEGER);
        const bms = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : Number.MAX_SAFE_INTEGER);
        return ams - bms;
      });
      setPodItems(list);
    });
    return () => unsub();
  }, [view]);

  // Carica Countdown in tempo reale quando vista attiva
  useEffect(() => {
    if (view !== 'countdown') return;
    const unsub = onSnapshot(collection(db, 'countdowns'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const ao = Number(a.order ?? Number.POSITIVE_INFINITY);
        const bo = Number(b.order ?? Number.POSITIVE_INFINITY);
        if (ao !== bo) return ao - bo;
        const ams = getMillis(a.createdAt);
        const bms = getMillis(b.createdAt);
        return ams - bms;
      });
      setCdItems(list);
    });
    return () => unsub();
  }, [view]);

  // Handler per aggiungere un nuovo artista
  const handleAddArtist = async (artist) => {
    // Guard: blocca creazione se esiste già un artista con nome normalizzato o email identica
    const nName = normalizeName(artist.nome || artist.name || '');
    if (nName) {
      const dupByName = artists.find(a => normalizeName(a.nome || a.name) === nName);
      if (dupByName) {
        alert(`Esiste già un artista con nome simile: "${dupByName.nome}". Modifica quello esistente invece di crearne uno nuovo.`);
        return;
      }
    }
    const emailToCheck = (artist.loginEmail || artist.email || '').trim().toLowerCase();
    if (emailToCheck) {
      const dupByEmail = artists.find(a => ((a.loginEmail || a.email || '').trim().toLowerCase()) === emailToCheck);
      if (dupByEmail) {
        alert(`Questa email è già associata all'artista "${dupByEmail.nome}". Evito di creare un duplicato.`);
        return;
      }
    }
    await addDoc(collection(db, "artisti"), { ...artist, normalizedName: nName || null, createdAt: serverTimestamp() });
    setView("list");
  };

  // Handler per selezionare artista da gestire
  const handleSelectArtist = (artist) => {
    setSelectedArtist(artist);
    setArtistLoginCode((artist && artist.loginCode) || '');
    setArtistEmail((artist && (artist.loginEmail || artist.email)) || '');
    setArtistPassword('');
    setView("edit");
  };

  // Effettua lookup su Auth quando cambia l'email (debounce leggero)
  useEffect(() => {
    let active = true;
    if (!artistEmail || !artistEmail.includes('@')) {
      setArtistAuthExists(false);
      setArtistEmailStatusMsg('');
      return;
    }
    setCheckingArtistEmail(true);
    const t = setTimeout(async () => {
      try {
        const methods = await fetchSignInMethodsForEmail(auth, artistEmail.trim());
        if (!active) return;
        const exists = methods && methods.length > 0;
        setArtistAuthExists(exists);
        setArtistEmailStatusMsg(exists ? 'Utente Auth trovato' : 'Nessun utente Auth per questa email');
      } catch (e) {
        if (!active) return;
        setArtistAuthExists(false);
        setArtistEmailStatusMsg(e.message || 'Errore verifica email');
      } finally {
        if (active) setCheckingArtistEmail(false);
      }
    }, 500);
    return () => { active = false; clearTimeout(t); };
  }, [artistEmail]);

  // Handler per aggiornare artista
  const handleUpdateArtist = async (updatedArtist) => {
    const ref = doc(db, "artisti", updatedArtist.id);
    // Preserva createdAt esistente se presente nell'oggetto selezionato
    const payload = { ...updatedArtist };
    const existing = artists.find(a => a.id === updatedArtist.id);
    if (existing && existing.createdAt && !payload.createdAt) payload.createdAt = existing.createdAt;
    // Aggiorna normalizedName per migliorare il rilevamento duplicati
    if ((payload.nome || payload.name)) {
      payload.normalizedName = normalizeName(payload.nome || payload.name) || null;
    }
    // Guard su email duplicata (solo se cambiata)
    const emailToCheck = (artistEmail || payload.loginEmail || payload.email || '').trim().toLowerCase();
    if (emailToCheck) {
      const dupByEmail = artists.find(a => a.id !== updatedArtist.id && ((a.loginEmail || a.email || '').trim().toLowerCase()) === emailToCheck);
      if (dupByEmail) {
        alert(`Email già usata da "${dupByEmail.nome}". Aggiorna l'email o elimina il duplicato prima di salvare.`);
        return;
      }
    }
    if (artistLoginCode && artistLoginCode.trim()) payload.loginCode = artistLoginCode.trim();
    if (artistEmail && artistEmail.trim()) payload.loginEmail = artistEmail.trim();
    await setDoc(ref, payload, { merge: true });
    // Resta in modalità modifica e mantieni i dati appena inseriti
    setSelectedArtist(updatedArtist);
    setView("edit");
  };

  // Salvataggio rapido solo del campo 'order' per un artista dalla lista
  const saveArtistOrder = async (artistId, orderValue) => {
    try {
      const orderNum = Number(orderValue);
      await setDoc(doc(db, 'artisti', artistId), { order: Number.isFinite(orderNum) ? orderNum : 0 }, { merge: true });
      alert('Ordine artista aggiornato');
    } catch (e) {
      console.error('Errore aggiornamento ordine artista', e);
      alert('Errore aggiornamento ordine');
    }
  };

  // Helpers per riordino rapido (↑/↓)
  const getMillis = (ts) => (ts?.toMillis ? ts.toMillis() : (ts?.seconds ? ts.seconds * 1000 : Number.MAX_SAFE_INTEGER));

  // Normalizzazione ordine rimossa (feature obsoleta)

  // Upload Home video and persist URL in site/config
  const handleHomeVideoUpload = async (file) => {
    if (!file) return;
    try {
      setHomeVideoUploading(true);
      const r = ref(storage, `site/home/${Date.now()}_${file.name}`);
      await uploadBytes(r, file);
      const url = await getDownloadURL(r);
      setHomeVideoUrl(url);
      await setDoc(doc(db, 'site', 'config'), { homeVideoUrl: url }, { merge: true });
      alert('Video Home aggiornato.');
    } catch (e) {
      console.error('Errore upload home video', e);
      alert('Errore caricamento video Home');
    } finally {
      setHomeVideoUploading(false);
    }
  };

  const moveArtist = async (artistId, dir) => {
    try {
      if (artists.length < 2) return; // semplificato: niente normalizzazione automatica
      // Ordina per order asc
      const sorted = [...artists].sort((a, b) => {
        const ao = Number(a.order ?? Number.POSITIVE_INFINITY);
        const bo = Number(b.order ?? Number.POSITIVE_INFINITY);
        if (ao !== bo) return ao - bo;
        return getMillis(a.createdAt) - getMillis(b.createdAt);
      });
      const idx = sorted.findIndex(a => a.id === artistId);
      if (idx === -1) return;
      const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= sorted.length) return;
      const a = sorted[idx];
      const b = sorted[targetIdx];
      const ao = Number(a.order);
      const bo = Number(b.order);
      // Scambia gli ordini
      await setDoc(doc(db, 'artisti', a.id), { order: bo }, { merge: true });
      await setDoc(doc(db, 'artisti', b.id), { order: ao }, { merge: true });
    } catch (e) {
      console.error('Errore spostamento artista', e);
      alert('Errore durante lo spostamento');
    }
  };

  // Eliminazione rapida dalla lista
  const handleDeleteArtist = async (artistId) => {
    try {
      await deleteDoc(doc(db, "artisti", artistId));
      // Se stai modificando proprio questo artista, torna alla lista
      if (selectedArtist && selectedArtist.id === artistId) {
        setSelectedArtist(null);
        setView("list");
      }
    } catch (e) {
      console.error('Errore eliminazione artista', e);
      alert('Errore durante eliminazione artista: ' + (e && e.message ? e.message : 'sconosciuto'));
    }
  };

  // Handler per tornare indietro
  const handleBack = () => {
    setView("list");
    setSelectedArtist(null);
  };

  const handleFestivalUpload = async (file) => {
    if (!file) return;
    try {
      setFestivalUploading(true);
      const path = `festival/${Date.now()}_${file.name}`;
      const r = ref(storage, path);
      await uploadBytes(r, file);
      const url = await getDownloadURL(r);
      await setDoc(doc(db, 'site', 'config'), { festivalPdfUrl: url }, { merge: true });
      alert('PDF del Festival caricato con successo.');
    } catch (e) {
      console.error('Errore upload festival PDF', e);
      alert(`Errore upload PDF: ${e && e.message ? e.message : 'sconosciuto'}`);
    } finally {
      setFestivalUploading(false);
    }
  };

  const handleFestivalBandoUpload = async (file) => {
    if (!file) return;
    try {
      setFestivalUploading(true);
      const path = `festival/bando_${Date.now()}_${file.name}`;
      const r = ref(storage, path);
      await uploadBytes(r, file);
      const url = await getDownloadURL(r);
      await setDoc(doc(db, 'site', 'config'), { festivalBandoPdfUrl: url }, { merge: true });
      alert('Bando di partecipazione caricato con successo.');
    } catch (e) {
      console.error('Errore upload bando PDF', e);
      alert(`Errore upload PDF bando: ${e && e.message ? e.message : 'sconosciuto'}`);
    } finally {
      setFestivalUploading(false);
    }
  };

  const handleFestivalSpecificheUpload = async (file) => {
    if (!file) return;
    try {
      setFestivalUploading(true);
      const path = `festival/specifiche_${Date.now()}_${file.name}`;
      const r = ref(storage, path);
      await uploadBytes(r, file);
      const url = await getDownloadURL(r);
      await setDoc(doc(db, 'site', 'config'), { festivalSpecifichePdfUrl: url }, { merge: true });
      alert('Specifiche tecniche caricate con successo.');
    } catch (e) {
      console.error('Errore upload specifiche PDF', e);
      alert(`Errore upload PDF specifiche: ${e && e.message ? e.message : 'sconosciuto'}`);
    } finally {
      setFestivalUploading(false);
    }
  };

  const handleFestivalVideoUpload = async (file) => {
    if (!file) return;
    try {
      setFestivalVideoUploading(true);
      const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
      const path = `festival/video_${Date.now()}.${ext}`;
      const r = ref(storage, path);
      await uploadBytes(r, file);
      const url = await getDownloadURL(r);
      await setDoc(doc(db, 'site', 'config'), { festivalVideoUrl: url }, { merge: true });
      alert('Video di presentazione caricato con successo.');
    } catch (e) {
      console.error('Errore upload video festival', e);
      alert(`Errore upload video: ${e && e.message ? e.message : 'sconosciuto'}`);
    } finally {
      setFestivalVideoUploading(false);
    }
  };

  const handleSoundsLogoUpload = async (file) => {
    if (!file) return;
    try {
      setBrandingUploading(true);
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `branding/sounds_logo_${Date.now()}.${ext}`;
      const r = ref(storage, path);
      await uploadBytes(r, file);
      const url = await getDownloadURL(r);
      await setDoc(doc(db, 'site', 'config'), { soundsLogoUrl: url }, { merge: true });
      alert('Logo "Sounds" caricato con successo.');
    } catch (e) {
      console.error('Errore upload logo Sounds', e);
      alert(`Errore upload logo: ${e && e.message ? e.message : 'sconosciuto'}`);
    } finally {
      setBrandingUploading(false);
    }
  };

  // Backfill feature rimossa (obsoleta)

  return (
    <div className="admin-base">
      <header className="dash-header">
        <h2 className="dash-title">Dashboard Artisti</h2>
        <div className="dash-actions">
          <button
            onClick={() => navigate('/')}
            className="dash-btn dash-btn--ghost"
          >
            Vai al Sito
          </button>
          <button
            onClick={async () => { await logout(); navigate('/'); }}
            className="dash-btn dash-btn--primary"
          >
            Logout
          </button>
        </div>
        <div className="dash-user">{user && (<>
          <span>{user.email}</span>
          <span style={{ marginLeft: 8, color: '#888', fontSize: 12 }} title="Firebase UID">UID: {user.uid}</span>
        </>)}
        </div>
      </header>

      {/* Duplicates section removed as requested */}
        {user && (
          <div style={{margin:'10px 0 20px', padding: '12px 16px', background:'#111', border:'1px solid #333', borderRadius:10, display:'flex', flexDirection:'column', gap:10}}>
            <strong style={{color:'#ffd700', fontSize:14}}>Cambio password admin (solo per te)</strong>
            <div style={{display:'flex', flexWrap:'wrap', gap:10}}>
              <input type="password" placeholder="Nuova password" value={adminPwNew} onChange={e=>setAdminPwNew(e.target.value)} style={{flex:'1 1 200px', minWidth:180, padding:8, borderRadius:8, border:'1px solid #444', background:'#000', color:'#fff'}} />
              <input type="password" placeholder="Conferma" value={adminPwConfirm} onChange={e=>setAdminPwConfirm(e.target.value)} style={{flex:'1 1 200px', minWidth:180, padding:8, borderRadius:8, border:'1px solid #444', background:'#000', color:'#fff'}} />
              <button className="dash-small-btn dash-small-btn--primary" disabled={!adminPwNew || adminPwNew.length<6 || adminPwNew!==adminPwConfirm} onClick={async ()=>{
                setAdminPwMsg(''); setAdminPwErr('');
                try { await changeCurrentUserPassword(adminPwNew.trim()); setAdminPwMsg('Password aggiornata.'); setAdminPwNew(''); setAdminPwConfirm(''); }
                catch(e){ setAdminPwErr(e.message||'Errore cambio password'); }
              }}>Aggiorna</button>
              <button className="dash-small-btn" onClick={async ()=>{ if(user?.email){ try{ await resetPassword(user.email); setAdminPwMsg('Email reset inviata al tuo indirizzo.'); } catch(e){ setAdminPwErr('Errore invio reset: '+(e.message||e)); } } }}>Invia reset via email</button>
            </div>
            {(adminPwMsg || adminPwErr) && <div style={{fontSize:12}}>{adminPwMsg && <span style={{color:'#6fda8b'}}>{adminPwMsg}</span>} {adminPwErr && <span style={{color:'#ff6464'}}>{adminPwErr}</span>}</div>}
          </div>
        )}
  <div className="dash-views">
        <button className="dash-btn dash-btn--ghost" onClick={() => setView('video')}>Gestione Video Studio</button>
        <button className="dash-btn dash-btn--ghost" onClick={() => setView('videoLogo')}>Gestione Video Logo</button>
      {view === 'video' && (
        <div className="dash-editor dash-container">
          <h3 className="dash-section-title">Video Presentazione Studio</h3>
          <DashboardVideoManager onBack={handleBack} />
        </div>
      )}
      {view === 'videoLogo' && (
        <div className="dash-editor dash-container">
          <h3 className="dash-section-title">Video Logo</h3>
          <DashboardLogoVideoManager onBack={handleBack} />
        </div>
      )}
        <button
          className="dash-btn dash-btn--primary"
          onClick={() => setView("create")}
        >
          Crea Artista
        </button>
        <button
          className="dash-btn dash-btn--ghost"
          onClick={() => setView("list")}
        >
          Gestione Artisti
        </button>
        <button
          className="dash-btn dash-btn--ghost"
          onClick={() => setView("festival")}
        >
          Gestisci Festival
        </button>
        <button
          className="dash-btn dash-btn--ghost"
          onClick={() => setView("buy")}
        >
          Buy Music
        </button>
        <button
          className="dash-btn dash-btn--ghost"
          onClick={() => setView("tracks")}
        >
          Gestione Brani Musica
        </button>
        <button
          className="dash-btn dash-btn--ghost"
          onClick={() => setView("podcast")}
        >
          Podcast
        </button>
        <button
          className="dash-btn dash-btn--ghost"
          onClick={() => setView("countdown")}
        >
          Countdown
        </button>
        <button
          className="dash-btn dash-btn--ghost"
          onClick={() => setView("settings")}
        >
          Impostazioni Sito
        </button>
        <button
          className="dash-btn dash-btn--ghost"
          onClick={() => setView('duplicates')}
        >
          Controllo Duplicati
        </button>
        {/* Voce AI rimossa */}
      </div>
      {/* Removed obsolete buttons: Backfill createdAt & Normalizza ordine */}

      {view === "list" && (
        <div className="dash-list dash-container">
          <h3 className="dash-section-title">Artisti inseriti</h3>
          {artists.length === 0 ? (
            <p>Nessun artista inserito.</p>
          ) : (
            <ul>
              {artists.map((artist) => (
                <li key={artist.id} className="dash-item">
                  <span style={{ fontWeight: "bold" }}>{artist.nome}</span>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 12 }}>
                    <input
                      type="number"
                      value={artist.order ?? ''}
                      onChange={(e) => setArtists(list => list.map(a => a.id === artist.id ? { ...a, order: e.target.value } : a))}
                      placeholder="Ordine"
                      style={{ width: 90, padding: '6px 8px', borderRadius: 6, border: '1px solid #444', background: '#111', color: '#fff' }}
                    />
                    <button
                      className="dash-small-btn"
                      onClick={() => saveArtistOrder(artist.id, artists.find(a => a.id === artist.id)?.order)}
                      title="Salva ordine"
                    >
                      Salva Ordine
                    </button>
                    <button
                      className="dash-small-btn"
                      onClick={() => moveArtist(artist.id, 'up')}
                      title="Sposta su"
                    >
                      ↑
                    </button>
                    <button
                      className="dash-small-btn"
                      onClick={() => moveArtist(artist.id, 'down')}
                      title="Sposta giù"
                    >
                      ↓
                    </button>
                  </div>
                  <div className="dash-item-actions">
                    <button
                      className="dash-small-btn dash-small-btn--primary"
                      onClick={() => handleSelectArtist(artist)}
                    >
                      Modifica
                    </button>
                    <button
                      className="dash-small-btn dash-small-btn--danger"
                      onClick={() => {
                        if (window.confirm(`Eliminare definitivamente l'artista "${artist.nome}"?`)) {
                          handleDeleteArtist(artist.id);
                        }
                      }}
                    >
                      Elimina
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {view === 'duplicates' && (
        <div className="dash-list dash-container">
          <h3 className="dash-section-title">Controllo Duplicati</h3>
          <p style={{color:'#bbb'}}>Suggerimenti basati su nome normalizzato ed email. Usa Modifica per verificare e <em>Elimina</em> quello non più valido. Non viene effettuata alcuna fusione automatica.</p>
          {/* Group by normalizedName */}
          <div style={{marginTop:16}}>
            <h4 className="dash-section-title" style={{marginTop:0}}>Per Nome</h4>
            {(() => {
              const groups = artists.reduce((acc, a) => {
                const key = (a.normalizedName || (a.nome || a.name || '')).toString().toLowerCase()
                  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/(^-|-$)+/g, '') || '(vuoto)';
                acc[key] = acc[key] || [];
                acc[key].push(a);
                return acc;
              }, {});
              const dups = Object.entries(groups).filter(([, list]) => list.length > 1);
              if (dups.length === 0) return <div style={{color:'#8f8'}}>Nessun sospetto duplicato per nome.</div>;
              return (
                <ul>
                  {dups.map(([key, list]) => (
                    <li key={key} className="dash-item">
                      <div style={{fontWeight:'bold'}}>"{key}"</div>
                      <ul style={{marginTop:8}}>
                        {list.map(a => (
                          <li key={a.id} style={{display:'flex', alignItems:'center', gap:8, padding:'6px 0'}}>
                            <span>{a.nome || a.name} <span style={{color:'#888'}}>({a.id})</span></span>
                            {a.loginEmail || a.email ? <span style={{color:'#bbb'}}>{(a.loginEmail || a.email)}</span> : null}
                            <button className="dash-small-btn dash-small-btn--primary" onClick={() => handleSelectArtist(a)}>Modifica</button>
                            <button className="dash-small-btn dash-small-btn--danger" onClick={() => { if(window.confirm(`Eliminare definitivamente "${a.nome}"?`)) handleDeleteArtist(a.id); }}>Elimina</button>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </div>
          {/* Group by email */}
          <div style={{marginTop:24}}>
            <h4 className="dash-section-title">Per Email</h4>
            {(() => {
              const groups = artists.reduce((acc, a) => {
                const key = ((a.loginEmail || a.email || '').trim().toLowerCase()) || '(vuota)';
                acc[key] = acc[key] || [];
                acc[key].push(a);
                return acc;
              }, {});
              const dups = Object.entries(groups)
                .filter(([key, list]) => key !== '(vuota)' && list.length > 1);
              if (dups.length === 0) return <div style={{color:'#8f8'}}>Nessun sospetto duplicato per email.</div>;
              return (
                <ul>
                  {dups.map(([key, list]) => (
                    <li key={key} className="dash-item">
                      <div style={{fontWeight:'bold'}}>{key}</div>
                      <ul style={{marginTop:8}}>
                        {list.map(a => (
                          <li key={a.id} style={{display:'flex', alignItems:'center', gap:8, padding:'6px 0'}}>
                            <span>{a.nome || a.name} <span style={{color:'#888'}}>({a.id})</span></span>
                            <button className="dash-small-btn dash-small-btn--primary" onClick={() => handleSelectArtist(a)}>Modifica</button>
                            <button className="dash-small-btn dash-small-btn--danger" onClick={() => { if(window.confirm(`Eliminare definitivamente "${a.nome}"?`)) handleDeleteArtist(a.id); }}>Elimina</button>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </div>
        </div>
      )}

  {view === 'buy' && (
        <div className="dash-editor dash-container">
          <h3 className="dash-section-title">Buy Music - Generi e Brani</h3>
          <BuyMusicAdmin />
        </div>
      )}

      {view === 'tracks' && (
        <div className="dash-editor dash-container">
          <h3 className="dash-section-title">Gestione Brani Musica</h3>
          <DashboardTracks />
        </div>
      )}

      {view === 'podcast' && (
        <div className="dash-editor dash-container">
          <h3 className="dash-section-title">Podcast</h3>
          <p>Carica un file video (anche 4K) oppure inserisci un link YouTube. Compila titolo/descrizione e ordina i contenuti.</p>
          <PodcastAdmin
            items={podItems}
            uploading={podUploading}
            setUploading={setPodUploading}
          />
        </div>
      )}

      {view === 'countdown' && (
        <div className="dash-editor dash-container">
          <h3 className="dash-section-title">Countdown</h3>
          <p>Aggiungi copertina e data/ora precisa di pubblicazione. Gli utenti vedranno un timer "verde matrix" fino all'uscita.</p>
          <CountdownAdmin
            items={cdItems}
            uploading={cdUploading}
            setUploading={setCdUploading}
          />
        </div>
      )}

      {view === 'festival' && (
        <div className="dash-editor dash-container">
          <h3 className="dash-section-title">Festival</h3>
          <p>Carica il PDF del Festival (Bando di Partecipazione, specifiche tecniche). Sarà visibile nella pagina pubblica "Festival".</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
            <div>
              <label style={{ color: '#ffd700', fontWeight: 'bold' }}>PDF Generale</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <input id="pdf-generale" type="file" accept="application/pdf" onChange={(e) => handleFestivalUpload(e.target.files && e.target.files[0])} disabled={festivalUploading} />
                <button className="dash-small-btn dash-small-btn--primary" onClick={() => document.getElementById('pdf-generale').click()} disabled={festivalUploading}>
                  {festivalUploading ? 'Caricamento…' : 'Seleziona PDF'}
                </button>
              </div>
            </div>
            <div>
              <label style={{ color: '#ffd700', fontWeight: 'bold' }}>Bando di Partecipazione</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <input id="pdf-bando" type="file" accept="application/pdf" onChange={(e) => handleFestivalBandoUpload(e.target.files && e.target.files[0])} disabled={festivalUploading} />
                <button className="dash-small-btn dash-small-btn--primary" onClick={() => document.getElementById('pdf-bando').click()} disabled={festivalUploading}>
                  {festivalUploading ? 'Caricamento…' : 'Seleziona PDF Bando'}
                </button>
              </div>
            </div>
            <div>
              <label style={{ color: '#ffd700', fontWeight: 'bold' }}>Specifiche Tecniche</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <input id="pdf-specifiche" type="file" accept="application/pdf" onChange={(e) => handleFestivalSpecificheUpload(e.target.files && e.target.files[0])} disabled={festivalUploading} />
                <button className="dash-small-btn dash-small-btn--primary" onClick={() => document.getElementById('pdf-specifiche').click()} disabled={festivalUploading}>
                  {festivalUploading ? 'Caricamento…' : 'Seleziona PDF Specifiche'}
                </button>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16, maxWidth: 680 }}>
            <label style={{ color: '#ffd700' }}>
              Titolo Festival
              <input type="text" value={festivalTitle} onChange={(e) => setFestivalTitle(e.target.value)} placeholder="Es. Festival Arte Registrazioni 2025" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #444', background: '#111', color: '#fff', marginTop: 6 }} />
            </label>
            <label style={{ color: '#ffd700' }}>
              Descrizione
              <textarea value={festivalDescription} onChange={(e) => setFestivalDescription(e.target.value)} rows={4} placeholder="Breve descrizione/istruzioni per il Festival" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #444', background: '#111', color: '#fff', marginTop: 6 }} />
            </label>
            <label style={{ color: '#ffd700' }}>
              Link pagamento iscrizione (Stripe Payment Link)
              <input type="url" value={festivalPaymentLinkUrl} onChange={(e) => setFestivalPaymentLinkUrl(e.target.value)} placeholder="https://pay.arteregistrazioni.com/…" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #444', background: '#111', color: '#fff', marginTop: 6 }} />
            </label>
            <label style={{ color: '#ffd700' }}>
              Descrizione pagamento (mostrata accanto al pulsante)
              <input type="text" value={festivalPaymentDescription} onChange={(e) => setFestivalPaymentDescription(e.target.value)} placeholder="Quota di iscrizione, scadenze, ecc." style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #444', background: '#111', color: '#fff', marginTop: 6 }} />
            </label>
            <div>
              <button className="dash-btn dash-btn--primary" onClick={async () => {
                try {
                  await setDoc(doc(db, 'site', 'config'), {
                    festivalTitle: festivalTitle || null,
                    festivalDescription: festivalDescription || null,
                    festivalPaymentLinkUrl: festivalPaymentLinkUrl || null,
                    festivalPaymentDescription: festivalPaymentDescription || null
                  }, { merge: true });
                  alert('Titolo e descrizione aggiornati.');
                } catch (e) {
                  console.error('Errore salvataggio titolo/descrizione festival', e);
                  alert('Errore salvataggio: ' + (e && e.message ? e.message : 'sconosciuto'));
                }
              }}>Salva testo</button>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <h4 className="dash-section-title">Video di presentazione</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <input id="video-festival" type="file" accept="video/*" onChange={(e) => handleFestivalVideoUpload(e.target.files && e.target.files[0])} disabled={festivalVideoUploading} />
              <button className="dash-small-btn dash-small-btn--primary" onClick={() => document.getElementById('video-festival').click()} disabled={festivalVideoUploading}>
                {festivalVideoUploading ? 'Caricamento…' : 'Seleziona Video'}
              </button>
            </div>
            {festivalVideoUrl ? (
              <div style={{ marginTop: 12 }}>
                <div><strong>Video attuale:</strong> <a href={festivalVideoUrl} target="_blank" rel="noreferrer">Apri</a></div>
                <video src={festivalVideoUrl} controls style={{ width: '100%', maxWidth: 720, borderRadius: 12, marginTop: 8 }} />
              </div>
            ) : (
              <div style={{ color: '#888', marginTop: 8 }}>Nessun video caricato.</div>
            )}
          </div>
          {festivalPdfUrl ? (
            <div style={{ marginTop: 16 }}>
              <div><strong>PDF attuale:</strong> <a href={festivalPdfUrl} target="_blank" rel="noreferrer">Apri</a></div>
              <iframe title="Anteprima PDF" src={festivalPdfUrl} style={{ width: '100%', height: 500, border: '2px solid #ffd700', borderRadius: 12, marginTop: 12 }} />
            </div>
          ) : (
            <div style={{ color: '#888', marginTop: 12 }}>Nessun PDF caricato.</div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginTop: 16 }}>
            {festivalBandoPdfUrl ? (
              <div>
                <div><strong>Bando di Partecipazione:</strong> <a href={festivalBandoPdfUrl} target="_blank" rel="noreferrer">Apri</a></div>
                <iframe title="Bando PDF" src={festivalBandoPdfUrl} style={{ width: '100%', height: 380, border: '2px solid #ffd700', borderRadius: 12, marginTop: 8 }} />
              </div>
            ) : (
              <div style={{ color: '#888' }}>Nessun bando caricato.</div>
            )}
            {festivalSpecifichePdfUrl ? (
              <div>
                <div><strong>Specifiche Tecniche:</strong> <a href={festivalSpecifichePdfUrl} target="_blank" rel="noreferrer">Apri</a></div>
                <iframe title="Specifiche PDF" src={festivalSpecifichePdfUrl} style={{ width: '100%', height: 380, border: '2px solid #ffd700', borderRadius: 12, marginTop: 8 }} />
              </div>
            ) : (
              <div style={{ color: '#888' }}>Nessuna specifica caricata.</div>
            )}
          </div>

          <div style={{ marginTop: 24, paddingTop: 12, borderTop: '1px dashed #333' }}>
            <h4 className="dash-section-title">Branding</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <label style={{ color: '#ffd700', fontWeight: 'bold' }}>Logo "Sounds"</label>
              <input id="sounds-logo" type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleSoundsLogoUpload(e.target.files && e.target.files[0])} />
              <button className="dash-small-btn dash-small-btn--primary" onClick={() => document.getElementById('sounds-logo').click()} disabled={brandingUploading}>
                {brandingUploading ? 'Caricamento…' : 'Seleziona immagine'}
              </button>
              {soundsLogoUrl ? (
                <>
                  <span style={{ color: '#bbb' }}>
                    Caricato: <a href={soundsLogoUrl} target="_blank" rel="noreferrer">Apri</a>
                  </span>
                  <img src={soundsLogoUrl} alt="Logo Sounds" style={{ height: 40, objectFit: 'contain', borderRadius: 6, border: '1px solid #333', padding: 4, background: '#000' }} />
                </>
              ) : (
                <span style={{ color: '#888' }}>Nessun logo caricato.</span>
              )}
            </div>
          </div>
        </div>
      )}

      {view === 'settings' && (
        <div className="dash-editor dash-container">
          <h3 className="dash-section-title">Impostazioni Sito</h3>
          <p>Gestisci il logo "Sounds", il video in Home e i testi introduttivi della pagina Buy Music.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, border: '1px dashed #333', borderRadius: 10 }}>
              <label style={{ color: '#ffd700', fontWeight: 'bold' }}>Video Home</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <input id="home-video" type="file" accept="video/*" style={{ display: 'none' }} onChange={(e) => handleHomeVideoUpload(e.target.files && e.target.files[0])} />
                <button className="dash-small-btn dash-small-btn--primary" onClick={() => document.getElementById('home-video').click()} disabled={homeVideoUploading}>
                  {homeVideoUploading ? 'Caricamento…' : 'Seleziona Video Home'}
                </button>
                <input
                  type="url"
                  placeholder="Oppure incolla URL diretto .mp4/.webm"
                  value={homeVideoUrl}
                  onChange={(e) => setHomeVideoUrl(e.target.value)}
                  style={{ flex: 1, minWidth: 260, padding: 8, borderRadius: 8, border: '1px solid #444', background: '#111', color: '#fff' }}
                />
                <button
                  className="dash-small-btn"
                  onClick={async () => {
                    try {
                      await setDoc(doc(db, 'site', 'config'), { homeVideoUrl: homeVideoUrl || null }, { merge: true });
                      alert('URL Video Home salvato.');
                    } catch (e) {
                      console.error('Errore salvataggio URL Home', e);
                      alert('Errore salvataggio');
                    }
                  }}
                >Salva URL</button>
                {homeVideoUrl ? (
                  <>
                    <a href={homeVideoUrl} target="_blank" rel="noreferrer" className="dash-small-btn">Apri</a>
                    <video src={homeVideoUrl} controls style={{ width: '100%', maxWidth: 420, borderRadius: 10 }} />
                  </>
                ) : (
                  <span style={{ color: '#888' }}>Nessun video Home caricato. Verrà usato il default.</span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <label style={{ color: '#ffd700', fontWeight: 'bold' }}>Logo "Sounds"</label>
              <input id="sounds-logo-settings" type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleSoundsLogoUpload(e.target.files && e.target.files[0])} />
              <button className="dash-small-btn dash-small-btn--primary" onClick={() => document.getElementById('sounds-logo-settings').click()} disabled={brandingUploading}>
                {brandingUploading ? 'Caricamento…' : 'Carica/Modifica Logo'}
              </button>
              {soundsLogoUrl ? (
                <>
                  <span style={{ color: '#bbb' }}>Attuale:</span>
                  <img src={soundsLogoUrl} alt="Logo Sounds" style={{ height: 48, objectFit: 'contain', borderRadius: 6, border: '1px solid #333', padding: 4, background: '#000' }} />
                  <a href={soundsLogoUrl} target="_blank" rel="noreferrer" className="dash-small-btn">Apri</a>
                </>
              ) : (
                <span style={{ color: '#888' }}>Nessun logo caricato.</span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
              <label style={{ color: '#ffd700' }}>
                Testo introduttivo (Italiano)
                <textarea rows={5} value={buyIntroIt} onChange={(e) => setBuyIntroIt(e.target.value)} placeholder="Testo IT per Buy Music" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #444', background: '#111', color: '#fff', marginTop: 6 }} />
              </label>
              <label style={{ color: '#ffd700' }}>
                Intro text (English)
                <textarea rows={5} value={buyIntroEn} onChange={(e) => setBuyIntroEn(e.target.value)} placeholder="Intro EN for Buy Music" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #444', background: '#111', color: '#fff', marginTop: 6 }} />
              </label>
              <div>
                <button className="dash-btn dash-btn--primary" onClick={async () => {
                  try {
                    await setDoc(doc(db, 'site', 'config'), { buyIntroIt: buyIntroIt || null, buyIntroEn: buyIntroEn || null }, { merge: true });
                    alert('Testi introduttivi aggiornati.');
                  } catch (e) {
                    console.error('Errore salvataggio testi Buy Music', e);
                    alert('Errore salvataggio testi');
                  }
                }}>Salva Testi</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sezione Voce AI rimossa */}

      {view === "create" && (
        <div className="dash-editor dash-container">
          <h3 className="dash-section-title">Crea nuovo artista</h3>
          <ArtistPageEditable
            onSave={handleAddArtist}
            onCancel={handleBack}
          />
        </div>
      )}

      {view === "edit" && selectedArtist && (
        <div className="dash-editor dash-container">
          <h3 className="dash-section-title">Modifica artista</h3>
          <ArtistPageEditable
            artist={selectedArtist}
            onSave={handleUpdateArtist}
            onCancel={handleBack}
          />
          {/* Gestione codice login artista e link dedicato */}
          <div style={{ marginTop: 24, padding: 16, border: '1px dashed #444', borderRadius: 10 }}>
            <h4 className="dash-section-title" style={{ marginTop: 0 }}>Accesso Dashboard Artista</h4>
            <div style={{ display:'flex', flexDirection:'column', gap:12, maxWidth:640, marginBottom:12 }}>
              <label style={{color:'#ffd700', fontWeight:600, display:'flex', flexDirection:'column', gap:4}}>Email artista
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <input type="email" value={artistEmail} onChange={e=>setArtistEmail(e.target.value)} placeholder="email artista" style={{ flex:1, padding:10, borderRadius:8, border:'1px solid #444', background:'#111', color:'#fff' }} />
                  {artistEmail && (
                    <span style={{
                      fontSize:11,
                      padding:'4px 8px',
                      borderRadius:20,
                      background: checkingArtistEmail ? '#333' : (artistAuthExists ? '#0d4d2a' : '#555'),
                      color: artistAuthExists ? '#6fda8b' : '#ddd',
                      border: artistAuthExists ? '1px solid #16a34a' : '1px solid #666',
                      whiteSpace:'nowrap'
                    }}>
                      {checkingArtistEmail ? 'Verifica…' : (artistAuthExists ? 'Esiste' : 'Non creato')}
                    </span>
                  )}
                </div>
                {artistEmailStatusMsg && <div style={{ fontSize:11, color: artistAuthExists ? '#6fda8b' : '#bbb', marginTop:4 }}>{artistEmailStatusMsg}</div>}
              </label>
              <label style={{color:'#ffd700', fontWeight:600}}>Password iniziale (solo per creare/reset manuale)
                <input type="text" value={artistPassword} onChange={e=>setArtistPassword(e.target.value)} placeholder="Nuova password (min 6)" style={{ width:'100%', marginTop:6, padding:10, borderRadius:8, border:'1px solid #444', background:'#111', color:'#fff' }} />
              </label>
              <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                <button className="dash-small-btn dash-small-btn--primary" disabled={creatingArtistUser || !artistEmail || artistPassword.length<6} onClick={async ()=>{
                  setArtistActionMessage('');
                  setArtistActionError('');
                  try {
                    setCreatingArtistUser(true);
                    const preExists = artistAuthExists; // stato prima
                    await createUserWithEmailAndPassword(auth, artistEmail.trim(), artistPassword.trim());
                    setArtistAuthExists(true);
                    if (!preExists) {
                      // creato ora
                      setArtistActionMessage('Utente creato. Ricorda di premere Salva artista.');
                      if (autoSendReset) {
                        try {
                          await resetPassword(artistEmail.trim());
                          setArtistActionMessage(prev => prev + ' Email reset inviata (l\'artista può impostare una nuova password).');
                        } catch (re) {
                          setArtistActionError('Creato ma invio email reset fallito: '+ (re.message||re));
                        }
                      }
                    } else {
                      setArtistActionMessage('Utente già esistente. Puoi usare Invia email reset se serve.');
                    }
                  } catch (e) {
                    if (e && e.code === 'auth/email-already-in-use') {
                      setArtistAuthExists(true);
                      try {
                        await resetPassword(artistEmail.trim());
                        setArtistActionMessage('Utente esistente: inviato link reset password.');
                      } catch (re) {
                        setArtistActionError('Utente esistente, reset fallito: ' + (re.message||re));
                      }
                    } else {
                      setArtistActionError('Errore creazione: ' + (e.message||e));
                    }
                  } finally { setCreatingArtistUser(false); }
                }}>{creatingArtistUser ? 'Creo...' : (artistAuthExists ? 'Forza / Reset' : 'Crea utente')}</button>
                <button className="dash-small-btn" disabled={!artistEmail || checkingArtistEmail} onClick={async ()=>{
                  if (!artistEmail) return;
                  try { await resetPassword(artistEmail.trim()); alert('Email di reset inviata.'); }
                  catch(e){ alert('Errore invio reset: '+ (e.message||e)); }
                }}>Invia email reset</button>
                <button className="dash-small-btn" type="button" onClick={()=>alert('Per cambiare password usa "Recupera / Reset password" nella pagina di login artista. Per sicurezza non si legge / modifica qui.')}>Info reset password</button>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
                <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, cursor:'pointer', color:'#ccc' }}>
                  <input type="checkbox" checked={autoSendReset} onChange={e=>setAutoSendReset(e.target.checked)} />
                  Invia automaticamente email reset dopo creazione (consigliato)
                </label>
              </div>
              {(artistActionMessage || artistActionError) && (
                <div style={{ marginTop:6, fontSize:12, lineHeight:1.4 }}>
                  {artistActionMessage && <div style={{ color:'#6fda8b' }}>{artistActionMessage}</div>}
                  {artistActionError && <div style={{ color:'#ff6464' }}>{artistActionError}</div>}
                </div>
              )}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap: 10, alignItems:'center', maxWidth: 640 }}>
              <input
                type="text"
                placeholder="Codice univoco (es. AR-7F29-KQ)"
                value={artistLoginCode}
                onChange={(e)=>setArtistLoginCode(e.target.value)}
                style={{ padding: 10, borderRadius: 8, border: '1px solid #444', background:'#111', color:'#fff' }}
              />
              <button className="dash-small-btn" onClick={() => setArtistLoginCode(() => {
                const rnd = Math.random().toString(36).toUpperCase().slice(2, 6);
                const rnd2 = Math.random().toString(36).toUpperCase().slice(2, 6);
                return `AR-${rnd}-${rnd2}`;
              })}>Genera</button>
            </div>
            <div style={{ marginTop: 10, color: '#bbb', fontSize: 13 }}>Ricorda di premere Salva nella scheda artista per salvare il codice.</div>
            <div style={{ marginTop: 12, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              <input readOnly value={`${window.location.origin}/artist-login?aid=${encodeURIComponent(selectedArtist.id)}`} style={{ flex: 1, minWidth: 260, padding: 10, borderRadius: 8, border:'1px solid #444', background:'#111', color:'#fff' }} />
              <button className="dash-small-btn" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/artist-login?aid=${encodeURIComponent(selectedArtist.id)}`); }}>Copia Link</button>
            </div>
            <div style={{ marginTop: 8 }}>
              <a className="dash-small-btn dash-small-btn--primary" href={`/artist-login?aid=${encodeURIComponent(selectedArtist.id)}`} target="_blank" rel="noreferrer">Apri pagina di accesso artista</a>
            </div>
          </div>
          <div style={{ marginTop: 40 }}>
            <ArtistTracksManager artist={selectedArtist} />
          </div>
        </div>
      )}

      {view === 'festival' && (
        <div className="dash-editor dash-container">
          <h3 className="dash-section-title">Festival</h3>
          <p>Carica il PDF del Festival (Bando di Partecipazione, specifiche tecniche). Sarà visibile nella pagina pubblica "Festival".</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <input type="file" accept="application/pdf" onChange={(e) => handleFestivalUpload(e.target.files && e.target.files[0])} disabled={festivalUploading} />
            <button className="dash-small-btn dash-small-btn--primary" onClick={() => document.querySelector('input[type=file][accept="application/pdf"]').click()} disabled={festivalUploading}>
              {festivalUploading ? 'Caricamento…' : 'Seleziona PDF'}
            </button>
          </div>
          {festivalPdfUrl ? (
            <div style={{ marginTop: 16 }}>
              <div><strong>PDF attuale:</strong> <a href={festivalPdfUrl} target="_blank" rel="noreferrer">Apri</a></div>
              <iframe title="Anteprima PDF" src={festivalPdfUrl} style={{ width: '100%', height: 500, border: '2px solid #ffd700', borderRadius: 12, marginTop: 12 }} />
            </div>
          ) : (
            <div style={{ color: '#888', marginTop: 12 }}>Nessun PDF caricato.</div>
          )}
        </div>
      )}
    </div>
  );
}

export default Dashboard;
