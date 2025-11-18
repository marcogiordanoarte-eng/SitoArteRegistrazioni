// Configurazione Firebase
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getAuth, connectAuthEmulator, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, updatePassword } from "firebase/auth";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";
import { initializeAppCheck, ReCaptchaV3Provider, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

const firebaseConfig = {
  apiKey: "AIzaSyBOE3Mq6wXNBUWYxUHxq0iBKecjpVWJuCE",
  authDomain: "arteregistrazioni-2025.firebaseapp.com",
  projectId: "arteregistrazioni-2025",
  // Nome BUCKET corretto (non dominio): <project-id>.appspot.com
  // Nota: usare il nome bucket, non l'host firebasestorage.app
  // Per i progetti nuovi, il bucket di default è <project-id>.firebasestorage.app
  // Allineiamo al bucket effettivo per evitare mismatch con Signed POST
  // ATTENZIONE: usare il bucket canonicale *.appspot.com per Firebase Storage REST
  storageBucket: "arteregistrazioni-2025.appspot.com",
  messagingSenderId: "130523873354",
  appId: "1:130523873354:web:eb48aea4dd9446270e66b3",
  measurementId: "G-XF3QX0NPZT"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
if (process.env.NODE_ENV !== 'production') {
  console.info('[Firebase] storageBucket configurato:', firebaseConfig.storageBucket);
  if (getApps().length > 0 && getApps()[0] !== app) {
    console.info('[Firebase] App riutilizzata da HMR');
  }
}

// App Check opzionale: inizializza SOLO se esplicitamente abilitato
// Impostare REACT_APP_ENABLE_APPCHECK=true per abilitare in dev
try {
  const enableAppCheck = process.env.REACT_APP_ENABLE_APPCHECK === 'true';
  if (enableAppCheck && typeof window !== 'undefined') {
    if (process.env.REACT_APP_APPCHECK_DEBUG_TOKEN) {
      window.FIREBASE_APPCHECK_DEBUG_TOKEN = process.env.REACT_APP_APPCHECK_DEBUG_TOKEN;
    } else if (process.env.REACT_APP_APPCHECK_DEBUG === 'true') {
      window.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    const providerType = (process.env.REACT_APP_RECAPTCHA_PROVIDER || 'v3').toLowerCase();
    if (providerType === 'enterprise' && process.env.REACT_APP_RECAPTCHA_ENTERPRISE_SITE_KEY) {
      initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(process.env.REACT_APP_RECAPTCHA_ENTERPRISE_SITE_KEY),
        isTokenAutoRefreshEnabled: true,
      });
      if (process.env.NODE_ENV !== 'production') {
        console.info('[AppCheck] Inizializzato reCAPTCHA Enterprise');
      }
    } else if (process.env.REACT_APP_RECAPTCHA_V3_SITE_KEY) {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(process.env.REACT_APP_RECAPTCHA_V3_SITE_KEY),
        isTokenAutoRefreshEnabled: true,
      });
      if (process.env.NODE_ENV !== 'production') {
        console.info('[AppCheck] Inizializzato reCAPTCHA v3');
      }
    } else {
      if (process.env.NODE_ENV !== 'production') {
        console.info('[AppCheck] Nessun provider configurato (variabili env mancanti)');
      }
    }
  } else if (process.env.NODE_ENV !== 'production') {
    console.info('[AppCheck] Disabilitato in dev (REACT_APP_ENABLE_APPCHECK!=true)');
  }
} catch (e) {
  console.warn('[AppCheck] inizializzazione saltata/errore:', e && e.message ? e.message : e);
}

// IMPORTANTE: inizializza i servizi DOPO App Check, così l'header X-Firebase-AppCheck verrà allegato alle richieste
export const db = getFirestore(app);
// Usa il bucket di default dal config (appspot.com)
export const storage = getStorage(app);
export const STORAGE_BUCKET = firebaseConfig.storageBucket;
export const PROJECT_ID = firebaseConfig.projectId;
// Functions (callable) - specifica regione esplicitamente
export const functions = getFunctions(app, 'us-central1');

// Wrapper per callable: mantieni httpsCallable standard (niente fetch diretto per onCall).
async function callCallable(name, data) {
  const callable = httpsCallable(functions, name);
  const res = await callable(data);
  return res.data;
}

