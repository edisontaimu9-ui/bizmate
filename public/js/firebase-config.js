// Firebase web config is NOT secret — it's meant to be public (it just
// identifies which Firebase project to talk to; actual security comes from
// Firebase Auth + Firestore Security Rules + the Worker's own checks).
// Get these values from Firebase Console > Project Settings > Your apps > Web app.
export const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
};

// Point this at your deployed Worker (or http://localhost:8787 during
// `wrangler dev`).
export const API_BASE_URL = "https://bizmate-api.YOUR-SUBDOMAIN.workers.dev";
