/**
 * EXTRA: a teaching aid, not part of the agent.
 *
 * Where the time went for one message, measured by the page itself: the moments the street view records (Send,
 * respond()'s checks done, generate() called, its result, the reply on the page) plus what the browser's Resource
 * Timing reports about the page's own requests to Google: the request to Gemini, and an App Check token request if
 * the message needed one. Usually it doesn't: the hourly token is already in the browser, so step 5 is only the SDK
 * attaching it. If it's missing or expired, the SDK gets a new one first. Live, reCAPTCHA then asks Google for its
 * proof from its own frame; the page can't time that request, so it's inside stage 5's proof, shown as "your browser
 * + Google".
 *
 * The street view is slowed down; these are the real times. The stages are numbered like the street view's tracker.
 * Step 10 takes two rows: the answer's trip back over the internet (timed with the request, which the browser sees as
 * one call), then the rest in your browser. So does step 5 when a new token is fetched: the proof, then the token
 * request.
 *
 * No DOM here, so the tests run it in Node: street.js measures and draws, this file only does the sums.
 */

/** A duration for people: "12 ms" or "1.4 s". */
export const fmt = (ms) => (ms < 999.5 ? `${Math.max(0, Math.round(ms))} ms` : `${(ms / 1000).toFixed(1)} s`);

/** The end of a Resource Timing entry. */
const end = (e) => e.startTime + e.duration;

/** How the request to Gemini ended, for each kind of error agent.js reports. */
const ERRORS = {
  timeout: "no reply: stopped by the time limit", network: "couldn't reach Google",
  appcheck: "App Check refused the request (403)", quota: "Gemini: free quota used up (429)", busy: "Gemini: too busy (500/503)",
};

/**
 * What a token request's result means. Chromium reports its HTTP status, and 0 when the request failed; other browsers
 * may not report it at all, and then it counts as ok (the page can't tell).
 *
 * @param {number|null|undefined} status The token request's status from Resource Timing (missing: not reported).
 * @returns {"ok"|"refused"|"failed"} refused: App Check said no (e.g. 403). failed: no answer got through (offline, or
 *   blocked on the way, e.g. by a proxy). Either way the SDK has no valid token, so it sends a placeholder instead.
 */
export function tokenVerdict(status) {
  if (status === 0) return "failed";
  if (status != null && status !== 200) return "refused";
  return "ok";
}

/**
 * The stages of one message, back to back: each starts where the one before it ended, so they add up to the total.
 * A stage that hasn't finished yet runs until `now` and is marked live.
 *
 * @param {object} p
 * @param {{sent: number, checked?: number, generate?: number, result?: number, shown?: number}} p.marks
 *   performance.now() at Send, when respond()'s checks were done, when generate() was called, when its result came
 *   back and when the reply was on the page (missing = not reached yet).
 * @param {{type: string, kind?: string}} [p.outcome] agent.js's result event (model-ok, model-empty or model-error).
 * @param {{startTime: number, duration: number, responseStatus?: number}[]} [p.tokens] App Check token requests since
 *   Send, oldest first. Usually none: the hourly token was already in the browser.
 * @param {{startTime: number, duration: number, responseStatus?: number}|null} [p.model] The request to Gemini, once
 *   it has finished (Resource Timing reports a request only when it's done).
 * @param {number} p.now The current performance.now().
 * @param {boolean} [p.local] true on localhost / 127.0.0.1, where a debug token stands in for reCAPTCHA.
 * @returns {{rows: {key: string, name: string, where: "browser"|"google"|"both", ms: number, live: boolean}[],
 *   total: number, live: boolean, note: string}} where "both": your browser and Google, which the page can't split.
 */
