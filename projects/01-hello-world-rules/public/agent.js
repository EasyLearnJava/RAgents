// Step 1: the Hello World agent, rule-based.
// Say "Hello" (or hi / hey) and it replies "Hello World". Anything else gets a nudge.

const GREETING = /^\s*(hello|hi|hey)\b/i;

export function respond(message) {
  const text = String(message ?? "").trim();
  if (text === "") return "Type something first. Try: Hello";
  if (GREETING.test(text)) return "Hello World";
  return 'I only know one thing so far. Say "Hello"!';
}
