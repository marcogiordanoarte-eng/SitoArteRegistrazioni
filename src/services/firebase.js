// Centralized Firebase service for the whole SPA
// Exports: app, auth, db (Firestore), rtdb (Realtime DB), storage, functions (EU), and auth helpers
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updatePassword } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaV3Provider, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

// Project: arteregistrazioni-2025 (default in .firebaserc)
const firebaseConfig = {
  apiKey: 'AIzaSyBOE3Mq6wXNBUWYxUHxq0iBKecjpVWJuCE',
  authDomain: 'arteregistrazioni-2025.firebaseapp.com',
  projectId: 'arteregistrazioni-2025',
  storageBucket: 'arteregistrazioni-2025.firebasestorage.app',
  messagingSenderId: '130523873354',
  appId: '1:130523873354:web:eb48aea4dd9446270e66b3',
  measurementId: 'G-XF3QX0NPZT',
  databaseURL: `https://arteregistrazioni-2025-default-rtdb.europe-west1.firebasedatabase.app`
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// Optionally enable AppCheck via env
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
      initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(process.env.REACT_APP_RECAPTCHA_ENTERPRISE_SITE_KEY), isTokenAutoRefreshEnabled: true });
    } else if (process.env.REACT_APP_RECAPTCHA_V3_SITE_KEY) {
      initializeAppCheck(app, { provider: new ReCaptchaV3Provider(process.env.REACT_APP_RECAPTCHA_V3_SITE_KEY), isTokenAutoRefreshEnabled: true });
    }
  }
} catch (_) {}

// Services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const storage = getStorage(app);
// Force EU region for callable functions
export const functions = getFunctions(app, 'europe-west1');

// Emulators (opt-in via env)
if (process.env.REACT_APP_USE_AUTH_EMULATOR === 'true') {
  try { connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }); } catch(_) {}
}
if (process.env.REACT_APP_USE_FIRESTORE_EMULATOR === 'true') {
  try { connectFirestoreEmulator(db, '127.0.0.1', 8080); } catch(_) {}
}
if (process.env.REACT_APP_USE_DATABASE_EMULATOR === 'true') {
  try { connectDatabaseEmulator(rtdb, '127.0.0.1', 9000); } catch(_) {}
}
if (process.env.REACT_APP_USE_STORAGE_EMULATOR === 'true') {
  try { connectStorageEmulator(storage, '127.0.0.1', 9199); } catch(_) {}
}
if (process.env.REACT_APP_USE_FUNCTIONS_EMULATOR === 'true') {
  try { connectFunctionsEmulator(functions, '127.0.0.1', 5001); } catch(_) {}
}

// Auth helpers used across the app
export const googleProvider = new GoogleAuthProvider();
export async function loginWithGooglePopup() {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (err) {
    // Fallback for environments where popup may be blocked
    await signInWithRedirect(auth, googleProvider);
    return null;
  }
}
export async function logoutUser() { await signOut(auth); }
export async function registerUser(email, password) { const c = await createUserWithEmailAndPassword(auth, email, password); return c.user; }
export async function loginUser(email, password) { const c = await signInWithEmailAndPassword(auth, email, password); return c.user; }
export async function resetPassword(email) { await sendPasswordResetEmail(auth, email); }
export async function changeCurrentUserPassword(newPassword) { if (!auth.currentUser) throw new Error('No user'); await updatePassword(auth.currentUser, newPassword); }

export const PROJECT_ID = firebaseConfig.projectId;
export const STORAGE_BUCKET = firebaseConfig.storageBucket;

export default app;
