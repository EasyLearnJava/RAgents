/**
 * Firebase wiring for step 2: config -> App Check -> AI Logic (Gemini Developer API) -> model.
 *
 * Why it's built this way:
 * - No API key in this code: Firebase AI Logic holds the Gemini key on Google's side.
 * - App Check proves requests come from this site; AI Logic rejects calls without it (403).
 * - The Firebase SDK loads straight from Google's CDN (version pinned below), so there is no build step.
 *
 * The page (index.html) calls startAgent() once, then respond(message) for each message.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getToken, initializeAppCheck, onTokenChanged, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app-check.js";
import { getAI, getGenerativeModel, GoogleAIBackend } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-ai.js";
import { FIREBASE_CONFIG, MODEL, RECAPTCHA_SITE_KEY } from "./ai-config.js";
import { SYSTEM_INSTRUCTION, createAgent, setupProblem } from "./agent.js";

/**
 * How long to wait for a reply: the whole call (enforced in generate() below), including any wait for an App Check
 * token. Generous on purpose: free-tier replies can take 20 seconds or more. The Firebase SDK's own default is 3 minutes.
 */
const REPLY_TIMEOUT_MS = 90_000;

/**
 * The name of the Firebase app object this page creates (without one, Firebase calls it "[DEFAULT]"). It only exists in
 * the browser; we reuse the web app's nickname from the Firebase console so it's easy to recognise. It's part of the keys
 * the SDK saves in IndexedDB: "<App ID>-ragents-web" for the cached App Check token, "ragents-web!<App ID>" for the
 * daily heartbeat.
 */
const APP_NAME = "ragents-web";

/**
 * Finds the Firebase web config: FIREBASE_CONFIG from ai-config.js if set, otherwise
 * /__/firebase/init.json (served by Firebase Hosting; forwarded there on Vercel and by the local server).
 *
 * @returns {Promise<object|null>} The config object, or null when neither source is available.
 */
async function loadFirebaseConfig() {
  if (FIREBASE_CONFIG) return FIREBASE_CONFIG;
  try {
    // Firebase Hosting serves the project's web app config here automatically.
    const res = await fetch("/__/firebase/init.json");
    if (res.ok) return await res.json();
  } catch { /* not on Firebase Hosting */ }
  return null;
}

/**
 * When an App Check token was issued and when it expires, read from the token itself (a signed JWT whose middle part
 * is plain JSON). Only these two times leave this file: the token is a credential and is never shown.
 *
 * @param {string} jwt An App Check token.
 * @returns {{issuedAt?: number, expiresAt?: number}} Times in milliseconds, or {} if it can't be read.
 */
function tokenTimes(jwt) {
  try {
    const part = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(part.padEnd(Math.ceil(part.length / 4) * 4, "=")));
    return { issuedAt: claims.iat * 1000, expiresAt: claims.exp * 1000 };
  } catch {
    return {};
  }
}

/**
 * Connects to the model once and returns the agent.
 *
 * If setup is incomplete it does not throw: it returns ready=false, and respond() replies with
 * the setup instruction, so the page can show it in the chat.
 *
 * @param {(event: object) => void} [onEvent] Optional stage reporter for the diagrams (see createAgent in agent.js). It also
 *   gets {type: "token", issuedAt, expiresAt} for the cached App Check token (fetched, loaded or renewed) and
 *   {type: "token-error", message} when App Check can't give one.
 * @returns {Promise<{ready: boolean, model: string, respond: (message: unknown) => Promise<string>}>}
 */
export async function startAgent(onEvent) {
  const config = await loadFirebaseConfig();
  const problem = setupProblem({ config, siteKey: RECAPTCHA_SITE_KEY, model: MODEL });
  if (problem) return { ready: false, model: MODEL, respond: async () => problem };

  // On your own machine, App Check uses a debug token instead of reCAPTCHA.
  // The browser console prints it; register it once in the console (see README).
  if (["localhost", "127.0.0.1"].includes(location.hostname)) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;

  const app = initializeApp(config, APP_NAME);
  // App Check must start before the first model call. One hourly token: fetched when the page loads (unless one saved
  // in this browser is still fresh), cached in the browser and renewed in the background about 35 minutes into its hour.
  // See "Hourly token or a fresh one each time?" in the README.
  const appCheck = initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY), isTokenAutoRefreshEnabled: true });
  // Optional: tell the page about the cached token (its times only), so the street view can show when it expires.
  // getToken() reports the first one (it waits for the request App Check is already making, so it adds none);
  // onTokenChanged() reports renewals (in debug mode only after a reload: the SDK doesn't announce new debug tokens).
  if (onEvent) {
    const report = (t) => onEvent({ type: "token", ...tokenTimes(t.token) });
    const failed = (err) => onEvent({ type: "token-error", message: String(err?.message ?? err) });
    onTokenChanged(appCheck, report, failed);
    getToken(appCheck).then(report, failed).catch((err) => console.error("onEvent failed:", err));
  }
  // GoogleAIBackend = the Gemini Developer API (works on the free Spark plan).
  // useLimitedUseAppCheckTokens: false = every request carries the cached hourly token, so no message makes a token
  // request of its own (true would fetch a fresh single-use token for every request).
  const ai = getAI(app, { backend: new GoogleAIBackend(), useLimitedUseAppCheckTokens: false });
  const model = getGenerativeModel(ai, { model: MODEL, systemInstruction: SYSTEM_INSTRUCTION });

  // One message in, one reply out (no history yet: that's step 3), within REPLY_TIMEOUT_MS for the whole call. A message
  // only waits for an App Check token if the cached one is missing or expired. The SDK's own `timeout` option only cancels
  // the final request, so it can't stop a stuck App Check step; this limit can. Running out throws a "Timed out" error,
  // which respond() turns into a friendly message.
  const generate = async (text) => {
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(new DOMException(`Timed out: no reply within ${REPLY_TIMEOUT_MS / 1000} s`, "TimeoutError")),
      REPLY_TIMEOUT_MS);
    const gaveUp = new Promise((_, reject) => stop.signal.addEventListener("abort", () => reject(stop.signal.reason), { once: true }));
    try {
      return (await Promise.race([model.generateContent(text, { signal: stop.signal }), gaveUp])).response.text();
    } finally {
      clearTimeout(timer);
    }
  };
  return { ready: true, model: MODEL, respond: createAgent(generate, onEvent) };
}
