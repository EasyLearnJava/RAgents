// Step 2 settings. Fill in RECAPTCHA_SITE_KEY once (see this project's README).
// Nothing here is a secret: Firebase web config and reCAPTCHA site keys are meant to be public.

// The Gemini model Firebase AI Logic should call. Flash-Lite has the most free-tier headroom;
// gemini-3.8-flash is stronger but often returns 429 (quota) or 500 (high demand) on the free tier.
export const MODEL = "gemini-3.5-flash-lite";

// App Check site key (reCAPTCHA Enterprise). AI Logic rejects calls without App Check.
export const RECAPTCHA_SITE_KEY = "6LdVR-ItAAAAAGUxQK14RltxPK5uCA1caxO6peEG";

// The web app's firebaseConfig (Firebase console → Project settings → Your apps → ragents-web).
// Needed off Firebase Hosting (Vercel, local testing), where /__/firebase/init.json doesn't exist.
// These are the same public values Firebase Hosting serves to every visitor at /__/firebase/init.json.
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBQ6LR0D3yrrcxoAOrsbBp0HRhCjYjuCXU",
  authDomain: "ragent-eec65.firebaseapp.com",
  projectId: "ragent-eec65",
  storageBucket: "ragent-eec65.firebasestorage.app",
  messagingSenderId: "867411437292",
  appId: "1:867411437292:web:9420a2a2881532129b67c9",
};
