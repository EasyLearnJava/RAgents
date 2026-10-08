/**
 * Tests for the street view's "Where the time went" sums (public/extras/timing.js).
 * Times are made up, in milliseconds since Send. Run from the repo root with:  npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fmt, stages, tokenVerdict } from "../public/extras/timing.js";

const token = { startTime: 600, duration: 300, responseStatus: 200 };       // the App Check exchange: 600 → 900
const model = { startTime: 905, duration: 19600, responseStatus: 200 };     // the request to Gemini: 905 → 20505
const keys = (r) => r.rows.map((row) => row.key);
const ms = (r) => Object.fromEntries(r.rows.map((row) => [row.key, Math.round(row.ms)]));
const ok = { type: "model-ok" };
const fail = (kind, message = "") => ({ type: "model-error", kind, message });
const replied = { sent: 0, checked: 1, generate: 1.2, result: 20600, shown: 20610 };
/** The App Check SDK's errors, as agent.js reports them (their code is in brackets at the end). */
const NO_NETWORK = "AppCheck: Fetch failed to connect to a network. Check Internet connection. Original error: Failed to fetch. (appCheck/fetch-network-error).";
const REFUSED = "AppCheck: 403 error. Attempts allowed again after 01d:00m:00s (appCheck/initial-throttle).";
const HOLDING_OFF = "AppCheck: Requests throttled due to 403 error. Attempts allowed again after 23h:59m:50s (appCheck/throttled).";

test("timing: durations read like people say them", () => {
  assert.equal(fmt(12.4), "12 ms");
  assert.equal(fmt(999.7), "1.0 s");
  assert.equal(fmt(1400), "1.4 s");
  assert.equal(fmt(19605), "19.6 s");
});

