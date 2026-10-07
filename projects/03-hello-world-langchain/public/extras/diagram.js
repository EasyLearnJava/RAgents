/**
 * EXTRA: a teaching aid, not part of the agent.
 *
 * Draws the "What happens when you press Send" diagram under the chat. To show LangChain's real steps it runs
 * the chain once more with chain.streamEvents(text), which reports every step as it runs (instant: no model,
 * nothing leaves the browser), and replays those events slowly.
 * index.html calls showDiagram() on the line marked EXTRA; remove it and the chat works the same.
 */
import { createFlow } from "/lib/flow.js";

const SPEC = {
  title: "What happens when you press Send",
  hint: "Each box names the function or chain step that runs. Everything happens in your browser (no model, no server). " +
        "The boxes follow LangChain's own streamEvents(), replayed slowly; the trace shows the real event names and times.",
  lanes: [
    { label: "You", nodes: [{ id: "you", title: "You", sub: "type a message, press Send (or Enter)" }] },
    { label: "index.html", nodes: [
      { id: "submit", title: "<form id=\"form\">", sub: "the browser fires a \"submit\" event → onSend(e) runs (set up with addEventListener)" },
      { id: "onsend", title: "onSend(e)", sub: "add(text, \"you\") · calls chain.invoke(text)" },
    ] },
    { label: "agent.js · LangChain chain", nodes: [
      { id: "normalize", title: "normalize", sub: "RunnableLambda: String(message).trim()" },
      { id: "rules", title: "rules", sub: "RunnableBranch: is empty? → is greeting? → fallback" },
    ] },
  ],
  response: [
    { label: "agent.js · LangChain chain", nodes: [
      { id: "r-rules", title: "rules returns", sub: "the chosen branch returns { reply, rule }" },
      { id: "r-chain", title: "chain.invoke() resolves", sub: "hello-chain finishes and hands { reply, rule } to onSend()" },
    ] },
    { label: "index.html", nodes: [
      { id: "r-onsend", title: "onSend(e) continues", sub: "const result = await chain.invoke(text) · calls add(result.reply, \"bot\")" },
      { id: "r-add", title: "add(text, who)", sub: "creates <div class=\"msg bot\">, sets textContent, appends it to #log" },
    ] },
    { label: "You", nodes: [{ id: "r-you", title: "You", sub: "see the reply bubble" }] },
  ],
};

// The diagram adds its own place under the chat, so index.html needs no diagram HTML.
const box = document.createElement("div");
box.style.width = "100%";
document.body.append(box);
const flow = createFlow(box, SPEC);

/** The chain steps worth showing (LangChain also reports unnamed internal steps). */
const SHOW = new Set(["hello-chain", "normalize", "rules", "is empty?", "is greeting?",
  "reply: hint", "reply: Hello World", "reply: fallback"]);
const short = (v) => (v && typeof v === "object" && "reply" in v ? `{reply: “${v.reply}”, rule: ${v.rule}}` : JSON.stringify(v));
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
let run = 0;                      // a newer message cancels an older replay

/** Runs the chain with streamEvents() and keeps the named steps' events (real names and times). */
async function record(chain, text) {
  const events = [];
  const t0 = performance.now();
  for await (const e of chain.streamEvents(text, { version: "v2" })) {
    if (!SHOW.has(e.name) || (e.event !== "on_chain_start" && e.event !== "on_chain_end")) continue;
    events.push({ event: e.event, name: e.name, ms: performance.now() - t0, output: e.data?.output });
  }
  return events;
}

/**
 * Replays one message: the calls on the way in, LangChain's events, then each return on the way back.
 * @param {string} text What the user typed.
 * @param {object} chain The chain from agent.js.
 */
export async function showDiagram(text, chain) {
  const id = ++run;
  const events = await record(chain, text);
  const result = events.find((e) => e.event === "on_chain_end" && e.name === "hello-chain").output;
  const typed = `“${text.trim().slice(0, 30)}”`;
  const reply = `“${result.reply.slice(0, 40)}”`;
  const step = async (node, note, line) => {
    flow.set(node, "active"); await pause(220); if (id !== run) return false;
    flow.set(node, "done", note);
    flow.log(line, node === "r-you" ? "done" : undefined);
    return true;
  };
  flow.start();
  flow.set("you", "done", text.trim() ? typed : "(empty)");
  flow.log(`You typed ${typed} and pressed Send`);
  if (!await step("submit", "submit event", 'The browser fired "submit" on <form id="form"> → onSend(e) started')) return;
  if (!await step("onsend", `chain.invoke(${typed})`, `onSend(e) added your bubble with add(text, "you"), then called chain.invoke(${typed}) in agent.js`)) return;
  const checks = [];
  for (const e of events) {
    await pause(170); if (id !== run) return;
    const when = `${e.ms.toFixed(1)} ms`;
    if (e.event === "on_chain_start") {
      if (e.name === "normalize" || e.name === "rules") flow.set(e.name, "active");
      flow.log(`[${when}] on_chain_start · ${e.name}`);
      continue;
    }
    flow.log(`[${when}] on_chain_end · ${e.name} → ${short(e.output)}`);
    if (e.name === "normalize") flow.set("normalize", "done", `“${e.output}”`);
    if (e.name.endsWith("?")) { checks.push(`${e.name} ${e.output ? "yes" : "no"}`); flow.set("rules", "active", checks.join(" · ")); }
    if (e.name.startsWith("reply:")) flow.set("rules", "done", `${checks.join(" · ")}${checks.length ? " → " : ""}${e.name}`);
    if (e.name === "rules") flow.set("r-rules", "done", `{ reply: ${reply}, rule: "${e.output.rule}" }`);
    if (e.name === "hello-chain") flow.set("r-chain", "done", "{ reply, rule } returned");
  }
  if (!await step("r-onsend", `add(${reply}, "bot")`, 'onSend(e) got the result and called add(result.reply, "bot")')) return;
  if (!await step("r-add", "<div class=\"msg bot\"> added", 'add() created a <div class="msg bot">, set its textContent and appended it to #log')) return;
  await step("r-you", reply, `You see ${reply}`);
}
