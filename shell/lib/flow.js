/**
 * flow.js: a live "what happens when you press Send" diagram, shared by every step.
 *
 * Each project page describes its own boxes (grouped into lanes such as "Your browser" and
 * "Google Cloud") and then reports what really happens while a message is handled:
 *
 *   const flow = createFlow(document.getElementById("flow"), spec);
 *   flow.start();                          // new message: reset boxes and the trace
 *   flow.set("agent", "active");           // box is working (pulses)
 *   flow.set("agent", "done", "rule matched: greeting");   // finished, with a note under the box
 *   flow.log("agent.js: greeting rule matched");            // add a line to the trace
 *
 * Box states: "idle" | "active" | "done" | "error" | "skip".
 * Served at /lib/flow.js (scripts/build.mjs copies shell/ to the site root).
 * All text is inserted with textContent, never innerHTML.
 */

const CSS = `
.fl { width: 100%; max-width: 980px; margin: 0 auto; background: var(--card, #fbf6eb); color: var(--ink, #241b15);
      border: 3px solid var(--ink, #241b15); border-radius: 22px; box-shadow: 6px 6px 0 var(--ink, #241b15); padding: 16px 18px 14px; }
.fl h2 { margin: 0 0 2px; font-size: 1.05rem; }
.fl .fl-hint { margin: 0 0 14px; font-size: .85rem; color: var(--muted, #65543f); }
.fl-lanes { display: flex; align-items: stretch; gap: 10px; }
.fl-lane { flex: var(--n, 1) 1 0; min-width: 0; border: 2px dashed var(--muted, #65543f); border-radius: 16px; padding: 30px 10px 10px; position: relative; }
.fl-lane > b { position: absolute; top: 4px; left: 12px; font-size: .68rem; letter-spacing: .12em; text-transform: uppercase; color: var(--muted, #65543f); }
.fl-row { display: flex; align-items: center; gap: 6px; height: 100%; }
.fl-node { flex: 1 1 0; min-width: 0; align-self: stretch; border: 2.5px solid var(--ink, #241b15); border-radius: 14px; padding: 8px 10px;
           background: var(--bg, #f6eedd); position: relative; transition: background .25s, opacity .25s; }
.fl-node .t { font-weight: 800; font-size: .9rem; line-height: 1.2; }
.fl-node .s { font-size: .74rem; color: var(--muted, #65543f); line-height: 1.3; margin-top: 2px; }
.fl-node .n { font-size: .74rem; font-weight: 700; margin-top: 4px; min-height: 1em; overflow-wrap: anywhere; }
.fl-node::after { position: absolute; top: -10px; right: -8px; width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center;
                  font-size: .72rem; font-weight: 900; color: #fff; border: 2px solid var(--ink, #241b15); }
.fl-node.active { background: color-mix(in srgb, var(--you, #4f7bc0) 22%, var(--bg, #f6eedd)); animation: fl-pulse 1s ease-in-out infinite; }
.fl-node.done { background: color-mix(in srgb, var(--ok, #5c8d55) 22%, var(--bg, #f6eedd)); }
.fl-node.done::after { content: "✓"; background: var(--ok, #5c8d55); }
.fl-node.error { background: color-mix(in srgb, var(--warn, #b14d44) 25%, var(--bg, #f6eedd)); }
.fl-node.error::after { content: "✕"; background: var(--warn, #b14d44); }
.fl-node.skip { opacity: .4; }
.fl-arrow { flex: none; font-weight: 900; color: var(--muted, #65543f); transition: color .25s; }
.fl-arrow.lit { color: var(--you, #4f7bc0); }
.fl-gap { flex: none; align-self: center; font-weight: 900; font-size: 1.3rem; color: var(--muted, #65543f); }
.fl-gap.lit { color: var(--you, #4f7bc0); }
.fl-return { margin-top: 10px; border: 2px dashed var(--muted, #65543f); border-radius: 12px; padding: 5px 12px; font-size: .8rem; font-weight: 700;
             color: var(--muted, #65543f); text-align: center; transition: background .25s, color .25s; }
.fl-return.done { color: var(--ink, #241b15); background: color-mix(in srgb, var(--ok, #5c8d55) 20%, transparent); border-style: solid; }
.fl-return.error { color: var(--ink, #241b15); background: color-mix(in srgb, var(--warn, #b14d44) 20%, transparent); border-style: solid; }
.fl-trace { margin: 12px 0 0; padding: 10px 12px 10px 34px; border-top: 2px solid var(--ink, #241b15); font-size: .82rem; max-height: 190px; overflow-y: auto; }
.fl-trace li { margin: 2px 0; }
.fl-trace li span { color: var(--muted, #65543f); font-variant-numeric: tabular-nums; margin-right: 6px; }
.fl-trace li.error { color: var(--warn, #b14d44); font-weight: 700; }
.fl-trace li.done { font-weight: 700; }
@keyframes fl-pulse { 50% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--you, #4f7bc0) 45%, transparent); } }
@media (prefers-reduced-motion: reduce) { .fl-node.active { animation: none; } }
@media (max-width: 720px) {
  .fl-lanes, .fl-row { flex-direction: column; }
  .fl-lane { flex: none; }
  .fl-node { align-self: stretch; }
  .fl-arrow, .fl-gap { transform: rotate(90deg); align-self: center; }
}`;

