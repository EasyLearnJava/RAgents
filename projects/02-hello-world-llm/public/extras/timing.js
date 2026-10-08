/**
 * EXTRA: a teaching aid, not part of the agent.
 *
 * Where the time went for one message, measured by the page itself: the moments the street view records (Send,
 * respond()'s checks done, generate() called, its result, the reply on the page) plus what the browser's Resource
 * Timing reports about the page's own requests to Google: the App Check token exchange and the request to Gemini.
 * Live, reCAPTCHA also asks Google for its proof, from its own frame. The page can't time that request, so it's inside
 * stage 5's proof, shown as "your browser + Google".
 *
 * The street view is slowed down; these are the real times. The stages are numbered like the street view's tracker.
 * Steps 5 and 10 take two rows each: 5 is the proof, then the token request; 10 is the answer's trip back over the
 * internet (timed with the request, which the browser sees as one call), then the rest in your browser.
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

/** The App Check SDK's own error code in agent.js's error event ("fetch-network-error", "throttled", …), if any. */
export const appCheckCode = (outcome) =>
  outcome?.type === "model-error" ? /\(appCheck\/([\w-]+)\)/.exec(outcome.message ?? "")?.[1] : undefined;

/**
 * What a token request's result means. Chromium reports its HTTP status, and 0 when the request failed; other browsers
 * may not report it at all, and then the App Check SDK's error code in the outcome decides. Either way, the SDK stops
 * when it gets no token: nothing goes to Gemini.
 *
 * @param {number|null|undefined} status The token request's status from Resource Timing (missing: not reported).
 * @param {{type: string, message?: string}} [outcome] agent.js's result event, if it has come.
 * @returns {"ok"|"refused"|"failed"} refused: App Check said no (e.g. 403). failed: no answer got through (offline, or
 *   blocked on the way, e.g. by a proxy).
 */
export function tokenVerdict(status, outcome) {
  const code = appCheckCode(outcome);
  if (status === 0 || code === "fetch-network-error") return "failed";
  if ((status != null && status !== 200) || code) return "refused";
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
 * @param {{type: string, kind?: string, message?: string}} [p.outcome] agent.js's result event (model-ok, model-empty
 *   or model-error).
 * @param {{startTime: number, duration: number, responseStatus?: number}[]} [p.tokens] App Check token exchanges
 *   since Send, oldest first (usually one).
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
    if (!live) at = until;
    return !live;
  };
  const kind = outcome?.type === "model-error" ? outcome.kind : null;
  const back = (name) => stage("back", `10–11 · ${name}`, "browser", marks.shown);
  const done = (note = "") => ({ rows, total: Math.max(0, (marks.shown ?? now) - marks.sent), live: marks.shown == null, note });

  // 1–4: in your browser until respond() has checked the text.
  if (!stage("checks", "1–4 · Send → onSend(e) → respond() checks", "browser", marks.checked ?? marks.generate ?? marks.shown)) {
    return done();
  }
  if (marks.generate == null) {                 // stopped by the checks (or setup isn't finished): nothing left the browser
    if (marks.checked != null) back("the hint goes on the page");
    return done("Nothing was sent: respond() answered from your browser.");
  }

  // 5: generate() gets a single-use token. First the proof for App Check: locally the debug token, read in your
  // browser; live, reCAPTCHA, which checks this page in your browser and gets its proof from Google. Then the token
  // request (the drone). Resource Timing reports the token request only once it's done.
  if (!tokens.length) {
    if (marks.result == null) {
      stage("proof", "5 · generate(): getting a single-use App Check token…", "both");
      return done();
    }
    const code = appCheckCode(outcome);
    const [name, where] = kind === "timeout" ? ["no App Check token within the time limit", "both"]
      : code === "throttled" ? ["no token request: App Check is holding off after a refusal (reload the page to retry)", "browser"]
      : code === "recaptcha-error" ? ["reCAPTCHA couldn't vouch for this page, so no token was requested", "both"]
      : code ? ["no App Check token (the browser hasn't reported the token request yet)", "both"]
      : [];
    if (name) {                                 // no token, so the SDK stopped: nothing was sent to Gemini
      stage("proof", `5 · generate(): ${name}`, where, marks.result);
      back(kind === "timeout" ? "the time-limit message goes on the page" : "the error message goes on the page");
      return done(kind === "timeout" ? "No App Check token came back in time, so your message was never sent to Gemini."
        : code === "throttled" ? "No token request, so nothing was sent to Google." : "No token, so your message was never sent to Gemini.");
    }
    // Google answered, but the browser kept no record of the requests (e.g. its Resource Timing buffer was full).
    stage("unsplit", `5–10 · generate(): token, request to Gemini and back${kind ? `: ${ERRORS[kind] ?? "an error"}` : ""} ` +
      "(the browser didn't report the requests, so they can't be split)", "both", model ? end(model) : marks.result);
    back(kind ? "back in your browser: the error message goes on the page" : "back in your browser: respond() → the reply on the page");
    return done();
  }
  stage("proof", local ? "5 · generate(): the SDK reads this browser's debug token"
    : "5 · generate(): reCAPTCHA checks this page and gets its proof from Google", local ? "browser" : "both", tokens[0].startTime);
  const status = tokens.at(-1).responseStatus;
  const verdict = tokenVerdict(status, outcome);
  const tries = tokens.length > 1 ? `${tokens.length} tries` : "";
  const detail = [verdict === "failed" ? "failed" : verdict === "refused" ? String(status || "refused") : "", tries]
    .filter(Boolean).join(", ");
  stage("token", `5 · the drone: single-use token from App Check${detail ? ` (${detail})` : ""}`, "google",
    Math.max(...tokens.map(end)));
  if (verdict !== "ok") {                       // the SDK stops here: nothing goes to Gemini
    back("the error message goes on the page");
    return done(verdict === "failed"
      ? "The token request failed (offline, or blocked on the way, e.g. by a proxy), so nothing was sent to Gemini."
      : `App Check refused the token${status ? ` (${status})` : ""}, so nothing was sent to Gemini.`);
  }

  // 6–10: one HTTPS request: over the internet, App Check's check, AI Logic, Gemini, and the answer's trip back over
  // the internet (the start of the tracker's 10). It ends with its Resource Timing entry (a request stopped mid-flight
  // still gets one, with status 0); without an entry, at generate()'s result. Nothing comes back after a timeout or a
  // network error, so those stay 6–9.
  const answered = (model != null || marks.result != null) && kind !== "timeout" && kind !== "network";
  const n = answered ? "6–10" : "6–9";
  const name = kind ? `${n} · ${ERRORS[kind] ?? "HTTPS → App Check → AI Logic → Gemini: an error"}`
    : answered ? `${n} · HTTPS → App Check → AI Logic → Gemini, and back over HTTPS`
    : `${n} · waiting for Google: App Check → AI Logic → Gemini…`;
  if (!stage("gemini", name, "google", model ? end(model) : marks.result)) return done();
  back(kind === "timeout" ? "the time-limit message goes on the page"
    : `back in your browser: ${kind ? "the error message goes on the page" : "respond() → the reply on the page"}`);

  const token = rows.find((r) => r.key === "token"), gemini = rows.find((r) => r.key === "gemini");
  return done(!kind && gemini.ms > 2 * token.ms
    ? `Your browser sees the request to Gemini as one HTTPS call, so it can't split it. For scale: the token request also ` +
      `went to Google and back, in ${fmt(token.ms)}. So most of the ${fmt(gemini.ms)} is Google at work: App Check's check, ` +
      "AI Logic and Gemini writing the reply."
    : "");
}
