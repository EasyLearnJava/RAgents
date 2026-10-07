/**
 * Step 3: step 1's Hello World agent, rebuilt with LangChain.
 *
 * Same rules, same replies, no model. The difference is the shape: the logic is a LangChain *chain*,
 * small steps ("Runnables") joined with .pipe() and run with .invoke():
 *
 *   normalize (RunnableLambda: trim the text)
 *     → rules (RunnableBranch: is empty? → is greeting? → fallback)
 *
 * Every LangChain building block, including model calls in later steps, shares this Runnable interface
 * (.invoke, .pipe, .batch, .stream, .streamEvents), so a branch can later be swapped for a model.
 *
 * "@langchain/core/runnables" resolves to node_modules in tests (npm install) and to the jsDelivr CDN
 * in the browser (the import map in index.html). No data leaves the browser: LangSmith tracing is off.
 */
import { RunnableBranch, RunnableLambda } from "@langchain/core/runnables";

/** Same greeting rule as step 1: hello / hi / hey at the start, any case, as a whole word. */
const GREETING = /^\s*(hello|hi|hey)\b/i;

/** Wraps a plain function as a named Runnable, so it shows up by name in streamEvents() and the diagram. */
const step = (name, fn) => RunnableLambda.from(fn).withConfig({ runName: name });

/** Chain step 1: turn whatever came in into trimmed text (null/undefined become ""). */
export const normalize = step("normalize", (message) => String(message ?? "").trim());

/**
 * Chain step 2: pick the reply. RunnableBranch tries each [condition, action] pair in order and runs the
 * action of the first condition that returns true; the last entry is the default.
 * Each reply carries the rule that produced it, so the page can show which branch fired.
 */
export const rules = RunnableBranch.from([
  [step("is empty?", (text) => text === ""),
   step("reply: hint", () => ({ reply: "Type something first. Try: Hello", rule: "empty" }))],
  [step("is greeting?", (text) => GREETING.test(text)),
   step("reply: Hello World", () => ({ reply: "Hello World", rule: "greeting" }))],
  step("reply: fallback", () => ({ reply: 'I only know one thing so far. Say "Hello"!', rule: "fallback" })),
]).withConfig({ runName: "rules" });

/** The whole agent: normalize, then rules. */
export const chain = normalize.pipe(rules).withConfig({ runName: "hello-chain" });

/**
 * Runs the chain and returns the reply plus the rule that fired.
 * @param {unknown} message What the user typed.
 * @returns {Promise<{reply: string, rule: "empty"|"greeting"|"fallback"}>}
 */
export function explain(message) {
  return chain.invoke(message);
}

/**
 * Returns just the reply text (same replies as step 1's respond()).
 * @param {unknown} message What the user typed.
 * @returns {Promise<string>}
 */
export async function respond(message) {
  return (await explain(message)).reply;
}
