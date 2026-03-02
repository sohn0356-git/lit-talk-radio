import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const hasFirebaseConfig = Object.values(firebaseConfig).every(
  (value) => typeof value === "string" && value.length > 0
);

const firebaseApp = hasFirebaseConfig ? initializeApp(firebaseConfig) : null;

export const db = firebaseApp ? getFirestore(firebaseApp) : null;

export function assertFirebaseReady() {
  if (!db) {
    throw new Error(
      "Firebase 설정이 없습니다. .env 파일에 VITE_FIREBASE_* 값을 추가하세요."
    );
  }
}
