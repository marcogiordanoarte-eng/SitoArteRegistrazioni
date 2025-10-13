import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import PublicSite from "./PublicSite";
import DownloadConfirm from "./DownloadConfirm";
import Artisti from "./Artisti";
import ArtistDetail from "./ArtistDetail";
import Studio from "./Studio";
import Contatti from "./Contatti";
import Festival from "./Festival";
import BuyMusic from "./BuyMusic";
import Musica from "./Musica";
import BuyGenreDetail from "./BuyGenreDetail";
import Podcast from "./Podcast";
import Countdown from "./Countdown";
import Terms from "./Terms";
import Privacy from "./Privacy";
import Licenza from "./Licenza";
import PagamentoEsempio from "./PagamentoEsempio";
import Dashboard from "./Dashboard";
import Login from "./Login";
import { AuthProvider, useAuth } from "./AuthContext";
import { ADMIN_UIDS } from './config';
import ArtistSelfDashboard from './ArtistSelfDashboard';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return <div style={{ color: '#ffd700', textAlign: 'center', marginTop: 80 }}>Verifica sessione...</div>;
  }
  if (!user) {
    console.info('[PrivateRoute] Nessun utente autenticato. Redirect a /login', { from: location.pathname });
    return <Navigate to="/login" replace state={{ from: location.pathname, reason: 'not-auth' }} />;
  }
  if (!ADMIN_UIDS.includes(user.uid)) {
    console.warn('[PrivateRoute] Utente autenticato ma NON admin. Redirect a /login', { uid: user.uid, from: location.pathname });
    return <Navigate to="/login" replace state={{ from: location.pathname, reason: 'not-admin' }} />;
  }
  return children;
}

// Rotta protetta per qualsiasi utente autenticato (dashboard personale artista)
function AuthRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return <div style={{ color: '#ffd700', textAlign: 'center', marginTop: 80 }}>Verifica sessione...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname, reason: 'not-auth' }} />;
  }
  return children;
}

export default function App() {
  // Nessun listener vocale o UI di assistente: rimosso su richiesta
  useEffect(() => {
    // Inject public fonts stylesheet
    const id = 'vintaface-fonts-css';
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = '/fonts/fonts.css';
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    // Suppress benign media/navigation errors (AbortError, NotAllowedError) and NotSupportedError like "The operation is not supported."
    const onUnhandled = (e) => {
      try {
        const name = (e && e.reason && e.reason.name) || '';
        const msg = (e && e.reason && e.reason.message) || '';
        if (
          name === 'AbortError' ||
          name === 'NotAllowedError' ||
          name === 'NotSupportedError' ||
          (typeof msg === 'string' && (
            msg.includes('The operation was aborted') ||
            msg.includes('The operation is not supported')
          ))
        ) {
          e.preventDefault && e.preventDefault();
          return false;
        }
      } catch {}
    };
    const onError = (e) => {
      try {
        const name = (e && e.error && e.error.name) || '';
        const msg = (e && e.message) || '';
        if (
          name === 'AbortError' ||
          name === 'NotAllowedError' ||
          name === 'NotSupportedError' ||
          (typeof msg === 'string' && (
            msg.includes('The operation was aborted') ||
            msg.includes('The operation is not supported')
          ))
        ) {
          e.preventDefault && e.preventDefault();
          return false;
        }
      } catch {}
    };
    window.addEventListener('unhandledrejection', onUnhandled);
    window.addEventListener('error', onError, true);
    return () => {
      window.removeEventListener('unhandledrejection', onUnhandled);
      window.removeEventListener('error', onError, true);
    };
  }, []);

  useEffect(() => {
    // Hide dashboard badge on scroll down; show on scroll up or near top
    let lastY = window.scrollY || 0;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY || 0;
        const delta = y - lastY;
        const badges = document.querySelectorAll('.dash-badge');
        if (badges && badges.length) {
          if (y > 80 && delta > 6) {
            badges.forEach(b => b.classList.add('dash-badge--hidden'));
          } else if (delta < -6 || y < 60) {
            badges.forEach(b => b.classList.remove('dash-badge--hidden'));
          }
        }
        lastY = y;
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  // Nessun GlobalAssistant: UI/AI disattivata completamente

  return (
    <AuthProvider>
      <BrowserRouter>
        <div style={{ position:'relative', minHeight:'100vh' }}>
          <Routes>
            <Route path="/" element={<PublicSite />} />
            <Route path="/artisti" element={<Artisti />} />
            <Route path="/artista/:id" element={<ArtistDetail />} />
            <Route path="/studio" element={<Studio />} />
            <Route path="/festival" element={<Festival />} />
            <Route path="/podcast" element={<Podcast />} />
            <Route path="/countdown" element={<Countdown />} />
            <Route path="/buy" element={<BuyMusic />} />
            <Route path="/musica" element={<Musica />} />
            <Route path="/buy/genre/:gid" element={<BuyGenreDetail />} />
            <Route path="/contatti" element={<Contatti />} />
            <Route path="/termini" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/licenza" element={<Licenza />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/artist-dashboard" element={<AuthRoute><ArtistSelfDashboard /></AuthRoute>} />
            <Route path="/download-confirm" element={<DownloadConfirm />} />
            <Route path="/pagamento-esempio" element={<PagamentoEsempio />} />
          </Routes>
          {/* Nessun assistente o finestrella: UI IA rimossa */}
            {/* Nessun assistente o finestrella: UI IA rimossa */}
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
