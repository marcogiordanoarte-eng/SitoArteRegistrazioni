// Configurazione Firebase
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getAuth, connectAuthEmulator, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { initializeAppCheck, ReCaptchaV3Provider, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

const firebaseConfig = {
  apiKey: "AIzaSyBOE3Mq6wXNBUWYxUHxq0iBKecjpVWJuCE",
  authDomain: "arteregistrazioni-2025.firebaseapp.com",
  projectId: "arteregistrazioni-2025",
  // Bucket reale attivo per questo progetto (verificato con gsutil)
  storageBucket: "arteregistrazioni-2025.firebasestorage.app",
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
// Functions (callable)
export const functions = getFunctions(app);
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

// Log (solo sviluppo) per tracciare cambi utente
if (process.env.NODE_ENV !== 'production') {
  onAuthStateChanged(auth, user => {
    console.info('[Auth] Stato utente:', user ? user.uid : 'nessun utente');
  });
}