/**
 * EXTRA: a teaching aid, not part of the agent.
 *
 * Where the time went for one message, measured by the page itself: the moments index.html reports (the submit event,
 * just before fetch(), api() resolved, the reply added to the page) and the next frame after them, what the browser's
 * Resource Timing reports about the request to /api/step4/chat (when it went out, the answer's first byte and its last
 * byte), and server_ms from the JSON reply: how long run_with_events() took, timed by the server itself.
 *
 * Your browser sees the request as one call, so it can't tell the network from the server's own work. server_ms is the
 * one part it can split out, because the server timed it and sent it back. Everything else between the request going
 * out and the answer's first byte (the network both ways, the site server or Vercel, Python starting up if the function
 * was cold, FastAPI turning JSON into Python and back) is one stage. The chain ran somewhere inside that time; the page
 * can't say exactly when, so it gets its own row after it.
 *
 * The street view is slowed down; these are the real times. The stages are numbered like the street view's tracker.
 * The street view and the diagram wait until the reply has been drawn (the car starts after 300 ms if the answer is
 * slower), so their own drawing stays out of these times.
 *
 * No DOM here, so the tests run it in Node: street.js measures and draws, this file only does the sums.
 */

/** A duration for people: "< 1 ms", "12 ms" or "1.4 s" (whole milliseconds: some browsers' clocks aren't finer). */
export const fmt = (ms) => (ms < 0.5 ? "< 1 ms" : ms < 999.5 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`);

/** A size for people: "312 bytes" or "1.3 KB". */
export const size = (n) => (n < 1000 ? `${n} bytes` : `${(n / 1024).toFixed(1)} KB`);

/**
 * What api()'s result means, checked in the same order as whyFailed() in index.html, so the street view and the timing
 * tell the same story as the chat. One difference: a 5xx answer other than 502 means the server is there but something
 * on it failed. whyFailed() calls any answer without JSON "not deployed", so the chat says that for it.
 *
 * @param {{ok: boolean, status: number, data: object|null}} res What api() returned.
 * @returns {"ok"|"rejected"|"down"|"server"|"missing"|"network"|"error"} rejected: FastAPI refused it (422: over 1000
 *   characters). down: no Python backend answered (502). server: the server failed (500, 503, 504: e.g. an error in
 *   the Python code, or on Vercel a function that crashed or ran out of time). missing: no backend on this site (404,
 *   or a page instead of JSON). network: no answer at all (status 0). error: any other status.
 */
export function outcome({ ok, status, data }) {
  if (ok) return "ok";
  if (status === 422) return "rejected";
  if (status === 502) return "down";
  if (status >= 500) return "server";
  if (status === 404 || data === null) return "missing";
  if (status === 0) return "network";
  return "error";
}

/**
 * The request's own moments from its Resource Timing entry, or null when the browser didn't report them (a request
 * that failed on the network has no answer to time).
 *
 * @param {object|null} e The Resource Timing entry for /api/step4/chat.
 * @returns {{connect: number|null, request: number, response: number, end: number, bytes: number}|null} connect: when
 *   a new connection started (null when the request reused the one the page already had); request: when it was sent;
 *   response: the answer's first byte; end: its last byte; bytes: the answer's size (0 if not reported).
 */
export function requestTimes(e) {
  if (!e || !(e.requestStart > 0) || !(e.responseStart >= e.requestStart)) return null;
  const fresh = e.connectEnd > e.connectStart || e.domainLookupEnd > e.domainLookupStart;
  return {
    connect: fresh ? e.domainLookupStart || e.connectStart : null,
    request: e.requestStart,
    response: e.responseStart,
    end: Math.max(e.responseStart, e.responseEnd || e.startTime + e.duration),
    bytes: e.encodedBodySize || 0,
  };
}

/**
 * The trip's name: there and back, by how it ended (kind is outcome()'s answer, or null while api() is still reading
 * it). `chain` says whether the chain has its own row.
 */
function tripName(kind, status, chain, { local, vercel }) {
  if (kind === "ok") {
    const parts = local ? "the site server, uvicorn and FastAPI, on this computer"
      : `the internet, ${vercel ? "Vercel" : "the server"} and FastAPI (a cold start lands here too)`;
    return chain ? `5–9 · there and back, except the chain: ${parts}` : `5–9 · there and back: ${parts}, and the chain`;
  }
  return "5–9 · there and back: " + ({
    rejected: "FastAPI refused it (422), so the chain never ran",
    down: "no Python backend answered (502)",
    server: `the server answered ${status} instead of the reply (something on it failed)`,
    missing: `there's no Python backend on this site (${status === 404 ? "404" : "a page came back, not JSON"})`,
    network: "the answer was cut off on the way (network error)",
    error: `the server answered with an error (${status})`,
  }[kind] ?? "the answer is in, api() is still reading it");
}

