// Firebase web config is NOT secret — it's meant to be public (it just
// identifies which Firebase project to talk to; actual security comes from
// Firebase Auth + the Worker's own checks, since this app only uses
// Firebase for Auth — no Firestore, no Firebase Storage).
export const firebaseConfig = {
  apiKey: "AIzaSyDre1cOuU2JQMuI6rW5FA87zflUG3x19iY",
  authDomain: "bizmate-3a18b.firebaseapp.com",
  projectId: "bizmate-3a18b",
  storageBucket: "bizmate-3a18b.firebasestorage.app",
  messagingSenderId: "66947975463",
  appId: "1:66947975463:web:d9e9dec586881e94b3c102",
};

// Point this at your deployed Worker (or http://localhost:8787 during
// `wrangler dev`).
export const API_BASE_URL = "https://bizmate-api.YOUR-SUBDOMAIN.workers.dev";
