/**
 * EXTRA: a teaching aid, not part of the agent.
 *
 * "Street view" of step 4, the first step with a backend: your message leaves the browser for a Python server and comes
 * back as JSON. The car drives it through your browser (the form, index.html's onSend(e), then api(), which sends it
 * with fetch), over the bridge to the server's land and back. There: the server's front door (live, Vercel sends /api/*
 * to the Python function api/index.py; locally, the site server forwards it to uvicorn), FastAPI's gate in main.py (at
 * most 1000 characters, or 422 before chat() runs), and agent.py, where run_with_events() runs the chain normalize |
 * rules. The JSON reply carries the server's own LangChain events, and the chain's board lights up from them, so it
 * shows what really ran on the server.
 *
 * Live (https://) the bridge is HTTPS: at its entrance the request is encrypted (the sign lights up, the TLS session key
 * shows and the tag scrambles), at the server's front door it's decrypted with the same key, and the answer comes back
 * the same way. Locally it's plain HTTP on 127.0.0.1, which never leaves your computer: nothing is encrypted, and the
 * scene and the panel under it say so.
 *
 * It follows what really happened: index.html hands over api()'s result, so a network error fails on the bridge, a 502
 * or 404 stops at the server's front door with the reason (so does a 500 or 504: the server is there, but something on
 * it failed), and a 422 stops at FastAPI's gate. The car waits at the front door until the answer is in, which is where
 * a cold start on Vercel spends its time. On page load the courier drone replays the health check
 * (GET /api/step4/health) and the health board shows its answer: the Python and langchain-core versions, or why there's
 * no backend. The wire board shows what api() really sent and got back.
 *
 * Under the tracker, "Where the time went" shows the real time of each stage (the sums are in timing.js), and the
 * network log lists the page's real requests since your first message (Resource Timing). So that its own drawing isn't
 * timed as part of your message, the street view starts playing once the reply has been drawn, or after 300 ms if the
 * answer is slower (then the car drives while you wait).
 *
 *   street.health(res)   the page-load health check came back    street.start(timeStamp)   onSend(e) began
 *   street.send(text)    just before api() calls fetch()           street.answer(res)        api() resolved
 *   street.reply(shown)  the reply (or why it failed) is on the page
 *
 * Drawn with the shared toolkit /lib/town.js (plain SVG, no library). All text goes in with textContent.
 */
import * as t from "/lib/town.js";
import { fmt, outcome, size, stages } from "./timing.js";

const { svg, box, house, depot, factory, chimney, tree, lamp, road, curve, lanes, depthLayer, pin, boom, board,
  vehicle, courier, tracker, card, el, paneX, paneY, banner, iso } = t;

/** Pin labels are drawn bigger here: this town is wide, so it's shown smaller. */
const S = 1.2;

/** On localhost / 127.0.0.1 the site server forwards /api/* to uvicorn, on this computer. */
const LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);
/** On a vercel.app address (the live site) Vercel runs the backend as a Python function. */
const VERCEL = location.hostname.endsWith(".vercel.app");
/** The page came over HTTPS, so its requests to /api are encrypted on the way too (same site, same protocol). */
const SECURE = location.protocol === "https:";

/** The server's land, by where the page runs: its banner, its front door's pin, and what the narration calls it. */
const SERVER = LOCAL
  ? { land: "PYTHON SERVER", sub: "uvicorn, on this computer", door: "Site server", route: "forwards /api/* to uvicorn", it: "the site server" }
  : VERCEL ? { land: "VERCEL", sub: "runs the Python function", door: "Vercel", route: "/api/* → api/index.py", it: "Vercel" }
  : { land: "WEB SERVER", sub: location.host, door: "Web server", route: "this site's /api/*", it: "this site's server" };

/** The road: through your browser, round a bend, straight over the bridge, then through the server's land. */
const ROAD = [[-6, 45], [6, 45], [20, 46], [32, 49], [46, 49], [60, 46], [74, 45], [86, 46], [96, 43], [103, 35], [105, 24],
  [105, 12], [105, 0], [105, -12], [105, -24], [104, -36], [101, -48], [100, -60], [102, -72], [103, -82]];
/**
 * Where the car stops (points on the road; the lane is found from them). Between the bridge's portals the skewed signs
 * leave no room for a long tag, so the car stops on either side of the bridge, where its tag stays clear of them: at the
 * near end (bridge on the way out, landing on the way back) and at the server's front door, past the far portal (door
 * on the way out; exit on the way back, a little further on, where the reply's longer tag clears the far sign). fastapi
 * is just short of FastAPI's barrier.
 */
const STOP = { house: [8, 45], gate: [16.5, 45.8], depot: [37, 48.5], api: [80, 45.5], bridge: [105, 17], landing: [105, 24],
  door: [104, -37], exit: [103.2, -39.5], fastapi: [102.3, -43], agent: [101.5, -70] };

const TRACK = [
  ["Typed", "You"], ["Submit", "<form>"], ["onSend(e)", "index.html"], ["api()", "fetch POST"],
  SECURE ? ["HTTPS", "encrypt → decrypt"] : ["HTTP", LOCAL ? "127.0.0.1" : "not encrypted"],
  ["Server", LOCAL ? "site server → uvicorn" : VERCEL ? "Vercel → Python" : "this site"],
  ["chat()", "main.py · FastAPI"], ["Chain", "agent.py"], ["Back", "JSON to your browser"], ["Shown", "You"],
];

/** The chain's branches in agent.py, in the order RunnableBranch tries them (normalize runs before them). */
const RULES = ['is empty?  text == ""', "is greeting?  hello / hi / hey", "else  reply: fallback"];
/** The server's event names → the board's rows. */
const ROW = { "is empty?": 0, "is greeting?": 1, "reply: fallback": 2 };

/** The bridge: its two pairs of towers (y), their height, the cable's lowest point, and its far and near side (x). */
const TOWERS = [-15, 9], TOWER_TOP = 16, SAG = 3, SIDES = [95.2, 114.8];
/** The main cable's height at y: a parabola from tower top to tower top, lowest half-way. */
const cableZ = (y) => SAG + (TOWER_TOP - SAG) * ((2 * y - TOWERS[0] - TOWERS[1]) / (TOWERS[1] - TOWERS[0])) ** 2;

/**
 * Where the courier drone parks (the helipad on api()'s roof) and where the health check can end: beside main.py
 * (health() answered), beside the server's front door (no backend behind it, or it failed), or over the bridge (no
 * answer at all). Each one keeps the drone's tag clear of the pins and the bridge's signs.
 */
const DRONE_HOME = [84.5, 29.5, 11], DRONE_MAIN = [96, -55, 14], DRONE_DOOR = [98, -29, 6], DRONE_BRIDGE = [105, -3, 8];

