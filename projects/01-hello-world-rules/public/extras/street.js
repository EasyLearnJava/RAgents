/**
 * EXTRA: a teaching aid, not part of the agent.
 *
 * "Street view" of what happens when you press Send. Your message rides in a black sports car along a winding
 * road from your house (the chat), through the form's gate (the submit event), to the index.html depot (onSend)
 * and on to the agent.js factory (respond), which checks the rules and loads the reply for the trip back. It's
 * the same sequence as the box diagram in diagram.js, slowed right down: for real, respond() usually takes less time
 * than the browser's clock can measure, and the reply is drawn within about a frame (16.7 ms on a 60 Hz screen).
 *
 * The town is drawn inside a browser window, with the server outside it, because that's the point of step 1:
 * once the page has loaded, everything runs in your browser tab and nothing goes to a server. The server panel
 * counts the page's real network requests (Resource Timing) since your first message, so you can see it stay at 0.
 *
 * Under the tracker, "Where the time went" shows the real time of each stage (the sums are in timing.js): the times
 * index.html notes on its EXTRA lines, plus the next frame, which showStreet() times before it starts the replay (so
 * the replay's own drawing isn't counted).
 *
 * Drawn with the shared toolkit /lib/town.js (plain SVG, no library). index.html calls showStreet(text, reply, marks)
 * after each reply; delete its EXTRA lines and nothing else changes.
 */
import { PATH, ruleFromReply } from "./diagram.js";
import { clockStep, formatter, stages, tooQuick } from "./timing.js";

// ---------- The trip (pure: no page needed, so test/extras.test.js can check it) ----------

/** Quotes text for a label, shortened to `max` characters. */
const quote = (s, max) => `“${s.length > max ? s.slice(0, max - 1) + "…" : s}”`;

/**
 * Plans one message's trip: which rule fired, what the car carries each way, the rule checks the factory
 * shows, and the narration for each of the seven stops on the tracker.
 * @param {string} text What the user typed.
 * @param {string} reply What respond() returned.
 * @param {{respond: string, total: string}} [real] The real times, ready to show: respond() alone (or "too quick for
 *   your browser's clock to measure"), and from Send until the browser drew the reply ("Where the time went"). Without
 *   them the narration gives no times.
 */
export function tripFor(text, reply, real) {
  const rule = ruleFromReply(reply);
  const raw = String(text ?? "");
  const typed = quote(raw.trim() || raw, 24);    // a blank message is quoted as it is: “” or “   ”
  const said = quote(reply, 34);
  // respond() checks the rules in order and stops at the first "yes".
  const checks = { empty: ["yes"], greeting: ["no", "yes"], fallback: ["no", "no", "yes"] }[rule];
  // respond() gives the hint only for a blank message: nothing typed, or only spaces (text.trim() leaves nothing).
  const blank = rule === "empty" ? (raw ? "only spaces" : "nothing") : "";
  const legs = [
    { stop: "house", say: (blank ? `You pressed Send with ${blank} typed.` : `You typed ${typed} and pressed Send.`) +
      " The message gets into the car, which never leaves this browser tab." },
    { stop: "gate", say: 'The browser fires a "submit" event on <form id="form">: the gate opens and onSend(e) starts.' },
    { stop: "depot", say: blank ? `onSend(e) reads input.value: ${blank} typed, so text.trim() is empty and there's no ` +
      `bubble of yours to add. It calls respond(${typed}).`
      : `onSend(e) reads input.value, puts your bubble on the page with add(text, "you"), then calls respond(${typed}).` },
    { stop: "factory", say: `respond() checks the rules in order: ${PATH[rule]}.${real ? ` Real time: ${real.respond}.` : ""}` },
    { stop: "depot", say: `respond() returns ${said} to onSend(e).` },
    { stop: "depot", say: 'onSend(e) calls add(reply, "bot"): a new <div class="msg bot"> goes on the page.' },
    { stop: "house", say: `You see ${said}.${real ? ` Real time from Send until the browser drew it: ${real.total}.` : ""} ` +
      "Nothing went to a server." },
  ];
  return { rule, typed, said, checks, legs };
}

