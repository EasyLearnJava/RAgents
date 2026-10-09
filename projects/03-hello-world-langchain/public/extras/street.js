/**
 * EXTRA: a teaching aid, not part of the agent.
 *
 * "Street view" of step 3: step 1's trip, through a LangChain chain. A black sports car carries your message from your
 * house (the chat) through the form's gate (the submit event) to the index.html depot (onSend(e), which calls
 * chain.invoke(text)), then through the chain in agent.js: the normalize station (a RunnableLambda: the car's tag
 * changes to the trimmed text) and, joined to it by .pipe(), the rules station (a RunnableBranch), whose board shows the
 * conditions it tried, in order, and what each returned. Then it brings { reply, rule } back to onSend(e), which shows
 * the reply with add().
 *
 * Every stop follows LangChain's own report for this message: record.js runs the chain once more with streamEvents(),
 * and trip.js plans the trip from those events, with their real names and outputs. The real trip takes milliseconds,
 * so it's slowed right down.
 *
 * The town is drawn inside a browser window: once the page has loaded, everything runs in your browser tab. Outside it
 * are the two places the page downloaded files from while it loaded: this site's server (the page's own files) and
 * the jsDelivr CDN (LangChain's code, listed from the browser's Resource Timing: one import brings in about a dozen
 * files). Under them, the page's network requests since your first message: it stays at 0. On a narrow screen they go
 * last, under the timings, so the scene keeps its tracker and narration right under it.
 *
 * Under the tracker, "Where the time went" shows the real run's stages (the sums are in timing.js), timed on
 * index.html's lines marked EXTRA, and under it LangChain's steps from the recorded run, kept apart from the total.
 *
 *   street.start(e)          onSend(e) started: notes the submit event's timestamp and the time now
 *   street.mark(e, name)     "invoke", "resolved", "added": the real chain.invoke() call, and onSend(e) done
 *   street.reply(e, text, result, recording)   the reply is on the page: time the next frame, then play the trip
 *
 * Each message's times are kept by its submit event `e`, so two messages in flight at once never mix them.
 *
 * Drawn with the shared toolkit /lib/town.js (plain SVG, no library). All text goes in with textContent.
 */
import * as t from "/lib/town.js";
import { BRANCHES, TRACK, tripFor } from "./trip.js";
import { clockStep, fmt, recordedSplit, stages } from "./timing.js";

const { svg, box, house, depot, factory, chimney, tree, lamp, road, curve, lanes, depthLayer, pin, boom, board,
  vehicle, tracker, card, el, paneY } = t;

/** The road: from your house past the form's gate and index.html, through the chain's two stations, to a turning circle. */
const ROAD = [[-6, 45], [6, 45], [20, 46], [32, 50], [46, 50], [58, 46], [70, 44], [82, 46], [96, 46], [108, 45], [120, 47]];
/** Where the car stops (points on the road; the lane is found from them). */
const STOP = { house: [8, 45], gate: [16.5, 45.8], depot: [42, 50], normalize: [67, 44.5], rules: [96, 46] };
/** The CDN the import map in index.html loads LangChain from. */
const CDN = "cdn.jsdelivr.net";

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- The scene ----------

