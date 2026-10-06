/**
 * Step 1: the Hello World agent, rule-based.
 *
 * Say "Hello" (or hi / hey) and it replies "Hello World"; anything else gets a nudge.
 * There is no model, server or API key: the browser runs respond() directly.
 * This file holds only the agent's logic, so it can be tested without a browser
 * (see ../test/agent.test.js). The chat window lives in index.html.
 */

/**
 * A greeting at the start of the message, any case: "hello", "Hi there", "HEY!".
 * The \b word boundary stops longer words such as "helloooo" or "hire" from matching.
 */
const GREETING = /^\s*(hello|hi|hey)\b/i;

/**
 * Returns the agent's reply to one message.
 *
 * @param {unknown} message What the user typed. null/undefined are treated as empty.
 * @returns {string} "Hello World" for a greeting, a hint for empty input, otherwise a nudge.
 * @example respond("hi there")   // "Hello World"
 * @example respond("weather?")   // 'I only know one thing so far. Say "Hello"!'
 */
export function respond(message) {
  const text = String(message ?? "").trim();
  if (text === "") return "Type something first. Try: Hello";
  if (GREETING.test(text)) return "Hello World";
  return 'I only know one thing so far. Say "Hello"!';
}
