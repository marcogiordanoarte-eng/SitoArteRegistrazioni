// Configurazione Firebase
import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

// Unify to the main project: arteregistrazioni-2025
const firebaseConfig = {
  apiKey: "AIzaSyBOE3Mq6wXNBUWYxUHxq0iBKecjpVWJuCE",
  authDomain: "arteregistrazioni-2025.firebaseapp.com",
  projectId: "arteregistrazioni-2025",
  storageBucket: "arteregistrazioni-2025.appspot.com",
  messagingSenderId: "130523873354",
  appId: "1:130523873354:web:eb48aea4dd9446270e66b3",
  measurementId: "G-XF3QX0NPZT"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const rtdb = getDatabase(app);
export const googleProvider = new GoogleAuthProvider();