/** The chain's own stage: run_with_events() on the server, timed by the server. */
const CHAIN = "8 · the chain: run_with_events() in agent.py (timed by the server: server_ms)";

/**
 * The stages of one message, back to back: each starts where the one before it ended, so they add up to the total.
 * A stage that hasn't finished yet runs until `now` and is marked live.
 *
 * @param {object} p
 * @param {{submit?: number, onSend?: number, fetch?: number, api?: number, add?: number, frame?: number,
 *   noFrame?: boolean, scene?: number}} p.marks performance.now() times the street view records from index.html's
 *   calls: the submit event (its e.timeStamp), onSend(e) starting, just before fetch(), api() resolved, the reply added
 *   to the page, then the next frame (missing = not reached yet). noFrame: the browser drew no frame (a hidden tab), so
 *   the message ends at add. scene: when the street view started playing the trip (it waits for the frame, or 300 ms).
 * @param {{ok: boolean, status: number, data: object|null}|null} [p.res] What api() returned (null while it's out).
 * @param {object|null} [p.entry] The request's Resource Timing entry, once the browser reports it (when it's done).
 * @param {number} p.now The current performance.now().
 * @param {boolean} [p.local] true on localhost / 127.0.0.1: the server is uvicorn on this computer.
 * @param {boolean} [p.secure] true when the page came over HTTPS (a new connection then has a TLS handshake).
 * @param {boolean} [p.vercel] true on the live site, where Vercel runs the Python function.
 * @returns {{rows: {key: string, name: string, where: "browser"|"server"|"both", ms: number, live: boolean}[],
 *   total: number, live: boolean, note: string}} where "both": your browser and the server, which the page can't split.
 */
