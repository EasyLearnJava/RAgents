/**
 * EXTRA: a teaching aid, not part of the agent.
 *
 * Records LangChain's own report of one message for the diagram and the street view: it runs the chain once more with
 * chain.streamEvents(text), which reports every step as it runs, and keeps the named steps' start and end events with
 * their outputs and the time this page received each one. index.html records once per message and hands the same
 * recording to both, so each message runs the chain twice in all: the real chain.invoke(), then this.
 *
 * It waits until the browser has drawn the reply. A run finishes without giving the browser a chance to draw (so does
 * chain.invoke() itself), so starting it straight away would hold up the reply and the real run's timings.
 * No model and no network: it all runs in your browser.
 */

/** The chain steps agent.js names (LangChain also reports each step's output chunks, which the extras don't use). */
export const STEPS = new Set(["hello-chain", "normalize", "rules", "is empty?", "is greeting?",
  "reply: hint", "reply: Hello World", "reply: fallback"]);

/** Resolves once the browser has drawn its next frame (straight away in Node, which has no frames). */
function afterNextFrame() {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== "function") { resolve(); return; }
    requestAnimationFrame(() => setTimeout(resolve, 0));      // the frame's callbacks run, it's drawn, then this
    setTimeout(resolve, 1000);                                 // a hidden page draws no frames: don't wait for ever
  });
}

/**
 * Runs the chain once with streamEvents() and keeps the named steps' start and end events.
 * @param {object} chain The chain from agent.js.
 * @param {string} text What the user typed.
 * @returns {Promise<{events: {event: string, name: string, ms: number, output?: unknown}[], ms: number}>} The events in
 *   the order LangChain reported them, each with `ms`: when this page received it, in ms since the run started. The
 *   outer `ms` is the whole run's time.
 */
export async function record(chain, text) {
  await afterNextFrame();
  const events = [];
  const t0 = performance.now();
  for await (const e of chain.streamEvents(text, { version: "v2" })) {
    if (!STEPS.has(e.name) || (e.event !== "on_chain_start" && e.event !== "on_chain_end")) continue;
    events.push({ event: e.event, name: e.name, ms: performance.now() - t0, output: e.data?.output });
  }
  return { events, ms: performance.now() - t0 };
}