// HTTP fallback endpoint (con CORS esplicito): definito in functions come registerLivePlayHttp
const REGISTER_LIVE_HTTP = `https://us-central1-${PROJECT_ID}.cloudfunctions.net/registerLivePlayHttp`;
// Usa l'emulatore di Storage in sviluppo se richiesto via env
if (process.env.REACT_APP_USE_STORAGE_EMULATOR === 'true') {
  try {
    connectStorageEmulator(storage, '127.0.0.1', 9199);
    if (process.env.NODE_ENV !== 'production') {
      console.info('[Storage] Connesso all\'emulatore su http://127.0.0.1:9199');
    }
  } catch (e) {
    console.warn('[Storage] Impossibile connettersi all\'emulatore:', e && e.message ? e.message : e);
  }
}
// Collega anche Firestore all'emulatore quando si usa lo Storage emulato
// (oppure quando esplicitamente richiesto) per evitare di scrivere record locali su Firestore di produzione
if (process.env.REACT_APP_USE_FIRESTORE_EMULATOR === 'true') {
  try {
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    if (process.env.NODE_ENV !== 'production') {
      console.info('[Firestore] Connesso all\'emulatore su http://127.0.0.1:8080');
    }
  } catch (e) {
    console.warn('[Firestore] Impossibile connettersi all\'emulatore:', e && e.message ? e.message : e);
  }
}
export const auth = getAuth(app);
// Collegamento facoltativo all'emulatore di Functions
if (process.env.REACT_APP_USE_FUNCTIONS_EMULATOR === 'true') {
  try {
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    if (process.env.NODE_ENV !== 'production') {
      console.info('[Functions] Connesso all\'emulatore su http://127.0.0.1:5001');
    }
  } catch (e) {
    console.warn('[Functions] Impossibile connettersi all\'emulatore:', e && e.message ? e.message : e);
  }
}
// Collegamento facoltativo all'emulatore di Auth (in genere non necessario per Storage emulato)
if (process.env.REACT_APP_USE_AUTH_EMULATOR === 'true') {
  try {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    if (process.env.NODE_ENV !== 'production') {
      console.info('[Auth] Connesso all\'emulatore su http://127.0.0.1:9099');
    }
  } catch (e) {
    console.warn('[Auth] Impossibile connettersi all\'emulatore:', e && e.message ? e.message : e);
  }
}