const quote = (s, max) => `“${s.length > max ? s.slice(0, max - 1) + "…" : s}”`;
const clip = (s, max) => (s.length > max ? s.slice(0, max - 1) + "…" : s);
const SYMS = "#%&@$!?*+=~^xXqQkKzZ9786";
/** What text looks like on the wire: every character scrambled (a stand-in for real ciphertext), spaces kept. */
const scramble = (s) => Array.from(s, (c, i) => (c === " " ? " " : SYMS[(c.codePointAt(0) * 7 + i * 13) % SYMS.length])).join("");
/** HTTP status words, for the wire board. */
const STATUS = { 200: "OK", 404: "Not Found", 405: "Method Not Allowed", 422: "Unprocessable Content", 500: "Internal Server Error",
  502: "Bad Gateway", 503: "Service Unavailable", 504: "Gateway Timeout" };

/** The newest Resource Timing entry for one of this site's paths since `since` (null if the browser hasn't reported one). */
const latest = (path, since = 0) => performance.getEntriesByType("resource")
  .filter((e) => e.startTime >= since && new URL(e.name).pathname === path).at(-1) ?? null;

// ---------- The scene ----------

function build() {
  t.ensureStyles();
  const ui = card("Street view: your message goes to a Python server",
    "The car carries your message out of your browser, over the bridge to the Python server " +
    (LOCAL ? "(here uvicorn, on this computer) " : VERCEL ? "(Vercel runs it) " : "") + "and brings the reply back as " +
    "JSON. It stops where each piece runs and follows what really happened, errors included; the chain's board lights up " +
    "from the server's own events. Everything is slowed down so you can follow it; the real times are under the tracker, " +
    "in \"Where the time went\".",
    "Street view of one message's trip to the Python server and back");
  performance.setResourceTimingBufferSize?.(1000);   // the network log and the timings read it; the default keeps 250
  // When it's full, make room instead of losing entries (the browser then adds the ones that were waiting).
  performance.addEventListener?.("resourcetimingbufferfull", () =>
    performance.setResourceTimingBufferSize(2 * performance.getEntriesByType("resource").length));

  const root = svg("svg", { class: "st-scene st-framed", viewBox: "-580 -470 2340 1200", role: "img",
    "aria-label": "Your browser and the Python server as two pieces of land joined by a bridge; a car carries the message between them" });

  // Land: the server (far), the bridge (over the internet's clouds; locally there's no internet under it), your browser
  // (near). Then the road.
  box(root, [60, -98, -2.5], [58, 80, 2.5], "cloud");
  for (const y of TOWERS) for (const x of SIDES) box(root, [x - 1, y - 1, -15], [2, 2, 12.6], "steel");   // piers under the towers
  if (!LOCAL) {
    for (const [x, y, z, r] of [[88, -6, -9, 30], [122, 4, -7, 36], [97, -15, -12, 24], [122, -14, -10, 28], [86, 8, -8, 22],
      [101, -15, -15, 26], [112, -15, -15, 22], [101, 9, -15, 24], [113, 9, -15, 28]]) {
      const [cx, cy] = iso(x, y, z);
      svg("ellipse", { class: "st-cloud", cx, cy, rx: r * 1.6, ry: r * 0.8 }, root);
    }
  }
  bridgeBack(root);
  box(root, [-8, 12, -2.5], [124, 50, 2.5], "slab");
  const center = curve(ROAD), lane = lanes(center);
  road(root, center, { capEnd: true });

  // Everything that stands up, in back-to-front order (the car moves through this layer).
  const depth = depthLayer(root);
  const top = svg("g", {}, root);
  const tags = svg("g");                            // the car's tag goes over everything, labels included
  const L = depth.layer, b = {};
  b.house = depth.add(house(L, 2, 20), 34);
  b.gate = svg("g", { class: "st-bldg" }, L);
  box(b.gate, [21, 33.6, 0], [4, 3.6, 5.4], "booth");
  box(b.gate, [20.6, 33.2, 5.4], [4.8, 4.4, 0.8], "wall");
  paneY(b.gate, 21.6, 24.4, 37.2, 2.4, 4.6);
  box(b.gate, [23.2, 37.4, 0], [0.6, 0.6, 4.6], "booth");
  const formArm = boom(b.gate, [23.5, 37.7, 4.2], [0, 1], 17);
  depth.add(b.gate, 58);
  b.depot = depth.add(depot(L, [30, 20], [14, 14, 9]), 64);
  b.api = depth.add(depot(L, [72, 18], [15, 14, 10]), 104);
  const pad = t.ground(b.api, 84.5, 29.5, 10.03);                  // the drone's helipad
  svg("circle", { class: "st-pad", r: 2.6 * t.K }, pad);
  t.label(pad, 0, 0.9 * t.K, "H", "st-padh", "middle", 2.4 * t.K);
  const antenna = svg("g", { class: "st-antenna" }, L);           // fetch() sends the request from here
  const [ax0, ay0] = iso(84, 21, 10), [ax1, ay1] = iso(84, 21, 17);
  svg("line", { x1: ax0, y1: ay0, x2: ax1, y2: ay1 }, antenna);
  for (let i = 0; i < 3; i++) svg("circle", { cx: ax1, cy: ay1, r: 10, style: `animation-delay:${i * 0.4}s` }, antenna);
  depth.add(antenna, 106);

  // The server: its front door (a long building that reaches the car's stops past the bridge), main.py with FastAPI's
  // gatehouse beside the road (the ChatIn check), and agent.py. main.py and its gatehouse light up together, so
  // b.fastapi holds both.
  b.door = depth.add(depot(L, [86, -38], [10, 13, 8], "gwall"), 61);
  const gatehouse = svg("g", { class: "st-bldg" }, L);
  box(gatehouse, [91, -51, 0], [4.5, 4, 5.6], "booth");
  box(gatehouse, [90.6, -51.4, 5.6], [5.3, 4.8, 0.8], "gwall");
  paneX(gatehouse, 95.5, -50.2, -47.8, 2.4, 4.6);
  const apiArm = boom(gatehouse, [96, -49, 4.2], [1, 0], 17);
  b.fastapi = [depth.add(depot(L, [70, -58], [20, 14, 12], "gwall"), 26), depth.add(gatehouse, 45)];
  b.agent = depth.add(factory(L, [66, -92], [22, 16, 9]), -10);
  depth.add(chimney(L, 88.6, -90, 15), -1);

  // Bridge railings (the near one is in front of the car), trees and lamps.
  for (const [x, d] of [[95.6, 92], [114.4, 112]]) {
    const rail = svg("g", {}, L);
    svg("line", { class: "st-rail", ...lineAt([x, -18, 1.4], [x, 12, 1.4]) }, rail);
    for (let y = -18; y <= 12; y += 5) svg("line", { class: "st-rail", ...lineAt([x, y, 0], [x, y, 1.4]) }, rail);
    depth.add(rail, d);
  }
  for (const [x, y] of [[17, 24], [18, 31], [26, 28], [48, 23], [56, 31], [63, 22], [92, 26], [64, -38], [80, -38], [62, -64],
    [116, -60], [116, -40], [116, -86], [94, -86]]) depth.add(tree(L, x, y), x + y);
  for (const [x, y] of [[84, 58], [99, 58.5]]) depth.add(tree(L, x, y), x + y);
  for (const [x, y] of [[29, 38.5], [57, 36.5], [94.5, -60], [95, -42]]) depth.add(lamp(L, x, y), x + y);
  const car = vehicle(depth, tags, S);
  const drone = courier(tags, S);
  const droneBody = tags.querySelector(".st-drone");   // "parked" stops its rotors (style.css)

  // The front of the bridge (always in front of the car), what's under it, then labels.
  const bridge = bridgeFront(top, tags);
  b.bridge = bridge.g;
  // Under the bridge: the internet's clouds live; locally nothing, because 127.0.0.1 never leaves your computer.
  const [skyX, skyY] = LOCAL ? iso(118, 14, -16) : iso(124, -2, -12);
  t.label(top, skyX, skyY, LOCAL ? "127.0.0.1: no internet" : "the internet", "st-sky", "middle", 30);
  // Raised pins (the last number) keep their boxes clear of each other and of the tags at the car's and drone's stops:
  // the form's clears the car's tag at your house, main.py's leaves room for the drone's tag below it.
  const pins = {
    house: pin(top, [8, 26, 12.6], "You", "the chat page", S),
    gate: pin(top, [23, 35.4, 6.4], '<form id="form">', '"submit" event', S, 30),
    depot: pin(top, [37, 26, 9.5], "index.html", "onSend(e) · add()", S, 100),
    api: pin(top, [79, 24, 12], "api(path, body)", "index.html: fetch()", S),
    door: pin(top, [91, -29.5, 8.5], SERVER.door, SERVER.route, S, 24),
    fastapi: pin(top, [80, -51, 12.5], "main.py · FastAPI", "≤ 1000 characters? → chat()", S, 12),
    agent: pin(top, [77, -84, 12.5], "agent.py", "run_with_events(): the chain", S),
  };
  const wire = wireBoard(top, [-570, -460]);
  const health = healthBoard(top, [470, -460]);
  const rules = board(top, [1110, -466], "agent.py: the chain's rules", RULES, 1.1, 470);
  banner(top, -560, 560, "YOUR BROWSER TAB", "your computer: everything on this land runs here");
  banner(top, 1330, 360, SERVER.land, SERVER.sub);
  root.append(tags);
  const legend = svg("g", { class: "st-legend", transform: "translate(1180 520)" }, top);
  const keys = [["→ near lane: your message", "lg you"], ["← far lane: the reply", "lg bot"],
    ...(SECURE ? [["🔒 tag = encrypted on the internet", "lg"], ["🔑 = TLS session key (both ends)", "lg"]]
      : [[LOCAL ? "no 🔒: plain HTTP on 127.0.0.1" : "no 🔒: plain HTTP, not encrypted", "lg"]]),
    ["drone = the health check (page load)", "lg"]];
  keys.forEach(([text, cls], i) => t.label(legend, 0, i * 44, text, cls, "start", 30));

  // Tracker, narration, timing, the bridge's panel and the network log.
  const track = tracker(TRACK);
  const log = el("div", "st-netlog");
  const count = el("b", "", "0");
  const head = el("p", "st-label"); head.append("Network log · real requests this page made since your first message: ", count);
  const list = el("ol", "st-log");
  log.append(head, list, el("p", "st-note", "From your browser's own record (Resource Timing). Each message makes one request, " +
    "POST /api/step4/chat, to this page's own site: the page and /api share one address (same origin), so no CORS is needed. " +
    "The health check, GET /api/step4/health, ran when the page loaded, before your first message."));
  // Under the tracker: where the time really went for your last message (the sums are in timing.js).
  const timing = t.timingPanel({ fmt,
    where: { browser: "your browser", server: LOCAL ? "the server, on this computer" : "the server, over the internet",
      both: LOCAL ? "your browser + the server" : "your browser + the server, over the internet" },
    hint: "Send a message: each stage's real time shows here, measured by your browser (and the chain by the server).",
    measured: "Measured by your browser: its own clock and Resource Timing for the request to /api/step4/chat. When the " +
      "reply has it, the chain's time is the server's own (server_ms)." });
  const panel = SECURE ? tlsPanel() : LOCAL ? loopPanel() : null;
  ui.card.append(root, track.el, ui.now, timing.el, ...(panel ? [panel.el] : []), log);
  document.body.append(ui.card);        // style.css gives it its own row under the chat

  const sOut = (p) => lane.sOut(...p);
  const play = t.player();
  ui.replay.addEventListener("click", () => { if (lastRun) run({ ...lastRun, replay: true }); });
  ui.pace.addEventListener("click", () => { ui.pace.textContent = play.cycle(); });
  /** Tracker steps the page can't see (after a 500 the server may or may not have run them) get "?" (see style.css). */
  const unsure = (steps) => { for (const j of steps) track.el.children[j].className = "unsure"; };
  const st = {
    car, drone, lane, center, play, ui, rules, track, formArm, apiArm, sOut, bridge, panel, timing, health, wire,
    stop(i, where, skipped = [], maybe = []) {
      for (const [k, gs] of Object.entries(b)) for (const g of [gs].flat()) { g.classList.toggle("on", k === where); g.classList.remove("bad"); }
      for (const [k, p] of Object.entries(pins)) { p.classList.toggle("on", k === where); p.classList.remove("bad"); }
      if (i !== null) { track.set(i, skipped); unsure(maybe); }
    },
    /** The trip is over: every step done, apart from the skipped ones and the ones the page can't see. */
    finish(skipped = [], maybe = []) { track.finish(skipped); unsure(maybe); },
    bad(where) {
      for (const g of [b[where] ?? []].flat()) g.classList.add("bad");
      pins[where]?.classList.remove("on"); pins[where]?.classList.add("bad");
    },
    say(text) { ui.now.textContent = text; },
    busy(on) { root.classList.toggle("busy", on); },
    sending(on) { root.classList.toggle("sending", on); },
    /** The drone takes off for an errand (its rotors spin), or lands on its helipad (they stop: spinning rotors would keep
     * the page drawing frames, which "Where the time went" would count as waiting for the next frame). */
    takeOff() { droneBody.classList.remove("parked"); },
    land() { droneBody.classList.add("parked"); },
    /** Puts the drone back on its helipad, with nothing to carry. */
    park() { drone.place(...DRONE_HOME); drone.carry(""); st.land(); },
    /**
     * Stops everything that moves by itself (antenna, smoke, rotors), so nothing draws while a message is out. It
     * changes nothing that's already still: even rewriting the same SVG attributes makes the browser lay the scene out.
     */
    still() {
      st.busy(false); st.sending(false);            // toggle(…, false) leaves a class that's off alone
      if (!droneBody.classList.contains("parked")) st.park();
    },
    /** Refreshes the network log from the browser's Resource Timing. */
    requests(since) {
      const reqs = since == null ? [] : t.requestsSince(since);
      count.textContent = String(reqs.length);
      list.replaceChildren(...reqs.slice(-8).map((r) => {
        const u = new URL(r.name), li = el("li", "", `${u.origin === location.origin ? "" : u.host}${u.pathname}`);
        // Chromium reports status 0 for a request that got no answer (other browsers may not report a status at all).
        const status = r.responseStatus ? ` · ${r.responseStatus}` : r.responseStatus === 0 && !r.responseStart ? " · no answer" : "";
        const bytes = r.encodedBodySize ? ` · ${size(r.encodedBodySize)}` : "";
        li.append(el("span", "", `${u.host}${status} · ${fmt(r.duration)}${bytes}`));
        return li;
      }));
      if (!reqs.length) list.append(el("li", "", "none yet"));
    },
    reset() {
      car.place(lane.out, sOut(STOP.house)); car.carry("", "you"); formArm(0); apiArm(0);
      for (const end of ["near", "far"]) { bridge.sign(end, ""); bridge.key(end, ""); }
      panel?.upTo(-1); wire.clear();
      st.busy(false); st.sending(false); st.park(); st.stop(-1, null); rules.reset();
    },
  };
  st.reset();
  st.requests(null);
  return st;
}

