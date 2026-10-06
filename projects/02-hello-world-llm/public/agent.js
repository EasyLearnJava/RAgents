// Step 2: the Hello World agent with a real model.
// Same idea as the picture in the notes: your code sends ONE message to a model and shows the reply.
// This file is pure logic (no Firebase imports) so it can be tested without a network.
// The Firebase wiring lives in main.js.

export const SYSTEM_INSTRUCTION =
  "You are the Hello World agent, the first step in a series of learning projects. " +
  "Reply in one or two short, friendly sentences. " +
  "If the user greets you, start your reply with 'Hello World!'.";

export const MAX_CHARS = 500;

// generate(text) -> Promise<string>: anything that sends text to a model and returns its reply.
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

// Turn SDK/API errors into messages a user (and you, while learning) can act on.
export function friendlyError(err) {
  const msg = String(err?.message ?? err ?? "");
  if (/app.?check|PERMISSION_DENIED|\b403\b/i.test(msg)) {
    return "The model refused the request because App Check isn't set up (or this browser isn't registered). See the step 2 README.";
  }
  if (/RESOURCE_EXHAUSTED|\b429\b|quota|rate.?limit/i.test(msg)) {
    return "The free model quota is used up for now. Please try again in a minute.";
  }
  if (/failed to fetch|network|offline|ERR_/i.test(msg)) {
    return "Couldn't reach the model. Check your connection and try again.";
  }
  return "Something went wrong calling the model: " + msg.slice(0, 160);
}

// Returns a setup message if the page can't call the model yet, or null when it's ready.
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
