/**
 * Tests for the street view's "Where the time went" sums (public/extras/timing.js).
 * Times are made up, in milliseconds since the submit event. Run from the repo root with:  npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fmt, outcome, requestTimes, size, stages } from "../public/extras/timing.js";

/**
 * A made-up Resource Timing entry for /api/step4/chat: sent at `request`, first byte at `response`, last byte at `end`.
 * With `connect`, the browser opened a new connection at that time (otherwise it reused one, and the connection times
 * equal fetchStart, as browsers report them).
 */
const entry = ({ start = 1.6, request = 2, response = 19, end = 19.5, connect = null, bytes = 1026 } = {}) => ({
  name: "http://127.0.0.1:5000/api/step4/chat", startTime: start, duration: end - start, fetchStart: start,
  domainLookupStart: connect ?? start, domainLookupEnd: connect ?? start,
  connectStart: connect ?? start, connectEnd: connect == null ? start : request - 0.1,
  requestStart: request, responseStart: response, responseEnd: end, encodedBodySize: bytes,
});
const marks = { submit: 0, onSend: 0.1, fetch: 1.5, api: 21, add: 21.5, frame: 30 };
const reply = (server_ms = 7) => ({ ok: true, status: 200, data: { reply: "Hello World", rule: "greeting", events: [], server_ms } });
const failed = (status, data = { error: "x" }) => ({ ok: false, status, data });
const keys = (r) => r.rows.map((row) => row.key);
const ms = (r) => Object.fromEntries(r.rows.map((row) => [row.key, row.ms]));
const wheres = (r) => Object.fromEntries(r.rows.map((row) => [row.key, row.where]));
const name = (r, key) => r.rows.find((row) => row.key === key)?.name;
const addsUp = (r) => assert.equal(r.rows.reduce((sum, row) => sum + row.ms, 0), r.total);

test("timing: durations and sizes read like people say them, never finer than a millisecond", () => {
  assert.equal(fmt(0), "< 1 ms");
  assert.equal(fmt(0.4), "< 1 ms");
  assert.equal(fmt(12.4), "12 ms");
  assert.equal(fmt(999.7), "1.0 s");
  assert.equal(fmt(1400), "1.4 s");
  assert.equal(size(312), "312 bytes");
  assert.equal(size(1026), "1.0 KB");
  assert.equal(size(1340), "1.3 KB");
});

test("timing: api()'s result is read in the same order as whyFailed() in index.html", () => {
  assert.equal(outcome(reply()), "ok");
  assert.equal(outcome(failed(422, { detail: [] })), "rejected");
  assert.equal(outcome(failed(502)), "down");
  assert.equal(outcome(failed(502, null)), "down");          // whyFailed() checks 502 before "no JSON"
  assert.equal(outcome(failed(404, null)), "missing");
  assert.equal(outcome(failed(200, null)), "missing");       // a web page came back instead of JSON
  assert.equal(outcome(failed(405, null)), "missing");
  assert.equal(outcome(failed(0, { error: "Failed to fetch" })), "network");
  assert.equal(outcome(failed(403, { detail: "x" })), "error");
});

test("timing: a 5xx other than 502 means the server is there but failed, with or without JSON", () => {
  // whyFailed() calls an answer without JSON "not deployed"; the street view and the timings tell these apart.
  assert.equal(outcome(failed(500, null)), "server");        // e.g. Starlette's "Internal Server Error" (plain text)
  assert.equal(outcome(failed(500, { detail: "x" })), "server");
  assert.equal(outcome(failed(504, null)), "server");        // e.g. a Vercel function that ran past its time limit
  assert.equal(outcome(failed(503, null)), "server");
});

test("timing: the request's own moments, or none when the browser didn't report them", () => {
  assert.equal(requestTimes(null), null);
  assert.equal(requestTimes({ ...entry(), requestStart: 0, responseStart: 0 }), null);   // a failed request has no answer to time
  assert.deepEqual(requestTimes(entry()), { connect: null, request: 2, response: 19, end: 19.5, bytes: 1026 });
  assert.equal(requestTimes(entry({ connect: 1.7, request: 2.6 })).connect, 1.7);
});

