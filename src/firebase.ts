import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB_rX1kBkAJIt4gcmxZPESe5LAoKPgtHaQ",
  authDomain: "portfolio-pro-app.firebaseapp.com",
  projectId: "portfolio-pro-app",
  storageBucket: "portfolio-pro-app.firebasestorage.app",
  messagingSenderId: "842442999279",
  appId: "1:842442999279:web:f863bdf05695470fd2e21a",
  measurementId: "G-BHQDLJ24CM"
};

export const isFirebaseConfigured = true;

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