/**
 * The wire board: what api() really sent and what came back (the text you typed, api()'s result, and the answer's size
 * from Resource Timing). sent(text) fills the request's row; got(res, bytes) the answer's.
 */
function wireBoard(parent, [x, y]) {
  const W = 1000, g = svg("g", { class: "st-board", transform: `translate(${x} ${y})` }, parent);
  svg("rect", { width: W, height: 200, rx: 18 }, g);
  t.label(g, 24, 42, "What api() sent, and what came back", "tt", "start", 30);
  const rows = ["tn", "ts"].map((cls, i) => {
    const row = svg("g", { class: "st-trow", transform: `translate(0 ${92 + i * 58})` }, g);
    return { row, head: t.label(row, 24, 0, "", cls, "start", 25), note: t.label(row, 62, 24, "", "tnote", "start", 18) };
  });
  const set = (i, head, note, kind = "") => {
    rows[i].head.textContent = head; rows[i].note.textContent = note; rows[i].row.setAttribute("class", "st-trow " + kind);
  };
  return {
    clear() { set(0, "→ POST /api/step4/chat", "nothing sent yet"); set(1, "← the answer", "comes back here"); },
    sent(text) {
      set(0, "→ POST /api/step4/chat · Content-Type: application/json", `body: ${clip(JSON.stringify({ message: text }), 76)}`, "used");
      set(1, "← waiting for the answer…", "", "wait");
    },
    got(res, bytes) {
      const kind = outcome(res), d = res.data;
      const of = bytes ? ` · ${size(bytes)}` : "";
      if (kind === "network") { set(1, "← no answer: the request failed (network error)", `fetch() rejected: ${clip(d?.error ?? "", 60)}`, "bad"); return; }
      const head = `← ${res.status} ${STATUS[res.status] ?? ""}`.trim() + (d === null ? " · not JSON" : " · JSON") + of;
      const body = kind === "ok"
        ? `{"reply": ${clip(JSON.stringify(d.reply), 32)}, "rule": "${d.rule}", "events": [${d.events?.length ?? 0} events], "server_ms": ${d.server_ms}}`
        : d === null ? "not JSON (a page or plain text), so api() returns data: null"
        : kind === "rejected" ? `{"detail": [{"msg": "${clip(String(d.detail?.[0]?.msg ?? "…"), 46)}", "input": your text}]}`
        : clip(JSON.stringify(d), 80);
      set(1, head, body, kind === "ok" ? "ok" : "bad");
    },
  };
}

