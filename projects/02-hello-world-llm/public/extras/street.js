/**
 * EXTRA: a teaching aid, not part of the agent.
 *
 * "Street view" of step 2: unlike step 1, your message really leaves your computer. The car drives it through your
 * browser (the form, index.html, agent.js's checks, main.js), over the HTTPS bridge (a suspension bridge across the
 * internet's clouds), into Google Cloud: App Check's gate, Firebase AI Logic (which adds the Gemini key) and Gemini.
 * Then it brings the reply back the same way. At the bridge's entrance the message is encrypted (the sign lights up,
 * the TLS session key shows and the tag scrambles), and at the far end it's decrypted with the same key. What Google
 * sends back (the reply, or an error status) gets the same treatment the other way; after a timeout nothing comes
 * back. A panel under the scene says what does the encrypting and how to see it.
 *
 * It follows what really happens: agent.js reports each stage (the same events as the box diagram), so a message
 * that's too long turns back inside your browser, a 403 stops at App Check's gate, and the car waits at Gemini for
 * the real reply. The network log under the scene lists the page's real requests (Resource Timing).
 *
 * App Check tokens get their own courier drone, because fetching one is a separate trip to Google. main.js uses App
 * Check's hourly token: the Firebase SDK fetches it when the page loads (unless one saved in this browser is still
 * fresh), keeps it and renews it in the background about 35 minutes into its hour. Every message carries that 🎫, so a
 * message normally makes no token request at all: the drone flies on page load, and only flies for a message that finds
 * no valid token. It shows the real result of each token request (its HTTP status, from Resource Timing). Without a
 * valid token (App Check refused one, locally an unregistered debug token comes back 403, or the request never got
 * through) the SDK still sends the message, with a placeholder token in its place, and App Check's gate refuses it
 * (403). Only if no token comes back within main.js's time limit does generate() stop waiting: then the car turns back
 * at main.js and the message never leaves your browser.
 *
 * The token board above your browser shows the cached 🎫 and when it expires (from main.js's optional {type: "token"}
 * events, which carry only its times), and what proves the page to App Check: locally the debug token, live reCAPTCHA.
 * Locally, a panel under the scene explains the debug token: where and when it's made, what it's for, how long it lasts.
 *
 * Under the tracker, "Where the time went" shows the real time of each stage (the sums are in timing.js): the street
 * view is slowed down, so this is where you see which stage a slow reply really spends its time in (usually the
 * request to Gemini). The stage you're waiting on counts up while the message is out.
 *
 *   street.start   a new message was sent        street.event   pass agent.js's stage events here
 *   street.reply   the reply is on the page        street.setupProblem   setup isn't finished
 *
 * Drawn with the shared toolkit /lib/town.js (plain SVG, no library). All text goes in with textContent.
 */
import * as t from "/lib/town.js";
import { MODEL } from "../ai-config.js";
import { fmt, stages, tokenVerdict } from "./timing.js";

const { svg, box, house, depot, factory, chimney, tree, lamp, road, curve, lanes, depthLayer, pin, boom, board,
  vehicle, courier, tracker, card, el, paneX, paneY, banner, iso } = t;

/** Pin labels are drawn bigger here: this town is wider, so it's shown smaller. */
const S = 1.2;

/** The road: through your browser, round a bend, straight over the internet bridge, then through Google Cloud. */
const ROAD = [[-6, 45], [6, 45], [20, 46], [32, 49], [46, 49], [60, 46], [74, 45], [86, 46], [96, 43], [103, 35], [105, 24],
  [105, 12], [105, 0], [105, -12], [105, -24], [104, -36], [101, -48], [100, -60], [102, -72], [103, -82]];
/**
 * Where the car stops (points on the road; the lane is found from them). The bridge's encrypt/decrypt stops (bridge,
 * farEnd, landing) keep the car's tag clear of the portal signs.
 */
const STOP = { house: [8, 45], gate: [16.5, 45.8], depot: [37, 48.5], agent: [58, 46.5], main: [80, 45.5],
  bridge: [105, 12], farEnd: [105, -9.5], landing: [105, 20], appcheck: [105, -22.5], ailogic: [102.5, -46], gemini: [101.5, -70] };

const TRACK = [
  ["Typed", "You"], ["Submit", "<form>"], ["onSend(e)", "index.html"], ["respond()", "agent.js checks"], ["generate()", "main.js"],
  ["HTTPS", "encrypt → decrypt"], ["App Check", "Google"], ["AI Logic", "Google"], ["Gemini", "Google"], ["Back", "to your browser"], ["Shown", "You"],
];
const GOOGLE_STEPS = [4, 5, 6, 7, 8];

/** The HTTPS bridge: its two pairs of towers (y), their height, the cable's lowest point, and its far and near side (x). */
const TOWERS = [-15, 9], TOWER_TOP = 16, SAG = 3, SIDES = [95.2, 114.8];
/** The main cable's height at y: a parabola from tower top to tower top, lowest half-way. */
const cableZ = (y) => SAG + (TOWER_TOP - SAG) * ((2 * y - TOWERS[0] - TOWERS[1]) / (TOWERS[1] - TOWERS[0])) ** 2;
const RULES = ['text === ""', "text.length > 500", "→ generate(text)"];

/** On localhost / 127.0.0.1 main.js uses App Check's debug token instead of reCAPTCHA. */
const LOCAL = typeof location !== "undefined" && ["localhost", "127.0.0.1"].includes(location.hostname);

/** Where the courier drone parks (the helipad on main.js's roof) and where it collects tokens (above App Check's gate). */
const DRONE_HOME = [84.5, 29.5, 11], DRONE_GATE = [99, -29, 9];

const quote = (s, max) => `“${s.length > max ? s.slice(0, max - 1) + "…" : s}”`;
const SYMS = "#%&@$!?*+=~^xXqQkKzZ9786";
/** What text looks like on the wire: every character scrambled (a stand-in for real ciphertext), spaces kept. */
const scramble = (s) => Array.from(s, (c, i) => (c === " " ? " " : SYMS[(c.codePointAt(0) * 7 + i * 13) % SYMS.length])).join("");

// ---------- The scene ----------