test("timing: the usual message, locally: back-to-back stages that add up to the total, the chain split out by server_ms", () => {
  const r = stages({ marks, res: reply(7), entry: entry(), now: 40, local: true });
  assert.deepEqual(keys(r), ["send", "trip", "chain", "download", "back", "draw"]);
  assert.deepEqual(ms(r), { send: 2, trip: 10, chain: 7, download: 0.5, back: 2, draw: 8.5 });
  assert.deepEqual(wheres(r), { send: "browser", trip: "server", chain: "server", download: "server", back: "browser", draw: "browser" });
  assert.equal(r.total, 30);                                 // from the submit event to the next frame
  assert.equal(r.live, false);
  addsUp(r);
  assert.match(name(r, "send"), /^1–4 · Send → onSend\(e\) → api\(\) → fetch\(\)/);
  assert.match(name(r, "trip"), /^5–9 · there and back, except the chain: the site server, uvicorn and FastAPI, on this computer$/);
  assert.match(name(r, "chain"), /^8 · the chain: run_with_events\(\)/);
  assert.equal(name(r, "download"), "9 · downloading the reply (1.0 KB)");
  assert.match(name(r, "draw"), /^10 · until the next frame/);
  assert.match(r.note, /^The chain took 7 ms; the trip's other 10 ms is the site server passing the request to uvicorn/);
});

test("timing: live on Vercel, a new connection first (TLS handshake), and a cold start's place is named", () => {
  const e = entry({ start: 1.6, connect: 1.7, request: 120, response: 1900, end: 1903 });
  const r = stages({ marks: { ...marks, api: 1905, add: 1906, frame: 1915 }, res: reply(6), entry: e, now: 2000, secure: true, vercel: true });
  assert.deepEqual(keys(r), ["send", "connect", "trip", "chain", "download", "back", "draw"]);
  assert.equal(r.rows[1].where, "both");
  assert.match(name(r, "connect"), /TLS handshake/);
  assert.equal(r.rows[1].ms, 118.3);
  assert.equal(ms(r).trip, 1900 - 120 - 6);
  assert.match(name(r, "trip"), /the internet, Vercel and FastAPI \(a cold start lands here too\)/);
  assert.equal(r.total, 1915);
  addsUp(r);
  assert.match(r.note, /^The chain took 6 ms\. .*cold start .* send another message to compare\.$/);
  const plain = stages({ marks, res: reply(), entry: entry({ connect: 1.7, request: 2.6 }), now: 40, local: true });
  assert.equal(name(plain, "connect"), "5 · a new connection first (TCP, on this computer)");
});

test("timing: while the request is out, the wait counts up as one stage the page can't split yet", () => {
  const r = stages({ marks: { submit: 0, onSend: 0.1, fetch: 1.5 }, now: 900, local: true });
  assert.deepEqual(keys(r), ["send", "wait"]);
  assert.equal(r.rows[0].ms, 1.5);
  assert.equal(r.rows[1].live, true);
  assert.equal(r.rows[1].where, "both");
  assert.match(r.rows[1].name, /^5–9 · waiting for the server…$/);
  assert.equal(r.total, 900);
  assert.equal(r.live, true);
});

test("timing: the answer is in but not on the page yet: the browser's part counts up", () => {
  const r = stages({ marks: { submit: 0, onSend: 0.1, fetch: 1.5, api: 21 }, res: reply(7), entry: entry(), now: 21.2, local: true });
  assert.deepEqual(keys(r), ["send", "trip", "chain", "download", "back"]);
  assert.equal(r.rows.at(-1).live, true);
  assert.equal(r.live, true);
  // Resource Timing can report the request a moment before api() has read it: no chain row until server_ms is known.
  const early = stages({ marks: { submit: 0, onSend: 0.1, fetch: 1.5 }, entry: entry(), now: 19.6, local: true });
  assert.deepEqual(keys(early), ["send", "trip", "download", "back"]);
  assert.match(name(early, "trip"), /api\(\) is still reading it/);
  addsUp(early);
});

test("timing: no Resource Timing for the request (e.g. a full buffer): one unsplit stage, but the chain still has its own", () => {
  const r = stages({ marks, res: reply(7), now: 40, local: true });
  assert.deepEqual(keys(r), ["send", "unsplit", "chain", "back", "draw"]);
  assert.deepEqual(ms(r), { send: 1.5, unsplit: 12.5, chain: 7, back: 0.5, draw: 8.5 });
  assert.equal(r.rows[1].where, "both");
  assert.match(name(r, "unsplit"), /the browser didn't report the request/);
  assert.match(r.note, /didn't report this request/);
  assert.equal(r.total, 30);
  addsUp(r);
});

test("timing: FastAPI refuses an over-long message (422): no chain stage, the answer comes straight back", () => {
  const r = stages({ marks, res: failed(422, { detail: [{ msg: "String should have at most 1000 characters" }] }),
    entry: entry({ response: 9, end: 9.4, bytes: 1340 }), now: 40, local: true });
  assert.deepEqual(keys(r), ["send", "trip", "download", "back", "draw"]);
  assert.equal(name(r, "trip"), "5–9 · there and back: FastAPI refused it (422), so the chain never ran");
  assert.equal(name(r, "download"), "9 · downloading the answer (1.3 KB)");
  assert.match(r.note, /before chat\(\) ran, so there's no chain stage/);
  addsUp(r);
});

test("timing: no Python backend: 502 locally (uvicorn not running), 404 or a web page where it isn't deployed", () => {
  const down = stages({ marks, res: failed(502), entry: entry({ response: 4 }), now: 40, local: true });
  assert.deepEqual(keys(down), ["send", "trip", "download", "back", "draw"]);
  assert.match(name(down, "trip"), /no Python backend answered \(502\)/);
  assert.match(down.note, /couldn't reach uvicorn/);
  const live = stages({ marks, res: failed(502, null), entry: entry({ response: 4 }), now: 40, secure: true, vercel: true });
  assert.match(live.note, /server said 502/);
  const missing = stages({ marks, res: failed(404, null), entry: entry({ response: 4 }), now: 40 });
  assert.match(name(missing, "trip"), /no Python backend on this site \(404\)/);
  assert.match(name(missing, "back"), /api\(\) finds no JSON/);
  assert.match(missing.note, /no backend behind \/api\/step4\/chat/);
  assert.match(name(down, "back"), /api\(\) reads the JSON/);   // the site server's 502 is JSON
  const page = stages({ marks, res: failed(200, null), entry: entry({ response: 4 }), now: 40 });
  assert.match(name(page, "trip"), /a page came back, not JSON/);
  const other = stages({ marks, res: failed(403, { detail: "x" }), entry: entry({ response: 4 }), now: 40 });
  assert.match(name(other, "trip"), /answered with an error \(403\)/);
  assert.match(other.note, /^The server answered 403, an error instead of the reply, so there's no chain stage\.$/);
});

test("timing: the server answered 500 or 504: no chain row (no server_ms), and the note doesn't say no Python ran", () => {
  const crashed = stages({ marks, res: failed(500, null), entry: entry({ response: 14 }), now: 40, local: true });
  assert.deepEqual(keys(crashed), ["send", "trip", "download", "back", "draw"]);
  assert.match(name(crashed, "trip"), /the server answered 500 instead of the reply \(something on it failed\)/);
  assert.match(name(crashed, "back"), /api\(\) finds no JSON/);
  assert.match(crashed.note, /^The server answered 500 instead of the reply, so there's no server_ms/);
  assert.doesNotMatch(crashed.note, /No Python code ran|no backend/);
  addsUp(crashed);
  const timedOut = stages({ marks, res: failed(504, null), entry: entry({ response: 14 }), now: 40, secure: true, vercel: true });
  assert.match(timedOut.note, /runs past its 10 s limit 504\.$/);
});

test("timing: a network error (status 0): from fetch() until it gave up, then back in the browser", () => {
  const m = { submit: 0, onSend: 0.1, fetch: 1.5, api: 40, add: 40.5, frame: 48 };
  const r = stages({ marks: m, res: failed(0, { error: "Failed to fetch" }), now: 60 });
  assert.deepEqual(keys(r), ["send", "failed", "back", "draw"]);
  assert.equal(r.rows[1].ms, 38.5);
  assert.equal(r.rows[1].where, "both");
  assert.match(name(r, "failed"), /^4–5 · fetch\(\): no answer came back \(network error\)$/);
  assert.match(name(r, "back"), /api\(\) returns \{ ok: false, status: 0 \}/);
  assert.match(r.note, /nothing to split/);
  assert.equal(r.total, 48);
  // A failed request that the browser reports anyway has no answer to time: the same stages.
  const reported = stages({ marks: m, res: failed(0), entry: { ...entry(), requestStart: 0, responseStart: 0, responseEnd: 0 }, now: 60 });
  assert.deepEqual(keys(reported), ["send", "failed", "back", "draw"]);
});

test("timing: server_ms longer than the browser's measured window (coarse clocks) never makes a stage negative", () => {
  const r = stages({ marks, res: reply(30), entry: entry(), now: 40, local: true });
  assert.equal(ms(r).chain, 17);                             // all of requestStart → responseStart
  assert.equal(ms(r).trip, 0);
  assert.ok(r.rows.every((row) => row.ms >= 0));
  assert.equal(r.total, 30);
  addsUp(r);
});

test("timing: a reply without server_ms has no chain row, and says the chain is inside the trip", () => {
  const r = stages({ marks, res: { ok: true, status: 200, data: { reply: "Hello World" } }, entry: entry(), now: 40, local: true });
  assert.deepEqual(keys(r), ["send", "trip", "download", "back", "draw"]);
  assert.match(name(r, "trip"), /, and the chain$/);
  assert.equal(r.note, "");
});

test("timing: the street view starts after the reply's frame; a slow answer starts it earlier, and the note says so", () => {
  const quick = stages({ marks: { ...marks, scene: 30.4 }, res: reply(7), entry: entry(), now: 40, local: true });
  assert.doesNotMatch(quick.note, /street view/);
  assert.equal(quick.total, 30);                             // its own start isn't a stage
  const slow = { submit: 0, onSend: 0.1, fetch: 1.5, scene: 301.5, api: 1905, add: 1906, frame: 1915 };
  const r = stages({ marks: slow, res: reply(6), entry: entry({ request: 2, response: 1900, end: 1903 }), now: 2000, local: true });
  assert.match(r.note, /The street view started playing while you waited \(after 300 ms\), so the stages back in your browser can include a little of its own drawing\.$/);
  assert.equal(r.total, 1915);
  addsUp(r);
  const hidden = stages({ marks: { ...slow, frame: undefined, noFrame: true }, res: reply(6), entry: entry({ request: 2, response: 1900, end: 1903 }), now: 3000, local: true });
  assert.match(hidden.note, /its own drawing\. The tab was hidden/);
});

test("timing: a hidden tab draws no frame, so the total ends when add() put the reply on the page", () => {
  const r = stages({ marks: { ...marks, frame: undefined, noFrame: true }, res: reply(7), entry: entry(), now: 2000, local: true });
  assert.deepEqual(keys(r), ["send", "trip", "chain", "download", "back"]);
  assert.equal(r.total, 21.5);
  assert.equal(r.live, false);
  assert.match(r.note, /The tab was hidden/);
  const waiting = stages({ marks: { ...marks, frame: undefined }, res: reply(7), entry: entry(), now: 25, local: true });
  assert.equal(waiting.rows.at(-1).key, "draw");
  assert.equal(waiting.rows.at(-1).live, true);
});
