// Step 2 settings. Fill in RECAPTCHA_SITE_KEY once (see this project's README).
// Nothing here is a secret: Firebase web config and reCAPTCHA site keys are meant to be public.

// The Gemini model Firebase AI Logic should call (Firebase's own quickstart uses this one).
export const MODEL = "gemini-3.8-flash";

// App Check site key (reCAPTCHA Enterprise). AI Logic rejects calls without App Check.
export const RECAPTCHA_SITE_KEY = "";

// Leave null on Firebase Hosting: the config loads automatically from /__/firebase/init.json.
// For local testing (http://127.0.0.1), paste your web app's firebaseConfig object here instead.
export const FIREBASE_CONFIG = null;