function build() {
  t.ensureStyles();
  const ui = card("Street view: your message's trip through the LangChain chain, inside your browser",
    "The car carries your message to onSend(e), through the chain's two stations, normalize and rules (joined with " +
    ".pipe()), and brings the reply back. Each stop follows LangChain's own streamEvents() report for this message, with " +
    "its real event names and outputs. It all runs in your browser: the network was only used while the page loaded (its " +
    "own files, and LangChain's code from a CDN). Slowed right down; the real times are under the tracker.",
    "Street view of one message's trip through the LangChain chain");

  const root = svg("svg", { class: "st-scene", viewBox: "-590 -80 1570 890", role: "img",
    "aria-label": "An isometric town: your house, the form's gate, the index.html depot, then the chain's normalize and " +
      "rules stations along one winding road" });

  // Ground, road, then everything that stands up, back to front. .pipe() is painted on the far half of the road as it
  // leaves normalize for rules, between where the car's tag waits at those two stops, so neither tag covers it.
  box(root, [-8, 14, -2.5], [140, 48, 2.5], "slab");
  const center = curve(ROAD), lane = lanes(center);
  road(root, center, { capEnd: true });
  t.paint(root, 66, 41.5, ".pipe()", 24);
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
  const gateArm = boom(b.gate, [23.5, 37.7, 4.2], [0, 1], 17);
  depth.add(b.gate, 58);
  b.depot = depth.add(depot(L, [32, 18], [20, 16, 10]), 68);
  b.normalize = depth.add(depot(L, [60, 21], [14, 13, 8], "gwall"), 94);
  b.rules = depth.add(factory(L, [86, 18], [20, 16, 9]), 122);
  const smoke = depth.add(chimney(L, 108.2, 20.5, 19), 131);
  for (const [x, y] of [[17, 24], [18, 31], [27, 27], [55, 24], [56, 31], [79, 24], [80, 31], [116, 25]]) depth.add(tree(L, x, y), x + y);
  for (const [x, y] of [[29, 38], [57, 37], [81.5, 37.5], [111, 35.5]]) depth.add(lamp(L, x, y), x + y);
  for (const [x, y] of [[3, 57], [28, 59.5], [55, 58], [78, 57.5], [101, 58]]) depth.add(tree(L, x, y), x + y);
  const car = vehicle(depth, tags);

  // Two pins are lifted, so the car's tag never covers them: the reply waits at your house next to the form's pin, and
  // the result passes under normalize's pin on its way back to index.html. Your pin stands near the left end of the
  // roof ridge, above the lifted form pin, so that pin doesn't hide where it points.
  const pins = {
    house: pin(top, [3, 26, 12.6], "You", "the chat page"),
    gate: pin(top, [23, 35.4, 6.4], '<form id="form">', '"submit" event', 1, 64),
    depot: pin(top, [45, 24, 10.2], "index.html", "onSend → chain.invoke"),
    normalize: pin(top, [67, 27, 8.2], "normalize", "RunnableLambda · trim", 1, 40),
    rules: pin(top, [96, 25, 12.8], "rules", "RunnableBranch"),
  };
  t.banner(top, 470, 160, "AGENT.JS · THE CHAIN", "hello-chain = normalize.pipe(rules)", 30);
  const rules = board(top, [450, -60], "rules (RunnableBranch) tries, in order",
    BRANCHES.map(([condition, step]) => `${condition ?? "default"} → ${step}`), 1, 500);
  root.append(tags);
  const legend = svg("g", { class: "st-legend", transform: "translate(-560 600)" }, top);
  t.label(legend, 0, 0, "→ near lane: your message", "lg you", "start", 22);
  t.label(legend, 0, 36, "← far lane: the reply", "lg bot", "start", 22);
  t.label(legend, 0, 72, "· on a tag = a space", "lg", "start", 22);

  // Tracker, narration, the browser window with the outside world next to it, and the timings under the tracker.
  const track = tracker(TRACK);
  const world = el("div", "st-world");
  const outside = outsidePanel();
  world.append(t.browserWindow(root, "Hello World Agent",
    "Everything inside this window runs in your browser tab, on your computer. LangChain's code was downloaded when the " +
    "page loaded; your messages are never sent anywhere."), outside.el);
  const timing = t.timingPanel({ fmt: (ms) => fmt(ms, step),
    where: { browser: "your browser" },
    hint: "Send a message: each stage's real time shows here, measured by your browser.",
    measured: "Measured by your browser's own clock." });
  const recorded = recordedPanel();
  ui.card.append(world, track.el, ui.now, timing.el, recorded.el);
  document.body.append(ui.card);       // style.css gives it its own row under the chat
  // town.js stacks the window and the outside world on a narrow screen (860 px or less). There the outside world goes
  // last instead, so the scene keeps its tracker and narration right under it.
  const narrow = matchMedia("(max-width: 860px)");
  const place = () => (narrow.matches ? ui.card : world).append(outside.el);
  narrow.addEventListener("change", place);
  place();

  const sOut = (p) => lane.sOut(...p);
  const play = t.player();
  ui.replay.addEventListener("click", () => { if (lastTrip) run(lastTrip); });
  ui.pace.addEventListener("click", () => { ui.pace.textContent = play.cycle(); });
  // Redraw the outside panel whenever the browser reports a finished request (LangChain's files arrive after this runs).
  try { new PerformanceObserver(() => outside.update()).observe({ type: "resource", buffered: true }); } catch { /* updated at each stop instead */ }
  outside.update();
  const st = {
    car, lane, center, gateArm, rules, track, play, ui, timing, recorded, outside, sOut,
    /** Highlights the building (and its pin) where the car is, and the tracker up to step i. */
    stop(i, where) {
      for (const [k, g] of Object.entries(b)) g.classList.toggle("on", k === where);
      for (const [k, p] of Object.entries(pins)) p.classList.toggle("on", k === where);
      track.set(i);
    },
    say(text) { ui.now.textContent = text; },
    busy(on) { root.classList.toggle("busy", on); smoke.classList.toggle("busy", on); },
    reset() {
      car.place(lane.out, sOut(STOP.house)); car.carry("", "you"); gateArm(0); st.busy(false); st.stop(-1, null); rules.reset();
    },
  };
  st.reset();
  return st;
}