/** The health board on the server's side: what the page-load health check (GET /api/step4/health) got back. */
function healthBoard(parent, [x, y]) {
  const W = 600, g = svg("g", { class: "st-board", transform: `translate(${x} ${y})` }, parent);
  svg("rect", { width: W, height: 150, rx: 18 }, g);
  t.label(g, 24, 42, "health(): checked when the page loaded", "tt", "start", 27);
  const row = svg("g", { class: "st-trow", transform: "translate(0 92)" }, g);
  const status = t.label(row, 24, 0, "", "ts", "start", 25);
  const note = t.label(row, 24, 30, "", "tnote", "start", 18);
  const set = (text, sub, kind = "") => { status.textContent = text; note.textContent = sub; row.setAttribute("class", "st-trow " + kind); };
  set("waiting for the page's check…", "GET /api/step4/health", "wait");
  return { set };
}

/** One side of the bridge at x: two towers, the main cable with its backstays, and the hangers. */
function bridgeSide(parent, x) {
  for (const y of TOWERS) box(parent, [x - 0.7, y - 0.7, 0], [1.4, 1.4, TOWER_TOP], "steel");
  const cable = [[x, -18, 1.4]];
  for (let y = TOWERS[0]; y <= TOWERS[1]; y++) cable.push([x, y, cableZ(y)]);
  cable.push([x, 12, 1.4]);
  svg("polyline", { class: "st-cable", points: t.pts(...cable) }, parent);
  for (let y = TOWERS[0] + 3; y < TOWERS[1]; y += 3) svg("line", { class: "st-hanger", ...lineAt([x, y, cableZ(y)], [x, y, 1.4]) }, parent);
}

/** The back of the bridge, behind the car: the deck with its truss, and the far side's towers and cable. */
function bridgeBack(parent) {
  box(parent, [95, -18, -2.4], [20, 30, 2.4], "bridge");
  const truss = [];
  for (let i = 0; i <= 12; i++) truss.push([115, -18 + i * 2.5, i % 2 ? -0.3 : -2.1]);
  svg("polyline", { class: "st-truss", points: t.pts(...truss) }, parent);
  bridgeSide(parent, SIDES[0]);
}

/**
 * The front of the bridge, always in front of the car: a portal over the road at each pair of towers ("near" at your
 * browser's end, "far" at the server's) with a sign on the side you see, then the near side's towers and cable.
 * The signs read "HTTPS 🔒" live; locally "HTTP", because nothing is encrypted on 127.0.0.1.
 * g is its group (it turns red on a network error); sign() and key() show what each end is doing.
 */
function bridgeFront(parent, tags) {
  const g = svg("g", { class: "st-https" }, parent);
  const [x0, x1] = [SIDES[0] - 0.7, SIDES[1] + 0.7], w = (x1 - x0) * t.K, h = 4 * t.K;
  const rest = SECURE ? "HTTPS 🔒" : "HTTP";
  const ends = {};
  for (const [end, y] of [["far", TOWERS[0]], ["near", TOWERS[1]]]) {
    box(g, [x0, y - 0.7, TOWER_TOP - 4], [x1 - x0, 1.4, 4], "steel");
    const [ex, ey] = iso(x0, y + 0.7, TOWER_TOP);       // the sign lies on the portal's +y face: x runs along it, z up
    const sign = svg("g", { class: "st-bsign", transform: `matrix(1 0.5 0 1 ${ex.toFixed(1)} ${ey.toFixed(1)})` }, g);
    svg("rect", { x: 6, y: 4, width: w - 12, height: h - 8, rx: 6 }, sign);
    const text = t.label(sign, w / 2, h / 2 + 1, rest, "", "middle", 19);
    // The session key, shown while that end is at work: above the near sign, and under the far portal's beam (above it,
    // the front door's pin and the car's tag at the door leave no room).
    const key = t.makeTag(tags, S);
    const [dx, dy, dz] = end === "near" ? [0, 0, 8] : [4, 0, -12];
    key.at(...iso((x0 + x1) / 2 + dx, y + dy, TOWER_TOP + dz));
    key.carry("");
    ends[end] = { sign, text, key };
  }
  bridgeSide(g, SIDES[1]);
  return {
    g,
    /** One end's sign: kind "enc" (encrypting), "dec" (decrypting), or "" for the resting text. */
    sign(end, text, kind = "") {
      ends[end].text.textContent = text || rest;
      ends[end].sign.setAttribute("class", `st-bsign ${kind}`.trim());
    },
    /** Shows the session key above one end ("" hides it). */
    key(end, text) { ends[end].key.carry(text, "key"); },
  };
}