test("timing: a reply splits into back-to-back stages that add up to the total", () => {
  const r = stages({ marks: replied, outcome: ok, tokens: [token], model, now: 21000 });
  assert.deepEqual(keys(r), ["checks", "proof", "token", "gemini", "back"]);
  assert.deepEqual(ms(r), { checks: 1, proof: 599, token: 300, gemini: 19605, back: 105 });
  assert.equal(r.total, 20610);
  assert.equal(r.live, false);
  assert.equal(r.rows.reduce((sum, row) => sum + row.ms, 0), r.total);
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

test("timing: steps 5 and 10 each take two rows, like the tracker", () => {
  const r = stages({ marks: replied, outcome: ok, tokens: [token], model, now: 21000 });
  assert.match(r.rows[3].name, /^6–10 · .*and back over HTTPS/);
  assert.match(r.rows[4].name, /^10–11 · back in your browser/);
});

test("timing: while Gemini is working, its stage counts up", () => {
  const r = stages({ marks: { sent: 0, checked: 1, generate: 1.2 }, tokens: [token], now: 5000 });
  assert.deepEqual(keys(r), ["checks", "proof", "token", "gemini"]);
  assert.equal(r.rows.at(-1).live, true);
  assert.equal(r.rows.at(-1).ms, 4100);
  assert.match(r.rows.at(-1).name, /^6–9 · waiting for Google/);
  assert.equal(r.total, 5000);
  assert.equal(r.live, true);
});

test("timing: before the token request shows up, generate() counts up (browser and Google: not split yet)", () => {
  const r = stages({ marks: { sent: 0, checked: 1, generate: 1.2 }, now: 400 });
  assert.deepEqual(keys(r), ["checks", "proof"]);
  assert.equal(r.rows[1].live, true);
  assert.equal(r.rows[1].where, "both");
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

test("timing: a refused token (locally: an unregistered debug token) stops before Gemini", () => {
  const r = stages({ marks: { sent: 0, checked: 1, generate: 1, result: 215, shown: 220 }, outcome: fail("appcheck"),
    tokens: [{ startTime: 10, duration: 200, responseStatus: 403 }], now: 300, local: true });
  assert.deepEqual(keys(r), ["checks", "proof", "token", "back"]);
  assert.match(r.rows[2].name, /\(403\)/);
  assert.match(r.note, /refused the token \(403\)/);
});

test("timing: a token request that failed (status 0: offline or blocked) stops before Gemini", () => {
  const r = stages({ marks: { sent: 0, checked: 1, generate: 1, result: 30, shown: 33 }, outcome: fail("network", NO_NETWORK),
    tokens: [{ startTime: 6, duration: 22, responseStatus: 0 }], now: 40 });
  assert.deepEqual(keys(r), ["checks", "proof", "token", "back"]);
  assert.match(r.rows[2].name, /\(failed\)/);
  assert.match(r.note, /token request failed.*nothing was sent to Gemini/);
});

test("timing: browsers that don't report the status: the App Check error decides", () => {
  const unknown = { startTime: 600, duration: 300 };
  const refused = stages({ marks: { sent: 0, checked: 1, generate: 1, result: 905, shown: 910 }, outcome: fail("appcheck", REFUSED),
    tokens: [unknown], now: 1000 });
  assert.deepEqual(keys(refused), ["checks", "proof", "token", "back"]);
  assert.match(refused.rows[2].name, /\(refused\)/);
  assert.match(refused.note, /refused the token, so nothing was sent to Gemini/);
  // AI Logic's own 403 on the request to Gemini has no App Check code: that request was sent.
  const sent = stages({ marks: { sent: 0, checked: 1, generate: 1, result: 1300, shown: 1305 },
    outcome: fail("appcheck", "[403 ] App Check token is invalid. (AI/fetch-error)"), tokens: [unknown], now: 1400 });
  assert.deepEqual(keys(sent), ["checks", "proof", "token", "gemini", "back"]);
  assert.match(sent.rows[3].name, /App Check refused the request/);
  const fine = stages({ marks: replied, outcome: ok, tokens: [unknown], model, now: 21000 });
  assert.deepEqual(ms(fine), { checks: 1, proof: 599, token: 300, gemini: 19605, back: 105 });
});

test("timing: what a token request's result means", () => {
  assert.equal(tokenVerdict(200), "ok");
  assert.equal(tokenVerdict(undefined), "ok");
  assert.equal(tokenVerdict(403), "refused");
  assert.equal(tokenVerdict(0), "failed");
  assert.equal(tokenVerdict(undefined, fail("network", NO_NETWORK)), "failed");
  assert.equal(tokenVerdict(undefined, fail("appcheck", REFUSED)), "refused");
});

test("timing: no token request at all (App Check holding off after a 403)", () => {
  const r = stages({ marks: { sent: 0, checked: 1, generate: 1, result: 3, shown: 4 }, outcome: fail("appcheck", HOLDING_OFF), now: 9 });
  assert.deepEqual(keys(r), ["checks", "proof", "back"]);
  assert.match(r.rows[1].name, /holding off/);
  assert.equal(r.rows[1].where, "browser");
  assert.match(r.note, /nothing was sent to Google/);
});

test("timing: reCAPTCHA couldn't vouch, so no token was requested", () => {
  const r = stages({ marks: { sent: 0, checked: 1, generate: 1, result: 800, shown: 805 },
    outcome: fail("appcheck", "AppCheck: ReCAPTCHA error. (appCheck/recaptcha-error)."), now: 900 });
  assert.match(r.rows[1].name, /reCAPTCHA couldn't vouch/);
  assert.doesNotMatch(r.rows[1].name, /holding off/);
});

test("timing: an App Check error before its request is reported never claims App Check held off", () => {
  const r = stages({ marks: { sent: 0, checked: 1, generate: 1, result: 215, shown: 220 }, outcome: fail("appcheck", REFUSED), now: 230 });
  assert.deepEqual(keys(r), ["checks", "proof", "back"]);
  assert.match(r.rows[1].name, /hasn't reported the token request yet/);
  assert.match(r.note, /never sent to Gemini/);
});

test("timing: a token that never came in time: nothing was sent", () => {
  const r = stages({ marks: { sent: 0, checked: 1, generate: 1, result: 90001, shown: 90005 }, outcome: fail("timeout", "Timed out: no reply within 90 s"),
    now: 90010 });
  assert.deepEqual(keys(r), ["checks", "proof", "back"]);
  assert.match(r.rows[1].name, /no App Check token within the time limit/);
  assert.match(r.rows[2].name, /time-limit message/);
  assert.match(r.note, /never sent to Gemini/);
});

test("timing: a timeout lasts until generate() gives up, and nothing comes back", () => {
  const r = stages({ marks: { sent: 0, checked: 1, generate: 1, result: 90905, shown: 90910 }, outcome: fail("timeout"),
    tokens: [token], now: 91000 });
  assert.deepEqual(keys(r), ["checks", "proof", "token", "gemini", "back"]);
  assert.equal(r.rows[3].ms, 90005);
  assert.match(r.rows[3].name, /^6–9 · no reply: stopped by the time limit/);
  assert.equal(r.note, "");
});

test("timing: a 429 ends the Gemini stage where its request ended", () => {
  const r = stages({ marks: { sent: 0, checked: 1, generate: 1, result: 2200, shown: 2210 }, outcome: fail("quota"),
    tokens: [token], model: { startTime: 905, duration: 1200, responseStatus: 429 }, now: 2300 });
  assert.equal(r.rows[3].ms, 1205);
  assert.match(r.rows[3].name, /^6–10 · Gemini: free quota used up \(429\)/);
  assert.equal(r.note, "");
  const other = stages({ marks: { sent: 0, checked: 1, generate: 1, result: 2200, shown: 2210 }, outcome: fail("other"),
    tokens: [token], now: 2300 });
  assert.match(other.rows[3].name, /: an error/);
});

test("timing: an empty reply came back too; a fast reply makes no claim about Google", () => {
  const empty = stages({ marks: replied, outcome: { type: "model-empty" }, tokens: [token], model, now: 21000 });
  assert.match(empty.rows[3].name, /and back over HTTPS/);
  const fast = stages({ marks: { ...replied, result: 1450, shown: 1460 }, outcome: ok, tokens: [token],
    model: { startTime: 905, duration: 500, responseStatus: 200 }, now: 1500 });
  assert.equal(fast.note, "");
});

test("timing: no Resource Timing at all (e.g. a full buffer): one unsplit stage, no made-up App Check error", () => {
  for (const m of [null, model]) {
    const r = stages({ marks: replied, outcome: ok, model: m, now: 21000 });
    assert.deepEqual(keys(r), ["checks", "unsplit", "back"]);
    assert.equal(r.rows[1].where, "both");
    assert.ok(r.rows.every((row) => !/holding off|App Check error/.test(row.name)));
    assert.doesNotMatch(r.note, /nothing was sent/);
    assert.equal(r.rows.reduce((sum, row) => sum + row.ms, 0), r.total);
  }
});

test("timing: two token tries count as one token stage", () => {
  const tries = [{ startTime: 600, duration: 100, responseStatus: 200 }, { startTime: 750, duration: 150, responseStatus: 200 }];
  const r = stages({ marks: { sent: 0, checked: 1, generate: 1, result: 20600, shown: 20610 }, outcome: ok, tokens: tries, model, now: 21000 });
  assert.equal(r.rows[2].ms, 300);
  assert.match(r.rows[2].name, /2 tries/);
});
