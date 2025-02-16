import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyC3X3g_J09IYUjQnz6eFdHUCr91SdG8-u0",
  authDomain: "arabemerge-ticket.firebaseapp.com",
  projectId: "arabemerge-ticket",
  storageBucket: "arabemerge-ticket.firebasestorage.app",
  messagingSenderId: "1081596127429",
  appId: "1:1081596127429:web:d0a690799134bd032928ac"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