/**
 * One end of the HTTPS bridge encrypts or decrypts `words` (the car's tag): its sign lights up, the session key shows
 * above it, and the tag turns into scrambled text (encrypt) or back into words (decrypt), a character at a time.
 * After a decrypt the crossing is over, so both signs rest again.
 */
async function crypt(st, tw, end, mode, words, kind = "you") {
  const enc = mode === "enc";
  st.bridge.sign(end, enc ? "🔒 ENCRYPT" : "🔓 DECRYPT", mode);
  st.bridge.key(end, end === "near" ? "🔑 session key" : "🔑 same session key");
  const open = Array.from("🔓 " + words), locked = Array.from("🔒 " + scramble(words));
  const [from, to] = enc ? [open, locked] : [locked, open];
  await tw.tween(1100, (e, p) => {
    const n = Math.round(p * to.length);
    st.car.carry(to.slice(0, n).join("") + from.slice(n).join(""), enc || n < to.length ? "lock" : kind);
  });
  await tw.wait(800);
  st.bridge.key(end, "");
  if (!enc) {
    st.car.carry(words, kind);
    for (const e of ["near", "far"]) st.bridge.sign(e, "");
  }
}

/** Adds a numbered list of steps to `box` and returns upTo(i), which marks steps 0…i done (-1 clears them). */
function stepList(box, steps) {
  const ol = el("ol", "st-steps");
  const items = steps.map(([title, text], i) => {
    const li = el("li"); li.dataset.n = String(i + 1);
    li.append(el("b", "", title), text);
    ol.append(li);
    return li;
  });
  box.append(ol);
  return (i) => { items.forEach((li, j) => { li.className = j <= i ? "done" : ""; }); };
}

/** Under the scene, live: what the HTTPS bridge uses to encrypt and decrypt, step by step (they light up as the car passes). */
function tlsPanel() {
  const box = el("div", "st-debug st-tls");
  box.append(el("p", "st-label", "🔒 The HTTPS bridge: what encrypts and decrypts your message"));
  const upTo = stepList(box, [
    ["Handshake", `when your browser first connects to ${location.host}, it checks the site's certificate (proof it's really ` +
      "that site) and the two sides agree on a secret session key (key exchange: X25519, plus ML-KEM in newer Chrome). The key " +
      "itself never crosses the internet. The page and /api are one site, so they usually share that connection."],
    ["Encrypt", "at the bridge's near end your browser's TLS encrypts the request with that key, usually with AES-128-GCM, which " +
      "also seals it: any change on the way is detected."],
    ["Cross", "on the internet it's scrambled bytes. Wi-Fi, your provider and routers can see which site and roughly how big, " +
      "never the words."],
    ["Decrypt", `${VERCEL ? "Vercel's" : "The server's"} front door has the same session key, so it decrypts the request. HTTPS ` +
      `ends there: ${VERCEL ? "Vercel's router and the Python function get" : "the server gets"} it in plain form.`],
    ["Reply", "comes back over the same bridge: the front door encrypts it with the key and your browser decrypts it."],
  ]);
  box.append(el("p", "st-life", "See the real ones: F12 → Security (\"Privacy and security\" in newer Chrome) → " +
    `${location.host} shows something like "TLS 1.3, X25519MLKEM768, AES_128_GCM". The page's own code can't read them. ` +
    "Behind a company proxy that inspects HTTPS (like Zscaler) there are two bridges, your browser ↔ the proxy and the proxy ↔ " +
    `${VERCEL ? "Vercel" : "the server"}, and the proxy decrypts in between.`));
  return { el: box, upTo };
}

/** Under the scene, locally: why there's nothing to encrypt (plain HTTP on 127.0.0.1), step by step as the car passes. */
function loopPanel() {
  const box = el("div", "st-debug st-tls");
  box.append(el("p", "st-label", "🔓 Locally it's plain HTTP on 127.0.0.1: nothing is encrypted, and nothing leaves your computer"));
  const upTo = stepList(box, [
    ["Your browser", `sends the request to this page's own address, http://${location.host}: the site server (npm run serve).`],
    ["127.0.0.1", "is your computer's own address (loopback). Requests to it never reach the Wi-Fi or the internet, so there's " +
      "nobody on the way to read them."],
    ["Site server", "forwards every /api/* request to uvicorn on 127.0.0.1 (port 8000 in the README), then passes its answer " +
      "back. If uvicorn isn't running, it answers 502 itself."],
    ["uvicorn", "the Python server, another program on this computer: it runs main.py's FastAPI app, which runs the chain."],
  ]);
  box.append(el("p", "st-life", "On the live site it's HTTPS instead: the request is encrypted in your browser and decrypted at " +
    "Vercel's front door, and the reply comes back the same way (see step 4's README)."));
  return { el: box, upTo };
}

/** Two world points (with z) → a line's x1/y1/x2/y2 attributes. */
function lineAt(a, b) {
  const [x1, y1] = iso(...a), [x2, y2] = iso(...b);
  return { x1, y1, x2, y2 };
}

// ---------- The page-load health check: the drone's errand ----------

/** What the health board says about the health check's answer: [status line, note, kind]. */
function healthLines(res, took) {
  const kind = outcome(res), d = res.data;
  if (kind === "ok") return [`✓ Python ${d.python} · langchain-core ${d.langchain_core}`, `${res.status} · answered${took}, from main.py's health()`, "ok"];
  if (kind === "down") return ["✕ 502: no Python backend answered", clip(d?.error ?? "Bad Gateway", 58), "bad"];
  if (kind === "server") return [`✕ ${res.status}: the server is there, but failed`, `GET /api/step4/health got ${`${res.status} ${STATUS[res.status] ?? ""}`.trim()}`, "bad"];
  if (kind === "missing") return ["✕ no Python backend on this site", `GET /api/step4/health got ${res.status === 404 ? "404 Not Found" : "a page, not JSON"}`, "bad"];
  if (kind === "network") return ["✕ no answer (network error)", "the request never got an answer", "bad"];
  return [`✕ ${res.status}: the server answered with an error`, "", "bad"];
}

/**
 * Replays the page-load health check: index.html's api("/api/step4/health") sends GET /api/step4/health before you type
 * anything. The drone flies it to the server and brings back the real answer (it has already come back: this shows it).
 */