/** The tracker under the scene: one entry per leg of the trip. */
const TRACK = [
  ["Typed", "You"], ["Submit", "<form>"], ["onSend(e)", "index.html"], ["respond()", "agent.js"],
  ["Returned", "to onSend(e)"], ["add(reply)", "index.html"], ["Shown", "You"],
];

/** The rules respond() checks, in order (the factory's board). */
const RULES = ['text === ""', "GREETING.test(text)", "else: fallback"];

// ---------- The town ----------

/** The road's centre line: a gentle S from your house to a turning circle past the factory. */
const ROAD = [[-6, 45], [6, 45], [20, 46], [32, 50], [46, 50], [58, 46], [70, 44], [84, 46], [96, 48]];
/** Where the car stops (points on the road; the lane is found from them). */
const STOP = { house: [8, 45], gate: [16.5, 45.8], depot: [42, 50], factory: [73, 44.5] };

let town = null;                                 // /lib/town.js, loaded in the browser only
let scene = null;                                // built once
let last = null;                                 // the last [text, reply, real times], for Replay
let firstSend = null;                            // performance.now() of the first message, for the request counter

/** Builds the card, the town and the tracker, and returns the handles the replay needs. */
function build(t) {
  const { svg, box, house, depot, factory, chimney, tree, lamp, road, curve, lanes, depthLayer, pin, boom, board, vehicle,
    tracker, card, browserWindow, el, paneY } = t;
  t.ensureStyles();
  const ui = card("Street view: your message's trip, inside your browser",
    "The car carries your message to agent.js and brings the reply back, stopping where each function runs. " +
    "The road is your computer's memory, not the internet: the server sent this page once, and after that nothing goes to it. " +
    "Slowed right down so you can follow it: the real times are under the tracker, in \"Where the time went\".",
    "Street view of one message's trip");

  const root = svg("svg", { class: "st-scene", viewBox: "-580 -70 1380 800", role: "img",
    "aria-label": "An isometric town: your house, the form's gate, the index.html depot and the agent.js factory along one winding road" });

  // Ground, road, then everything that stands up, kept in back-to-front order.
  box(root, [-8, 14, -2.5], [118, 48, 2.5], "slab");
  const center = curve(ROAD), lane = lanes(center);
  road(root, center, { capEnd: true });
  const depth = depthLayer(root);
  const top = svg("g", {}, root);
  const tags = svg("g");                            // the car's tag goes over everything, labels included
  const b = {};
  b.house = depth.add(house(depth.layer, 2, 20), 34);
  b.gate = svg("g", { class: "st-bldg" }, depth.layer);
  box(b.gate, [21, 33.6, 0], [4, 3.6, 5.4], "booth");
  box(b.gate, [20.6, 33.2, 5.4], [4.8, 4.4, 0.8], "wall");
  paneY(b.gate, 21.6, 24.4, 37.2, 2.4, 4.6);
  box(b.gate, [23.2, 37.4, 0], [0.6, 0.6, 4.6], "booth");
  const gateArm = boom(b.gate, [23.5, 37.7, 4.2], [0, 1], 17);
  depth.add(b.gate, 58);
  b.depot = depth.add(depot(depth.layer, [32, 18], [20, 16, 10]), 68);
  b.factory = depth.add(factory(depth.layer, [62, 18], [22, 16, 9]), 99);
  const smoke = depth.add(chimney(depth.layer, 86.2, 20.5, 21), 109);
  for (const [x, y] of [[17, 24], [18, 31], [28, 27], [56, 23], [57, 31], [93, 27]]) depth.add(tree(depth.layer, x, y), x + y);
  for (const [x, y] of [[29, 38], [57, 36], [90, 36.5]]) depth.add(lamp(depth.layer, x, y), x + y);
  for (const [x, y] of [[3, 57], [28, 59.5], [55, 58], [76, 57]]) depth.add(tree(depth.layer, x, y), x + y);
  const car = vehicle(depth, tags);

  const pins = {
    // <form id="form"> is raised clear of the reply's tag, which would cover it once the car is parked at your house.
    // That puts it over the house, so "You" points at the roof's front-left corner and is raised above it: its line
    // then runs beside the <form> label instead of under it.
    house: pin(top, [1.5, 32.6, 7.6], "You", "the chat page", 1, 40),
    gate: pin(top, [23, 35.4, 6.4], '<form id="form">', '"submit" event', 1, 66),
    depot: pin(top, [44, 24, 10.2], "index.html", "onSend(e) · add()"),
    factory: pin(top, [70, 25, 12.8], "agent.js", "respond(message)"),
  };
  const rules = board(top, [436, -60], "agent.js checks, in order", RULES);
  root.append(tags);
  const legend = svg("g", { class: "st-legend", transform: "translate(-560 560)" }, top);
  t.label(legend, 0, 0, "→ near lane: your message", "lg you", "start", 22);
  t.label(legend, 0, 36, "← far lane: the reply", "lg bot", "start", 22);

  // Tracker, narration, and the browser window with the server outside it.
  const track = tracker(TRACK);
  const world = el("div", "st-world");
  const net = el("div", "st-net");
  const server = el("div", "st-server");
  const rack = svg("svg", { viewBox: "0 0 60 64", class: "st-rack", "aria-hidden": "true" });
  for (let i = 0; i < 3; i++) { svg("rect", { x: 4, y: 4 + i * 20, width: 52, height: 16, rx: 4 }, rack); svg("circle", { cx: 14, cy: 12 + i * 20, r: 3 }, rack); }
  const count = el("p", "st-count", "Send a message, then watch this stay at 0.");
  server.append(rack, el("b", "", "Server (Vercel or Firebase Hosting)"),
    el("p", "", "Sent the page's files once, over HTTPS, when you opened it: index.html, agent.js, style.css and the " +
      "extras' scripts."),
    el("p", "st-label", "Network requests since your first message"), count,
    el("p", "", "Your messages never come here. Try it: turn off Wi-Fi and the agent still answers."));
  net.append(el("div", "st-zone", "Outside your computer"), el("div", "st-wire", "the internet: used once, to download the page"), server);
  world.append(browserWindow(root, "Hello World Agent",
    "Everything inside this window runs in your browser tab, on your computer. Nothing here is sent anywhere."), net);

  // Under the tracker: where the time really went for your last message (the sums are in timing.js).
  // How finely this browser's clock measures: 0.1 ms in Chrome and Edge. 0 if it never moved while it was read: then
  // the panel says it can't time the stages, rather than show numbers it can't stand behind.
  const step = clockStep(() => performance.now());
  const fmt = formatter(step);
  const timing = t.timingPanel({ fmt, where: { browser: "your browser" },
    hint: step ? "Send a message: each stage's real time shows here, measured by your browser's own clock."
      : "Your browser's clock didn't move while this page measured it, so it can't time the stages of a message.",
    measured: "Measured by your browser's own clock (performance.now())." });
  ui.card.append(world, track.el, ui.now, timing.el);
  document.body.append(ui.card);       // style.css gives it its own row under the chat

  const sOut = (p) => lane.sOut(...p);
  const st = {
    car, lane, center, gateArm, rules, track, step,
    /** Highlights the building (and its pin) where the car is, and the tracker up to step i. */
    stop(i, where) {
      for (const [k, g] of Object.entries(b)) g.classList.toggle("on", k === where);
      for (const [k, p] of Object.entries(pins)) p.classList.toggle("on", k === where);
      track.set(i);
    },
    say(text) { ui.now.textContent = text; },
    /**
     * Shows "Where the time went" for one message (what stages() in timing.js returns) and returns respond()'s time
     * and the total, ready for the narration.
     * @returns {{respond: string, total: string}}
     */
    times(r) {
      timing.show(r);
      const agent = r.rows.find((row) => row.key === "respond").ms;
      return { respond: tooQuick(agent, step) ? "too quick for your browser's clock to measure" : fmt(agent),
        total: fmt(r.total) };
    },
    requests(since) {
      const n = t.requestsSince(since).length;
      count.textContent = String(n);
      count.classList.toggle("zero", n === 0);
    },
    busy(on) { root.classList.toggle("busy", on); smoke.classList.toggle("busy", on); },
    reset() {
      car.place(lane.out, sOut(STOP.house)); car.carry("", "you"); gateArm(0); st.busy(false); st.stop(-1, null); rules.reset();
    },
    sOut, ui,
  };
  st.reset();
  const play = t.player();
  st.play = play;
  ui.replay.addEventListener("click", () => { if (last) run(...last); });
  ui.pace.addEventListener("click", () => { ui.pace.textContent = play.cycle(); });
  return st;
}