/** Turns a CDN address into a short name: ".../npm/zod@4.6.5/v4/core/+esm" → "zod 4.6.5 · v4/core". */
function fileName(url) {
  const path = new URL(url).pathname.replace(/\/\+esm$/, "");
  const m = /^\/npm\/((?:@[^/]+\/)?[^/@]+)@([^/]+)(\/.+)?$/.exec(path);
  return m ? `${m[1]} ${m[2]}${m[3] ? " · " + m[3].slice(1) : ""}` : path;
}

/** A size in bytes for people, like the browser's DevTools: "0 kB", "56 kB", "1.2 MB" (anything else is at least 1 kB). */
const size = (n) => (n >= 999_500 ? `${(n / 1e6).toFixed(1)} MB` : `${n > 0 ? Math.max(1, Math.round(n / 1000)) : 0} kB`);
/** A download's time for people: "310 ms", "6.3 s". */
const took = (ms) => (ms < 999.5 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`);
/** "1 file", "11 files". */
const files = (n) => `${n} file${n === 1 ? "" : "s"}`;
/** Whether a request failed: Chromium reports status 0 for one that got no answer (other browsers may not say). */
const failed = (e) => e.responseStatus === 0 || e.responseStatus >= 400;

/**
 * Outside the browser window: where the page's files came from when it loaded (this site's server, and the jsDelivr
 * CDN for LangChain's code, listed from the browser's Resource Timing), and the page's network requests since your
 * first message. update() redraws it from Resource Timing.
 */
function outsidePanel() {
  /** The address index.html's import map gives "@langchain/core/runnables": the one file the page asks for itself. */
  let entry = "";
  try { entry = JSON.parse(document.querySelector('script[type="importmap"]').textContent).imports["@langchain/core/runnables"]; } catch { /* no map */ }
  const net = el("div", "st-net");
  const rack = () => {
    const r = svg("svg", { viewBox: "0 0 60 64", class: "st-rack", "aria-hidden": "true" });
    for (let i = 0; i < 3; i++) { svg("rect", { x: 4, y: 4 + i * 20, width: 52, height: 16, rx: 4 }, r); svg("circle", { cx: 14, cy: 12 + i * 20, r: 3 }, r); }
    return r;
  };
  const site = el("div", "st-server st-site");
  site.append(rack(), el("b", "", "This site's server"),
    el("p", "", `${location.host} sent this page's own files once, when you opened it: index.html, agent.js, style.css and the extras.`));
  const cdn = el("div", "st-server");
  const summary = el("p", "", "");
  // The file list is folded away (it's about a dozen lines): the summary above it says how many, how big and how long.
  const fold = el("details", "st-files"), foldTitle = el("summary");
  const list = el("ol", "st-log st-cdn");
  fold.append(foldTitle, list);
  fold.hidden = true;
  const count = el("p", "st-count", "Send a message, then watch this stay at 0.");
  cdn.append(rack(), el("b", "", `CDN: ${CDN}`), summary, fold,
    el("p", "st-label", "Network requests since your first message"), count,
    el("p", "", "Your messages never go to either. Try it: once the page has loaded, turn off Wi-Fi and the agent still answers."));
  net.append(el("div", "st-zone", "Outside your computer"), el("div", "st-wire", "the internet: used only while the page loaded"), site, cdn);
  return {
    el: net,
    update() {
      const got = performance.getEntriesByType("resource").filter((e) => new URL(e.name).host === CDN);
      const ok = got.filter((e) => !failed(e)), bad = got.length - ok.length;
      const cached = ok.filter((e) => e.transferSize === 0 && e.decodedBodySize > 0).length;
      const sent = ok.reduce((n, e) => n + e.transferSize, 0), unpacked = ok.reduce((n, e) => n + e.decodedBodySize, 0);
      const span = ok.length ? Math.max(...ok.map((e) => e.startTime + e.duration)) - Math.min(...ok.map((e) => e.startTime)) : 0;
      if (!got.length) summary.textContent = "LangChain's code is loading from here…";
      else if (!ok.length) {
        summary.textContent = "Nothing came back: the request for LangChain's code failed (the CDN is blocked, or you're " +
          "offline), so the chat can't start.";
      } else if (cached === ok.length && !bad) {
        summary.textContent = `LangChain's code, when the page loaded: ${files(ok.length)}, all from your browser's cache this ` +
          "time (nothing downloaded). They're the import map's one entry and everything it pulls in.";
      } else {
        summary.textContent = `Sent LangChain's code once, when the page loaded: ${files(ok.length)}` +
          `${cached ? ` (${cached} from your browser's cache)` : ""}, ${size(sent)} (${size(unpacked)} of JavaScript unpacked), ` +
          `in ${took(span)}. ${bad ? `${files(bad)} failed, so the chat can't start.` : "Send waited for them."} They're the ` +
          "import map's one entry and everything it pulls in.";
      }
      fold.hidden = !got.length;
      foldTitle.textContent = got.length === 1 ? "The file" : `The ${files(got.length)}`;
      // One line per file: its name, and its size (or where it came from); the time it took shows on hover.
      list.replaceChildren(...got.map((e) => {
        const li = el("li", "", fileName(e.name) + (e.name === entry ? " (the entry)" : ""));
        const how = failed(e) ? `failed${e.responseStatus ? ` ${e.responseStatus}` : ""}`
          : e.transferSize === 0 && e.decodedBodySize > 0 ? "cache" : size(e.transferSize);
        li.append(el("span", "", how));
        li.title = `${e.name}\n${failed(e) ? "failed" : how === "cache" ? "from your browser's cache" : `${how} over the network`} · ${took(e.duration)}`;
        return li;
      }));
      if (firstSend != null) {
        const n = t.requestsSince(firstSend).length;
        count.textContent = String(n);
        count.classList.toggle("zero", n === 0);
      }
    },
  };
}

/**
 * Under "Where the time went": LangChain's steps inside chain.invoke(), from record.js's recorded run. It's a separate
 * run, so this has its own total and is never added to the real run's.
 */
function recordedPanel() {
  const panel = el("div", "st-timing st-recorded");
  const bar = el("div", "st-tbar"), list = el("ol", "st-tlist");
  const note = el("p", "st-note", "Send a message: LangChain's own steps show here, from a second run of the chain.");
  panel.append(el("p", "st-label", "🔍 Inside chain.invoke(): LangChain's steps, from the recorded run (a separate run, " +
    "not part of the total above)"), bar, list, note);
  /** One row: colour swatch, name, (no place), time, share. */
  const row = (cls, name, time, share) => {
    const li = el("li", cls);
    li.append(el("i"), el("span", "nm", name), el("small", "wh", ""), el("b", "", time), el("small", "pc", share));
    return li;
  };
  return {
    el: panel,
    /**
     * @param {{rows: {name: string, ms: number}[], total: number} | null} split recordedSplit()'s result.
     * @param {number} invokeMs How long the real chain.invoke() took.
     */
    show(split, invokeMs) {
      if (!split) {
        bar.replaceChildren(); list.replaceChildren();
        note.textContent = "LangChain didn't report every step this time, so there's no split to show.";
        return;
      }
      const share = (ms) => (split.total > 0 ? `${Math.round((100 * ms) / split.total)}%` : "");
      // Shares of the bar, as in town.js's timingPanel: raw times adding up to under 1 ms would leave it part-empty.
      const sum = split.rows.reduce((a, r) => a + Math.max(0, r.ms), 0);
      bar.replaceChildren(...split.rows.map((r) => {
        const slice = el("span", "browser");
        slice.style.flexGrow = String(sum > 0 ? (1000 * Math.max(0, r.ms)) / sum : 1);
        slice.title = `${r.name}: ${fmt(r.ms, step)}`;
        return slice;
      }));
      list.replaceChildren(...split.rows.map((r) => row("browser", r.name, fmt(r.ms, step), share(r.ms))),
        row("total", "The recorded run, in all: from calling streamEvents() to its last event", fmt(split.total, step), ""));
      const slower = split.total > invokeMs;
      note.textContent = "A second run of the same chain, with streamEvents(), made after your reply was drawn so the street " +
        `view and the diagram can show each step. It took ${fmt(split.total, step)}, against ${fmt(invokeMs, step)} for the ` +
        `real chain.invoke() above${slower ? ": reporting every step costs time" : ""}. Each part is the time between ` +
        "LangChain's events as this page received them, so it includes LangChain's own reporting work, not just agent.js's functions.";
    },
  };
}

// ---------- Following the real run ----------

const messages = new WeakMap();                 // each message's times, by its submit event: two can be in flight at once
let current = null;                             // the message the street view shows: the newest reply, as in the diagram
let lastTrip = null;                            // the last message that was played, for Replay
let firstSend = null;                           // the first message's submit time, for the request counter
const step = clockStep();                       // how far apart this browser's clock ticks, in ms
// index.html loads this file with the chat's own code, so a street view that can't be drawn (say, an older /lib/town.js
// without timingPanel) must not stop the chat: it says so in the console and stays out of the way.
let scene = null;
try { scene = build(); } catch (err) { console.error("The street view couldn't be drawn; the chat works without it.", err); }

/** onSend(e) started (index.html calls this right after e.preventDefault()): the submit event's own timestamp, and the time now. */
function start(e) {
  if (!scene) return;                           // no street view: nothing to time or show (mark and reply find no message)
  const msg = { marks: { sent: e.timeStamp, onSend: performance.now() }, drewBetween: false };
  messages.set(e, msg);
  firstSend ??= msg.marks.sent;
}

/**
 * One of index.html's moments for the message submitted with `e`: "invoke" (chain.invoke() called), "resolved" (it
 * returned), "added" (onSend(e) done). Each message keeps its own, so two in flight at once never mix their times.
 */
function mark(e, name) {
  const msg = messages.get(e);
  if (!msg) return;
  msg.marks[name] = performance.now();
  // If the browser's next frame comes before the reply is on the page, it came while chain.invoke() was running (the
  // only place onSend(e) waits), so it drew your bubble on its own.
  if (name === "invoke") requestAnimationFrame(() => { msg.drewBetween = msg.marks.added == null; });
}

/** Resolves at the start of the browser's next frame, the one that draws the reply, and notes it as msg's "frame". */
function nextFrame(msg) {
  return new Promise((resolve) => requestAnimationFrame(() => { msg.marks.frame = performance.now(); resolve(); }));
}

/**
 * The reply is on the page (index.html calls this last). Waits for the frame that draws it, shows where the time went,
 * then waits for the recorded run and plays the trip. Only the newest reply is shown, as in the diagram.
 * @param {Event} e The message's submit event.
 * @param {string} text What the user typed.
 * @param {{reply: string, rule: string}} result What chain.invoke() returned.
 * @param {Promise<object>} recording record.js's recording of this message.
 */
async function reply(e, text, result, recording) {
  const msg = messages.get(e);
  if (!msg || msg.marks.added == null) return;
  current = msg;
  Object.assign(msg, { text, result });
  await Promise.race([nextFrame(msg), pause(1000)]);        // a hidden page draws no frames
  if (current !== msg) return;
  const timed = stages({ marks: msg.marks, bubble: Boolean(text.trim()), drewBetween: msg.drewBetween, step });
  scene.timing.show(timed);
  msg.took = fmt(timed.total, step);
  msg.recording = await recording;
  if (current !== msg) return;
  scene.recorded.show(recordedSplit(msg.recording), msg.marks.resolved - msg.marks.invoke);
  lastTrip = msg;
  run(msg);
}

// ---------- The replay ----------

/** Plays one message's trip from its recorded events (live, or again with Replay). */
async function run(msg) {
  const st = scene, { car, lane, center, gateArm, rules } = st;
  const trip = tripFor(msg.text, msg.result, msg.recording, msg.took);
  st.ui.replay.disabled = false;
  const tw = st.play.begin();
  const boomTo = (to) => { const from = gateArm.deg; return tw.tween(450, (e) => gateArm(from + (to - from) * e)); };
  const leg = (i) => { st.stop(i, trip.legs[i].stop); st.say(trip.legs[i].say); st.outside.update(); };
  try {
    st.reset();
    leg(0); car.carry(trip.typed, "you"); await tw.wait(1000);
    await car.drive(tw, st.sOut(STOP.gate)); leg(1); await boomTo(80); await tw.wait(400);
    await car.drive(tw, st.sOut(STOP.depot)); leg(2); await tw.wait(1400);
    await car.drive(tw, st.sOut(STOP.normalize)); leg(3); await tw.wait(1000);
    car.carry(trip.trimmed, "you"); await tw.wait(1100);
    await car.drive(tw, st.sOut(STOP.rules)); leg(4); st.busy(true);
    for (let i = 0; i < trip.board.length; i++) {
      const state = trip.board[i];
      rules.set(i, state === "skip" ? "skip" : "check"); if (state === "skip") continue;
      await tw.wait(450); rules.set(i, state);
    }
    car.carry(trip.carried, "bot"); await tw.wait(1300); st.busy(false);
    // Round the turning circle at the end of the road and back along the far lane.
    await car.drive(tw, lane.out.total);
    const back = lane.turnAt(center.p.length - 1, 6);
    car.place(back.path, 0);
    await car.drive(tw, back.sAt(...STOP.depot)); leg(5); await tw.wait(1200);
    leg(6); car.carry(trip.said, "bot"); await tw.wait(1200);
    await car.drive(tw, back.sAt(...STOP.house)); leg(7); await boomTo(0);
    tw.alive(); st.track.finish();
  } catch (err) {
    if (err !== t.STOPPED) throw err;
  }
}

export const street = { start, mark, reply };
