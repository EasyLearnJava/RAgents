/**
 * EXTRA: a teaching aid, not part of the agent.
 *
 * Draws the "What happens when you press Send" diagram under the chat and fills it in as a message travels:
 * onSend → respond (agent.js) → generate (main.js) → Firebase AI Logic → Gemini, and back.
 * index.html calls it on the lines marked EXTRA; remove those lines and the chat works the same.
 *
 *   diagram.event   pass to startAgent(); agent.js reports each stage through it (input checked, call started, ok/error)
 *   diagram.start   a new message was sent
 *   diagram.reply   the reply is on the page: replay the way back
 *   diagram.setupProblem   setup isn't finished (shown on page load)
 */
import { createFlow } from "/lib/flow.js";
import { MODEL } from "../ai-config.js";

const SPEC = {
  title: "What happens when you press Send",
  hint: "Each box names the function that runs. generate(), Firebase AI Logic and Gemini happen in one request: " +
        "they light up in order while you wait, then each shows its real result. The way back is slowed down slightly.",
  lanes: [
    { label: "You", nodes: [{ id: "you", title: "You", sub: "type a message, press Send (or Enter)" }] },
    { label: "index.html", nodes: [
      { id: "submit", title: "<form id=\"form\">", sub: "the browser fires a \"submit\" event → onSend(e) runs (set up with addEventListener)" },
      { id: "onsend", title: "onSend(e)", sub: "add(text, \"you\") · add(\"thinking…\") · calls agent.respond(text)" },
    ] },
    { label: "agent.js · main.js", nodes: [
      { id: "respond", title: "respond(message)", sub: "agent.js (built by createAgent): empty? ≤ 500 characters? → calls generate(text)" },
      { id: "generate", title: "generate(text)", sub: "main.js: model.generateContent(text); the Firebase SDK adds a single-use App Check token" },
    ] },
    { label: "Google Cloud", nodes: [
      { id: "ailogic", title: "Firebase AI Logic", sub: "checks the App Check token, adds the Gemini key" },
      { id: "gemini", title: `Gemini · ${MODEL}`, sub: "system instruction + your one message" },
    ] },
  ],
  response: [
    { label: "Google Cloud", nodes: [
      { id: "r-gemini", title: "Gemini", sub: "writes the reply (or returns an error)" },
      { id: "r-ailogic", title: "Firebase AI Logic", sub: "sends the result back to your browser" },
    ] },
    { label: "agent.js · main.js", nodes: [
      { id: "r-generate", title: "generate() returns", sub: "main.js: return response.text() to respond()" },
      { id: "r-respond", title: "respond() returns", sub: "agent.js: trims the reply (errors → friendlyError(err)) and returns text to onSend()" },
    ] },
    { label: "index.html", nodes: [
      { id: "r-onsend", title: "onSend(e) continues", sub: "const reply = await agent.respond(text) · thinking.remove() · calls add(reply, \"bot\")" },
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

const REQUEST = ["generate", "ailogic", "gemini"];
const ERRORS = {
  appcheck: { at: ["ailogic"], note: "rejected (403)", why: "Firebase AI Logic refused the request: App Check token missing or invalid" },
  network: { at: ["generate"], note: "couldn't reach Google", why: "the request never reached Google (network/offline)" },
  quota: { at: ["gemini"], note: "quota used up (429)", why: "Gemini's quota limit was reached" },
  busy: { at: ["gemini"], note: "busy (500/503)", why: "Gemini is overloaded right now" },
  other: { at: ["gemini"], note: "error", why: "the model call failed" },
};
let timers = [];                  // lights the boxes in order while the single request is in flight
let outcome = null;               // what happened on the way there; decides how the way back is drawn
let run = 0;                      // a newer message cancels an older replay
const stopTimers = () => { timers.forEach(clearTimeout); timers = []; };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** Request row: agent.js reports each stage here (createAgent's onEvent). */
function event(e) {
  outcome = e;
  if (e.type === "rejected") {
    const why = e.reason === "empty" ? "nothing typed" : "longer than 500 characters";
    flow.set("respond", "error", `${why} → returns a hint, generate() not called`);
    REQUEST.forEach((id) => flow.set(id, "skip"));
    flow.log(`respond(): ${why}, so it returns a hint straight away. generate() isn't called: no request, no quota used.`, "error");
  } else if (e.type === "accepted") {
    flow.set("respond", "done", `${e.chars} characters OK → generate(text)`);
    flow.log(`respond() checked the input (${e.chars} characters) and called generate(text) in main.js`);
  } else if (e.type === "model-start") {
    flow.set("generate", "active");
    flow.log("generate(text) called model.generateContent(text); the Firebase SDK added a single-use App Check token and sent the request…");
    timers.push(setTimeout(() => flow.set("ailogic", "active"), 250));
    timers.push(setTimeout(() => flow.set("gemini", "active"), 500));
  } else if (e.type === "model-ok" || e.type === "model-empty") {
    stopTimers();
    flow.set("generate", "done", "request sent with the token");
    flow.set("ailogic", "done", "token OK, key added, forwarded");
    flow.set("gemini", "done", `answered in ${e.ms} ms`);
    flow.log(`Firebase AI Logic accepted the token and forwarded it; Gemini answered in ${e.ms} ms. It saw only the system instruction and this one message (no history yet).`);
  } else if (e.type === "model-error") {
    stopTimers();
    const err = ERRORS[e.kind] || ERRORS.other;
    for (const id of REQUEST) {
      if (err.at.includes(id)) flow.set(id, "error", err.note);
      else if (REQUEST.indexOf(id) < REQUEST.indexOf(err.at[0])) flow.set(id, "done");
      else flow.set(id, "skip");
    }
    flow.log(`Failed after ${e.ms} ms: ${err.why}.`, "error");
  }
}

/** A new message was sent: reset the diagram and show the steps in index.html. */
function start(text, ready) {
  stopTimers();
  run++;
  outcome = null;
  flow.start();
  flow.set("you", "done", text.trim() ? `“${text.trim().slice(0, 30)}”` : "(empty)");
  flow.log(`You typed “${text.trim().slice(0, 80)}” and pressed Send`);
  flow.set("submit", "done", "submit event");
  flow.log('The browser fired "submit" on <form id="form"> → onSend(e) started');
  flow.set("onsend", "done", "agent.respond(text)");
  flow.log("onSend(e) read input.value, added your bubble and “thinking…”, then called agent.respond(text)");
  if (!ready) {
    flow.set("respond", "error", "setup needed");
    REQUEST.forEach((box) => flow.set(box, "skip"));
    flow.log("Setup isn't finished, so no request was sent.", "error");
  }
}

/**
 * Response row: replays the way back, one box at a time, from what actually happened.
 * Errors travel back too: Google returns an error status, generate() throws, respond() catches it and
 * friendlyError(err) turns it into a readable message.
 */
async function reply(text) {
  const id = run;
  const o = outcome || {};
  const short = `“${text.slice(0, 40)}${text.length > 40 ? "…" : ""}”`;
  const err = o.type === "model-error" ? (ERRORS[o.kind] || ERRORS.other) : null;
  const code = { appcheck: "403", quota: "429", busy: "500/503" }[o.kind] || "error";
  let steps;                      // [box, state, note, trace line] for each hop on the way back
  if (o.type === "rejected") {
    steps = [["r-gemini", "skip"], ["r-ailogic", "skip"], ["r-generate", "skip"],
      ["r-respond", "done", "returned a hint", "respond() returned a hint to onSend() (nothing was sent)"]];
  } else if (o.type === "model-ok") {
    steps = [["r-gemini", "done", `${o.chars} characters`, `Gemini wrote a ${o.chars}-character reply`],
      ["r-ailogic", "done", "200 OK", "Firebase AI Logic sent it back to the browser"],
      ["r-generate", "done", "returned response.text()", "generate() returned response.text() to respond()"],
      ["r-respond", "done", "trimmed → returned reply", "respond() trimmed it, checked it isn't empty and returned it to onSend()"]];
  } else if (o.type === "model-empty") {
    steps = [["r-gemini", "error", "empty reply", "Gemini returned an empty reply"],
      ["r-ailogic", "done", "200 OK", "Firebase AI Logic sent it back"],
      ["r-generate", "done", "returned empty text", "generate() returned an empty string to respond()"],
      ["r-respond", "done", "→ “try again” message", "respond() returned a “please try again” message instead"]];
  } else if (err && o.kind === "network") {
    steps = [["r-gemini", "skip"], ["r-ailogic", "skip"],
      ["r-generate", "error", "threw a network error", "generate() threw a network error (nothing came back)"],
      ["r-respond", "done", "caught → friendlyError(err)", "respond() caught it; friendlyError(err) turned it into a friendly message"]];
  } else if (err) {
    steps = [
      o.kind === "appcheck" ? ["r-gemini", "skip"] : ["r-gemini", "error", err.note, `Gemini returned an error: ${err.note}`],
      ["r-ailogic", "error", `${code} sent back`, `Firebase AI Logic sent back an error (${code})`],
      ["r-generate", "error", "threw an error", "generate(): model.generateContent() threw the error"],
      ["r-respond", "done", "caught → friendlyError(err)", "respond() caught it; friendlyError(err) turned it into a friendly message"]];
  } else {                        // setup incomplete: the agent answered with the setup message, nothing was sent
    steps = [["r-gemini", "skip"], ["r-ailogic", "skip"], ["r-generate", "skip"],
      ["r-respond", "done", "returned the setup message", "respond() returned the setup message (nothing was sent)"]];
  }
  steps.push(["r-onsend", "done", `add(${short}, "bot")`, "onSend(e) got the reply, removed “thinking…” and called add(reply, \"bot\")"]);
  steps.push(["r-add", "done", "<div class=\"msg bot\"> added", 'add() created a <div class="msg bot">, set its textContent and appended it to #log']);
  steps.push(["r-you", "done", short, `You see ${short}`]);
  for (const [node, state, note, line] of steps) {
    if (state === "skip") { flow.set(node, "skip"); continue; }
    flow.set(node, "active"); await pause(220); if (id !== run) return;
    flow.set(node, state, note);
    if (line) flow.log(line, node === "r-you" ? "done" : state === "error" ? "error" : undefined);
  }
}

/** Setup isn't finished (shown once when the page loads). */
function setupProblem(problem) {
  flow.set("respond", "error", "setup needed");
  flow.log(problem, "error");
}

export const diagram = { event, start, reply, setupProblem };