async function pageLoad(res) {
  const st = scene, tw = st.play.begin();
  const kind = outcome(res), e = latest("/api/step4/health");
  const took = e ? ` in ${fmt(e.duration)}` : "";
  const [line, sub, cls] = healthLines(res, took);
  try {
    st.stop(null, "api");
    st.say('Page load: before you type anything, index.html checks the server: api("/api/step4/health") sends GET /api/step4/health…');
    st.drone.place(...DRONE_HOME); st.drone.carry(`${SECURE ? "🔒 " : ""}GET /health`, SECURE ? "lock" : "you");
    st.takeOff();
    await st.drone.fly(tw, kind === "ok" ? DRONE_MAIN : kind === "network" ? DRONE_BRIDGE : DRONE_DOOR);
    const answer = kind === "ok" ? `✓ Python ${res.data.python}` : kind === "network" ? "✕ no answer" : `✕ ${res.status}`;
    st.drone.carry(answer, kind === "ok" ? "ok" : "err");
    if (kind === "ok") st.stop(null, "fastapi");
    else if (kind === "network") st.bad("bridge");
    else st.bad("door");
    st.health.set(line, sub, cls);
    await tw.wait(900);
    st.drone.carry(`${SECURE && kind !== "network" ? "🔒 " : ""}${answer}`, SECURE && kind !== "network" ? "lock" : kind === "ok" ? "ok" : "err");
    await st.drone.fly(tw, DRONE_HOME);
    st.drone.carry(answer, kind === "ok" ? "ok" : "err");
    st.land();
    st.stop(null, null);
    st.say(kind === "ok" ? `Page load: main.py's health() answered${took}: Python ${res.data.python} and langchain-core ` +
        `${res.data.langchain_core}, the versions the chat's badge shows. Send a message to watch it travel.`
      : kind === "down" ? `Page load: the health check got 502${res.data?.error ? `: “${res.data.error}”` : ""}. ` +
        (LOCAL ? "Start uvicorn (step 4's README) and reload the page." : "No Python backend answered.")
      : kind === "missing" ? `Page load: the health check got ${res.status === 404 ? "404" : "a page instead of JSON"}: ` +
        "there's no Python backend on this site, so the chat can't answer here. Step 4's README says how to run it locally."
      : kind === "server" ? `Page load: the health check got ${res.status}: the server is there, but something on it failed` +
        `${LOCAL && res.status === 500 ? " (an error in the Python code: uvicorn's terminal shows it)" : ""}.`
      : kind === "network" ? "Page load: the health check got no answer (network error)."
      : `Page load: the health check got ${res.status}.`);
  } catch (err) {
    if (err !== t.STOPPED) throw err;
  } finally {
    st.health.set(line, sub, cls);                // right even if a message cut the flight short
  }
}

// ---------- Following the real trip ----------

const scene = build();
let current = null;                              // the message being shown (a slow answer arrives while the car drives)
let lastRun = null;                              // everything about the last message, for Replay
let firstSend = null;                            // the first message's submit time, for the network log
let ticker = 0;                                  // redraws the timing panel while a message is out

/** A promise you resolve later (and that never complains if it's abandoned). */
function later() {
  let resolve, reject;
  const p = new Promise((a, b) => { resolve = a; reject = b; });
  p.catch(() => {});
  return { p, resolve, reject };
}

/** The page-load health check came back (index.html passes api()'s { ok, status, data }). */
function health(res) {
  pageLoad(res);
}

/**
 * onSend(e) began (index.html calls this right after e.preventDefault()): the clock starts at the submit event.
 * e.timeStamp is on the same clock as performance.now(); a browser that reports something else falls back to now.
 * Whatever the street view is still playing (the last trip, or the page-load drone) stops here, so it doesn't draw
 * while this message is out.
 */
function start(timeStamp) {
  const now = performance.now();
  for (const d of current ? [current.answered, current.shown] : []) d.reject(t.STOPPED);
  clearTimeout(current?.wait);
  clearInterval(ticker);
  scene.play.begin();                            // the last trip stops at its next frame
  scene.still();                                 // and nothing else moves by itself (antenna, smoke, the drone's rotors)
  scene.ui.replay.disabled = true;
  const submit = Number.isFinite(timeStamp) && timeStamp > 0 && timeStamp <= now ? timeStamp : now;
  firstSend ??= submit;
  current = { text: "", res: null, shownText: "", marks: { submit, onSend: now }, answered: later(), shown: later() };
}

/**
 * Just before api() calls fetch(). The street view waits, so its drawing isn't timed as part of your message: the trip
 * starts once the reply has been drawn (see reply()), or after 300 ms if the answer is slower. Then the car drives
 * while you wait, and the timing panel counts the wait up.
 */
function send(text) {
  if (!current) start();
  const msg = current;
  msg.text = String(text ?? "");
  msg.wait = setTimeout(() => {
    if (current !== msg) return;
    ticker = setInterval(measure, 200);
    measure();
    playTrip(msg);
  }, 300);
  msg.marks.fetch = performance.now();
}

/** api() resolved: what came back ({ ok, status, data }). The car gets it after the reply's frame (see reply()). */
function answer(res) {
  if (!current) return;
  current.marks.api = performance.now();
  current.res = res;
}

/**
 * The reply (or why it failed) is on the page. The next frame draws it: that's the last moment timed. Then, in a task
 * after that frame, the car gets api()'s result and the trip starts (if it hasn't yet). A hidden tab draws no frame,
 * so stop waiting after 1 s.
 */
function reply(shown) {
  if (!current) return;
  const msg = current;
  msg.marks.add = performance.now();
  msg.shownText = String(shown ?? "");
  lastRun = { text: msg.text, res: msg.res, shownText: msg.shownText, marks: msg.marks };
  const finish = () => {
    if (current !== msg) return;
    msg.answered.resolve(msg.res);
    msg.shown.resolve(msg.shownText);
    playTrip(msg);
    measure();
    // Resource Timing can report the request a moment after the reply is shown: look once more, then stop.
    setTimeout(() => { if (current === msg) { measure(); clearInterval(ticker); } }, 1500);
  };
  const timer = setTimeout(() => { msg.marks.noFrame = true; finish(); }, 1000);
  requestAnimationFrame(() => {
    if (msg.marks.noFrame) return;
    clearTimeout(timer);
    msg.marks.frame = performance.now();
    setTimeout(finish);                            // after this frame has been drawn
  });
}

/** Starts playing a message's trip, once. Its time is marked: timing.js notes it if that was before the reply's frame. */
function playTrip(msg) {
  if (current !== msg || msg.marks.scene != null) return;
  clearTimeout(msg.wait);
  msg.marks.scene = performance.now();
  run(msg);
}

/** This message's request to /api/step4/chat, once Resource Timing has it (it reports a request when it's done). */
const chatEntry = (msg) => (msg.marks?.fetch == null ? null : latest("/api/step4/chat", msg.marks.fetch - 1));

/** Redraws the timing panel for the message being shown: its marks, api()'s result and the request's Resource Timing. */
function measure() {
  if (!current) return;
  scene.timing.show(stages({ marks: current.marks, res: current.res, entry: chatEntry(current), now: performance.now(),
    local: LOCAL, secure: SECURE, vercel: VERCEL }));
}

