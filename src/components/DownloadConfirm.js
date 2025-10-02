import React, { useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import NavBar from './NavBar';
import YouTubeButton from './YouTubeButton';
import Footer from './Footer';
import "./Artisti.css";
import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

const DownloadConfirm = () => {
  const query = useQuery();
  const custom = query.get("cm") || query.get("custom"); // PayPal può restituire custom oppure lo passiamo noi come query
  const direct = query.get("dl"); // Fallback diretto: URL di download passato in query (per test Stripe Payment Link)
  const direct64 = query.get("dl64"); // Variante base64url per evitare validazioni Stripe su URL annidati
  // custom formattato come: artistId:albumIndex
  const [artistId, albumIndexStr] = (custom || ":").split(":");
  const albumIndex = Number.isFinite(Number(albumIndexStr)) ? Number(albumIndexStr) : null;
  // Nota: per semplificare e restare client-side, non verifichiamo la transazione.
  // Recupero on-demand del link privato se possibile.

  const [downloadHref, setDownloadHref] = React.useState("");
  React.useEffect(() => {
    let mounted = true;
    async function fetchLink() {
      try {
        // Se è stato passato un link diretto, usalo subito (utile per test con Stripe Payment Link senza lookup)
        if (direct) {
          if (mounted) setDownloadHref(direct);
          return;
        }
        // Supporto a dl64: decodifica base64url in URL
        if (direct64) {
          try {
            const b64 = direct64.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(direct64.length / 4) * 4, '=');
            const decoded = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('utf-8');
            if (decoded && decoded.startsWith('http')) {
              if (mounted) setDownloadHref(decoded);
              return;
            }
          } catch (e) {
            console.warn('DownloadConfirm: impossibile decodificare dl64', e);
          }
        }
        if (!artistId || albumIndex === null) return;
        const ref = doc(db, "artisti", artistId);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        const data = snap.data();
        const album = (data.albums || [])[albumIndex];
        const link = album && album.downloadLink;
        if (mounted && link) setDownloadHref(link);
      } catch (e) {
        console.warn("DownloadConfirm: impossibile ottenere link privato", e);
      }
    }
    fetchLink();
    return () => { mounted = false; };
  }, [artistId, albumIndex, direct, direct64]);

  const navigate = useNavigate();
  return (
  <div className="publicsite-bg" style={{ minHeight: "100vh" }}>
    <Link to="/login" className="dash-badge">Dashboard</Link>
    <button onClick={() => navigate(-1)} aria-label="Torna indietro" style={{ position: 'fixed', top: 10, left: 10, zIndex: 10000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', border: '2px solid #ffd700', width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 0 12px rgba(255,215,0,0.6)' }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
    <div className="logo-wrapper">
      <div className="logo-stack">
        <img src="/disco.png" alt="Disco" className="disco-img" />
        <img src="/logo.png" alt="Logo Arte Registrazioni" className="logo-img" />
      </div>
    </div>
    <NavBar />
    
    <div className="container" style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", display: "flex", marginBottom: 0 }}>
      <h2 style={{ color: "#ffd700", marginTop: 24 }}>Grazie per l'acquisto! Buona musica!</h2>
  <a href={downloadHref || "#"} onClick={(e) => { if (!downloadHref) e.preventDefault(); }} download className="glow-btn" style={{
        display: "inline-block",
        marginTop: 32,
        padding: "12px 32px",
        background: "#ffd700",
        color: "#222",
        borderRadius: 8,
        fontWeight: "bold",
        fontSize: "1.2em",
        textDecoration: "none",
        boxShadow: "0 0 16px #ffd700"
      }}>
        {downloadHref ? "Scarica il tuo album (ZIP)" : "Preparazione link..."}
      </a>
    </div>
    <div className="youtube-under-menu">
      <YouTubeButton small layout="row" />
    </div>
    <Footer />
  </div>
);
}

export default DownloadConfirm;
