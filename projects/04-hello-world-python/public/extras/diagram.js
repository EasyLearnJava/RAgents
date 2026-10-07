/**
 * EXTRA: a teaching aid, not part of the agent.
 *
 * Draws the "What happens when you press Send" diagram under the chat and replays each round trip:
 * onSend → api() → fetch → chat() (main.py) → run_with_events() (agent.py) → chain, and back.
 * The server's LangChain events come back in the JSON reply, so the replay shows real server-side steps and times.
 * index.html calls showDiagram() on the line marked EXTRA; remove it and the chat works the same.
 */
import { createFlow } from "/lib/flow.js";

const SPEC = {
  title: "What happens when you press Send",
  hint: "Each box names the function that runs, in the browser (index.html) and on the Python server (main.py, agent.py). " +
        "The reply comes back as JSON with the server's own LangChain events, replayed slowly; the trace shows real server times.",
  lanes: [
    { label: "You", nodes: [{ id: "you", title: "You", sub: "type a message, press Send (or Enter)" }] },
    { label: "index.html", nodes: [
      { id: "submit", title: "<form id=\"form\">", sub: "the browser fires a \"submit\" event → onSend(e) runs (set up with addEventListener)" },
      { id: "onsend", title: "onSend(e)", sub: "add(text, \"you\") · add(\"thinking…\") · calls api(\"/api/step4/chat\", { message }), which sends fetch POST" },
    ] },
    { label: "Python server · main.py, agent.py", nodes: [
      { id: "chat", title: "chat(body)", sub: "main.py (FastAPI): checks ≤ 1000 characters → calls run_with_events(message)" },
      { id: "runwith", title: "run_with_events()", sub: "agent.py: run_with_events(message) → async for … chain.astream_events(message)" },
      { id: "chain", title: "chain", sub: "normalize | rules (is empty? → is greeting? → fallback)" },
    ] },
  ],
  response: [
    { label: "Python server · main.py, agent.py", nodes: [
      { id: "r-chain", title: "rules returns", sub: "the chosen branch returns { reply, rule }" },
      { id: "r-runwith", title: "run_with_events() returns", sub: "return (result, events, server_ms) to chat()" },
      { id: "r-chat", title: "chat() returns", sub: "JSON { reply, rule, events, server_ms } → sent back over HTTP" },
    ] },
    { label: "index.html", nodes: [
      { id: "r-onsend", title: "onSend(e) continues", sub: "api() resolves { ok, status, data } · thinking.remove() · calls add(res.data.reply, \"bot\")" },
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

const short = (v) => (v && typeof v === "object" && "reply" in v ? `{reply: “${v.reply}”, rule: ${v.rule}}` : JSON.stringify(v));
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
let run = 0;                      // a newer message cancels an older replay

/**
 * Replays one round trip, naming each function: the calls on the way in, the server's events, then each return.
 * @param {string} text What the user typed.
 * @param {{ok: boolean, status: number, data: object}} res What api() returned.
 * @param {number} totalMs The full round trip, measured by index.html.
 * @param {string} shown What the chat showed (the reply, or why it failed).
 */
export async function showDiagram(text, res, totalMs, shown) {
  const id = ++run;
  const typed = `“${text.trim().slice(0, 30)}”`;
  const step = async (node, state, note, line) => {
    flow.set(node, "active"); await pause(220); if (id !== run) return false;
    flow.set(node, state, note);
    if (line) flow.log(line, state === "error" ? "error" : node === "r-you" ? "done" : undefined);
    return true;
  };
  flow.start();
  flow.set("you", "done", text.trim() ? typed : "(empty)");
  flow.log(`You typed ${typed} and pressed Send`);
  if (!await step("submit", "done", "submit event", 'The browser fired "submit" on <form id="form"> → onSend(e) started')) return;
  if (!await step("onsend", "done", "api(\"/api/step4/chat\")", `onSend(e) added your bubble and “thinking…”, then called api("/api/step4/chat", { message }) → fetch POST (round trip ${totalMs.toFixed(0)} ms)`)) return;

  if (!res.ok) {                  // rejected (422) or the server didn't answer
    const rejected = res.status === 422;
    await step("chat", "error", rejected ? "rejected (422)" : "not reachable",
      rejected ? "chat(body): FastAPI rejected it (more than 1000 characters) before run_with_events() was called"
               : `The server didn't answer: ${shown}`);
    for (const node of ["runwith", "chain", "r-chain", "r-runwith"]) flow.set(node, "skip");
    if (rejected) { if (!await step("r-chat", "error", "422 JSON sent back", "FastAPI sent back a 422 error as JSON")) return; }
    else flow.set("r-chat", "skip");
    if (!await step("r-onsend", "done", "add(error message)", 'api() resolved with ok: false; onSend(e) called add(whyFailed(res), "bot")')) return;
    if (!await step("r-add", "done", "<div class=\"msg bot\"> added", 'add() created a <div class="msg bot"> with the error message')) return;
    await step("r-you", "done", "the error message", "You see the error message");
    return;
  }

  const { events, server_ms, reply } = res.data;
  const said = `“${reply.slice(0, 40)}”`;
  if (!await step("chat", "done", "valid → run_with_events()", `chat(body): FastAPI checked the length and called run_with_events(message) (${server_ms} ms on the server, ${(totalMs - server_ms).toFixed(0)} ms on the network)`)) return;
  if (!await step("runwith", "done", "chain.astream_events()", "run_with_events() in agent.py called chain.astream_events(message)")) return;
  const path = [];
  for (const e of events) {
    await pause(170); if (id !== run) return;
    if (e.event === "on_chain_start") {
      if (e.name === "normalize" || e.name === "rules") flow.set("chain", "active", path.join(" · ") || e.name);
      flow.log(`[server ${e.ms} ms] on_chain_start · ${e.name}`);
      continue;
    }
    flow.log(`[server ${e.ms} ms] on_chain_end · ${e.name} → ${short(e.output)}`);
    if (e.name === "normalize") path.push(`normalize → “${e.output}”`);
    if (e.name.endsWith("?")) path.push(`${e.name} ${e.output ? "yes" : "no"}`);
    if (e.name.startsWith("reply:")) path.push(e.name);
    if (e.name === "rules") flow.set("chain", "done", path.join(" · "));
    else if (e.name !== "hello-chain") flow.set("chain", "active", path.join(" · "));
  }
  const rule = events.find((e) => e.event === "on_chain_end" && e.name === "rules")?.output?.rule;
  if (!await step("r-chain", "done", `{ reply: ${said}, rule: "${rule}" }`, `rules returned { reply: ${said}, rule: "${rule}" }`)) return;
  if (!await step("r-runwith", "done", "(result, events, server_ms)", "run_with_events() returned (result, events, server_ms) to chat()")) return;
  if (!await step("r-chat", "done", "JSON sent back", "chat() returned { reply, rule, events, server_ms }; FastAPI sent it back as JSON")) return;
  if (!await step("r-onsend", "done", `add(${said}, "bot")`, 'api() resolved with { ok: true, data }; onSend(e) removed “thinking…” and called add(res.data.reply, "bot")')) return;
  if (!await step("r-add", "done", "<div class=\"msg bot\"> added", 'add() created a <div class="msg bot">, set its textContent and appended it to #log')) return;
  await step("r-you", "done", said, `You see ${said}`);
}