/** Lights the chain's board from the server's own events (its LangChain trace, sent back in the JSON), one at a time. */
async function chainEvents(st, tw, events) {
  const path = [], seen = new Set();
  for (const e of events) {
    if (e.event === "on_chain_start") {
      if (e.name.endsWith("?") && Object.hasOwn(ROW, e.name)) { st.rules.set(ROW[e.name], "check"); await tw.wait(400); }
      continue;
    }
    if (e.name === "normalize") path.push(`normalize → ${quote(String(e.output), 20)}`);
    else if (e.name.endsWith("?") && Object.hasOwn(ROW, e.name)) {
      st.rules.set(ROW[e.name], e.output ? "yes" : "no"); seen.add(ROW[e.name]);
      path.push(`${e.name} ${e.output ? "yes" : "no"}`);
    } else if (e.name.startsWith("reply:")) {
      if (Object.hasOwn(ROW, e.name)) { st.rules.set(ROW[e.name], "yes"); seen.add(ROW[e.name]); }
      path.push(e.name);
    } else continue;                               // "rules" and "hello-chain" only wrap the steps above
    st.say(`The server's events: ${path.join(" → ")} (at ${e.ms} ms on the server's clock).`);
    await tw.wait(900);
  }
  for (const i of [0, 1, 2]) if (!seen.has(i)) st.rules.set(i, "skip");
}

