// Configurazione Firebase
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAW3YyFxv5tTOmIr4Cs3FHbXatMfsF-9IE",
  authDomain: "arte-registrazioni.firebaseapp.com",
  projectId: "arte-registrazioni",
  storageBucket: "arte-registrazioni.appspot.com",
  messagingSenderId: "1009537097208",
  appId: "1:1009537097208:web:09102e4ba03e338483ca0d",
  measurementId: "G-90V723Y7ZH"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);