// ---------- The replay ----------

/**
 * The next frame, timed: when the browser starts it (requestAnimationFrame callbacks run first in a frame) and when
 * it has drawn it (a setTimeout from there runs once the frame's style, layout and paint are done). The screen shows
 * it at its next refresh or so: that isn't timed.
 * @returns {Promise<{frame: number, drawn: number}>} performance.now() at both.
 */
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => {
  const frame = performance.now();
  setTimeout(() => resolve({ frame, drawn: performance.now() }));
}));

/**
 * Shows one message: its real times under the tracker, then its trip as a car ride. index.html calls this after
 * showing the reply.
 * @param {string} text What the user typed.
 * @param {string} reply What respond() returned.
 * @param {{submit: number, onSend: number, respond: number, returned: number, added: number}} [marks] The times
 *   index.html noted (performance.now()); this adds the next frame's. Without them, or without a clock step to read
 *   them by, there are no real times.
 */
export async function showStreet(text, reply, marks) {
  const frame = marks ? nextFrame() : null;        // time the frame that draws the reply: ask for it straight away,
  scene?.play.begin();                             // and stop the last replay, so its drawing isn't counted in it
  firstSend ??= marks?.submit ?? performance.now();
  await ready;
  if (!scene) return;
  let real = null;
  if (marks && scene.step) {
    Object.assign(marks, await frame);
    real = scene.times(stages({ marks, now: performance.now(), step: scene.step, empty: !String(text ?? "").trim(),
      requests: town.requestsSince(marks.submit).length }));
  }
  last = [text, reply, real];
  run(text, reply, real);
}