/** Plays one message's trip, waiting for api()'s real result where it needs it. */
async function run(msg) {
  const st = scene, { car, lane, center } = st;
  // A replay uses what was recorded; a live message waits for api()'s result (handed over after the reply's frame).
  const got = () => (msg.replay ? Promise.resolve(msg.res) : msg.answered.p);
  const shown = () => (msg.replay ? Promise.resolve(msg.shownText) : msg.shown.p);
  const tw = st.play.begin();
  st.ui.replay.disabled = !msg.replay;            // a live message keeps it off until its own trip has been drawn
  const boomTo = (arm, to) => { const from = arm.deg; return tw.tween(450, (e) => arm(from + (to - from) * e)); };
  const text = msg.text, blank = !text.trim();
  const typed = blank ? (text ? "(only spaces)" : "(empty)") : quote(text.trim(), 22);
  const chars = Array.from(text).length;          // Python's len(): FastAPI counts characters the same way
  let skipped = [], maybe = [];
  const leg = (i, where, say) => { st.stop(i, where, skipped, maybe); if (say) st.say(say); st.requests(firstSend); };
  const noChain = () => { for (const i of [0, 1, 2]) st.rules.set(i, "skip"); };   // the chain never ran: its board stays grey
  try {
    st.reset();
    leg(0, "house", !blank ? `You typed ${typed} and pressed Send.`
      : text ? "You pressed Send with only spaces in the box." : "You pressed Send with nothing typed.");
    car.carry(typed, "you"); await tw.wait(900);
    await car.drive(tw, st.sOut(STOP.gate)); leg(1, "gate", 'The browser fires a "submit" event on <form id="form">: onSend(e) starts.');
    await boomTo(st.formArm, 80);
    await car.drive(tw, st.sOut(STOP.depot));
    leg(2, "depot", !blank ? 'onSend(e) adds your bubble and "thinking…", turns Send off, then calls api("/api/step4/chat", { message: text }).'
      : text ? 'Only spaces, so onSend(e) adds no bubble of yours (text.trim() is empty), only "thinking…". It still sends the ' +
        "text as it is: on the server, the chain's normalize step trims it."
      : "Nothing typed, so onSend(e) adds only \"thinking…\". It doesn't check the text: even an empty message goes to the " +
        "server, where the chain answers it.");
    await tw.wait(1100);
    await car.drive(tw, st.sOut(STOP.api));
    leg(3, "api", 'api() sends it with fetch(): POST /api/step4/chat, the body {"message": …} as JSON. onSend(e) waits (await) for the answer.');
    st.wire.sent(text);
    st.sending(true); await tw.wait(1300);
    await car.drive(tw, st.sOut(STOP.bridge));
    if (SECURE) {
      leg(4, "bridge", "🔒 Encrypt: before the request leaves your computer, your browser's TLS encrypts it with the session key " +
        `it agreed with ${SERVER.it} (usually AES-128-GCM). On the internet it's only scrambled bytes.`);
      st.panel.upTo(1);
      await crypt(st, tw, "near", "enc", typed);
    } else {
      leg(4, "bridge", LOCAL ? `Plain HTTP to ${location.host}, this page's own address: the site server, on this computer. ` +
          "127.0.0.1 never leaves your computer, so nothing is encrypted."
        : "Plain HTTP: this page wasn't loaded over HTTPS, so the request crosses the network unencrypted.");
      st.panel?.upTo(1);
      await tw.wait(1500);
    }

    // Is the answer in yet? (Usually: the trip starts once the reply is on the page. A slow server or a cold start keeps
    // the car waiting at the front door below.)
    let res = msg.res, kind = res ? outcome(res) : null, turnAt;
    if (kind === "network") {
      skipped = [5, 6, 7];
      leg(4, "bridge", "No answer came back: the request failed on the network (offline, or the server couldn't be " +
        "reached). fetch() rejected, and api() caught it.");
      st.bad("bridge"); st.sending(false);
      noChain(); turnAt = STOP.bridge;
    } else {
      // Over the bridge to the server's front door. Live, HTTPS ends there: the request is decrypted as it arrives.
      await car.drive(tw, st.sOut(STOP.door));
      if (SECURE) {
        leg(4, "bridge", `🔓 Decrypt: HTTPS ends at ${SERVER.it}'s front door, which holds the same session key. It turns the ` +
          "bytes back into your request.");
        st.panel.upTo(3);
        await crypt(st, tw, "far", "dec", typed);
      }
      const door = LOCAL ? "The site server forwards every /api/* request to the Python backend: uvicorn, another program on " +
          "this computer, which runs main.py's FastAPI app."
        : VERCEL ? "Vercel's router: vercel.json sends every /api/* request to the Python function api/index.py, which loads " +
          "main.py's FastAPI app. If no copy of the function is running, Vercel starts one first (a cold start)."
        : "This site's server gets the request for /api/step4/chat.";
      leg(5, "door", msg.res ? door : `${door} Waiting for the answer… ("Where the time went" counts it up)`);
      st.panel?.upTo(LOCAL ? 2 : 3);
      await tw.wait(1300);
      res = await got();
      kind = outcome(res);
      st.sending(false);
      if (kind === "network") {
        skipped = [5, 6, 7];
        leg(5, "door", "No answer came back: the connection failed on the way (network error), so nothing from the server " +
          "reached your browser. fetch() rejected, and api() caught it.");
        st.bad("bridge");
        noChain(); turnAt = STOP.door;
      } else if (kind !== "ok" && kind !== "rejected") {
        // No reply. With no backend (502, 404, a page) the chain never ran; after a 500 or 504 the page can't tell.
        if (kind === "server") maybe = [6, 7];
        else { skipped = [6, 7]; noChain(); }
        const why = res.data?.error ? `: “${clip(res.data.error, 90)}”` : "";
        leg(5, "door", kind === "down" ? `${LOCAL ? "The site server couldn't reach uvicorn" : "No Python backend answered"}, so it ` +
            `answered 502${why}. The request goes no further.`
          : kind === "missing" ? `There's no Python backend behind /api/step4/chat on this site: the server answered ` +
            `${res.status === 404 ? "404" : `${res.status} with a page, not JSON`}. The request goes no further.`
          : kind === "server" ? `The server answered ${res.status} instead of the reply: it's there, but something on it failed` +
            (LOCAL ? (res.status === 500 ? " (an error in the Python code: uvicorn's terminal shows it)" : "")
              : VERCEL ? " (an error in the Python code answers 500; a function that runs past its 10 s limit, 504)" : "") +
            ". The page can't see how far your message got, so chat() and Chain get a “?”."
          : `The server answered ${res.status}: an error, so no reply comes back.`);
        st.bad("door");
        turnAt = STOP.door;
      } else {
        await car.drive(tw, st.sOut(STOP.fastapi));
        if (LOCAL) st.panel.upTo(3);                 // it reached uvicorn
        const check = "FastAPI reads the JSON into ChatIn and checks it: message must be text of at most 1000 characters.";
        if (kind === "rejected") {
          skipped = [7];
          const msg422 = res.data?.detail?.[0]?.msg ?? "the body didn't fit ChatIn";
          leg(6, "fastapi", `${check} ${chars > 1000 ? `Yours has ${chars}, so it` : "It"} answers 422 (“${msg422}”) without ` +
            "calling chat(): the chain never sees it.");
          st.bad("fastapi");
          noChain(); turnAt = STOP.fastapi;
        } else {
          leg(6, "fastapi", `${check} Yours has ${chars}, so FastAPI calls chat(body), and chat() calls run_with_events(message).`);
          await tw.wait(1300);
          await boomTo(st.apiArm, 80);
          await car.drive(tw, st.sOut(STOP.agent));
          const events = Array.isArray(res.data.events) ? res.data.events : [];
          leg(7, "agent", "run_with_events(message) runs the chain normalize | rules with astream_events(). The JSON reply " +
            `carries the server's own events (${events.length}), so the board lights up from what really ran.`);
          st.busy(true); await tw.wait(1300);
          await chainEvents(st, tw, events);
          st.busy(false);
          const { reply: said, rule, server_ms } = res.data;
          leg(7, "agent", `The chain answered { reply: ${quote(String(said), 34)}, rule: "${rule}" } in ${server_ms} ms on the ` +
            "server's own clock (server_ms, timed by run_with_events()).");
          await tw.wait(1500);
          turnAt = "end";
        }
      }
    }

    // The way back: turn round, cross the bridge (encrypted again, live) if the request got there, then home. The car
    // carries what really came back: the reply as JSON, an error status, or nothing at all after a network error.
    const what = kind === "ok" ? "reply" : "answer";
    const cargo = kind === "ok" ? `JSON ${quote(String(res.data.reply), 20)}` : kind === "rejected" ? "✕ 422 too long"
      : kind === "missing" ? `✕ ${res.status === 404 ? "404" : "not JSON"}` : kind === "network" ? "✕ no answer" : `✕ ${res.status}`;
    const tag = kind === "ok" ? "bot" : "err";
    car.carry(cargo, tag); await tw.wait(1100);
    let back;
    if (turnAt === "end") { await car.drive(tw, lane.out.total); back = lane.turnAt(center.p.length - 1, 6); }
    else back = lane.turnAt(center.nearest(...turnAt), 3.6);
    car.place(back.path, 0);
    const home = (p) => back.sAt(...p);
    const bytes = chatEntry(msg)?.encodedBodySize;
    if (turnAt === "end") {
      await car.drive(tw, home(STOP.fastapi));
      leg(8, "fastapi", "run_with_events() returns (result, events, server_ms) to chat(), which returns { reply, rule, events, " +
        `server_ms }: FastAPI sends it back as JSON${bytes ? ` (${size(bytes)})` : ""}.`);
      await tw.wait(1300);
    } else if (turnAt === STOP.fastapi) {
      leg(8, "fastapi", "FastAPI sends the 422 back as JSON: what was wrong, and your whole text with it (its \"input\").");
      await tw.wait(1300);
    }
    if (turnAt !== STOP.bridge) {
      // Out of the server's front door (where the car turned, or a little past it), then over the bridge.
      await car.drive(tw, home(turnAt === STOP.door ? STOP.door : STOP.exit));
      if (kind === "network") {                      // the connection failed: nothing crosses back
        leg(8, "bridge", "Nothing comes back over the bridge: the connection failed, so there's nothing to " +
          (SECURE ? "decrypt." : "read."));
        await tw.wait(1300);
      } else if (SECURE) {                            // encrypted at the front door, decrypted at your end
        leg(8, "bridge", `🔒 Encrypt: ${SERVER.it}'s front door encrypts the ${what} with the same session key.`);
        await crypt(st, tw, "far", "enc", cargo, tag);
        await car.drive(tw, home(STOP.landing));
        leg(8, "bridge", `🔓 Decrypt: back at your computer, your browser decrypts the ${what} with its copy of the key.`);
        st.panel.upTo(4);
        await crypt(st, tw, "near", "dec", cargo, tag);
      } else {
        leg(8, "bridge", LOCAL ? `The ${what} goes back over 127.0.0.1 as plain HTTP: it never leaves your computer.`
          : `The ${what} comes back as plain HTTP.`);
        await tw.wait(1300);
      }
    }
    await car.drive(tw, home(STOP.api));
    leg(8, "api", kind === "ok" ? "api() gets the answer: res.json() reads the JSON, and api() returns { ok: true, status: 200, data } to onSend(e)."
      : kind === "network" ? "fetch() rejected (no answer), so api() catches it and returns { ok: false, status: 0 } instead of throwing."
      : `api() ${res.data === null ? "finds no JSON in the answer" : "reads the JSON"} and returns { ok: false, status: ${res.status}, data } to onSend(e).`);
    st.wire.got(res, bytes);
    await tw.wait(1300);
    await car.drive(tw, home(STOP.depot));
    const text2 = await shown();
    leg(8, "depot", kind === "ok" ? 'onSend(e) removes "thinking…" and calls add(res.data.reply, "bot"): the reply goes on the page as plain text (textContent).'
      : `onSend(e) removes "thinking…" and calls add(whyFailed(res), "bot"): whyFailed() turns ${kind === "network" ? "status 0" : res.data === null ? "an answer without JSON" : `the ${res.status}`} into words` +
        (kind === "server" && res.data === null ? ". It only checks for JSON, so it says the backend isn't deployed, though here the server is there and failed." : "."));
    car.carry(quote(text2, 30), tag);
    await tw.wait(1100);
    await car.drive(tw, home(STOP.house));
    car.carry("");                                // home: the reply is in the chat now (and a tag here would cover the form's pin)
    leg(9, "house", `You see ${quote(text2, 60)}`);
    await boomTo(st.formArm, 0); await boomTo(st.apiArm, 0);
    tw.alive(); st.finish(skipped, maybe);
    st.ui.replay.disabled = false;
  } catch (err) {
    if (err !== t.STOPPED) throw err;
  }
}

export const street = { health, start, send, answer, reply };