function build() {
  t.ensureStyles();
  const ui = card("Street view: your message leaves the browser",
    "The car carries your message out of your browser, over the HTTPS bridge across the internet and into Google Cloud, then " +
    "brings the reply back. It stops where each piece runs and follows what really happens, including errors. The drone fetches " +
    "App Check's hourly token when the page loads, and every message carries it. Everything is slowed down so you can follow it; " +
    "the real times are under the tracker, in \"Where the time went\" (a free-tier reply can take 20 s or more, mostly waiting for Google).",
    "Street view of one message's trip to Gemini and back");
  performance.setResourceTimingBufferSize?.(1000);   // the network log, token checks and timings read it; the default keeps 250
  // When it's full, make room instead of losing entries (the browser then adds the ones that were waiting).
  performance.addEventListener?.("resourcetimingbufferfull", () =>
    performance.setResourceTimingBufferSize(2 * performance.getEntriesByType("resource").length));

  const root = svg("svg", { class: "st-scene st-framed", viewBox: "-580 -360 2340 1090", role: "img",
    "aria-label": "Your browser and Google Cloud as two pieces of land joined by an internet bridge; a car carries the message between them" });

  // Land: Google Cloud (far), the internet's clouds with the HTTPS bridge over them, your browser (near). Then the road.
  box(root, [60, -98, -2.5], [58, 80, 2.5], "cloud");
  for (const y of TOWERS) for (const x of SIDES) box(root, [x - 1, y - 1, -15], [2, 2, 12.6], "steel");   // piers under the towers
  for (const [x, y, z, r] of [[88, -6, -9, 30], [122, 4, -7, 36], [97, -15, -12, 24], [122, -14, -10, 28], [86, 8, -8, 22],
    [101, -15, -15, 26], [112, -15, -15, 22], [101, 9, -15, 24], [113, 9, -15, 28]]) {
    const [cx, cy] = iso(x, y, z);
    svg("ellipse", { class: "st-cloud", cx, cy, rx: r * 1.6, ry: r * 0.8 }, root);
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
  b.agent = depth.add(factory(L, [50, 19], [16, 15, 8]), 84);
  depth.add(chimney(L, 67.5, 20.5, 15), 89);
  b.main = depth.add(depot(L, [72, 18], [15, 14, 10]), 104);
  const pad = t.ground(b.main, 84.5, 29.5, 10.03);                 // the drone's helipad
  svg("circle", { class: "st-pad", r: 2.6 * t.K }, pad);
  t.label(pad, 0, 0.9 * t.K, "H", "st-padh", "middle", 2.4 * t.K);
  const antenna = svg("g", { class: "st-antenna" }, L);           // main.js sends the request from here
  const [ax0, ay0] = iso(84, 21, 10), [ax1, ay1] = iso(84, 21, 17);
  svg("line", { x1: ax0, y1: ay0, x2: ax1, y2: ay1 }, antenna);
  for (let i = 0; i < 3; i++) svg("circle", { cx: ax1, cy: ay1, r: 10, style: `animation-delay:${i * 0.4}s` }, antenna);
  depth.add(antenna, 106);

  // Google Cloud: App Check's gate, Firebase AI Logic (holds the key), Gemini.
  b.appcheck = svg("g", { class: "st-bldg" }, L);
  box(b.appcheck, [91, -31, 0], [4.5, 4, 5.6], "booth");
  box(b.appcheck, [90.6, -31.4, 5.6], [5.3, 4.8, 0.8], "gwall");
  paneX(b.appcheck, 95.5, -30.2, -27.8, 2.4, 4.6);
  const checkArm = boom(b.appcheck, [96, -29, 4.2], [1, 0], 17);
  depth.add(b.appcheck, 64);
  b.ailogic = depth.add(depot(L, [70, -54], [21, 15, 12], "gwall"), 34);
  const vault = svg("g", {}, b.ailogic);
  paneX(vault, 91, -50, -45, 2, 8, "st-vault");
  b.gemini = svg("g", { class: "st-bldg" }, L);
  box(b.gemini, [64, -94, 0], [26, 26, 15], "gwall");
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) paneX(b.gemini, 90, -92 + c * 4.2, -89.4 + c * 4.2, 2 + r * 3.2, 3.8 + r * 3.2);
  for (let c = 0; c < 6; c++) paneY(b.gemini, 66 + c * 4, 68.6 + c * 4, -68, 3, 12);
  const [gx, gy] = iso(77, -81, 19);
  const star = (r) => Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4, rr = i % 2 ? r * 0.38 : r; return `${(gx + rr * Math.sin(a)).toFixed(1)},${(gy - rr * Math.cos(a)).toFixed(1)}`; }).join(" ");
  svg("polygon", { class: "st-spark", points: star(34) }, b.gemini);
  depth.add(b.gemini, -4);

  // Bridge railings (the near one is in front of the car), trees and lamps.
  for (const [x, d] of [[95.6, 92], [114.4, 112]]) {
    const rail = svg("g", {}, L);
    svg("line", { class: "st-rail", ...lineAt([x, -18, 1.4], [x, 12, 1.4]) }, rail);
    for (let y = -18; y <= 12; y += 5) svg("line", { class: "st-rail", ...lineAt([x, y, 0], [x, y, 1.4]) }, rail);
    depth.add(rail, d);
  }
  for (const [x, y] of [[17, 24], [18, 31], [26, 28], [47, 24], [70, 31], [92, 26], [80, -62], [84, -33], [116, -60], [116, -40], [116, -86]]) depth.add(tree(L, x, y), x + y);
  for (const [x, y] of [[84, 58], [99, 58.5]]) depth.add(tree(L, x, y), x + y);
  for (const [x, y] of [[29, 38.5], [57, 36.5], [94.5, -58], [95, -40]]) depth.add(lamp(L, x, y), x + y);
  const car = vehicle(depth, tags, S);
  const drone = courier(tags, S);

  // The front of the HTTPS bridge (always in front of the car), what's under it, then labels.
  const bridge = bridgeFront(top, tags);
  b.bridge = bridge.g;
  const [skyX, skyY] = iso(124, -2, -12);
  t.label(top, skyX, skyY, "the internet", "st-sky", "middle", 30);
  const pins = {
    house: pin(top, [8, 26, 12.6], "You", "the chat page", S),
    gate: pin(top, [23, 35.4, 6.4], '<form id="form">', '"submit" event', S),
    depot: pin(top, [37, 26, 9.5], "index.html", "onSend(e) · add()", S, 100),
    agent: pin(top, [58, 26, 11.5], "agent.js", "respond(): checks", S, 40),
    main: pin(top, [79, 24, 12], "main.js", "generate() + App Check token", S),
    appcheck: pin(top, [93, -29, 6.5], "App Check", "is the token valid?", S, 24),
    ailogic: pin(top, [80, -47, 12.5], "Firebase AI Logic", "adds the Gemini key 🔑", S),
    gemini: pin(top, [77, -81, 16], "Gemini", MODEL, S),
  };
  const rules = board(top, [-570, -350], "agent.js checks, in order", RULES, 1.2);
  banner(top, -560, 560, "YOUR BROWSER TAB", "your computer: everything on this land runs here");
  banner(top, 1330, 360, "GOOGLE CLOUD", "Google's servers");
  root.append(tags);
  const legend = svg("g", { class: "st-legend", transform: "translate(1180 520)" }, top);
  t.label(legend, 0, 0, "→ near lane: your message", "lg you", "start", 30);
  t.label(legend, 0, 44, "← far lane: the reply", "lg bot", "start", 30);
  t.label(legend, 0, 88, "🔒 tag = encrypted on the internet", "lg", "start", 30);
  t.label(legend, 0, 132, "🔑 = TLS session key (both ends)", "lg", "start", 30);
  t.label(legend, 0, 176, "drone = App Check token request", "lg", "start", 30);
  const tokens = tokenBoard(top, [-110, -350]);

  // Tracker, narration and the network log.
  const track = tracker(TRACK);
  const log = el("div", "st-netlog");
  const count = el("b", "", "0");
  const head = el("p", "st-label"); head.append("Network log · real requests this page made since your first message: ", count);
  const list = el("ol", "st-log");
  log.append(head, list, el("p", "st-note", "From your browser's own record (Resource Timing). Hosts ending in googleapis.com are Google Cloud. " +
    "The App Check token was fetched when the page loaded and is renewed about every 35 minutes, so a message normally makes " +
    "one request: the one to Gemini."));
  const timing = timingPanel(), tls = tlsPanel();
  const debug = LOCAL ? debugPanel() : null;
  ui.card.append(root, track.el, ui.now, timing.el, tls.el, ...(debug ? [debug.el] : []), log);
  document.body.append(ui.card);        // style.css gives it its own row under the chat

  const sOut = (p) => lane.sOut(...p);
  const play = t.player();
  ui.replay.addEventListener("click", () => { if (lastRun) run({ ...lastRun, replay: true }); });
  ui.pace.addEventListener("click", () => { ui.pace.textContent = play.cycle(); });
  return {
    car, drone, lane, center, play, ui, rules, track, formArm, checkArm, sOut, tokens, debug, bridge, tls, timing,
    stop(i, where, skipped = []) {
      for (const [k, g] of Object.entries(b)) { g.classList.toggle("on", k === where); g.classList.remove("bad"); }
      for (const [k, p] of Object.entries(pins)) { p.classList.toggle("on", k === where); p.classList.remove("bad"); }
      if (i !== null) track.set(i, skipped);
    },
    bad(where) { b[where]?.classList.add("bad"); pins[where]?.classList.remove("on"); pins[where]?.classList.add("bad"); },
    say(text) { ui.now.textContent = text; },
    busy(on) { root.classList.toggle("busy", on); },
    sending(on) { root.classList.toggle("sending", on); },
    /** Refreshes the network log from the browser's Resource Timing. */
    requests(since) {
      const reqs = t.requestsSince(since);
      count.textContent = String(reqs.length);
      list.replaceChildren(...reqs.slice(-8).map((r) => {
        const u = new URL(r.name), li = el("li", "", u.host);
        const status = r.responseStatus ? ` · ${r.responseStatus}` : "";
        const file = u.pathname.split("/").pop() || "/";
        const name = file.includes(":") ? "…:" + file.split(":").pop() : file.slice(0, 48);   // e.g. …:exchangeDebugToken
        li.append(el("span", "", `${name}${status} · ${Math.max(0, Math.round(r.duration))} ms`));
        return li;
      }));
      if (!reqs.length) list.append(el("li", "", "none yet"));
    },
    reset() {
      car.place(lane.out, sOut(STOP.house)); car.carry("", "you"); formArm(0); checkArm(0);
      drone.place(...DRONE_HOME); drone.carry("");
      for (const end of ["near", "far"]) { bridge.sign(end, ""); bridge.key(end, ""); }
      tls.upTo(-1);
      this.busy(false); this.sending(false); this.stop(-1, null); rules.reset();
    },
  };
}

