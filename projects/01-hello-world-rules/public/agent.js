/**
 * Step 1: the Hello World agent, rule-based.
 *
 * Say "Hello" (or hi / hey) and it replies "Hello World"; anything else gets a nudge.
 * No model, no server, no API key: the browser runs respond() directly.
 * index.html calls respond() for every message; test/agent.test.js tests it.
 */

/** A greeting at the start of the message, any case: "hello", "Hi there", "HEY!" (but not "helloooo"). */
const GREETING = /^\s*(hello|hi|hey)\b/i;

/**
 * Returns the agent's reply to one message.
 * @param {unknown} message What the user typed (null/undefined count as empty).
 * @returns {string} "Hello World" for a greeting, a hint for empty input, otherwise a nudge.
 */
export function respond(message) {
  const text = String(message ?? "").trim();
  if (text === "") return "Type something first. Try: Hello";
  if (GREETING.test(text)) return "Hello World";
  return 'I only know one thing so far. Say "Hello"!';
}
