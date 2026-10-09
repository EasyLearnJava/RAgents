/**
 * Tests for the street view's "Where the time went" sums (public/extras/timing.js).
 * Times are made up, in milliseconds on the page's clock. Run from the repo root with:  npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { clockStep, fmt, recordedSplit, stages } from "../public/extras/timing.js";

/** A usual message: the submit event at 100, onSend(e) at 100.2, chain.invoke() 100.6 → 101.6, done 101.9, frame 112. */
const marks = { sent: 100, onSend: 100.2, invoke: 100.6, resolved: 101.6, added: 101.9, frame: 112 };
const keys = (r) => r.rows.map((row) => row.key);
const ms = (r) => Object.fromEntries(r.rows.map((row) => [row.key, Math.round(row.ms * 10) / 10]));
const addsUp = (r) => assert.ok(Math.abs(r.rows.reduce((sum, row) => sum + row.ms, 0) - r.total) < 1e-9);

/** A recorded streamEvents() run for "hi", as the browser received it (times in ms since the run started). */
const hi = {
  ms: 2.4,
  events: [["on_chain_start", "hello-chain", 0.5], ["on_chain_start", "normalize", 0.6], ["on_chain_end", "normalize", 1.0],
    ["on_chain_start", "rules", 1.1], ["on_chain_start", "is empty?", 1.2], ["on_chain_end", "is empty?", 1.4],
    ["on_chain_start", "is greeting?", 1.5], ["on_chain_end", "is greeting?", 1.7], ["on_chain_start", "reply: Hello World", 1.8],
    ["on_chain_end", "reply: Hello World", 2.0], ["on_chain_end", "rules", 2.2], ["on_chain_end", "hello-chain", 2.3]]
    .map(([event, name, at]) => ({ event, name, ms: at })),
};

test("timing: durations never look finer than the clock", () => {
  assert.equal(fmt(0), "< 0.1 ms");
  assert.equal(fmt(0.04), "< 0.1 ms");
  assert.equal(fmt(0.1), "0.1 ms");
  assert.equal(fmt(3.84), "3.8 ms");
  assert.equal(fmt(9.96), "10 ms");
  assert.equal(fmt(16.4), "16 ms");
  assert.equal(fmt(1400), "1.4 s");
  assert.equal(fmt(0.3, 1), "< 1 ms");                        // a clock with 1 ms steps: whole milliseconds only
  assert.equal(fmt(3.2, 1), "3 ms");
  assert.equal(fmt(0.26, 0.005), "0.26 ms");
});

test("timing: clockStep() finds how far apart the clock's readings are", () => {
  let t = 0;
  assert.equal(clockStep(() => Math.floor((t += 0.03) * 10) / 10), 0.1);   // a fine clock rounded to 0.1 ms, like Chrome's
  t = 0;
  assert.equal(clockStep(() => (t += 1.25)), 1.25);
  assert.equal(clockStep(() => 5, 20), 20);                                 // a clock that never moves: just the budget
});

test("timing: the usual message: five stages in your browser that add up to the total", () => {
  const r = stages({ marks });
  assert.deepEqual(keys(r), ["submit", "onsend", "invoke", "add", "frame"]);
  assert.deepEqual(ms(r), { submit: 0.2, onsend: 0.4, invoke: 1, add: 0.3, frame: 10.1 });
  assert.ok(r.rows.every((row) => row.where === "browser" && !row.live));
  assert.equal(r.total, 12);
  assert.equal(r.live, false);
  addsUp(r);
  assert.match(r.rows[2].name, /^4–6 · chain\.invoke\(text\), the real call/);
  assert.match(r.note, /no network time/);
  assert.match(r.note, /0\.1 ms steps here/);
  assert.match(r.note, /Most of it is the wait for the next frame/);
  assert.match(r.note, /your bubble and the reply appeared in the same frame/);
});

test("timing: the note says what really happened", () => {
  const between = stages({ marks, drewBetween: true });
  assert.match(between.note, /drew a frame while chain\.invoke\(\) ran/);
  const empty = stages({ marks, bubble: false });
  assert.match(empty.rows[1].name, /no bubble/);
  assert.doesNotMatch(empty.note, /your bubble/);
  const quick = stages({ marks: { ...marks, frame: 102.5 } });               // a frame came soon after: no claim about it
  assert.doesNotMatch(quick.note, /Most of it/);
  assert.match(stages({ marks, step: 1 }).note, /1 ms steps here, so anything shorter shows as < 1 ms/);
});

test("timing: with no frame (a hidden page draws none), the total ends when onSend(e) is done", () => {
  const r = stages({ marks: { ...marks, frame: undefined } });
  assert.deepEqual(keys(r), ["submit", "onsend", "invoke", "add"]);
  assert.ok(Math.abs(r.total - 1.9) < 1e-9);
  addsUp(r);
  assert.match(r.note, /No frame came within a second \(the page was hidden, or busy\)/);
});

test("timing: a clock that blurs two moments the wrong way round never makes a stage negative", () => {
  const r = stages({ marks: { ...marks, onSend: 99.9 } });
  assert.equal(r.rows[0].ms, 0);
  assert.ok(r.rows.every((row) => row.ms >= 0));
  addsUp(r);
});

test("timing: the recorded run splits into LangChain's steps that add up to that run, not the real one", () => {
  const r = recordedSplit(hi);
  assert.deepEqual(keys(r), ["normalize", "is empty?", "is greeting?", "reply: Hello World", "branch", "langchain"]);
  assert.deepEqual(ms(r), { normalize: 0.4, "is empty?": 0.2, "is greeting?": 0.2, "reply: Hello World": 0.2, branch: 0.5, langchain: 0.9 });
  assert.equal(r.total, 2.4);
  addsUp(r);
  assert.match(r.rows[1].name, /^rules › is empty\?/);
});

test("timing: the empty message's recorded run has one check and the hint", () => {
  const events = hi.events.filter((e) => !["is greeting?", "reply: Hello World"].includes(e.name))
    .concat([{ event: "on_chain_start", name: "reply: hint", ms: 1.5 }, { event: "on_chain_end", name: "reply: hint", ms: 1.6 }]);
  const r = recordedSplit({ events, ms: 2.4 });
  assert.deepEqual(keys(r), ["normalize", "is empty?", "reply: hint", "branch", "langchain"]);
  addsUp(r);
});

test("timing: a recording without normalize or rules gives no split", () => {
  assert.equal(recordedSplit({ events: hi.events.filter((e) => e.name !== "normalize"), ms: 2.4 }), null);
  assert.equal(recordedSplit({ events: [], ms: 0 }), null);
});