/**
 * The token board above your browser: the hourly token, and what proves the page to App Check
 * (locally the debug token, live reCAPTCHA). set(row, status, kind) updates a row; kind: "ok", "bad", "wait", "used".
 */
function tokenBoard(parent, [x, y]) {
  const W = 960, g = svg("g", { class: "st-board", transform: `translate(${x} ${y})` }, parent);
  svg("rect", { width: W, height: 200, rx: 18 }, g);
  t.label(g, 24, 42, "App Check tokens in this browser", "tt", "start", 30);
  const spec = [
    ["🎫", "Hourly token", "fetched on page load · cached · renewed every ~35 min · rides with every message"],
    LOCAL ? ["🔑", "Debug token (the proof)", "this browser's ID for local testing · swapped for the 🎫 above · never expires"]
      : ["🤖", "reCAPTCHA token (the proof)", "made fresh for each token request · only works on the allowed domains"],
  ];
  const rows = spec.map(([icon, name, note], i) => {
    const row = svg("g", { class: "st-trow", transform: `translate(0 ${92 + i * 58})` }, g);
    t.label(row, 24, 0, `${icon} ${name}`, "tn", "start", 25);
    const status = t.label(row, W - 24, 0, "", "ts", "end", 25);
    t.label(row, 62, 24, note, "tnote", "start", 18);
    return { row, status };
  });
  const set = (i, text, kind = "") => { rows[i].status.textContent = text; rows[i].row.setAttribute("class", "st-trow " + kind); };
  set(0, "none yet"); set(1, LOCAL ? "checked when the page loads" : "—");
  return { set };
}

/** Locally: the debug token's life, step by step, with whether this browser's token is registered (from App Check's answer). */
function debugPanel() {
  const box = el("div", "st-debug");
  box.append(el("p", "st-label", "🔑 The debug token (local testing only): where it comes from, what it's for, how long it lasts"));
  const steps = [
    ["Generated", "by the Firebase SDK, in this browser, the first time this page loads on this address. main.js switches App Check to debug mode on localhost / 127.0.0.1."],
    ["Stored", `in this browser's storage (IndexedDB) for ${location.host}, so every reload uses the same one.`],
    ["Printed", 'in the browser console on every load: F12 → Console, filter "debug token".'],
    ["Registered", "by you, once: Firebase console → App Check → Apps → ragents-web → ⋮ → Manage debug tokens → Add."],
    ["Used", "on every token trip (page load, then about every 35 minutes): shown to App Check instead of reCAPTCHA and swapped for the 🎫 hourly token."],
  ];
  const ol = el("ol", "st-steps");
  const items = steps.map(([title, text], i) => {
    const li = el("li"); li.dataset.n = String(i + 1);
    li.append(el("b", "", title), text);
    ol.append(li);
    return li;
  });
  const state = el("span", "state", "");
  items[3].append(state);
  box.append(ol, el("p", "st-life", "Lifespan: the debug token itself never expires. It lasts until you delete it in the Firebase console " +
    "or clear this site's data; another browser, profile or address makes a new one. The 🎫 tokens it gets expire (an hour by " +
    "default) and are renewed in the background. " +
    "Keep it secret: while it's registered, anyone who has it can pass App Check from any machine."));
  for (const li of items.slice(0, 3)) li.className = "done";
  return {
    el: box,
    /** true = App Check accepted it, false = refused (403), null = not known yet. */
    registered(ok) {
      items[3].className = ok === null ? "" : ok ? "done" : "bad";
      items[4].className = ok ? "done" : "";
      state.textContent = ok === null ? "" : ok ? "✓ registered: App Check accepts it" : "✕ not registered yet: App Check answers 403";
    },
  };
}

