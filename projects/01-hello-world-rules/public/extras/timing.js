/**
 * EXTRA: a teaching aid, not part of the agent.
 *
 * Where the time went for one message, measured by the page itself. index.html notes the time at each point of
 * onSend(e) on its EXTRA lines: the "submit" event (its timeStamp, on the same clock as performance.now()), onSend(e)
 * starting, just before and just after respond(), and once add(reply, "bot") has put the reply in the page. street.js
 * adds the next frame: when the browser starts it (requestAnimationFrame) and when it has drawn it (a setTimeout from
 * there runs once the frame is done). The screen shows that frame at its next refresh or so: that isn't timed.
 *
 * Nothing leaves your browser, so every stage is "browser", and most take a fraction of a millisecond. The browser's
 * clock is blurred on purpose (against timing attacks): it moves in steps, 0.1 ms in Chrome and Edge on an ordinary
 * page. clockStep() measures the step. A stage during which the clock didn't tick shows as "< 0.1 ms", and one it
 * ticked once in as "~0.1 ms": a tick can fall in any stage, however short, so both are too quick to measure.
 *
 * The street view is slowed down; these are the real times. The stages are numbered like the street view's tracker
 * (stage 1, typing, is your time, so it isn't timed). Step 7 takes two rows: waiting for the next frame, then drawing it.
 *
 * No DOM here, so the tests run it in Node: street.js measures and draws, this file only does the sums.
 */

/**
 * How long one step of the browser's clock is: the smallest jump between two different readings.
 *
 * @param {() => number} now The clock, e.g. () => performance.now().
 * @param {number} [jumps] How many jumps to watch; the smallest wins (a busy computer can miss a step).
 * @param {number} [reads] The most readings to take in all, so a clock that hardly ever moves can't hold up the page
 *   for long. A 0.1 ms step takes about a thousand readings.
 * @returns {number} The step in ms (0.1 in Chrome and Edge on an ordinary page), or 0 if the clock never moved while
 *   it was read: its steps are then too big for this page to time anything.
 */
export function clockStep(now, jumps = 5, reads = 1e6) {
  let step = Infinity;
  for (let i = 0; i < jumps && reads > 0; i++) {
    const a = now();
    let b = a;
    while (b === a && reads-- > 0) b = now();                 // spin until it moves
    if (b > a) step = Math.min(step, b - a);
  }
  return Number.isFinite(step) ? Number(step.toPrecision(2)) : 0;   // 0.0999999940… → 0.1
}

/**
 * Whether a duration was too quick for a clock that moves in `step` ms: the clock ticked once at most while it ran.
 * One tick only means that a tick happened to fall in it, which can happen however short it is.
 *
 * @param {number} ms The duration (a difference of two readings).
 * @param {number} step The clock's step in ms (clockStep()).
 */
export const tooQuick = (ms, step) => ms < 1.5 * step;

/**
 * Durations for a clock that moves in `step` ms. Every time is a difference of two readings, so it's a whole number of
 * steps (give or take rounding noise), and either reading can be up to a step off. So a stage during which the clock
 * didn't tick shows as "< 0.1 ms", one it ticked once in as "~0.1 ms" (both too quick to measure: see tooQuick()),
 * and longer ones with as many decimals as the step has ("0.3 ms", "16.7 ms"), in seconds from 1000 ms ("1.2 s").
 * Without a step (0: the clock never moved while it was read) there's nothing to go on, so every duration is "?".
 *
 * @param {number} step The clock's step in ms (clockStep()).
 * @returns {(ms: number) => string}
 */
export function formatter(step) {
  if (!(step > 0)) return () => "?";
  const digits = step >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(step) - 1e-9));
  return (ms) => {
    if (ms < step / 2) return `< ${step} ms`;
    if (tooQuick(ms, step)) return `~${step} ms`;
    const text = ms.toFixed(ms < 10 ? digits : Math.min(digits, 1));
    return Number(text) < 1000 ? `${text} ms` : `${(ms / 1000).toFixed(1)} s`;
  };
}

/** Each stage's name in the panel, numbered like the street view's tracker. */
const NAMES = {
  submit: '2 · the "submit" event reaches onSend(e)',
  onsend: '3 · onSend(e) reads the input, add(text, "you") puts your bubble in the page',
  empty: "3 · onSend(e) reads the input: nothing typed (spaces don't count), so no bubble",
  respond: "4–5 · respond() checks the rules and returns the reply",
  add: '6 · add(reply, "bot") puts the reply in the page',
  frame: "7 · waiting for the browser's next frame",
  drawn: "7 · the browser draws that frame (style, layout, paint)",
};

