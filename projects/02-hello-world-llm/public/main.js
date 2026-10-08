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
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app-check.js";
import { getAI, getGenerativeModel, GoogleAIBackend } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-ai.js";
import { FIREBASE_CONFIG, MODEL, RECAPTCHA_SITE_KEY } from "./ai-config.js";
import { SYSTEM_INSTRUCTION, createAgent, setupProblem } from "./agent.js";

/**
 * How long to wait for a reply: the whole call, App Check token included (enforced in generate() below). Generous on
 * purpose: free-tier replies can take 20 seconds or more. The Firebase SDK's own default is 3 minutes.
 */
const REPLY_TIMEOUT_MS = 90_000;

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
 * Connects to the model once and returns the agent.
 *
 * If setup is incomplete it does not throw: it returns ready=false, and respond() replies with
 * the setup instruction, so the page can show it in the chat.
 *
 * @param {(event: object) => void} [onEvent] Optional stage reporter for the diagrams (see createAgent in agent.js).
 * @returns {Promise<{ready: boolean, model: string, respond: (message: unknown) => Promise<string>}>}
 */
export async function startAgent(onEvent) {
  const config = await loadFirebaseConfig();
  const problem = setupProblem({ config, siteKey: RECAPTCHA_SITE_KEY, model: MODEL });
  if (problem) return { ready: false, model: MODEL, respond: async () => problem };

  // On your own machine, App Check uses a debug token instead of reCAPTCHA.
  // The browser console prints it; register it once in the console (see README).
  if (["localhost", "127.0.0.1"].includes(location.hostname)) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;

  const app = initializeApp(config);
  // App Check must start before the first model call. No auto-refresh: we keep no cached (hourly) token, because
  // every model call gets its own single-use token (below). See "Hourly token or a fresh one each time?" in the README.
  initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY), isTokenAutoRefreshEnabled: false });
  // GoogleAIBackend = the Gemini Developer API (works on the free Spark plan).
  // Limited-use tokens are single-use, so a captured token can't be replayed by someone else.
  const ai = getAI(app, { backend: new GoogleAIBackend(), useLimitedUseAppCheckTokens: true });
  const model = getGenerativeModel(ai, { model: MODEL, systemInstruction: SYSTEM_INSTRUCTION });

  // One message in, one reply out (no history yet: that's step 3), within REPLY_TIMEOUT_MS for the whole call: App Check
  // token, request and reply. The SDK's own `timeout` option only cancels the final request, so it can't stop a stuck
  // App Check step; this limit can. Running out throws a "Timed out" error, which respond() turns into a friendly message.
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
