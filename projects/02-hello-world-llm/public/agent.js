/**
 * Step 2: the Hello World agent with a real model.
 *
 * Your code sends ONE message to a model and shows the reply (no conversation history yet).
 * This file is pure logic with no Firebase imports, so it can be tested without a network:
 * the actual model call is passed in as a `generate` function. The Firebase wiring that
 * provides that function lives in main.js.
 *
 * Who calls what (no function here is test-only; the tests call them too):
 * - createAgent(generate, onEvent): main.js's startAgent() builds the agent with it; the returned
 *   respond(message) is what index.html's onSend() calls for every message.
 * - errorKind(err), friendlyError(err): used inside respond() when the model call fails.
 * - setupProblem(...): main.js's startAgent() checks the setup with it before connecting.
 * - SYSTEM_INSTRUCTION: main.js sends it to Gemini with every message.
 */

/**
 * Standing instructions sent to the model with every message. The reply shown in the chat is exactly
 * what the model returns; this only shapes it. Kept short and neutral (it used to ask for a "Hello World!"
 * opener, which the small model added to every reply). Set it to "" to send no instructions at all.
 */
export const SYSTEM_INSTRUCTION = "You are a helpful assistant. Keep replies short: one to three sentences.";

/** Longest message accepted. Keeps requests small and protects the free model quota. */
export const MAX_CHARS = 500;

/**
 * Builds the agent around any model call.
 *
 * Checks happen before the model is called (empty or too-long input never costs a request),
 * and every failure becomes a readable message instead of a crash.
 *
 * @param {(text: string) => Promise<string>} generate Sends text to a model and resolves to its reply.
 *   main.js passes the Gemini call; the tests pass a fake.
 * @param {(event: object) => void} [onEvent] Optional: told what happens at each stage, so the page's
 *   flow diagram can show it. Events, in order:
 *   {type: "rejected", reason: "empty"|"too-long"} - stopped before the model (no request made), or
 *   {type: "accepted", chars} then {type: "model-start"} then one of
 *   {type: "model-ok", ms, chars} | {type: "model-empty", ms} | {type: "model-error", ms, kind, message}.
 * @returns {(message: unknown) => Promise<string>} `respond(message)`: always resolves to text to show
 *   in the chat, never rejects.
 */
export function createAgent(generate, onEvent = () => {}) {
  return async function respond(message) {
    const text = String(message ?? "").trim();
    if (text === "") { onEvent({ type: "rejected", reason: "empty" }); return "Type something first. Try: Hello"; }
    if (text.length > MAX_CHARS) {
      onEvent({ type: "rejected", reason: "too-long" });
      return `That's a long message. Please keep it under ${MAX_CHARS} characters.`;
    }
    onEvent({ type: "accepted", chars: text.length });
    onEvent({ type: "model-start" });
    const t0 = Date.now();
    try {
      const reply = String((await generate(text)) ?? "").trim();
      if (!reply) { onEvent({ type: "model-empty", ms: Date.now() - t0 }); return "The model sent an empty reply. Please try again."; }
      onEvent({ type: "model-ok", ms: Date.now() - t0, chars: reply.length });
      return reply;
    } catch (err) {
      onEvent({ type: "model-error", ms: Date.now() - t0, kind: errorKind(err), message: String(err?.message ?? err ?? "") });
      return friendlyError(err);
    }
  };
}

/**
 * Classifies an SDK/API error by where it happened.
 *
 * @param {unknown} err The thrown error (or any value).
 * @returns {"appcheck"|"quota"|"busy"|"network"|"other"}
 *   appcheck = rejected by App Check / AI Logic (403); quota = 429; busy = model overloaded (500/503);
 *   network = never reached Google.
 */
export function errorKind(err) {
  const msg = String(err?.message ?? err ?? "");
  if (/app.?check|PERMISSION_DENIED|\b403\b/i.test(msg)) return "appcheck";
  if (/RESOURCE_EXHAUSTED|\b429\b|quota|rate.?limit/i.test(msg)) return "quota";
  if (/high demand|overloaded|UNAVAILABLE|\b50[03]\b/i.test(msg)) return "busy";
  if (/failed to fetch|network|offline|ERR_/i.test(msg)) return "network";
  return "other";
}

/**
 * Turns SDK/API errors into messages a user (and you, while learning) can act on.
 *
 * Recognised cases: App Check / permission (403), quota or rate limit (429), model busy (500/503),
 * network failures.
 * Anything else is shown with its original text, shortened to 160 characters.
 *
 * @param {unknown} err The thrown error (or any value).
 * @returns {string} A message to show in the chat.
 */
export function friendlyError(err) {
  switch (errorKind(err)) {
    case "appcheck":
      return "The model refused the request because App Check isn't set up (or this browser isn't registered). See the step 2 README.";
    case "quota": return "The free model quota is used up for now. Please try again in a minute.";
    case "busy": return "The model is busy right now (high demand). Please try again in a moment.";
    case "network": return "Couldn't reach the model. Check your connection and try again.";
    default: return "Something went wrong calling the model: " + String(err?.message ?? err ?? "").slice(0, 160);
  }
}

/**
 * Checks the one-time setup before any model call, so a missing step shows a clear instruction
 * instead of a confusing SDK error.
 *
 * @param {{config: object|null, siteKey: string, model: string}} setup
 *   config: Firebase web config (or null if not found); siteKey: App Check reCAPTCHA site key;
 *   model: Gemini model name.
 * @returns {string|null} What to fix, or null when everything needed is present.
 */
export function setupProblem({ config, siteKey, model }) {
  if (!config) {
    return "Setup needed: no Firebase web config found. On Firebase Hosting, register a Web app in the console " +
      "(Project Overview → Add app → Web). For local testing, paste the config into ai-config.js.";
  }
  if (!siteKey) {
    return "Setup needed: add your App Check reCAPTCHA site key to RECAPTCHA_SITE_KEY in ai-config.js (see the step 2 README).";
  }
  if (!model) return "Setup needed: set MODEL in ai-config.js.";
  return null;
}
