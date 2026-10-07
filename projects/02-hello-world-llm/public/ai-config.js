// Step 2 settings. Fill in RECAPTCHA_SITE_KEY once (see this project's README).
// Nothing here is a secret: Firebase web config and reCAPTCHA site keys are meant to be public.

// The Gemini model Firebase AI Logic should call. Flash-Lite has the most free-tier headroom;
// gemini-3.8-flash is stronger but often returns 429 (quota) or 500 (high demand) on the free tier.
export const MODEL = "gemini-3.5-flash-lite";

// App Check site key (reCAPTCHA Enterprise). AI Logic rejects calls without App Check.
export const RECAPTCHA_SITE_KEY = "6LdVR-ItAAAAAGUxQK14RltxPK5uCA1caxO6peEG";

// Leave null: the page loads the config from /__/firebase/init.json at runtime, so it isn't in the code.
// Firebase Hosting serves that file itself; on Vercel (vercel.json) and locally (scripts/serve.mjs)
// the request is forwarded to the Firebase site.
export const FIREBASE_CONFIG = null;
