/**
 * Tests for the street view's "Where the time went" sums (public/extras/timing.js).
 * Times are made up, in milliseconds, on a clock that moves in 0.1 ms steps like Chrome's and Edge's (their readings
 * carry a little rounding noise, e.g. 179.59999999403954). Run from the repo root with:  npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { clockStep, formatter, stages, tooQuick } from "../public/extras/timing.js";

const fmt = formatter(0.1);
/** The usual message: everything but the wait for the next frame is a fraction of a millisecond. */
const marks = { submit: 179.5, onSend: 179.59999999403954, respond: 179.90000000596046, returned: 179.90000000596046,
  added: 180.20000000298023, frame: 189.70000000298023, drawn: 191.10000000894070 };
const keys = (r) => r.rows.map((row) => row.key);
const ms = (r) => Object.fromEntries(r.rows.map((row) => [row.key, fmt(row.ms)]));
const addsUp = (r) => assert.ok(Math.abs(r.rows.reduce((sum, row) => sum + row.ms, 0) - r.total) < 1e-9);

test("timing: durations on a 0.1 ms clock: no tick or one tick is too quick to measure", () => {
  assert.equal(fmt(0), "< 0.1 ms");
  assert.equal(fmt(0.04), "< 0.1 ms");
  assert.equal(fmt(179.59999999403954 - 179.5), "~0.1 ms");    // one tick, with rounding noise below 0.1
  assert.equal(fmt(0.10000000596046), "~0.1 ms");
  assert.equal(tooQuick(0.10000000596046, 0.1), true);
  assert.equal(fmt(179.69999998807907 - 179.5), "0.2 ms");     // two ticks: measured, give or take a tick
  assert.equal(tooQuick(0.19999998807907, 0.1), false);
  assert.equal(fmt(0.3), "0.3 ms");
  assert.equal(fmt(1.24), "1.2 ms");
  assert.equal(fmt(16.66), "16.7 ms");
  assert.equal(fmt(999.94), "999.9 ms");
  assert.equal(fmt(999.96), "1.0 s");
  assert.equal(fmt(1400), "1.4 s");
});

test("timing: durations on coarser and finer clocks show only the digits the clock has", () => {
  const ms1 = formatter(1);
  assert.equal(ms1(0.4), "< 1 ms");
  assert.equal(ms1(1), "~1 ms");
  assert.equal(ms1(3.2), "3 ms");
  assert.equal(ms1(16.7), "17 ms");
  const fine = formatter(0.005);
  assert.equal(fine(0.002), "< 0.005 ms");
  assert.equal(fine(0.005), "~0.005 ms");
  assert.equal(fine(0.035), "0.035 ms");
  assert.equal(fine(12.345), "12.3 ms");
});

test("timing: without a clock step (it never moved while it was read) no duration is claimed", () => {
  assert.equal(formatter(0)(0.3), "?");
  assert.equal(formatter(0)(0), "?");
  assert.equal(formatter(NaN)(12), "?");
  const r = stages({ marks, now: 200, step: 0 });
  assert.equal(r.note, "Your browser's clock didn't move while this page measured it, so it can't time these stages. " +
    "No network request was made.");
  addsUp(r);
});

test("timing: clockStep finds the smallest jump, even when a busy moment skips a step", () => {
  let t = 179.5, calls = 0;
  const steps = [0.30000001192093, 0.09999999403954, 0.10000000596046, 0.2, 0.09999999403954];
  let i = 0;
  const clock = () => { if (++calls % 7 === 0) t += steps[i++ % steps.length]; return t; };
  assert.equal(clockStep(clock), 0.1);
});

test("timing: clockStep gives 0 for a clock that never moves, after a limited number of readings", () => {
  let calls = 0;
  assert.equal(clockStep(() => { calls++; return 42; }, 5, 1000), 0);
  assert.ok(calls <= 1001, `${calls} readings`);                 // one to start, then the spin's 1000 in all
  assert.equal(clockStep(() => 42), 0);                          // the default limit doesn't hang either
});

test("timing: the usual message: six back-to-back stages in your browser that add up to the total", () => {
  const r = stages({ marks, now: 200, step: 0.1 });
  assert.deepEqual(keys(r), ["submit", "onsend", "respond", "add", "frame", "drawn"]);
  assert.deepEqual(ms(r), { submit: "~0.1 ms", onsend: "0.3 ms", respond: "< 0.1 ms", add: "0.3 ms", frame: "9.5 ms",
    drawn: "1.4 ms" });
  assert.ok(r.rows.every((row) => row.where === "browser" && !row.live));
  assert.equal(fmt(r.total), "11.6 ms");
  assert.equal(r.live, false);
  addsUp(r);
});

