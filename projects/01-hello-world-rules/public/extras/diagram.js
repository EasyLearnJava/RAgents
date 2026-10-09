/**
 * EXTRA: a teaching aid, not part of the agent.
 *
 * Draws the "What happens when you press Send" diagram under the chat and replays each message through it,
 * naming the function that runs at each step (onSend → respond → add). The agent works the same without
 * this file: delete the lines marked EXTRA in index.html and nothing else changes.
 *
 * It learns which rule fired from the reply itself: in step 1 every rule gives a different reply, so
 * ruleFromReply() compares the reply with respond()'s own answers (test/extras.test.js checks this).
 */
import { respond } from "../agent.js";

/**
 * Which rule produced this reply: "empty", "greeting" or "fallback".
 * Uses respond()'s own replies as the reference, so the reply texts aren't copied here.
 * @param {string} reply What respond() returned.
 * @returns {"empty"|"greeting"|"fallback"}
 */
export function ruleFromReply(reply) {
  if (reply === respond("")) return "empty";
  if (reply === respond("hello")) return "greeting";
  return "fallback";
}

/** How respond() got to its answer, for each rule (the checks run in this order). street.js uses it too. */
export const PATH = {
  empty: 'text === "" → yes → return the hint',
  greeting: 'text === "" → no · GREETING.test(text) → yes → return "Hello World"',
  fallback: 'text === "" → no · GREETING.test(text) → no → return the fallback',
};

/** The diagram's boxes: request left to right, response right to left. */
const SPEC = {
  title: "What happens when you press Send",
  hint: "Each box names the function that runs. Everything happens inside your browser (no server, no model), " +
        "slowed down so you can follow it: the times in the list are the replay's, and the real ones are in the " +
        "street view's \"Where the time went\".",
  lanes: [
    { label: "You", nodes: [{ id: "you", title: "You", sub: "type a message, press Send (or Enter)" }] },
    { label: "index.html", nodes: [
      { id: "submit", title: "<form id=\"form\">", sub: "the browser fires a \"submit\" event → onSend(e) runs (set up with addEventListener)" },
      { id: "onsend", title: "onSend(e)", sub: "reads input.value · add(text, \"you\") · calls respond(text)" },
    ] },
    { label: "agent.js", nodes: [
      { id: "respond", title: "respond(message)", sub: "trim → text === \"\"? → GREETING.test(text)? → fallback" },
    ] },
  ],
  response: [
    { label: "agent.js", nodes: [
      { id: "r-respond", title: "respond() returns", sub: "return the reply text back to onSend()" },
    ] },
    { label: "index.html", nodes: [
      { id: "r-onsend", title: "onSend(e) continues", sub: "const reply = respond(text) · calls add(reply, \"bot\")" },
      { id: "r-add", title: "add(text, who)", sub: "creates <div class=\"msg bot\">, sets textContent, appends it to #log" },
    ] },
    { label: "You", nodes: [{ id: "r-you", title: "You", sub: "see the reply bubble" }] },
  ],
};

let flowReady = null;             // the diagram, created once
let run = 0;                      // a newer message cancels an older replay
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** Draws the diagram once, under the chat and the street view (style.css places it), using the shared engine (shell/lib/flow.js, served at /lib/flow.js). */
function ensureFlow() {
  flowReady ??= import("/lib/flow.js").then(({ createFlow }) => {
    const box = document.createElement("div");
    box.className = "diagram";    // style.css gives it its own row under the chat
    document.body.append(box);    // the diagram adds its own place on the page; index.html needs no diagram HTML
    return createFlow(box, SPEC);
  });
  return flowReady;
}

// Draw it as soon as the page loads (only in a browser; the tests import ruleFromReply() without a page).
if (typeof document !== "undefined") ensureFlow();

/**
 * Replays one message through the diagram. index.html calls this after showing the reply.
 * @param {string} text What the user typed.
 * @param {string} reply What respond() returned.
 */
export async function showDiagram(text, reply) {
  const flow = await ensureFlow();
  const id = ++run;
  const rule = ruleFromReply(reply);
  const typed = `“${(text.trim() || text).slice(0, 30)}”`;    // a blank message is quoted as it is: “” or “   ”
  const said = `“${reply.slice(0, 40)}”`;
  // respond() gives the hint only for a blank message: nothing typed, or only spaces (text.trim() leaves nothing).
  const blank = rule === "empty" ? (text ? "only spaces" : "nothing") : "";
  const steps = [
    ["you", typed, blank ? `You pressed Send with ${blank} typed` : `You typed ${typed} and pressed Send`],
    ["submit", "submit event", 'The browser fired "submit" on <form id="form"> → onSend(e) started'],
    ["onsend", `respond(${typed})`, blank
      ? `onSend(e) read input.value: ${blank} typed, so text.trim() was empty and there was no bubble of yours. ` +
        `Then it called respond(${typed}) in agent.js`
      : `onSend(e) read input.value, added your bubble with add(text, "you"), then called respond(${typed}) in agent.js`],
    ["respond", PATH[rule], `respond(): ${PATH[rule]}`],
    ["r-respond", said, `respond() returned ${said} to onSend(e)`],
    ["r-onsend", `add(${said}, "bot")`, 'onSend(e) got the reply and called add(reply, "bot")'],
    ["r-add", "<div class=\"msg bot\"> added", 'add() created a <div class="msg bot">, set its textContent and appended it to #log'],
    ["r-you", said, `You see ${said}`],
  ];
  flow.start();
  for (const [node, note, line] of steps) {
    flow.set(node, "active"); await pause(260); if (id !== run) return;
    flow.set(node, "done", note);
    flow.log(line, node === "r-you" ? "done" : undefined);
  }
}