/**
 * Plays one message's trip with the car (Replay plays it again).
 * @param {string} text What the user typed.
 * @param {string} reply What respond() returned.
 * @param {{respond: string, total: string}|null} real Its real times for the narration (see tripFor()).
 */
async function run(text, reply, real) {
  const st = scene, { car, lane, center, gateArm } = st;
  st.ui.replay.disabled = false;
  const tw = st.play.begin();
  const boomTo = (to) => { const from = gateArm.deg; return tw.tween(450, (e) => gateArm(from + (to - from) * e)); };

  const trip = tripFor(text, reply, real);
  const leg = (i) => { st.stop(i, trip.legs[i].stop); st.say(trip.legs[i].say); st.requests(firstSend); };
  try {
    st.reset();
    leg(0); car.carry(trip.typed, "you"); await tw.wait(1000);
    await car.drive(tw, st.sOut(STOP.gate)); leg(1); await boomTo(80); await tw.wait(400);
    await car.drive(tw, st.sOut(STOP.depot)); leg(2); await tw.wait(1300);
    await car.drive(tw, st.sOut(STOP.factory)); leg(3); st.busy(true);
    for (let i = 0; i < RULES.length; i++) {
      const result = trip.checks[i];
      st.rules.set(i, result ? "check" : "skip"); if (!result) continue;
      await tw.wait(450); st.rules.set(i, result);
    }
    car.carry(trip.said, "bot"); await tw.wait(1100); st.busy(false);
    // Round the turning circle at the end of the road and back along the far lane.
    await car.drive(tw, lane.out.total);
    const back = lane.turnAt(center.p.length - 1, 6);
    car.place(back.path, 0);
    await car.drive(tw, back.sAt(...STOP.depot)); leg(4); await tw.wait(900);
    leg(5); await tw.wait(1200);
    await car.drive(tw, back.sAt(...STOP.house)); leg(6); await boomTo(0);
    tw.alive(); st.track.finish();
  } catch (err) {
    if (err !== town?.STOPPED) throw err;
  }
}

// Draw it as soon as the page loads (only in a browser; the tests import tripFor() without a page).
// The toolkit is loaded here rather than imported at the top, because its /lib path only exists on the site.
const ready = typeof document === "undefined" ? Promise.resolve()
  : import("/lib/town.js").then((t) => { town = t; scene = build(t); });