/** Shows what a token request's result says about the proof (debug token or reCAPTCHA): nothing if it never got through. */
function showProof(st, r) {
  if (!r || r.verdict === "failed") return;
  const ok = r.verdict === "ok", status = r.status ? ` (${r.status})` : "";
  if (LOCAL) {
    st.tokens.set(1, ok ? "✓ registered" : `✕ not registered${status}`, ok ? "ok" : "bad");
    st.debug?.registered(ok);
  } else st.tokens.set(1, ok ? "✓ reCAPTCHA vouched" : `✕ refused${status}`, ok ? "ok" : "bad");
}

/** One side of the HTTPS bridge at x: two towers, the main cable with its backstays, and the hangers. */
function bridgeSide(parent, x) {
  for (const y of TOWERS) box(parent, [x - 0.7, y - 0.7, 0], [1.4, 1.4, TOWER_TOP], "steel");
  const cable = [[x, -18, 1.4]];
  for (let y = TOWERS[0]; y <= TOWERS[1]; y++) cable.push([x, y, cableZ(y)]);
  cable.push([x, 12, 1.4]);
  svg("polyline", { class: "st-cable", points: t.pts(...cable) }, parent);
  for (let y = TOWERS[0] + 3; y < TOWERS[1]; y += 3) svg("line", { class: "st-hanger", ...lineAt([x, y, cableZ(y)], [x, y, 1.4]) }, parent);
}

/** The back of the HTTPS bridge, behind the car: the deck with its truss, and the far side's towers and cable. */
function bridgeBack(parent) {
  box(parent, [95, -18, -2.4], [20, 30, 2.4], "bridge");
  const truss = [];
  for (let i = 0; i <= 12; i++) truss.push([115, -18 + i * 2.5, i % 2 ? -0.3 : -2.1]);
  svg("polyline", { class: "st-truss", points: t.pts(...truss) }, parent);
  bridgeSide(parent, SIDES[0]);
}

/**
 * The front of the HTTPS bridge, always in front of the car: a portal over the road at each pair of towers ("near" at
 * your browser's end, "far" at Google's) with a sign on the side you see, then the near side's towers and cable.
 * g is its group (it turns red on a network error); sign() and key() show what each end is doing.
 */