export function stages({ marks, res = null, entry = null, now, local = false, secure = false, vercel = false }) {
  const rows = [];
  let at = marks.submit ?? marks.onSend ?? marks.fetch;
  /** Adds the stage that runs from the previous one's end until `until` (still running if until is missing). */
  const stage = (key, name, where, until) => {
    const live = until == null;
    rows.push({ key, name, where, ms: Math.max(0, (live ? now : until) - at), live });
    if (!live) at = Math.max(at, until);
    return !live;
  };
  const kind = res ? outcome(res) : null;
  const ms = (key) => rows.find((r) => r.key === key)?.ms;
  const done = (note = "") => ({ rows, total: rows.reduce((sum, r) => sum + r.ms, 0), live: rows.some((r) => r.live), note });
  /** The chain's time, from the server's server_ms, never more than the time it could have run in. */
  const chainMs = (span) => (kind === "ok" && Number.isFinite(res.data?.server_ms) ? Math.min(res.data.server_ms, Math.max(0, span)) : null);
  const t = requestTimes(entry);

  // 1–4: in your browser, until the request goes out (or a new connection starts first).
  if (!stage("send", "1–4 · Send → onSend(e) → api() → fetch() sends the request", "browser", t ? t.connect ?? t.request : marks.fetch)) {
    return done();
  }
  let unsplit = false;
  if (t) {
    // 5: a new connection first, when the page had none open (closed while idle). With HTTPS that's a TLS handshake.
    if (t.connect != null) {
      stage("connect", secure ? "5 · a new connection first: DNS, TCP and the TLS handshake (it agrees the session key)"
        : `5 · a new connection first (TCP${local ? ", on this computer" : ""})`, "both", t.request);
    }
    // 5–9: from the request going out to the answer's first byte. The chain ran inside it, on the server's own clock.
    const chain = chainMs(t.response - t.request);
    stage("trip", tripName(kind, res?.status, chain != null, { local, vercel }), "server", t.response - (chain ?? 0));
    if (chain != null) stage("chain", CHAIN, "server", t.response);
    stage("download", `9 · downloading the ${kind === "ok" ? "reply" : "answer"}${t.bytes ? ` (${size(t.bytes)})` : ""}`, "server", t.end);
  } else if (marks.api == null) {
    // Still out: Resource Timing reports a request only once it's done, so it can't be split yet.
    stage("wait", "5–9 · waiting for the server…", "both", null);
    return done();
  } else if (kind === "network") {
    stage("failed", "4–5 · fetch(): no answer came back (network error)", "both", marks.api);
  } else {
    // Done, but the browser didn't report the request (e.g. a full Resource Timing buffer): one stage, apart from the
    // chain, whose time the server sent back.
    unsplit = true;
    const chain = chainMs(marks.api - at);
    stage("unsplit", `${tripName(kind, res.status, chain != null, { local, vercel })} (the browser didn't report the request, so this ` +
      "includes api() reading it)", "both", marks.api - (chain ?? 0));
    if (chain != null) stage("chain", CHAIN, "server", marks.api);
  }

  // 9–10: back in your browser: api() reads the JSON (or returns its error), onSend(e) puts the text on the page.
  const back = kind === "network" ? "api() returns { ok: false, status: 0 }" : res?.data === null ? "api() finds no JSON" : "api() reads the JSON";
  if (!stage("back", `9–10 · back in your browser: ${back}, onSend(e) calls add()`, "browser", marks.add)) return done();
  if (!marks.noFrame && !stage("draw", "10 · until the next frame, which draws it", "browser", marks.frame)) return done();

  const note = kind === "rejected" ? "FastAPI refused the message before chat() ran, so there's no chain stage: its 422 came straight back."
    : kind === "down" ? (local ? "No Python code ran: the site server couldn't reach uvicorn, so it answered 502 straight away."
      : "No Python code answered: the server said 502.")
    : kind === "server" ? `The server answered ${res.status} instead of the reply, so there's no server_ms and the chain can't be ` +
      "split out: the trip includes however long the server worked before it failed." +
      (vercel ? " On Vercel an error in the Python code answers 500, and a function that runs past its 10 s limit 504." : "")
    : kind === "missing" ? "No Python code ran: there's no backend behind /api/step4/chat on this site."
    : kind === "error" ? `The server answered ${res.status}, an error instead of the reply, so there's no chain stage.`
    : kind === "network" ? "No answer came back, so there's nothing to split: this is the time until fetch() gave up."
    : unsplit ? "Your browser didn't report this request (Resource Timing), so the trip can't be split, apart from the chain: " +
      "the server timed that itself (server_ms)."
    : kind === "ok" && ms("chain") != null ? (local
      ? `The chain took ${fmt(ms("chain"))}; the trip's other ${fmt(ms("trip"))} is the site server passing the request ` +
        "to uvicorn and back, and FastAPI turning JSON into Python and back, all on this computer."
      : `The chain took ${fmt(ms("chain"))}. Your browser sees the request as one call, so the internet, ` +
        `${vercel ? "Vercel" : "the server"} and FastAPI share the trip's ${fmt(ms("trip"))}. A cold start (a new copy of ` +
        "the function starting Python and loading FastAPI and LangChain) lands there too and can add a second or more: " +
        "send another message to compare.")
    : "";
  // The street view starts playing once the reply is drawn; a slow answer starts it at 300 ms, while the request is out.
  const early = marks.scene != null && marks.scene < (marks.noFrame ? marks.add : marks.frame);
  return done([note,
    early ? "The street view started playing while you waited (after 300 ms), so the stages back in your browser can " +
      "include a little of its own drawing." : "",
    marks.noFrame ? "The tab was hidden, so the browser drew no frame: the total ends at add()." : "",
  ].filter(Boolean).join(" "));
}