// Helpers auth email/password
export async function registerUser(email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function loginUser(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logoutUser() {
  await signOut(auth);
}

// Password reset (email link)
export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

// Update current user password (requires recent login)
export async function changeCurrentUserPassword(newPassword) {
  if (!auth.currentUser) throw new Error('Nessun utente autenticato');
  await updatePassword(auth.currentUser, newPassword);
}

// Spotify artist data helper (calls Cloud Function spotifyArtistData)
// Richiede che le funzioni siano configurate con: firebase functions:config:set spotify.clientid=... spotify.clientsecret=...
// Non esporre mai client secret direttamente nel frontend.
// Estrae ID artista da URL Spotify se presente
function extractSpotifyArtistId(input) {
  if (!input || typeof input !== 'string') return null;
  try {
    // Formati possibili:
    // https://open.spotify.com/artist/<ID>
    // https://open.spotify.com/artist/<ID>?si=...
  const m = input.match(/open\.spotify\.com\/artist\/([A-Za-z0-9]+)/); // regex semplice; nessuna escape inutile
    if (m && m[1]) return m[1];
  } catch {}
  return null;
}

// Helper principale Spotify con fallback ID->name
export async function fetchArtistData(artistNameOrUrl, market = 'IT') {
  if (!artistNameOrUrl || typeof artistNameOrUrl !== 'string') {
    throw new Error('artistName richiesto');
  }
  // Se è un URL Spotify prova estrazione ID
  const id = extractSpotifyArtistId(artistNameOrUrl);
  const isIdLookup = !!id;
  try {
    const callable = httpsCallable(functions, 'spotifyArtistData');
    const res = await callable({ artistName: isIdLookup ? id : artistNameOrUrl, market, byId: isIdLookup });
    return res.data;
  } catch (e) {
    const msg = e?.message || 'Errore Spotify';
    return { found: false, error: true, message: msg };
  }
}

// Apple Music artist data helper
// Richiede configurazione funzioni: firebase functions:config:set apple.musickit_teamid=... apple.musickit_keyid=... apple.musickit_privatekey="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
function extractAppleArtistName(input) {
  if (!input || typeof input !== 'string') return null;
  try {
    // https://music.apple.com/it/artist/<slug-name>/<numericId>
  const m = input.match(/music\.apple\.com\/[a-z]{2}\/artist\/([^/]+)\//i); // escape dentro [] non necessaria
    if (m && m[1]) {
      return decodeURIComponent(m[1]).replace(/-/g, ' ').trim();
    }
  } catch {}
  return null;
}

export async function fetchAppleArtistData(artistNameOrUrl, storefront = 'it') {
  if (!artistNameOrUrl || typeof artistNameOrUrl !== 'string') {
    throw new Error('artistName richiesto');
  }
  const extracted = extractAppleArtistName(artistNameOrUrl);
  const query = extracted || artistNameOrUrl;
  try {
    const callable = httpsCallable(functions, 'appleArtistData');
    const res = await callable({ artistName: query, storefront });
    return res.data;
  } catch (e) {
    const msg = e?.message || 'Errore Apple Music';
    return { found: false, error: true, message: msg };
  }
}

// Spotify single track helper (calls Cloud Function spotifyTrackData)
export async function fetchSpotifyTrackData(trackUrlOrId, market = 'IT') {
  if (!trackUrlOrId || typeof trackUrlOrId !== 'string') {
    throw new Error('track (URL o ID) richiesto');
  }
  const callable = httpsCallable(functions, 'spotifyTrackData');
  const res = await callable({ track: trackUrlOrId, market });
  return res.data;
}

// Apple single track helper (calls Cloud Function appleTrackData)
export async function fetchAppleTrackData(trackUrlOrId, storefront = 'it') {
  if (!trackUrlOrId || typeof trackUrlOrId !== 'string') {
    throw new Error('track (URL o ID) richiesto');
  }
  const callable = httpsCallable(functions, 'appleTrackData');
  const res = await callable({ track: trackUrlOrId, storefront });
  return res.data;
}

// Log (solo sviluppo) per tracciare cambi utente
if (process.env.NODE_ENV !== 'production') {
  onAuthStateChanged(auth, user => {
    console.info('[Auth] Stato utente:', user ? user.uid : 'nessun utente');
  });
}

// Google Sign-In rimosso: accesso admin solo tramite email/password

// Wrapper callable: registra un play live (per la mappa) – usa Cloud Function registerLivePlay
// Params: { artistId, city?, country?, lat?, lon? }
// Fallback: se non passi lat/lon verrà salvato null (posizionamento via city/country se corrisponde a capitali note)
export async function registerLivePlayEvent({ artistId, city, country, lat, lon }) {
  if (!artistId) throw new Error('artistId richiesto');
  // In localhost usa direttamente l'endpoint HTTP con CORS esplicito; in produzione callable.
  const isLocal = typeof window !== 'undefined' && /localhost|127\.0\.0\.1/.test(window.location.hostname);
  if (isLocal) {
    try {
      const resp = await fetch(REGISTER_LIVE_HTTP, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistId, city, country, lat, lon })
      });
      if (!resp.ok) throw new Error('HTTP livePlay non-ok ' + resp.status);
      const json = await resp.json().catch(() => ({ ok: false }));
      if (!json.ok) throw new Error('HTTP livePlay response invalida');
      return json;
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') console.warn('[registerLivePlayEvent] http local error', e?.message || e);
      throw e;
    }
  }
  // Produzione: callable
  return await callCallable('registerLivePlay', { artistId, city, country, lat, lon });
}

// Log strutturato dei play per reportistica SIAE (Cloud Function logPlay)
// Params: { artistId, trackId?, title?, src?, event: 'start'|'threshold'|'complete', playedSec?, durationSec? }
export async function logPlayEvent(payload) {
  if (!payload || !payload.artistId || !payload.event) throw new Error('artistId ed event richiesti');
  const callable = httpsCallable(functions, 'logPlay');
  const res = await callable(payload);
  return res.data;
}