function bridgeFront(parent, tags) {
  const g = svg("g", { class: "st-https" }, parent);
  const [x0, x1] = [SIDES[0] - 0.7, SIDES[1] + 0.7], w = (x1 - x0) * t.K, h = 4 * t.K;
  const ends = {};
  for (const [end, y] of [["far", TOWERS[0]], ["near", TOWERS[1]]]) {
    box(g, [x0, y - 0.7, TOWER_TOP - 4], [x1 - x0, 1.4, 4], "steel");
    const [ex, ey] = iso(x0, y + 0.7, TOWER_TOP);       // the sign lies on the portal's +y face: x runs along it, z up
    const sign = svg("g", { class: "st-bsign", transform: `matrix(1 0.5 0 1 ${ex.toFixed(1)} ${ey.toFixed(1)})` }, g);
    svg("rect", { x: 6, y: 4, width: w - 12, height: h - 8, rx: 6 }, sign);
    const text = t.label(sign, w / 2, h / 2 + 1, "HTTPS 🔒", "", "middle", 19);
    const key = t.makeTag(tags, S);                     // the session key, shown above the sign while that end is at work
    const [dx, dy, dz] = end === "near" ? [0, 0, 3] : [2, -3, 4.5];   // the far one sits higher, clear of the car's tag
    key.at(...iso((x0 + x1) / 2 + dx, y + dy, TOWER_TOP + dz));
    key.carry("");
    ends[end] = { sign, text, key };
  }
  bridgeSide(g, SIDES[1]);
  return {
    g,
    /** One end's sign: kind "enc" (encrypting), "dec" (decrypting), or "" for the resting "HTTPS 🔒". */
    sign(end, text, kind = "") {
      ends[end].text.textContent = text || "HTTPS 🔒";
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

/**
 * Under the tracker: where the time really went for your last message (the sums are in timing.js). Each stage is a
 * slice of one bar and a row with its time and share: blue is your browser, orange is Google (over the internet) and
 * striped is both, where the page can't split them. While you wait, the stage you're waiting on counts up.
 * It's redrawn five times a second, so it updates its rows in place: rebuilding them would restart the waiting pulse,
 * stop the bar from growing smoothly and clear any text you select.
 */
function timingPanel() {
  const box = el("div", "st-timing");
  const bar = el("div", "st-tbar"), list = el("ol", "st-tlist");
  const note = el("p", "st-note", "Send a message: each stage's real time shows here, measured by your browser.");
  box.append(el("p", "st-label", "⏱ Where the time went: real times for your last message (the street view is slowed down)"), bar, list, note);
  const WHERE = { browser: "your browser", google: "Google, over the internet", both: "your browser + Google" };
  /** Gives `parent` exactly n children (new ones from make()) and returns them. */
  const keep = (parent, n, make) => {
    while (parent.children.length > n) parent.lastElementChild.remove();
    while (parent.children.length < n) parent.append(make());
    return [...parent.children];
  };
  /** Sets text or a class only when it changed (rewriting the same text would still clear a selection in it). */
  const put = (node, text) => { if (node.textContent !== text) node.textContent = text; };
  const cls = (node, name) => { if (node.className !== name) node.className = name; };
  const blank = () => { const li = el("li"); li.append(el("i"), el("span", "nm"), el("small", "wh"), el("b"), el("small", "pc")); return li; };
  return {
    el: box,
    /** Draws what stages() in timing.js returns. */
    show({ rows, total, live, note: text }) {
      const share = (ms) => (total > 0 ? `${Math.round((100 * ms) / total)}%` : "");
      const kind = (r) => `${r.where}${r.live ? " live" : ""}`;
      keep(bar, rows.length, () => el("span")).forEach((slice, i) => {
        cls(slice, kind(rows[i]));
        slice.style.flexGrow = String(Math.max(1, rows[i].ms));      // the same node each time, so it grows smoothly
        slice.title = `${rows[i].name}: ${fmt(rows[i].ms)}`;
      });
      const items = [...rows.map((r) => [kind(r), r.name, WHERE[r.where], fmt(r.ms) + (r.live ? "…" : ""), share(r.ms)]),
        ["total", live ? "So far" : "Total: from Send to the reply on the page", "", fmt(total) + (live ? "…" : ""), ""]];
      keep(list, items.length, blank).forEach((li, i) => {
        const [name, ...texts] = items[i];
        cls(li, name);
        texts.forEach((s, j) => put(li.children[j + 1], s));
      });
      put(note, text || "Measured by your browser: its own clock, and Resource Timing for the requests to Google.");
    },
  };
}

/** Under the scene: what the HTTPS bridge uses to encrypt and decrypt, step by step (they light up as the car passes). */
function tlsPanel() {
  const box = el("div", "st-debug st-tls");
  box.append(el("p", "st-label", "🔒 The HTTPS bridge: what encrypts and decrypts your message"));
  const steps = [
    ["Handshake", "when your browser first connects, it checks Google's certificate (proof it's really Google) and the two sides " +
      "agree on a secret session key (key exchange: X25519, plus ML-KEM in newer Chrome). The key itself never crosses the internet."],
    ["Encrypt", "at the bridge's near end your browser's TLS encrypts the request with that key, usually with AES-128-GCM, which " +
      "also seals it: any change on the way is detected."],
    ["Cross", "on the internet it's scrambled bytes. Wi-Fi, your provider and routers can see which server and roughly how big, " +
      "never the words."],
    ["Decrypt", "Google's front door has the same session key, so it decrypts the request. HTTPS ends there: App Check, AI Logic " +
      "and Gemini get it in plain form."],
    ["Reply", "comes back over the same bridge: Google encrypts it with the key and your browser decrypts it."],
  ];
  const ol = el("ol", "st-steps");
  const items = steps.map(([title, text], i) => {
    const li = el("li"); li.dataset.n = String(i + 1);
    li.append(el("b", "", title), text);
    ol.append(li);
    return li;
  });
  box.append(ol, el("p", "st-life", "See the real ones: F12 → Security (\"Privacy and security\" in newer Chrome) → " +
    "firebasevertexai.googleapis.com shows something like \"TLS 1.3, X25519MLKEM768, AES_128_GCM\". The page's own code can't " +
    "read them. Behind a company proxy that inspects HTTPS (like Zscaler) there are two bridges, your browser ↔ the proxy and " +
    "the proxy ↔ Google, and the proxy decrypts in between."));
  return {
    el: box,
    /** Marks steps 0…i done (-1 clears them). */
    upTo(i) { items.forEach((li, j) => { li.className = j <= i ? "done" : ""; }); },
  };
}

/** Two world points (with z) → a line's x1/y1/x2/y2 attributes. */
function lineAt(a, b) {
  const [x1, y1] = iso(...a), [x2, y2] = iso(...b);
  return { x1, y1, x2, y2 };
}

// ---------- App Check tokens: the courier's errands ----------

/** App Check token exchanges (reCAPTCHA or debug token → App Check token) the page started since t0. */
const tokenRequests = (t0) => performance.getEntriesByType("resource")
  .filter((e) => e.startTime >= t0 && /firebaseappcheck\.googleapis\.com\/.+:exchange/.test(e.name));

/** Requests to Firebase AI Logic (your message itself) the page started since t0. */
const modelRequests = (t0) => performance.getEntriesByType("resource")
  .filter((e) => e.startTime >= t0 && e.name.includes("firebasevertexai.googleapis.com"));

/**
 * Waits up to `ms` for a token exchange that started after t0, or less once done() says there's nothing more to wait
 * for (a token request would show by then). Returns { status, debug, verdict } or null: status is null when the
 * browser doesn't report it, and verdict is timing.js's tokenVerdict(): "ok", "refused" or "failed" (it never got
 * through).
 */
async function tokenResult(tw, t0, ms, done) {
  let until = performance.now() + ms;
  for (;;) {
    const e = tokenRequests(t0).at(-1);
    if (e) {
      const status = e.responseStatus ?? null;
      return { status, debug: e.name.includes("exchangeDebugToken"), verdict: tokenVerdict(status) };
    }
    if (done()) until = Math.min(until, performance.now() + 400);
    if (performance.now() > until) return null;
    await new Promise((r) => setTimeout(r, 150));
    tw.alive();
  }
}

/** What the drone shows for a token request that brought no token. */
const tokenError = (r) => (r.verdict === "failed" ? "✕ failed" : `✕ ${r.status || "refused"}`);

/** Why App Check gave no token, in a few words, from the App Check SDK's error message (main.js passes it on). */
function tokenProblem(message = "") {
  if (/recaptcha-error/.test(message)) return "reCAPTCHA couldn't vouch";
  if (/fetch-network-error/.test(message)) return "request didn't get through";
  const status = /\b([45]\d\d)\b/.exec(message)?.[1];
  return status ? `refused (${status})` : "App Check gave none";
}

/**
 * The courier's round trip for a token request that has already been answered (`r`): fly to App Check's gate, show
 * the result, fly home.
 */
async function fetchToken(st, tw, label, r) {
  const { drone } = st;
  drone.place(...DRONE_HOME); drone.carry("🔒 " + label, "lock");     // a request of its own, over HTTPS: locked in flight
  await drone.fly(tw, DRONE_GATE);
  const ok = r.verdict === "ok", result = ok ? "🎫 token" : tokenError(r);
  drone.carry(result, ok ? "ok" : "err");
  if (r.verdict === "refused") st.bad("appcheck");                  // "failed" never reached App Check
  showProof(st, r);
  await tw.wait(800);
  drone.carry("🔒 " + result, "lock");
  await drone.fly(tw, DRONE_HOME);
  drone.carry(result, ok ? "ok" : "err");
}

/**
 * On page load the SDK gets the hourly token before you type anything: a fresh one saved in this browser (no request),
 * or a new one from Google, which the drone fetches. A saved one that's due for renewal is renewed straight away.
 */
async function pageLoadToken() {
  const st = scene, tw = st.play.begin();
  try {
    st.stop(null, "main");
    st.say("Page load: App Check starts. The Firebase SDK needs an hourly token (🎫): a fresh one saved in this browser, " +
      "or a new one from Google…");
    // The page-load token request, if any. main.js's token events say when there's nothing more to wait for.
    const r = await tokenResult(tw, 0, 10000, () => cached.state === "error" || (cached.state === "ok" && !renewalDue()));
    if (r) await fetchToken(st, tw, "page load: 🎫?", r);
    st.stop(null, null);
    if (r ? r.verdict === "ok" : cached.state === "ok") {
      if (!r) { st.tokens.set(1, LOCAL ? "✓ registered" : "not needed: the 🎫 was saved", "ok"); st.debug?.registered(true); }
      st.say(r ? "Page load: App Check issued an hourly token (🎫) and the SDK cached it in this browser. Every message carries " +
          "it, so messages make no token request; it's renewed in the background about 35 minutes in. Send a message to watch."
        : "Page load: a fresh hourly token (🎫) was already saved in this browser, so there's no token request: the drone stays " +
          "home. Every message carries it. Send a message to watch.");
    } else if (r || cached.state === "error") {
      const why = !r ? `App Check gave none (${tokenProblem(cached.error)})`
        : r.verdict === "failed" ? "the token request never got through (offline, or blocked on the way)"
        : r.debug ? "App Check refused this browser's debug token (403): it isn't registered in the Firebase console"
        : `App Check refused the token request (${r.status || "refused"})`;
      st.say(`Page load: no hourly token: ${why}. Until there is one, messages go out with a placeholder token and App ` +
        `Check refuses them (403)${r?.debug ? ': see "Testing on your own machine" in the step 2 README' : ""}.`);
    } else st.say("Page load: no App Check token yet.");
  } catch (err) {
    if (err !== t.STOPPED) throw err;
  }
}

/**
 * How this message gets its App Check token, shown at main.js (live, or from the recording on a replay). Usually the
 * cached 🎫 rides along and the drone stays home. Without a valid one the SDK asks for a new one first (the drone flies),
 * and if it gets none it sends a placeholder instead. Returns "cached", "new", "placeholder" or "late" (no token within
 * main.js's time limit, so nothing was sent).
 */
async function messageToken(st, tw, msg, got) {
  if (!msg.replay) {
    let r = null, use;
    if (!tokenValid() || tokenRequests(msg.t0).length) {
      // After a refusal the SDK holds off (no request); otherwise it asks App Check for a new token first.
      if (!(cached.state === "error" && /throttl/.test(cached.error))) {
        st.say("generate(text) calls model.generateContent(text). There's no valid hourly token in this browser, so the SDK " +
          `gets one first (${LOCAL ? "the debug token" : "reCAPTCHA"} vouches for this page, App Check swaps that for a 🎫)…`);
      }
      r = await tokenResult(tw, msg.t0, 6000, () => msg.seen.outcome);
    }
    if (r) use = r.verdict === "ok" ? "new" : "placeholder";
    else if (tokenValid()) use = "cached";
    else {
      const out = await got("outcome");             // no token request: the SDK used what it had, or gave up waiting
      use = out.kind === "timeout" && !modelRequests(msg.t0).length ? "late" : cached.state === "error" ? "placeholder" : "cached";
    }
    // Locally the SDK doesn't announce new tokens (see main.js), so note that this browser has one now.
    if (use === "new" && cached.state !== "ok") Object.assign(cached, { state: "ok", issuedAt: null, expiresAt: null, error: "" });
    msg.seen.token = { use, r, problem: cached.state === "error" ? cached.error : "" };
  }
  msg.seen.token ??= { use: "cached", r: null, problem: "" };   // a replay of a trip that never got this far
  const { use, r } = msg.seen.token;
  if (r) await fetchToken(st, tw, "new 🎫?", r);
  return use;
}

// ---------- The hourly token on the board ----------

/** What the page knows about the cached hourly token, from main.js's "token" and "token-error" events. */
const cached = { state: null, issuedAt: null, expiresAt: null, error: "" };   // state: null (nothing yet), "ok" or "error"

/** True while the board knows of a valid cached token (its times may be unknown). */
const tokenValid = () => cached.state === "ok" && (cached.expiresAt == null || cached.expiresAt > Date.now());

/**
 * True when the SDK should be renewing the cached token now: it renews half-way through the token's life plus 5 minutes,
 * but at least 5 minutes before it expires. False when its times are unknown.
 */
const renewalDue = () => cached.issuedAt != null && cached.expiresAt != null &&
  Math.min(cached.issuedAt + (cached.expiresAt - cached.issuedAt) / 2 + 300_000, cached.expiresAt - 300_000) <= Date.now();

/** "mm:ss" (or "h:mm:ss") until `ms`. */
function countdown(ms) {
  const s = Math.max(0, Math.round((ms - Date.now()) / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return `${h ? h + ":" + String(m).padStart(2, "0") : m}:${String(s % 60).padStart(2, "0")}`;
}

/** The 🎫 row on the board: a live countdown to the cached token's expiry, or why there's none. */
function showCached() {
  if (!scene || !cached.state) return;
  if (cached.state === "error") { scene.tokens.set(0, `✕ none: ${tokenProblem(cached.error)}`, "bad"); return; }
  if (cached.expiresAt == null) { scene.tokens.set(0, "✓ in this browser", "ok"); return; }
  const at = new Date(cached.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (cached.expiresAt > Date.now()) scene.tokens.set(0, `✓ valid · expires in ${countdown(cached.expiresAt)} (at ${at})`, "ok");
  else scene.tokens.set(0, LOCAL ? "renewed · reload to see it" : "expired · being renewed", "wait");   // locally renewals aren't announced
}

// ---------- Following the real events ----------

const scene = typeof document === "undefined" ? null : build();
let current = null;                              // the message being shown: its events arrive while the car drives
let lastRun = null;                              // everything about the last message, for Replay
let firstSend = null;                            // performance.now() of the first message, for the network log
let ticker = 0;                                  // redraws the timing panel while a message is out

/** A promise you resolve later (and that never complains if it's abandoned). */
function later() {
  let resolve, reject;
  const p = new Promise((a, b) => { resolve = a; reject = b; });
  p.catch(() => {});
  return { p, resolve, reject };
}

/** A new message was sent (index.html calls this before agent.respond()). */
function start(text, ready) {
  for (const d of current ? [current.check, current.outcome, current.reply] : []) d.reject(t.STOPPED);
  firstSend ??= performance.now();
  const sent = performance.now();
  current = { text, ready, t0: sent, marks: { sent }, check: later(), outcome: later(), reply: later(), seen: {} };
  clearInterval(ticker);
  ticker = setInterval(() => measure(), 200);
  measure();
  run(current);
}

/**
 * agent.js's stage events (createAgent's onEvent): the same ones the box diagram uses. Each one is also timed.
 * main.js adds the cached App Check token's times ("token") and App Check's errors ("token-error") for the board.
 */
function event(e) {
  if (e.type === "token") {
    Object.assign(cached, { state: "ok", issuedAt: e.issuedAt ?? null, expiresAt: e.expiresAt ?? null, error: "" });
    showCached();
    return;
  }
  if (e.type === "token-error") { Object.assign(cached, { state: "error", error: e.message ?? "" }); showCached(); return; }
  if (!current) return;
  const now = performance.now(), marks = current.marks;
  if (e.type === "rejected" || e.type === "accepted") { marks.checked = now; current.seen.check = e; current.check.resolve(e); }
  else if (e.type === "model-start") marks.generate = now;
  else if (e.type.startsWith("model-")) { marks.result = now; current.seen.outcome = e; current.outcome.resolve(e); }
  measure();
}

/** The reply is on the page: the car can bring it home. */
function reply(text) {
  if (!current) return;
  const msg = current;
  msg.marks.shown = performance.now();
  msg.seen.reply = text;
  msg.reply.resolve(text);
  lastRun = { text: msg.text, ready: msg.ready, seen: msg.seen };   // the token result may still be arriving
  measure();
  // Resource Timing can report the last request a moment after the reply is shown: look once more, then stop.
  setTimeout(() => { if (current === msg) { measure(); clearInterval(ticker); } }, 1500);
}

/** Redraws the timing panel for the message being shown: its marks plus the requests Resource Timing has seen. */
function measure() {
  if (!scene || !current) return;
  const marks = current.marks;
  scene.timing.show(stages({ marks, outcome: current.seen.outcome, tokens: tokenRequests(marks.sent),
    model: modelRequests(marks.sent)[0] ?? null, now: performance.now(), local: LOCAL }));
}

/** Setup isn't finished (shown when the page loads). There's no App Check then, so this also ends the page-load trip. */
function setupProblem(problem) {
  if (!scene) return;
  scene.play.begin();
  scene.say(problem);
}

/** Plays one message's trip, waiting for the real events where it needs them. */
async function run(msg) {
  if (!scene) return;
  const st = scene, { car, lane, center, rules } = st;
  // A replay uses the recorded events; a live message waits for them.
  const got = (k) => (msg.replay ? Promise.resolve(msg.seen[k]) : msg[k].p);
  const tw = st.play.begin();
  st.ui.replay.disabled = !msg.replay;            // a live message keeps it off until its own trip has been drawn
  const boomTo = (arm, to) => { const from = arm.deg; return tw.tween(450, (e) => arm(from + (to - from) * e)); };
  const typed = quote(msg.text.trim(), 22);
  let skipped = [];
  const leg = (i, where, say) => { st.stop(i, where, skipped); if (say) st.say(say); st.requests(firstSend); };
  try {
    st.reset();
    leg(0, "house", `You typed ${typed} and pressed Send.`); car.carry(typed, "you"); await tw.wait(900);
    await car.drive(tw, st.sOut(STOP.gate)); leg(1, "gate", 'The browser fires a "submit" event on <form id="form">: onSend(e) starts.');
    await boomTo(st.formArm, 80);
    await car.drive(tw, st.sOut(STOP.depot)); leg(2, "depot", 'onSend(e) adds your bubble and "thinking…", then calls agent.respond(text).');
    await tw.wait(1000);
    await car.drive(tw, st.sOut(STOP.agent)); leg(3, "agent", "respond() checks the message before anything is sent.");

    let reply, turnAt = null, kind = "bot";
    if (!msg.ready) {
      skipped = GOOGLE_STEPS;
      rules.set(0, "stop");
      reply = await got("reply");
      leg(3, "agent", "Setup isn't finished, so nothing is sent: " + reply);
      kind = "err"; turnAt = STOP.agent;
    } else {
      const check = await got("check");
      if (check.type === "rejected") {
        skipped = GOOGLE_STEPS;
        const empty = check.reason === "empty";
        rules.set(0, empty ? "stop" : "no"); await tw.wait(400);
        if (!empty) { rules.set(1, "stop"); await tw.wait(400); }
        rules.set(2, "skip");
        reply = await got("reply");
        leg(3, "agent", `respond(): ${empty ? "nothing typed" : "longer than 500 characters"}, so it returns a hint. ` +
          "generate() is never called: nothing leaves your browser and no quota is used.");
        turnAt = STOP.agent;
      } else {
        for (const [i, s] of [[0, "no"], [1, "no"], [2, "yes"]]) { rules.set(i, "check"); await tw.wait(350); rules.set(i, s); }
        await car.drive(tw, st.sOut(STOP.main));
        leg(4, "main");
        st.sending(true);
        const use = await messageToken(st, tw, msg, got);
        const { r: tok, problem } = msg.seen.token;
        if (use === "late") {
          // No valid token, and none within main.js's time limit: generate() stopped waiting, so nothing left your browser.
          skipped = [5, 6, 7, 8];
          st.sending(false);
          car.carry(`${typed} 🎫✕`, "err");
          st.drone.carry("✕ none in time", "err");
          reply = await got("reply");
          leg(4, "main", "No valid App Check token came back within main.js's time limit, so generate() stopped waiting. The " +
            "message is never sent to Google: check the network log.");
          st.bad("main");
          kind = "err"; turnAt = STOP.main;
        } else {
          const ride = `${typed} ${use === "placeholder" ? "🎫✕" : "🎫"}`;   // what rides in the X-Firebase-AppCheck header
          if (use === "placeholder") {
            const why = !tok ? (/throttl/.test(problem)
                ? "App Check refused a token request earlier, and after a refusal the SDK asks for no new one until the page is reloaded"
                : `App Check gave none (${tokenProblem(problem)})`)
              : tok.verdict === "failed" ? "the token request never got through (offline, or blocked on the way)"
              : `App Check refused the token request (${tok.status || "refused"})` +
                `${tok.debug ? ": this browser's debug token isn't registered" : ""}`;
            st.drone.carry(tok ? tokenError(tok) : "✕ no token", "err");
            leg(4, "main", `generate(text) calls model.generateContent(text), but there's no valid App Check token: ${why}. ` +
              "The Firebase SDK sends the request anyway, with a placeholder in the X-Firebase-AppCheck header, so App " +
              "Check's gate will refuse it.");
          } else {
            st.drone.carry("");
            leg(4, "main", use === "new"
              ? "Got a new hourly token (🎫). The SDK keeps it for the next messages and attaches it to this request (the " +
                "X-Firebase-AppCheck header). The request leaves."
              : "generate(text) calls model.generateContent(text). The Firebase SDK attaches the hourly token (🎫) already in " +
                "this browser (the X-Firebase-AppCheck header): no token request, so the request leaves straight away.");
          }
          car.carry(ride, use === "placeholder" ? "err" : "you"); await tw.wait(1200);
          await car.drive(tw, st.sOut(STOP.bridge));
          leg(5, "bridge", "🔒 Encrypt: before the request leaves your computer, your browser's TLS encrypts it with the session key " +
            "it agreed with Google (usually AES-128-GCM). On the internet it's only scrambled bytes.");
          st.tls.upTo(1);
          await crypt(st, tw, "near", "enc", ride);
          const early = msg.replay ? msg.seen.outcome : current === msg ? msg.seen.outcome : null;
          if (early?.kind === "network") {
            reply = await got("reply");
            leg(5, "bridge", "The request never reached Google (network error or offline). generate() throws; respond() turns it into a friendly message.");
            st.bad("bridge");
            kind = "err"; turnAt = STOP.bridge;
          } else {
            await car.drive(tw, st.sOut(STOP.farEnd));
            leg(5, "bridge", "🔓 Decrypt: HTTPS ends at Google's front door, which holds the same session key. It turns the bytes " +
              "back into your request, App Check token and all.");
            st.tls.upTo(3);
            await crypt(st, tw, "far", "dec", ride);
            await car.drive(tw, st.sOut(STOP.appcheck)); st.sending(false);
            leg(6, "appcheck", use === "placeholder" ? "App Check checks the token: it's only a placeholder…"
              : "App Check checks the 🎫: issued by App Check for this web app, and not expired?…");
            await tw.wait(700);
            const out = await got("outcome");
            if (out.type === "model-error" && (out.kind === "appcheck" || out.kind === "network")) {
              reply = await got("reply");
              leg(6, "appcheck", out.kind === "network" ? "The request never reached Google (network error)."
                : use === "placeholder" ? "App Check refused the placeholder (403), so the request goes no further. Copies of " +
                  "this page on other sites stop here too: they never get a real token."
                : "App Check refused the token (403), although your browser had a valid one. The usual cause: replay protection " +
                  "for Firebase AI Logic is Enforced in the Firebase console, so it accepts only single-use tokens (see \"If App " +
                  "Check refuses (403)\" in the step 2 README).");
              st.bad("appcheck");
              kind = "err"; turnAt = STOP.appcheck;
            } else {
              await boomTo(st.checkArm, 80);
              await car.drive(tw, st.sOut(STOP.ailogic));
              leg(7, "ailogic", "Firebase AI Logic accepts the token and adds the Gemini API key. The key stays here on Google's side: it never travels to your browser.");
              car.carry(`${typed} 🔑`, "you"); await tw.wait(1500);
              await car.drive(tw, st.sOut(STOP.gemini));
              leg(8, "gemini", `Gemini (${MODEL}) reads the system instruction and your one message…`);
              st.busy(true); await tw.wait(1200);
              reply = await got("reply");
              if (out.type === "model-ok") {
                leg(8, "gemini", `Gemini answered. Real time: generate() took ${fmt(out.ms)} in all ("Where the time went" ` +
                  "below splits it). The reply goes back the same way.");
              } else {
                kind = "err";
                leg(8, "gemini", out.type === "model-empty" ? "Gemini sent an empty reply."
                  : out.kind === "timeout" ? `No reply after ${Math.round(out.ms / 1000)} s, so main.js stopped waiting (its time limit).`
                  : `Gemini returned an error (${out.kind}). Real time: generate() took ${fmt(out.ms)} in all.`);
                st.bad("gemini");
              }
              st.busy(false);
              turnAt = "end";
            }
          }
        }
      }
    }

    // The way back: turn round, cross the internet (encrypted again) if we're in Google, then home. From Google the car
    // carries what Google really sent (the reply, or an error status); a friendly error message is written in your
    // browser, by respond(). After a timeout nothing comes back at all.
    const o = msg.seen.outcome, inGoogle = turnAt === "end" || turnAt === STOP.appcheck;
    const wire = !inGoogle ? null : o?.type === "model-ok" ? quote(reply, 30) : o?.type === "model-empty" ? "(an empty reply)"
      : { appcheck: "✕ 403 refused", quota: "✕ 429 quota used up", busy: "✕ 503 too busy", timeout: "" }[o?.kind] ?? "✕ error";
    car.carry(inGoogle ? wire || "✕ no reply" : quote(reply, 30), kind); await tw.wait(1100);
    let back;
    if (turnAt === "end") { await car.drive(tw, lane.out.total); back = lane.turnAt(center.p.length - 1, 6); }
    else back = lane.turnAt(center.nearest(...turnAt), 3.6);
    car.place(back.path, 0);
    const home = (p) => back.sAt(...p);
    if (inGoogle && wire) {                                         // cross the bridge back, encrypted
      const what = o?.type === "model-ok" ? "reply" : "answer";
      await car.drive(tw, home(STOP.farEnd));
      leg(9, "bridge", `🔒 Encrypt: Google's front door encrypts the ${what} with the same session key.`);
      await crypt(st, tw, "far", "enc", wire, kind);
      await car.drive(tw, home(STOP.landing));
      leg(9, "bridge", `🔓 Decrypt: back at your computer, your browser decrypts the ${what} with its copy of the key.`);
      st.tls.upTo(4);
      await crypt(st, tw, "near", "dec", wire, kind);
    } else if (inGoogle) {                                          // timeout: the browser gave up, nothing crosses back
      await car.drive(tw, home(STOP.farEnd));
      leg(9, "bridge", "Nothing comes back over the bridge: your browser stopped waiting, so there's nothing to decrypt.");
      await car.drive(tw, home(STOP.landing));
    }
    if (turnAt !== STOP.agent) {
      await car.drive(tw, home(STOP.main));
      leg(9, "main", o?.type === "model-empty" ? "generate() returns the empty text; respond() swaps it for a \"please try again\" message."
        : kind === "err" ? "generate() throws the error; respond() catches it and friendlyError(err) turns it into a readable message."
        : "generate() returns response.text() to respond(), which trims it and returns it.");
      car.carry(quote(reply, 30), kind);
      await tw.wait(900);
    }
    await car.drive(tw, home(STOP.depot));
    leg(9, "depot", 'onSend(e) removes "thinking…" and calls add(reply, "bot"): the reply goes on the page as plain text.');
    await tw.wait(1000);
    await car.drive(tw, home(STOP.house));
    leg(10, "house", `You see ${quote(reply, 60)}`);
    await boomTo(st.formArm, 0); await boomTo(st.checkArm, 0);
    tw.alive(); st.track.finish(skipped);
    st.ui.replay.disabled = false;
  } catch (err) {
    if (err !== t.STOPPED) throw err;
  }
}

if (scene) {
  setInterval(showCached, 1000);               // the 🎫 row's countdown
  pageLoadToken();
}

export const street = { start, event, reply, setupProblem };