test("timing: stages are numbered like the tracker; step 7 takes two rows", () => {
  const names = stages({ marks, now: 200, step: 0.1 }).rows.map((row) => row.name);
  assert.match(names[0], /^2 · the "submit" event/);
  assert.match(names[1], /^3 · onSend\(e\) reads the input, add\(text, "you"\)/);
  assert.match(names[2], /^4–5 · respond\(\)/);
  assert.match(names[3], /^6 · add\(reply, "bot"\)/);
  assert.match(names[4], /^7 · waiting for the browser's next frame/);
  assert.match(names[5], /^7 · the browser draws that frame/);
});

test("timing: the note says where the time went, that the screen isn't timed, that respond() was too quick, no request", () => {
  const r = stages({ marks, now: 200, step: 0.1 });
  assert.equal(r.note, "Most of the time (94%) was step 7: waiting for the browser's next frame (82%), then drawing it (12%). " +
    "Your screen shows the drawn frame at its next refresh or so: the page can't time that. " +
    "respond(), the agent itself, was too quick to measure: your browser's clock moves in 0.1 ms steps, and it ticked " +
    "once at most while respond() ran. No network request was made.");
});

test("timing: a respond() the clock ticked once in is still too quick to measure, not 0.1 ms", () => {
  const once = { ...marks, returned: 180.00000000596046 };      // one tick after respond: 179.9…
  const r = stages({ marks: once, now: 200, step: 0.1 });
  assert.equal(fmt(r.rows[2].ms), "~0.1 ms");
  assert.match(r.note, /respond\(\), the agent itself, was too quick to measure: .* ticked once at most while respond\(\) ran\./);
  assert.doesNotMatch(r.note, /took/);
});

test("timing: step 7 counts as one, even when neither of its rows is the biggest on its own", () => {
  // 2 ms of 7 is 28.6%: each row shows 29%, so step 7 says 58% (the rows' sum), not 57%.
  const close = { submit: 0, onSend: 0, respond: 2.8, returned: 2.8, added: 3, frame: 5, drawn: 7 };
  assert.match(stages({ marks: close, now: 20, step: 0.1 }).note,
    /^Most of the time \(58%\) was step 7: waiting for the browser's next frame \(29%\), then drawing it \(29%\)\./);
});

test("timing: a respond() long enough to measure gets its time, without the 'too quick'", () => {
  const r = stages({ marks: { ...marks, returned: 180.10000000894070 }, now: 200, step: 0.1 });
  assert.match(r.note, /respond\(\), the agent itself, took 0\.2 ms \(your browser's clock moves in 0\.1 ms steps\)\./);
});

test("timing: a blank message (nothing typed, or only spaces): onSend(e) puts no bubble of yours in the page", () => {
  const r = stages({ marks, now: 200, step: 0.1, empty: true });
  assert.match(r.rows[1].name, /nothing typed \(spaces don't count\), so no bubble/);
});

test("timing: when another stage beats step 7, the note names it", () => {
  const slow = { submit: 0, onSend: 0, respond: 6, returned: 6, added: 6.2, frame: 8, drawn: 9.5 };
  const r = stages({ marks: slow, now: 20, step: 0.1 });
  assert.match(r.note, /^Most of the time \(63%\) was step 3, onSend\(e\) putting your bubble in the page\./);
  const even = { submit: 0, onSend: 0, respond: 4, returned: 4, added: 7, frame: 8, drawn: 9.5 };
  assert.match(stages({ marks: even, now: 20, step: 0.1 }).note, /^The biggest share \(42%\) was step 3,/);
  const empty = stages({ marks: slow, now: 20, step: 0.1, empty: true });
  assert.match(empty.note, /was step 3, onSend\(e\) reading the blank input\./);
});

test("timing: requests the page made meanwhile are counted, not hidden", () => {
  assert.match(stages({ marks, now: 200, step: 0.1, requests: 1 }).note, /The page made 1 network request meanwhile\.$/);
  assert.match(stages({ marks, now: 200, step: 0.1, requests: 2 }).note, /made 2 network requests meanwhile\.$/);
});

test("timing: before the frame is drawn, the stage you're waiting on counts up", () => {
  const { frame, drawn, ...early } = marks;
  const r = stages({ marks: early, now: 185, step: 0.1 });
  assert.deepEqual(keys(r), ["submit", "onsend", "respond", "add", "frame"]);
  assert.equal(r.rows.at(-1).live, true);
  assert.equal(fmt(r.rows.at(-1).ms), "4.8 ms");
  assert.equal(r.total, 185 - 179.5);
  assert.equal(r.live, true);
  assert.equal(r.note, "");
  addsUp(r);
});

test("timing: the note uses the clock's own step (here a coarser 1 ms clock)", () => {
  const r = stages({ marks: { submit: 10, onSend: 10, respond: 10, returned: 10, added: 11, frame: 20, drawn: 21 },
    now: 30, step: 1 });
  assert.match(r.note, /^Most of the time \(91%\) was step 7: .*\(82%\).*\(9%\)\. .*too quick to measure: your browser's clock moves in 1 ms steps,/);
  addsUp(r);
});

test("timing: a total of 0 (a clock that didn't move during the message) makes no claim about where the time went", () => {
  const r = stages({ marks: { submit: 5, onSend: 5, respond: 5, returned: 5, added: 5, frame: 5, drawn: 5 }, now: 9, step: 0.1 });
  assert.equal(r.total, 0);
  assert.match(r.note, /^Your screen shows the drawn frame at its next refresh or so: the page can't time that\. respond\(\)/);
  assert.doesNotMatch(r.note, /Most of the time|biggest share/);
});
