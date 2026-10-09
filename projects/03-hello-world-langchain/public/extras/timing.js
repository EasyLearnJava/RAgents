/**
 * EXTRA: a teaching aid, not part of the agent.
 *
 * Where the time went for one message, measured by the page itself. index.html notes the real moments on its lines
 * marked EXTRA: the submit event's own timestamp, onSend(e) starting, the real chain.invoke() being called and
 * resolving, and onSend(e) finishing; street.js adds the start of the browser's next frame, which draws the reply.
 * The stages run back to back, so they add up to the total. It all runs in your browser: there's no network time.
 *
 * The page can't see inside chain.invoke(). The street view and the diagram show LangChain's steps from record.js's
 * second run of the chain, with streamEvents(), and recordedSplit() splits that run's time. It's a separate run (usually
 * a slower one: LangChain reports every step), so street.js shows it on its own, never in the total.
 *
 * Browsers make their clock coarse on purpose (it makes timing attacks harder): performance.now() moves in small steps,
 * 0.1 ms in Chrome and Edge. clockStep() measures the step, and fmt() never shows more precision than that.
 *
 * No DOM here, so the tests run it in Node: street.js measures and draws, this file only does the sums.
 */

/**
 * The smallest step the clock moves in, in ms: watches it change a few times and keeps the smallest change, rounded to
 * 4 decimals (e.g. 0.1). It stops after `budget` ms, or a million readings (a clock that doesn't move at all can't say
 * when the budget is up); if it saw no change by then, the budget.
 * @param {() => number} [now] The clock (tests pass a fake one).
 * @param {number} [budget] The most time to spend watching, in ms.
 */
export function clockStep(now = () => performance.now(), budget = 20) {
  const start = now();
  let last = start, step = Infinity;
  for (let changes = 0, reads = 0; changes < 6 && reads < 1e6; reads++) {
    const t = now();
    if (t !== last) { step = Math.min(step, t - last); last = t; changes++; }
    if (t - start > budget) break;
  }
  return Number.isFinite(step) ? Math.max(0.0001, Math.round(step * 1e4) / 1e4) : budget;
}

/** A clock step as text: 0.1 → "0.1". */
const num = (n) => String(+n.toPrecision(3));

/**
 * A duration for people, never finer than the clock: "< 0.1 ms" (less than one step), "0.4 ms", "12 ms" or "1.4 s".
 * @param {number} ms
 * @param {number} [step] The clock's step, in ms (clockStep()).
 */
export function fmt(ms, step = 0.1) {
  if (ms < step / 2) return `< ${num(step)} ms`;
  if (ms < 9.95) return `${ms.toFixed(step >= 1 ? 0 : step >= 0.1 ? 1 : 2)} ms`;
  if (ms < 999.5) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

/**
 * The stages of one message, back to back: each starts where the one before it ended, so they add up to the total.
 * They're numbered like the street view's tracker.
 *
 * @param {object} p
 * @param {{sent: number, onSend: number, invoke?: number, resolved?: number, added?: number, frame?: number}} p.marks
 *   The submit event's timeStamp, then performance.now() when onSend(e) started, when chain.invoke() was called and
 *   when it resolved, when onSend(e) was done, and at the start of the browser's next frame. Missing: not reached
 *   (street.js stops waiting for the frame after a second: a hidden page draws none).
 * @param {boolean} [p.bubble] Whether onSend(e) added your bubble (it doesn't for an empty message).
 * @param {boolean} [p.drewBetween] Whether the browser drew a frame while chain.invoke() ran.
 * @param {number} [p.step] The clock's step in ms (clockStep()), for the note.
 * @returns {{rows: {key: string, name: string, where: "browser", ms: number, live: boolean}[], total: number,
 *   live: boolean, note: string}}
 */
export function stages({ marks, bubble = true, drewBetween = false, step = 0.1 }) {
  const rows = [];
  let at = marks.sent;
  /** Adds the stage from the previous one's end until `until`, if that moment was reached. */
  const stage = (key, name, until) => {
    if (until == null) return false;
    rows.push({ key, name, where: "browser", ms: Math.max(0, until - at), live: false });
    at = Math.max(at, until);
    return true;
  };
  stage("submit", "1–2 · the submit event fires → onSend(e) starts", marks.onSend);
  stage("onsend", bubble ? '3 · onSend(e): add(text, "you"), clear the box' : "3 · onSend(e): nothing typed, so no bubble; clear the box",
    marks.invoke);
  stage("invoke", "4–6 · chain.invoke(text), the real call: normalize → rules → { reply, rule }", marks.resolved);
  stage("add", '7 · add(result.reply, "bot"), input.focus()', marks.added);
  const framed = stage("frame", "8 · waiting for the browser's next frame, which draws the reply", marks.frame);
  const total = Math.max(0, at - marks.sent);

  const notes = [`It all ran in your browser: no network time. Measured with your browser's clock, which moves in ` +
    `${num(step)} ms steps here, so anything shorter shows as < ${num(step)} ms.`];
  const frame = rows.find((r) => r.key === "frame");
  if (!framed) notes.push("No frame came within a second (the page was hidden, or busy), so the total ends when onSend(e) finished.");
  else if (frame.ms > total / 2) {
    notes.push("Most of it is the wait for the next frame: the screen is redrawn many times a second (about every 17 ms at " +
      "60 Hz), and the reply is drawn in the next one.");
  }
  if (bubble && marks.added != null) {
    notes.push(drewBetween ? "The browser drew a frame while chain.invoke() ran, so your bubble showed up just before the reply."
      : "chain.invoke() is async, but it finished before the browser drew anything, so your bubble and the reply appeared in the same frame.");
  }
  return { rows, total, live: false, note: notes.join(" ") };
}

/**
 * Splits record.js's run of the chain (a second run, with streamEvents()) into LangChain's steps, from the times the
 * page received each step's start and end event. The parts don't overlap and add up to the whole recorded run:
 * normalize; each step rules ran (its conditions and the reply it picked); rules' own work between them (RunnableBranch
 * trying the conditions and picking the reply); and LangChain's own bookkeeping, everything outside the named steps
 * (starting the run, handing the text from normalize to rules, reporting the events).
 *
 * @param {{events: {event: string, name: string, ms: number}[], ms: number}} recording record.js's result.
 * @returns {{rows: {key: string, name: string, ms: number}[], total: number} | null} null if a step is missing.
 */
export function recordedSplit({ events, ms }) {
  const at = (event, name) => events.find((e) => e.event === event && e.name === name)?.ms;
  /** How long a step took: from its start event to its end event. */
  const span = (name) => {
    const a = at("on_chain_start", name), b = at("on_chain_end", name);
    return a == null || b == null ? null : Math.max(0, b - a);
  };
  const normalize = span("normalize"), rules = span("rules");
  if (normalize == null || rules == null) return null;
  const inner = events.filter((e) => e.event === "on_chain_end" && (e.name.endsWith("?") || e.name.startsWith("reply:")))
    .map((e) => ({ key: e.name, name: `rules › ${e.name}`, ms: span(e.name) ?? 0 }));
  const own = rules - inner.reduce((sum, r) => sum + r.ms, 0);
  return {
    rows: [
      { key: "normalize", name: "normalize", ms: normalize },
      ...inner,
      { key: "branch", name: "rules › RunnableBranch itself: trying the conditions, picking the reply", ms: Math.max(0, own) },
      { key: "langchain", name: "LangChain's own bookkeeping: starting the run, handing the text on, reporting each step",
        ms: Math.max(0, ms - normalize - rules) },
    ],
    total: ms,
  };
}