/** Creates an element with an optional class and text. */
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/**
 * Renders the diagram into `container` and returns the controls the page uses to animate it.
 *
 * @param {HTMLElement} container Where to draw (its content is replaced).
 * @param {{title: string, hint?: string, lanes: Array<{label: string, nodes: Array<{id: string, title: string, sub?: string}>}>,
 *          returnLabel?: string}} spec  Lanes are drawn left to right, nodes left to right inside a lane.
 *   `returnLabel` adds a strip under the lanes for the reply's way back.
 */
export function createFlow(container, spec) {
  if (!document.getElementById("fl-style")) {
    const style = el("style"); style.id = "fl-style"; style.textContent = CSS; document.head.append(style);
  }
  const nodes = new Map();      // id -> {box, note, arrowIn}
  const gaps = [];              // arrows between lanes, lit as the request crosses them
  const root = el("section", "fl");
  root.setAttribute("aria-label", spec.title);
  root.append(el("h2", "", spec.title));
  if (spec.hint) root.append(el("p", "fl-hint", spec.hint));

  const lanes = el("div", "fl-lanes");
  spec.lanes.forEach((lane, li) => {
    if (li > 0) { const g = el("div", "fl-gap", "→"); g.dataset.before = lane.nodes[0].id; gaps.push(g); lanes.append(g); }
    const box = el("div", "fl-lane"); box.style.setProperty("--n", lane.nodes.length);
    box.append(el("b", "", lane.label));
    const row = el("div", "fl-row");
    lane.nodes.forEach((n, ni) => {
      let arrowIn = null;
      if (ni > 0) { arrowIn = el("div", "fl-arrow", "→"); row.append(arrowIn); }
      const card = el("div", "fl-node");
      card.append(el("div", "t", n.title));
      if (n.sub) card.append(el("div", "s", n.sub));
      const note = el("div", "n");
      card.append(note);
      row.append(card);
      nodes.set(n.id, { box: card, note, arrowIn });
    });
    box.append(row);
    lanes.append(box);
  });
  root.append(lanes);

  const back = spec.returnLabel ? el("div", "fl-return", spec.returnLabel) : null;
  if (back) root.append(back);
  const trace = el("ol", "fl-trace");
  trace.setAttribute("aria-live", "polite");
  trace.append(el("li", "", "Send a message to see each step here."));
  root.append(trace);
  container.replaceChildren(root);

  let t0 = performance.now();
  return {
    /** Starts a new message: every box back to idle, trace cleared, timer reset. */
    start() {
      t0 = performance.now();
      for (const { box, note, arrowIn } of nodes.values()) { box.className = "fl-node"; note.textContent = ""; arrowIn?.classList.remove("lit"); }
      gaps.forEach((g) => g.classList.remove("lit"));
      if (back) back.className = "fl-return";
      trace.replaceChildren();
    },
    /**
     * Sets one box's state and the short note under it.
     * @param {string} id  Node id from the spec, or "return" for the reply strip.
     * @param {"idle"|"active"|"done"|"error"|"skip"} state
     * @param {string} [note]
     */
    set(id, state, note) {
      if (id === "return") { if (back) back.className = "fl-return" + (state === "idle" ? "" : " " + state); return; }
      const n = nodes.get(id);
      if (!n) return;
      n.box.className = "fl-node" + (state === "idle" ? "" : " " + state);
      if (note !== undefined) n.note.textContent = note;
      const lit = state === "active" || state === "done" || state === "error";
      n.arrowIn?.classList.toggle("lit", lit);
      gaps.filter((g) => g.dataset.before === id).forEach((g) => g.classList.toggle("lit", lit));
    },
    /**
     * Adds a line to the trace, stamped with milliseconds since start().
     * @param {string} text
     * @param {"done"|"error"} [kind] Bold green-ish or red line.
     */
    log(text, kind) {
      const li = el("li", kind || "");
      li.append(el("span", "", `+${Math.round(performance.now() - t0)} ms`), document.createTextNode(text));
      trace.append(li);
      trace.scrollTop = trace.scrollHeight;
    },
  };
}
