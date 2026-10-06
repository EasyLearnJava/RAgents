/**
 * Step 2: the Hello World agent with a real model.
 *
 * Your code sends ONE message to a model and shows the reply (no conversation history yet).
 * This file is pure logic with no Firebase imports, so it can be tested without a network:
 * the actual model call is passed in as a `generate` function. The Firebase wiring that
 * provides that function lives in main.js.
 */

/** Standing instructions sent to the model with every message (its "personality"). */
export const SYSTEM_INSTRUCTION =
  "You are the Hello World agent, the first step in a series of learning projects. " +
  "Reply in one or two short, friendly sentences. " +
  "If the user greets you, start your reply with 'Hello World!'.";

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
 * @returns {(message: unknown) => Promise<string>} `respond(message)`: always resolves to text to show
 *   in the chat, never rejects.
 */
export function createAgent(generate) {
  return async function respond(message) {
    const text = String(message ?? "").trim();
    if (text === "") return "Type something first. Try: Hello";
    if (text.length > MAX_CHARS) return `That's a long message. Please keep it under ${MAX_CHARS} characters.`;
    try {
      const reply = String((await generate(text)) ?? "").trim();
      return reply || "The model sent an empty reply. Please try again.";
    } catch (err) {
      return friendlyError(err);
    }
  };
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
  const msg = String(err?.message ?? err ?? "");
  if (/app.?check|PERMISSION_DENIED|\b403\b/i.test(msg)) {
    return "The model refused the request because App Check isn't set up (or this browser isn't registered). See the step 2 README.";
  }
  if (/RESOURCE_EXHAUSTED|\b429\b|quota|rate.?limit/i.test(msg)) {
    return "The free model quota is used up for now. Please try again in a minute.";
  }
  if (/high demand|overloaded|UNAVAILABLE|\b50[03]\b/i.test(msg)) {
    return "The model is busy right now (high demand). Please try again in a moment.";
  }
  if (/failed to fetch|network|offline|ERR_/i.test(msg)) {
    return "Couldn't reach the model. Check your connection and try again.";
  }
  return "Something went wrong calling the model: " + msg.slice(0, 160);
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