export function stages({ marks, outcome, tokens = [], model = null, now, local = false }) {
  const rows = [];
  let at = marks.sent;
  /** Adds the stage that runs from the previous one's end until `until` (still running if until is missing). */
  const stage = (key, name, where, until) => {
    const live = until == null;
    rows.push({ key, name, where, ms: Math.max(0, (live ? now : until) - at), live });
    if (!live) at = Math.max(at, until);
    return !live;
  };
  const kind = outcome?.type === "model-error" ? outcome.kind : null;
  const failure = kind ? ERRORS[kind] ?? "HTTPS → App Check → AI Logic → Gemini: an error" : "";
  // Something came back from Google (a reply or an error status); nothing does after a timeout or a network error.
  const answered = (model != null || marks.result != null) && kind !== "timeout" && kind !== "network";
  const back = (name) => stage("back", `10–11 · ${name}`, "browser", marks.shown);
  const backHome = () => back(kind === "timeout" ? "the time-limit message goes on the page"
    : `back in your browser: ${kind ? "the error message goes on the page" : "respond() → the reply on the page"}`);
  const done = (note = "") => ({ rows, total: Math.max(0, (marks.shown ?? now) - marks.sent), live: marks.shown == null, note });

  // 1–4: in your browser until respond() has checked the text.
  if (!stage("checks", "1–4 · Send → onSend(e) → respond() checks", "browser", marks.checked ?? marks.generate ?? marks.shown)) {
    return done();
  }
  if (marks.generate == null) {                 // stopped by the checks (or setup isn't finished): nothing left the browser
    if (marks.checked != null) back("the hint goes on the page");
    return done("Nothing was sent: respond() answered from your browser.");
  }

  // 5: generate() attaches an App Check token. Usually the hourly one already in your browser: no request at all. If it's
  // missing or expired, the SDK first gets a new one: the proof (locally the debug token, read in your browser; live,
  // reCAPTCHA, which checks this page in your browser and gets its proof from Google), then the token request (the
  // drone). One that started after the request to Gemini is a renewal in the background, not this message's.
  const own = tokens.filter((e) => !model || e.startTime < model.startTime);
  let verdict = "ok", status;
  if (own.length) {
    stage("proof", local ? "5 · generate(): no valid hourly token, so the SDK reads this browser's debug token"
      : "5 · generate(): no valid hourly token, so reCAPTCHA checks this page and gets its proof from Google",
      local ? "browser" : "both", own[0].startTime);
    status = own.at(-1).responseStatus;
    verdict = tokenVerdict(status);
    const detail = [verdict === "failed" ? "failed" : verdict === "refused" ? String(status) : "",
      own.length > 1 ? `${own.length} tries` : ""].filter(Boolean).join(", ");
    stage("token", `5 · the drone: a new hourly token from App Check${detail ? ` (${detail})` : ""}`, "google",
      Math.max(...own.map(end)));
  } else if (model) {
    stage("cached", kind === "appcheck" ? "5 · generate(): no token request: the SDK attaches its token (or a placeholder)"
      : "5 · generate(): the SDK attaches the hourly token already in your browser (no token request)", "browser", model.startTime);
  } else {
    // No request reported: still out (Resource Timing reports a request only once it's done), or never reported (e.g. a
    // full Resource Timing buffer). Either way the page can't split the token from the request to Gemini.
    if (!stage("unsplit", marks.result == null ? "5–9 · generate(): the request to Gemini, waiting for Google…"
      : `${answered ? "5–10" : "5–9"} · generate(): ${failure || "the request to Gemini, and back"} ` +
        "(the browser didn't report the requests, so they can't be split)", "both", marks.result)) return done();
    backHome();
    return done();
  }

  // 6–10: one HTTPS request: over the internet, App Check's check, AI Logic, Gemini, and the answer's trip back over the
  // internet (the start of the tracker's 10). It goes even without a valid token: the SDK then sends a placeholder, which
  // App Check refuses (403). It ends with its Resource Timing entry (a request stopped mid-flight still gets one, with
  // status 0); without an entry, at generate()'s result. Nothing comes back after a timeout or a network error, so those
  // stay 6–9.
  const n = answered ? "6–10" : "6–9";
  const name = kind ? `${n} · ${failure}`
    : answered ? `${n} · HTTPS → App Check → AI Logic → Gemini, and back over HTTPS`
    : `${n} · waiting for Google: App Check → AI Logic → Gemini…`;
  if (!stage("gemini", name, "google", model ? end(model) : marks.result)) return done();
  backHome();

  if (verdict !== "ok") {
    return done(`${verdict === "failed" ? "The token request failed (offline, or blocked on the way)"
      : `App Check refused the new token (${status})`}, so the SDK sent your message with a placeholder token` +
      `${kind === "appcheck" ? ", which App Check refused (403)" : ""}.`);
  }
  if (kind) return done();
  const token = rows.find((r) => r.key === "token"), gemini = rows.find((r) => r.key === "gemini");
  if (!token) {
    return done("No token request: the SDK reused the hourly token already in your browser. Your browser sees the request " +
      `to Gemini as one HTTPS call, so its ${fmt(gemini.ms)} includes App Check's check, AI Logic and Gemini writing the reply.`);
  }
  return done(gemini.ms > 2 * token.ms
    ? `Your browser sees the request to Gemini as one HTTPS call, so it can't split it. For scale: the token request also ` +
      `went to Google and back, in ${fmt(token.ms)}. So most of the ${fmt(gemini.ms)} is Google at work: App Check's check, ` +
      "AI Logic and Gemini writing the reply."
    : "");
}
