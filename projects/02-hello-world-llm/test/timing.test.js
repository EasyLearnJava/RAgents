/**
 * Tests for the street view's "Where the time went" sums (public/extras/timing.js).
 * Times are made up, in milliseconds since Send. Run from the repo root with:  npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fmt, stages, tokenVerdict } from "../public/extras/timing.js";

const cachedModel = { startTime: 6, duration: 19600, responseStatus: 200 };  // the usual message: the request to Gemini, 6 → 19606
const cachedMarks = { sent: 0, checked: 1, generate: 1.2, result: 19700, shown: 19710 };
const token = { startTime: 600, duration: 300, responseStatus: 200 };       // a new hourly token: 600 → 900
const model = { startTime: 905, duration: 19600, responseStatus: 200 };     // the request to Gemini after it: 905 → 20505
const replied = { sent: 0, checked: 1, generate: 1.2, result: 20600, shown: 20610 };
const keys = (r) => r.rows.map((row) => row.key);
const ms = (r) => Object.fromEntries(r.rows.map((row) => [row.key, Math.round(row.ms)]));
const addsUp = (r) => assert.equal(r.rows.reduce((sum, row) => sum + row.ms, 0), r.total);
const ok = { type: "model-ok" };
const fail = (kind, message = "") => ({ type: "model-error", kind, message });

test("timing: durations read like people say them", () => {
  assert.equal(fmt(12.4), "12 ms");
  assert.equal(fmt(999.7), "1.0 s");
  assert.equal(fmt(1400), "1.4 s");
  assert.equal(fmt(19605), "19.6 s");
});

test("timing: the usual message reuses the hourly token: no token request, and the stages add up to the total", () => {
  const r = stages({ marks: cachedMarks, outcome: ok, model: cachedModel, now: 20000 });
  assert.deepEqual(keys(r), ["checks", "cached", "gemini", "back"]);
  assert.deepEqual(ms(r), { checks: 1, cached: 5, gemini: 19600, back: 104 });
  assert.match(r.rows[1].name, /^5 · .*hourly token already in your browser \(no token request\)/);
  assert.equal(r.rows[1].where, "browser");
  assert.equal(r.total, 19710);
  assert.equal(r.live, false);
  addsUp(r);
  assert.match(r.note, /No token request: the SDK reused the hourly token/);
});

test("timing: with no valid hourly token, the message first gets a new one (two rows for step 5)", () => {
  const r = stages({ marks: replied, outcome: ok, tokens: [token], model, now: 21000 });
  assert.deepEqual(keys(r), ["checks", "proof", "token", "gemini", "back"]);
  assert.deepEqual(ms(r), { checks: 1, proof: 599, token: 300, gemini: 19605, back: 105 });
  assert.match(r.rows[2].name, /new hourly token/);
  assert.equal(r.total, 20610);
  addsUp(r);
  assert.match(r.note, /most of the 19\.6 s is Google at work/);
});

test("timing: live, reCAPTCHA's proof is your browser + Google; locally the debug token is your browser", () => {
  const live = stages({ marks: replied, outcome: ok, tokens: [token], model, now: 21000 });
  assert.match(live.rows[1].name, /reCAPTCHA/);
  assert.equal(live.rows[1].where, "both");
  const local = stages({ marks: replied, outcome: ok, tokens: [token], model, now: 21000, local: true });
  assert.match(local.rows[1].name, /debug token/);
  assert.equal(local.rows[1].where, "browser");
  assert.deepEqual(local.rows.slice(2).map((row) => row.where), ["google", "google", "browser"]);
});

test("timing: step 10 takes two rows, like the tracker", () => {
  const r = stages({ marks: cachedMarks, outcome: ok, model: cachedModel, now: 20000 });
  assert.match(r.rows[2].name, /^6–10 · .*and back over HTTPS/);
  assert.match(r.rows[3].name, /^10–11 · back in your browser/);
});

test("timing: before Resource Timing reports the request, generate() counts up as one stage", () => {
  const r = stages({ marks: { sent: 0, checked: 1, generate: 1.2 }, now: 5000 });
  assert.deepEqual(keys(r), ["checks", "unsplit"]);
  assert.equal(r.rows[1].live, true);
  assert.equal(r.rows[1].where, "both");
  assert.match(r.rows[1].name, /^5–9 · .*waiting for Google/);
  assert.equal(r.total, 5000);
  assert.equal(r.live, true);
});

test("timing: after a new token, Gemini's stage counts up while it works", () => {
  const r = stages({ marks: { sent: 0, checked: 1, generate: 1.2 }, tokens: [token], now: 5000 });
  assert.deepEqual(keys(r), ["checks", "proof", "token", "gemini"]);
  assert.equal(r.rows.at(-1).live, true);
  assert.equal(r.rows.at(-1).ms, 4100);
  assert.match(r.rows.at(-1).name, /^6–9 · waiting for Google/);
});

test("timing: a message stopped by respond()'s checks never leaves the browser", () => {
  const r = stages({ marks: { sent: 0, checked: 2, shown: 5 }, now: 10 });
  assert.deepEqual(keys(r), ["checks", "back"]);
  assert.ok(r.rows.every((row) => row.where === "browser"));
  assert.match(r.note, /Nothing was sent/);
});

test("timing: setup not finished: one browser stage", () => {
  const r = stages({ marks: { sent: 0, shown: 3 }, now: 10 });
  assert.deepEqual(keys(r), ["checks"]);
  assert.equal(r.total, 3);
});

test("timing: a refused new token: the SDK still sends the message, with a placeholder, and App Check refuses it", () => {
  const r = stages({ marks: { sent: 0, checked: 1, generate: 1, result: 320, shown: 325 }, outcome: fail("appcheck"),
    tokens: [{ startTime: 10, duration: 200, responseStatus: 403 }], model: { startTime: 212, duration: 100, responseStatus: 403 },
    now: 400, local: true });
  assert.deepEqual(keys(r), ["checks", "proof", "token", "gemini", "back"]);
  assert.match(r.rows[2].name, /\(403\)/);
  assert.match(r.rows[3].name, /^6–10 · App Check refused the request \(403\)/);
  assert.match(r.note, /refused the new token \(403\), so the SDK sent your message with a placeholder token, which App Check refused/);
  addsUp(r);
});

test("timing: a token request that failed (status 0: offline or blocked), then the request couldn't reach Google", () => {
  const r = stages({ marks: { sent: 0, checked: 1, generate: 1, result: 40, shown: 43 }, outcome: fail("network"),
    tokens: [{ startTime: 6, duration: 22, responseStatus: 0 }], model: { startTime: 30, duration: 5, responseStatus: 0 }, now: 50 });
  assert.deepEqual(keys(r), ["checks", "proof", "token", "gemini", "back"]);
  assert.match(r.rows[2].name, /\(failed\)/);
  assert.match(r.rows[3].name, /^6–9 · couldn't reach Google/);
  assert.match(r.note, /token request failed.*placeholder token\.$/);
});

test("timing: what a token request's result means", () => {
  assert.equal(tokenVerdict(200), "ok");
  assert.equal(tokenVerdict(undefined), "ok");
  assert.equal(tokenVerdict(null), "ok");
  assert.equal(tokenVerdict(403), "refused");
  assert.equal(tokenVerdict(0), "failed");
});

test("timing: App Check refuses the token the SDK already had: no token request, no made-up cause", () => {
  const r = stages({ marks: { sent: 0, checked: 1, generate: 1, result: 140, shown: 145 }, outcome: fail("appcheck"),
    model: { startTime: 4, duration: 120, responseStatus: 403 }, now: 200 });
  assert.deepEqual(keys(r), ["checks", "cached", "gemini", "back"]);
  assert.match(r.rows[1].name, /its token \(or a placeholder\)/);
  assert.match(r.rows[2].name, /App Check refused the request/);
  assert.equal(r.note, "");
});

test("timing: a timeout lasts until generate() gives up, and nothing comes back", () => {
  const r = stages({ marks: { sent: 0, checked: 1, generate: 1, result: 90006, shown: 90010 }, outcome: fail("timeout"),
    model: { startTime: 6, duration: 90000, responseStatus: 0 }, now: 90020 });
  assert.deepEqual(keys(r), ["checks", "cached", "gemini", "back"]);
  assert.equal(r.rows[2].ms, 90000);
  assert.match(r.rows[2].name, /^6–9 · no reply: stopped by the time limit/);
  assert.match(r.rows[3].name, /time-limit message/);
  assert.equal(r.note, "");
});

test("timing: a timeout with no request reported is one unsplit stage", () => {
  const r = stages({ marks: { sent: 0, checked: 1, generate: 1, result: 90001, shown: 90005 }, outcome: fail("timeout"), now: 90010 });
  assert.deepEqual(keys(r), ["checks", "unsplit", "back"]);
  assert.match(r.rows[1].name, /^5–9 · generate\(\): no reply: stopped by the time limit/);
  addsUp(r);
});

test("timing: a 429 ends the Gemini stage where its request ended", () => {
  const r = stages({ marks: { sent: 0, checked: 1, generate: 1, result: 1300, shown: 1310 }, outcome: fail("quota"),
    model: { startTime: 6, duration: 1200, responseStatus: 429 }, now: 1400 });
  assert.equal(r.rows[2].ms, 1200);
  assert.match(r.rows[2].name, /^6–10 · Gemini: free quota used up \(429\)/);
  assert.equal(r.note, "");
  const other = stages({ marks: { sent: 0, checked: 1, generate: 1, result: 1300, shown: 1310 }, outcome: fail("other"),
    model: { startTime: 6, duration: 1200, responseStatus: 400 }, now: 1400 });
  assert.match(other.rows[2].name, /: an error/);
});

test("timing: an empty reply came back too; a fast reply after a new token makes no claim about Google", () => {
  const empty = stages({ marks: cachedMarks, outcome: { type: "model-empty" }, model: cachedModel, now: 20000 });
  assert.match(empty.rows[2].name, /and back over HTTPS/);
  const fast = stages({ marks: { ...replied, result: 1450, shown: 1460 }, outcome: ok, tokens: [token],
    model: { startTime: 905, duration: 500, responseStatus: 200 }, now: 1500 });
  assert.equal(fast.note, "");
});

test("timing: no Resource Timing at all (e.g. a full buffer): one unsplit stage, no made-up token story", () => {
  const r = stages({ marks: replied, outcome: ok, now: 21000 });
  assert.deepEqual(keys(r), ["checks", "unsplit", "back"]);
  assert.equal(r.rows[1].where, "both");
  assert.match(r.rows[1].name, /^5–10 · .*can't be split/);
  assert.equal(r.note, "");
  addsUp(r);
});

test("timing: two token tries count as one token stage", () => {
  const tries = [{ startTime: 600, duration: 100, responseStatus: 200 }, { startTime: 750, duration: 150, responseStatus: 200 }];
  const r = stages({ marks: replied, outcome: ok, tokens: tries, model, now: 21000 });
  assert.equal(r.rows[2].ms, 300);
  assert.match(r.rows[2].name, /2 tries/);
});

test("timing: a renewal in the background during the reply isn't this message's token", () => {
  const renewal = { startTime: 5000, duration: 300, responseStatus: 200 };
  const r = stages({ marks: cachedMarks, outcome: ok, tokens: [renewal], model: cachedModel, now: 20000 });
  assert.deepEqual(keys(r), ["checks", "cached", "gemini", "back"]);
  addsUp(r);
});