/** The stages before the frame in a sentence: "The biggest share (40%) was …". */
const SAID = {
  submit: 'step 2, the "submit" event reaching onSend(e)', onsend: "step 3, onSend(e) putting your bubble in the page",
  empty: "step 3, onSend(e) reading the blank input", respond: "steps 4–5, respond()",
  add: "step 6, add() putting the reply in the page",
};

/**
 * The stages of one message, back to back: each starts where the one before it ended, so they add up to the total.
 * A stage that hasn't finished yet runs until `now` and is marked live.
 *
 * @param {object} p
 * @param {{submit: number, onSend?: number, respond?: number, returned?: number, added?: number, frame?: number,
 *   drawn?: number}} p.marks performance.now() at the "submit" event, onSend(e) starting, just before and just after
 *   respond(), the reply in the page, the next frame starting and that frame drawn (missing = not reached yet).
 * @param {number} p.now The current performance.now().
 * @param {number} p.step The clock's step in ms (clockStep()): a stage it ticked once at most in was too quick to
 *   measure. 0 (the clock never moved while it was read) means these times can't be trusted, and the note says so.
 * @param {boolean} [p.empty] true when the input was blank (nothing typed, or only spaces): onSend(e) then puts no
 *   bubble of yours in the page.
 * @param {number} [p.requests] Network requests the page made between Send and the frame (Resource Timing).
 * @returns {{rows: {key: string, name: string, where: "browser", ms: number, live: boolean}[], total: number,
 *   live: boolean, note: string}}
 */
export function stages({ marks, now, step, empty = false, requests = 0 }) {
  const rows = [];
  let at = marks.submit;
  /** Adds the stage that runs from the previous one's end until `until` (still running if until is missing). */
  const stage = (key, until) => {
    const live = until == null;
    const name = NAMES[key === "onsend" && empty ? "empty" : key];
    rows.push({ key, name, where: "browser", ms: Math.max(0, (live ? now : until) - at), live });
    if (!live) at = Math.max(at, until);
    return !live;
  };
  const total = Math.max(0, (marks.drawn ?? now) - marks.submit);
  const done = (note = "") => ({ rows, total, live: marks.drawn == null, note });

  const ends = { submit: marks.onSend, onsend: marks.respond, respond: marks.returned, add: marks.added,
    frame: marks.frame, drawn: marks.drawn };
  for (const [key, until] of Object.entries(ends)) if (!stage(key, until)) return done();

  // From the data: where the time went (step 7's two rows together, or a bigger stage), the screen (untimed),
  // respond() itself, the network.
  const network = requests ? `The page made ${requests} network request${requests > 1 ? "s" : ""} meanwhile.`
    : "No network request was made.";
  if (!(step > 0)) {
    return done(`Your browser's clock didn't move while this page measured it, so it can't time these stages. ${network}`);
  }
  const fmt = formatter(step);
  const notes = [];
  const ms = (key) => rows.find((r) => r.key === key).ms;
  const pct = (t) => (total > 0 ? Math.round((100 * t) / total) : 0);    // rounded like the panel's rows
  const lead = (share) => (share > 50 ? "Most of the time" : "The biggest share");
  if (total > 0) {
    const top = rows.slice(0, -2).reduce((a, b) => (b.ms > a.ms ? b : a));   // the biggest stage before the frame
    const [frame, drawn] = [pct(ms("frame")), pct(ms("drawn"))];
    notes.push(ms("frame") + ms("drawn") >= top.ms
      ? `${lead(frame + drawn)} (${frame + drawn}%) was step 7: waiting for the browser's next frame (${frame}%), ` +
        `then drawing it (${drawn}%).`
      : `${lead(pct(top.ms))} (${pct(top.ms)}%) was ${SAID[top.key === "onsend" && empty ? "empty" : top.key]}.`);
  }
  notes.push("Your screen shows the drawn frame at its next refresh or so: the page can't time that.");
  const agent = ms("respond");
  notes.push(tooQuick(agent, step)
    ? `respond(), the agent itself, was too quick to measure: your browser's clock moves in ${step} ms steps, and it ` +
      "ticked once at most while respond() ran."
    : `respond(), the agent itself, took ${fmt(agent)} (your browser's clock moves in ${step} ms steps).`);
  notes.push(network);
  return done(notes.join(" "));
}
