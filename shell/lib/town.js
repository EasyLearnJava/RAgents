/**
 * town.js: the isometric "street view" toolkit shared by every step (flow.js is the box diagram's).
 *
 * A step's extras/street.js lays out its own town with these pieces: ground slabs, curved roads, buildings,
 * trees, lamps, map-pin labels, a car that carries the message along the road (with a tag showing what it
 * carries), a rule board, a tracker and a narration line.
 *
 * Coordinates are world units: x and y on the ground, z up; iso() turns them into screen units. Roads are
 * smooth curves through a few points; the car follows a lane (the road's centre line shifted sideways), turns
 * its body with the road, and speeds up and slows down between stops.
 *
 * Everything is plain SVG built with createElementNS, and all text goes in with textContent, never innerHTML.
 * Served at /lib/town.js (scripts/build.mjs copies shell/ to the site root).
 */

const NS = "http://www.w3.org/2000/svg";

/** Screen units per world unit. */
export const K = 8;

/** World (x, y, z) → screen [x, y]. Classic 2:1 isometric: x runs down-right, y down-left, z up. */
export const iso = (x, y, z = 0) => [(x - y) * K, (x + y) * K / 2 - z * K];

/** World points → an SVG "points" attribute. */
export const pts = (...ps) => ps.map((p) => iso(...p).map((n) => n.toFixed(1)).join(",")).join(" ");

/** Creates an SVG element with attributes, optionally appended to `parent`. */
export function svg(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent?.append(e);
  return e;
}

/** Creates an HTML element with an optional class and text. */
export function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Adds an SVG text element (textContent only). `size` sets the font size in screen units. */
export function label(parent, x, y, text, cls, anchor = "middle", size) {
  const t = svg("text", { x, y, class: cls, "text-anchor": anchor }, parent);
  if (size) t.style.fontSize = `${size}px`;
  t.textContent = text;
  return t;
}

/** A solid box: the three faces you can see (top, the +y side, the +x side), shaded light to dark. */
export function box(parent, [x0, y0, z0], [dx, dy, dz], mat) {
  const [x1, y1, z1] = [x0 + dx, y0 + dy, z0 + dz];
  const g = svg("g", { class: "st-" + mat }, parent);
  svg("polygon", { class: "t", points: pts([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]) }, g);
  svg("polygon", { class: "l", points: pts([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]) }, g);
  svg("polygon", { class: "r", points: pts([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]) }, g);
  return g;
}

/** A window or door on a +y face (fixed y) or a +x face (fixed x). */
export const paneY = (g, x0, x1, y, z0, z1, cls = "st-win") => svg("polygon", { class: cls, points: pts([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]) }, g);
export const paneX = (g, x, y0, y1, z0, z1, cls = "st-win") => svg("polygon", { class: cls, points: pts([x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]) }, g);

/**
 * A group that draws flat on the ground: inside it, a point (u, v) is world (x + u / K, y + v / K).
 * Paths, circles and text drawn in it lie on the ground in perspective.
 */
export const ground = (parent, x = 0, y = 0, z = 0) => {
  const [ox, oy] = iso(x, y, z);
  return svg("g", { transform: `matrix(1 0.5 -1 0.5 ${ox.toFixed(1)} ${oy.toFixed(1)})` }, parent);
};

/** Text painted on the ground at world (x, y), running along +x. */
export function paint(parent, x, y, text, size, cls = "st-paint", anchor = "start") {
  return label(ground(parent, x, y), 0, 0, text, cls, anchor, size);
}

// ---------- Curves, lanes and roads ----------

/**
 * A polyline with arc length: at(s) gives the point and heading (radians) s units along it.
 * @param {number[][]} p [[x, y], ...]
 */
export function polyline(p) {
  const len = [0];
  for (let i = 1; i < p.length; i++) len.push(len[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
  const total = len[len.length - 1];
  return {
    p, len, total,
    at(s) {
      s = Math.max(0, Math.min(total, s));
      let lo = 0, hi = len.length - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (len[mid] <= s) lo = mid; else hi = mid; }
      const f = len[hi] === len[lo] ? 0 : (s - len[lo]) / (len[hi] - len[lo]);
      const [ax, ay] = p[lo], [bx, by] = p[hi];
      return { x: ax + (bx - ax) * f, y: ay + (by - ay) * f, a: Math.atan2(by - ay, bx - ax) };
    },
    /** Index of the point nearest to (x, y). */
    nearest(x, y) {
      let best = 0, bd = Infinity;
      p.forEach(([px, py], i) => { const d = (px - x) ** 2 + (py - y) ** 2; if (d < bd) { bd = d; best = i; } });
      return best;
    },
  };
}

/** A smooth curve through the control points (Catmull-Rom), sampled about every `step` units. */
export function curve(points, step = 0.6) {
  const P = [points[0], ...points, points[points.length - 1]];
  const out = [];
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(points[points.length - 1]);
  return polyline(out);
}

/** The same curve shifted sideways by d (positive = to the left of the direction of travel). */
function offset(line, d) {
  const { p } = line;
  return polyline(p.map(([x, y], i) => {
    const [ax, ay] = p[Math.max(0, i - 1)], [bx, by] = p[Math.min(p.length - 1, i + 1)];
    const l = Math.hypot(bx - ax, by - ay) || 1;
    return [x - ((by - ay) / l) * d, y + ((bx - ax) / l) * d];
  }));
}

/**
 * The two lanes of a road with centre line `center`: out (to the left of the centre, driven forwards) and
 * back (to the right, driven backwards to the start). turnAt(i) builds the way back from centre point i:
 * a smooth U-turn, then the back lane to the start; sOf(j) is how far along it back-lane point j is.
 */
export function lanes(center, d = 3.5) {
  const out = offset(center, d), back = offset(center, -d);
  return {
    center, out, back,
    /** Distance along the out lane of the centre point nearest to (x, y). */
    sOut: (x, y) => out.len[center.nearest(x, y)],
    turnAt(i, bulge = 4.5) {
      const [cx, cy] = center.p[i], { a } = center.at(center.len[i]);
      const [fx, fy, nx, ny] = [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a)];
      const arc = [];
      for (let k = 0; k <= 28; k++) {
        const t = (k / 28) * Math.PI;
        arc.push([cx + nx * d * Math.cos(t) + fx * bulge * Math.sin(t), cy + ny * d * Math.cos(t) + fy * bulge * Math.sin(t)]);
      }
      const path = polyline([...arc, ...back.p.slice(0, i).reverse()]);
      const arcLen = path.len[28];
      return { path, sOf: (j) => arcLen + back.len[i] - back.len[j], sAt: (x, y) => arcLen + back.len[i] - back.len[center.nearest(x, y)] };
    },
  };
}

/** Draws a road along `center` (width 14): pavement, edge lines, asphalt and a dashed centre line. */
export function road(parent, center, { capEnd = false } = {}) {
  const g = ground(parent);
  const d = "M" + center.p.map(([x, y]) => `${(x * K).toFixed(1)} ${(y * K).toFixed(1)}`).join(" L");
  const [ex, ey] = center.p[center.p.length - 1];
  const band = (cls, w) => {
    svg("path", { d, class: cls, "stroke-width": w * K }, g);
    if (capEnd) svg("circle", { cx: ex * K, cy: ey * K, r: (w / 2 + 3) * K, class: cls + "-cap" }, g);
  };
  band("st-walkway", 18); band("st-edgeband", 14); band("st-asphalt", 13);
  svg("path", { d, class: "st-centre", "stroke-width": 0.35 * K, "stroke-dasharray": `${2.6 * K} ${2.2 * K}` }, g);
  return g;
}

// ---------- Scenery ----------

/** A round tree: trunk and two-tone crown. Returns its group (give it to a depth layer). */
export function tree(parent, x, y, size = 1) {
  const g = svg("g", { class: "st-tree" }, parent);
  const [bx, by] = iso(x, y, 0), [cx, cy] = iso(x, y, 4.6 * size);
  svg("ellipse", { class: "shadow", cx: bx, cy: by, rx: 16 * size, ry: 8 * size }, g);
  svg("line", { x1: bx, y1: by, x2: bx, y2: cy + 8 }, g);
  svg("circle", { cx, cy, r: 19 * size }, g);
  svg("circle", { class: "hi", cx: cx - 6 * size, cy: cy - 6 * size, r: 8 * size }, g);
  return g;
}

/** A street lamp. */
export function lamp(parent, x, y) {
  const g = svg("g", { class: "st-lamp" }, parent);
  const [bx, by] = iso(x, y, 0), [tx, ty] = iso(x, y, 7.5);
  svg("line", { x1: bx, y1: by, x2: tx, y2: ty }, g);
  svg("circle", { cx: tx, cy: ty, r: 5 }, g);
  return g;
}

/**
 * A layer that keeps its children in back-to-front order by depth (x + y: bigger is nearer to you), so the
 * car passes in front of and behind buildings correctly. add() static things; move() the car every frame.
 */
export function depthLayer(parent) {
  const layer = svg("g", {}, parent);
  const items = [];
  const insert = (node, depth) => {
    const i = items.findIndex((it) => it.depth > depth);
    if (i < 0) { items.push({ node, depth }); layer.append(node); }
    else { items.splice(i, 0, { node, depth }); layer.insertBefore(node, items[i + 1].node); }
  };
  return {
    layer,
    add(node, depth) { insert(node, depth); return node; },
    move(node, depth) {
      const i = items.findIndex((it) => it.node === node);
      if (i >= 0 && items[i].depth === depth) return;
      if (i >= 0) items.splice(i, 1);
      insert(node, depth);
    },
  };
}

/**
 * A map-pin label above a building: title + subtitle, screen-aligned so it stays readable.
 * `s` scales it (bigger scenes are drawn smaller, so they need bigger labels); `rise` lifts the label higher (to keep
 * neighbours apart). Toggle the "on" class to highlight.
 */
export function pin(parent, at, title, sub, s = 1, rise = 0) {
  const [ax, ay] = iso(...at);
  const g = svg("g", { class: "st-pin" }, parent);
  const w = (Math.max(title.length * 14, sub.length * 10.6) + 32) * s, h = 70 * s, top = ay - (22 + rise) * s - h;
  svg("line", { x1: ax, y1: ay, x2: ax, y2: top + h }, g);
  svg("circle", { cx: ax, cy: ay, r: 5 * s }, g);
  svg("rect", { x: ax - w / 2, y: top, width: w, height: h, rx: 13 * s }, g);
  label(g, ax, top + 31 * s, title, "tt", "middle", 23 * s);
  label(g, ax, top + 56 * s, sub, "ts", "middle", 18 * s);
  return g;
}

/** A big screen-aligned zone title with a subtitle, e.g. "YOUR BROWSER TAB". */
export function banner(parent, x, y, title, sub, size = 40) {
  const g = svg("g", { class: "st-banner" }, parent);
  label(g, x, y, title, "bt", "start", size);
  if (sub) label(g, x, y + size * 0.95, sub, "bs", "start", size * 0.55);
  return g;
}

// ---------- The car ----------

const CAR = 1.25;                                 // the car is drawn at this scale

/** Draws a convex solid: only the faces turned towards you (outward normal · (1, 1, 1) > 0, the view direction). */
function solid(parent, faces) {
  for (const { p, n, cls } of faces) if (n[0] + n[1] + n[2] > 0.01) svg("polygon", { class: cls, points: pts(...p) }, parent);
}

/**
 * Draws the black sports car (a fastback with two racing stripes) into `g` at world (x, y), facing angle `a`
 * (radians; 0 = +x). Only the faces turned towards you are drawn, so the same code draws it from any side.
 */
function drawCar(g, x, y, a, lift = 0) {
  g.replaceChildren();
  const [c, s] = [Math.cos(a), Math.sin(a)];
  const R = (u, v) => [u * c - v * s, u * s + v * c];                      // car's own axes → world
  const P = (u, v, z) => { const [wx, wy] = R(u * CAR, v * CAR); return [x + wx, y + wy, z * CAR + lift]; };
  const quad = (A, B, C, D, n, cls) => ({ p: [P(...A), P(...B), P(...C), P(...D)], n: [...R(n[0], n[1]), n[2]], cls });
  const facing = (nu, nv) => { const [wx, wy] = R(nu, nv); return wx + wy > 0.01; };
  const [L, W, z0, z1] = [4, 1.8, 0.55, 1.75];            // body: half-length, half-width, bottom, top
  svg("polygon", { class: "st-shadow", points: pts(P(-L - 0.3, -W - 0.3, -lift / CAR), P(L + 0.3, -W - 0.3, -lift / CAR), P(L + 0.3, W + 0.3, -lift / CAR), P(-L - 0.3, W + 0.3, -lift / CAR)) }, g);
  // Wheels on the far side first (the body covers them), then the body.
  const wheels = (v) => { for (const u of [-2.6, 2.6]) {
    const [cx, cy] = iso(...P(u, v, 0.7));
    svg("circle", { class: "st-wheel", cx, cy, r: 6.4 * CAR }, g);
    svg("circle", { class: "st-hub", cx, cy, r: 2.6 * CAR }, g);
  } };
  const near = facing(0, 1) ? W : -W;
  wheels(-near);
  solid(g, [
    quad([-L, -W, z1], [L, -W, z1], [L, W, z1], [-L, W, z1], [0, 0, 1], "t"),
    quad([-L, W, z0], [L, W, z0], [L, W, z1], [-L, W, z1], [0, 1, 0], "l"),
    quad([-L, -W, z0], [L, -W, z0], [L, -W, z1], [-L, -W, z1], [0, -1, 0], "l"),
    quad([L, -W, z0], [L, W, z0], [L, W, z1], [L, -W, z1], [1, 0, 0], "r"),
    quad([-L, -W, z0], [-L, W, z0], [-L, W, z1], [-L, -W, z1], [-1, 0, 0], "r"),
  ]);
  // Stripes on the hood and the trunk: the far one before the cabin (so the cabin can cover it), the near one after.
  const stripes = ([u0, u1], z) => [[-0.75, -0.3], [0.3, 0.75]].forEach(([v0, v1]) =>
    svg("polygon", { class: "st-stripe", points: pts(P(u0, v0, z), P(u1, v0, z), P(u1, v1, z), P(u0, v1, z)) }, g));
  const hood = [1.25, L - 0.1], trunk = [-L + 0.1, -2.45];
  const frontNear = facing(1, 0);
  stripes(frontNear ? trunk : hood, z1 + 0.01);
  const [cb0, cb1, cr0, cr1, zr] = [-2.45, 1.25, -1.5, 0.15, 2.85];   // cabin: base and roof range, roof height
  solid(g, [
    quad([cr0, -1.35, zr], [cr1, -1.35, zr], [cr1, 1.35, zr], [cr0, 1.35, zr], [0, 0, 1], "t"),
    quad([cb1, -1.6, z1], [cb1, 1.6, z1], [cr1, 1.35, zr], [cr1, -1.35, zr], [1.1, 0, 1.1], "gl"),     // windscreen
    quad([cb0, -1.6, z1], [cb0, 1.6, z1], [cr0, 1.35, zr], [cr0, -1.35, zr], [-1.1, 0, 0.9], "gl"),    // rear window
    quad([cb0, 1.6, z1], [cb1, 1.6, z1], [cr1, 1.35, zr], [cr0, 1.35, zr], [0, 1, 0.2], "gl"),         // side windows
    quad([cb0, -1.6, z1], [cb1, -1.6, z1], [cr1, -1.35, zr], [cr0, -1.35, zr], [0, -1, 0.2], "gl"),
  ]);
  stripes([cr0, cr1], zr + 0.01);
  stripes(frontNear ? hood : trunk, z1 + 0.01);
  // Headlights at the front, red tail lights at the back (whichever end faces you), then the near wheels.
  const lights = (u, cls) => [[-1.45, -0.8], [0.8, 1.45]].forEach(([v0, v1]) =>
    svg("polygon", { class: cls, points: pts(P(u, v0, 1.05), P(u, v1, 1.05), P(u, v1, 1.45), P(u, v0, 1.45)) }, g));
  if (frontNear) lights(L, "st-headlight");
  if (facing(-1, 0)) lights(-L, "st-taillight");
  wheels(near);
}

/** A tag (rounded label) that floats above a moving thing. kind: "you", "bot", "lock", "err", "ok", "key"; "" text hides it. */
export function makeTag(parent, s = 1) {
  const g = svg("g", { class: "st-tag" }, parent);
  const rect = svg("rect", { height: 40 * s, rx: 12 * s, y: -26 * s }, g);
  const text = label(g, 0, -6 * s, "", "tg", "middle", 20 * s);
  return {
    at(x, y) { g.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`); },
    carry(t, kind = "you") {
      g.style.display = t ? "" : "none";
      text.textContent = t;
      const w = (t.length * 12.4 + 28) * s;
      rect.setAttribute("x", (-w / 2).toFixed(1)); rect.setAttribute("width", w.toFixed(1));
      g.setAttribute("class", "st-tag " + kind);
    },
  };
}

/**
 * The car plus the tag that floats above it. The car lives in a depth layer (so buildings and trees in front
 * cover it); the tag goes on `top`. `s` scales the tag text.
 */
export function vehicle(depth, top, s = 1) {
  const g = svg("g", { class: "st-car" });
  depth.add(g, 0);
  const tag = makeTag(top, s);
  const v = {
    path: null, s: 0,
    /** Puts the car `s` units along `path` (it faces along the path). */
    place(path, s, lift = 0) {
      v.path = path; v.s = s;
      const { x, y, a } = path.at(s);
      // Look a little ahead and behind so the body turns smoothly through bends.
      const p1 = path.at(s - 1.2), p2 = path.at(s + 1.2);
      const heading = Math.hypot(p2.x - p1.x, p2.y - p1.y) > 0.1 ? Math.atan2(p2.y - p1.y, p2.x - p1.x) : a;
      drawCar(g, x, y, heading, lift);
      depth.move(g, x + y + 0.5);
      tag.at(...iso(x, y, 8.5 + lift));
    },
    /** Drives to `s1` along the current path: speeds up, cruises and slows down, like a real car. */
    drive(tw, s1) {
      const s0 = v.s, d = s1 - s0, path = v.path;
      return tw.tween(Math.sqrt(Math.abs(d)) * 150 + Math.abs(d) * 12 + 150, (e, p) => v.place(path, s0 + d * e, Math.abs(Math.sin(p * 40)) * 0.05));
    },
    /** What the car carries. kind: "you" (blue), "bot" (orange), "lock" (encrypted), "err" (red); "" hides it. */
    carry: (text, kind) => tag.carry(text, kind),
  };
  return v;
}

/**
 * A small courier drone that flies errands above the town (e.g. fetching an App Check token), with its shadow on
 * the ground and its own tag. place(x, y, z) moves it; fly() flies it in an arc; hide() parks it out of sight.
 */
export function courier(parent, s = 1) {
  const g = svg("g", { class: "st-drone" }, parent);
  const shadow = svg("ellipse", { class: "shadow", rx: 15 * s, ry: 7 * s }, g);
  const body = svg("g", {}, g);
  for (const [dx, dy] of [[-17, -7], [17, -7], [-17, 7], [17, 7]]) {
    svg("line", { class: "arm", x1: 0, y1: 0, x2: dx * s, y2: dy * s }, body);
    svg("ellipse", { class: "rotor", cx: dx * s, cy: (dy - 4) * s, rx: 11 * s, ry: 3.5 * s }, body);
  }
  svg("rect", { class: "core", x: -11 * s, y: -7 * s, width: 22 * s, height: 13 * s, rx: 5 * s }, body);
  svg("circle", { class: "eye", cx: 0, cy: -1 * s, r: 3 * s }, body);
  const tag = makeTag(parent, s);
  const d = {
    pos: [0, 0, 0],
    place(x, y, z) {
      d.pos = [x, y, z];
      g.style.display = "";
      const [sx, sy] = iso(x, y, 0), [bx, by] = iso(x, y, z);
      shadow.setAttribute("cx", sx.toFixed(1)); shadow.setAttribute("cy", sy.toFixed(1));
      body.setAttribute("transform", `translate(${bx.toFixed(1)} ${by.toFixed(1)})`);
      tag.at(bx, by - 30 * s);
    },
    /** Flies to (x, y, z) in a gentle arc. */
    fly(tw, [x, y, z]) {
      const [x0, y0, z0] = d.pos, dist = Math.hypot(x - x0, y - y0);
      return tw.tween(dist * 22 + 400, (e, p) => d.place(x0 + (x - x0) * e, y0 + (y - y0) * e, z0 + (z - z0) * e + Math.sin(p * Math.PI) * 4));
    },
    carry: (text, kind) => tag.carry(text, kind),
    hide() { g.style.display = "none"; tag.carry(""); },
  };
  d.hide();
  return d;
}

// ---------- Buildings ----------

/** Your house (the chat page): 12 × 12 with a pitched roof, front door facing +y. */
export function house(parent, x0, y0) {
  const g = svg("g", { class: "st-bldg" }, parent);
  box(g, [x0, y0, 0], [12, 12, 8], "wall");
  svg("polygon", { class: "st-roof-front", points: pts([x0 - 0.5, y0 + 12.6, 7.6], [x0 + 12.5, y0 + 12.6, 7.6], [x0 + 12.5, y0 + 6, 12.4], [x0 - 0.5, y0 + 6, 12.4]) }, g);
  svg("polygon", { class: "st-roof-gable", points: pts([x0 + 12, y0, 8], [x0 + 12, y0 + 12, 8], [x0 + 12, y0 + 6, 12]) }, g);
  paneY(g, x0 + 5, x0 + 7.4, y0 + 12, 0, 4.6, "st-door");
  for (const [a, b] of [[1.3, 3.6], [8.6, 10.9]]) paneY(g, x0 + a, x0 + b, y0 + 12, 3.8, 6.2);
  paneX(g, x0 + 12, y0 + 3.5, y0 + 8.5, 3.4, 6);
  return g;
}

/** A plain block with a big door and windows on its +y face (a depot, an office). `mat` is its wall material. */
export function depot(parent, [x0, y0], [dx, dy, dz], mat = "wall") {
  const g = svg("g", { class: "st-bldg" }, parent);
  box(g, [x0, y0, 0], [dx, dy, dz], mat);
  box(g, [x0 + dx * 0.2, y0 + 3, dz], [Math.min(5, dx * 0.3), 4, 2], "roof");
  paneY(g, x0 + dx * 0.3, x0 + dx * 0.7, y0 + dy, 0, dz * 0.62, "st-door");
  for (const x of [x0 + 1.2, x0 + dx - 4.8]) paneY(g, x, x + 3.6, y0 + dy, dz * 0.68, dz * 0.86);
  paneY(g, x0 + 2, x0 + dx - 2, y0 + dy, dz * 0.89, dz * 0.96, "st-sign");
  for (const y of [y0 + 2, y0 + dy - 6]) paneX(g, x0 + dx, y, y + 4, dz * 0.55, dz * 0.82);
  return g;
}

/** A factory with a saw-tooth glass roof (where the agent's logic runs). */
export function factory(parent, [x0, y0], [dx, dy, dz]) {
  const g = svg("g", { class: "st-bldg" }, parent);
  box(g, [x0, y0, 0], [dx, dy, dz], "wall");
  for (let i = 0; i < 3; i++) {
    const a = x0 + (i * dx) / 3, b = a + dx / 3;
    svg("polygon", { class: "st-roof-front", points: pts([a, y0, dz], [b, y0, dz + 3.5], [b, y0 + dy, dz + 3.5], [a, y0 + dy, dz]) }, g);
    svg("polygon", { class: "st-roof-gable", points: pts([a, y0 + dy, dz], [b, y0 + dy, dz], [b, y0 + dy, dz + 3.5]) }, g);
    svg("polygon", { class: "st-win", points: pts([b, y0, dz], [b, y0 + dy, dz], [b, y0 + dy, dz + 3.5], [b, y0, dz + 3.5]) }, g);
  }
  paneY(g, x0 + 4, x0 + 10, y0 + dy, 0, dz * 0.6, "st-door");
  for (const x of [x0 + dx - 10, x0 + dx - 5.4]) paneY(g, x, x + 3.4, y0 + dy, dz * 0.36, dz * 0.73);
  for (const y of [y0 + 2.5, y0 + dy - 7]) paneX(g, x0 + dx, y, y + 4.5, dz * 0.36, dz * 0.73);
  return g;
}

/** A brick chimney with smoke that puffs while the scene has the "busy" class. */
export function chimney(parent, x, y, h) {
  const g = svg("g", {}, parent);
  box(g, [x, y, 0], [2.6, 2.6, h], "brick");
  const smoke = svg("g", { class: "st-smoke" }, g);
  const [sx, sy] = iso(x + 1.3, y + 1.3, h + 0.4);
  for (let i = 0; i < 3; i++) svg("circle", { cx: sx, cy: sy, r: 9, style: `animation-delay:${i * 0.45}s` }, smoke);
  return g;
}

/**
 * A barrier arm that pivots at `at` and lies along `dir` ([1, 0] or [0, 1]) when down.
 * Returns set(deg): 0 = down across the road, 80 = up; set.deg is the current angle.
 */
export function boom(parent, at, dir, length) {
  const base = svg("line", { class: "st-boom" }, parent), stripe = svg("line", { class: "st-boom-stripe" }, parent);
  const set = (deg) => {
    const a = (deg * Math.PI) / 180, c = length * Math.cos(a);
    const [x1, y1] = iso(...at), [x2, y2] = iso(at[0] + dir[0] * c, at[1] + dir[1] * c, at[2] + length * Math.sin(a));
    for (const line of [base, stripe]) Object.entries({ x1, y1, x2, y2 }).forEach(([k, v]) => line.setAttribute(k, v.toFixed(1)));
    set.deg = deg;
  };
  set(0);
  return set;
}

// ---------- Panels ----------

/**
 * A rule board: a title and rows that light up as they're checked.
 * Returns { set(i, state), reset() }; state is "check", "yes", "no", "skip", "stop" (rejected) or "".
 */
export function board(parent, [x, y], title, rules, s = 1, width = 350) {
  const g = svg("g", { class: "st-board", transform: `translate(${x} ${y})` }, parent);
  svg("rect", { width: width * s, height: (60 + rules.length * 40) * s, rx: 15 * s }, g);
  label(g, 20 * s, 38 * s, title, "tt", "start", 22 * s);
  const rows = rules.map((r, i) => {
    const row = svg("g", { class: "st-row", transform: `translate(0 ${(84 + i * 40) * s})` }, g);
    svg("circle", { cx: 32 * s, cy: -7 * s, r: 11 * s }, row);
    label(row, 54 * s, 0, r, "rl", "start", 18 * s);
    return { row, mark: label(row, (width - 16) * s, 0, "", "rm", "end", 17 * s) };
  });
  const set = (i, state) => {
    rows[i].row.setAttribute("class", "st-row " + state);
    rows[i].mark.textContent = { yes: "✓ yes", no: "✕ no", check: "…", stop: "✕ stop" }[state] || "";
  };
  return { set, reset: () => rows.forEach((_, i) => set(i, "")) };
}

/** The numbered tracker under a scene. names: [title, subtitle] pairs. */
export function tracker(names) {
  const ol = el("ol", "st-track");
  ol.style.gridTemplateColumns = `repeat(${names.length}, minmax(62px, 1fr))`;
  const steps = names.map(([t, s], i) => {
    const li = el("li"); li.dataset.n = String(i + 1);
    li.append(el("b", "", t), s);
    ol.append(li);
    return li;
  });
  return {
    el: ol,
    /** Marks steps before i done and i active; `skipped` steps are greyed out. */
    set(i, skipped = []) { steps.forEach((li, j) => { li.className = skipped.includes(j) ? "skip" : j < i ? "done" : j === i ? "active" : ""; }); },
    finish(skipped = []) { steps.forEach((li, j) => { li.className = skipped.includes(j) ? "skip" : "done"; }); },
  };
}

/** The card around a scene: heading, hint, Replay and Speed buttons, and the narration line. */
export function card(title, hint, aria) {
  const c = el("section", "street");
  c.setAttribute("aria-label", aria);
  const replay = el("button", "", "↻ Replay"); replay.type = "button"; replay.disabled = true;
  const pace = el("button", "", "Speed 1×"); pace.type = "button";
  const bar = el("div", "st-bar"); bar.append(replay, pace);
  c.append(el("h2", "", title), el("p", "st-hint", hint), bar);
  const now = el("p", "st-now", "Send a message to watch it travel."); now.setAttribute("aria-live", "polite");
  return { card: c, replay, pace, now };
}

/** Wraps a scene in a drawn browser window (tab, address bar, a note underneath): "this all runs in your browser". */
export function browserWindow(scene, tab, note) {
  const win = el("div", "st-browser");
  const chrome = el("div", "st-chrome");
  const dots = el("span", "st-dots"); dots.append(el("i"), el("i"), el("i"));
  const secure = location.protocol === "https:";
  chrome.append(dots, el("span", "st-tab", tab), el("span", "st-url", (secure ? "🔒 " : "") + location.host + location.pathname));
  win.append(el("div", "st-zone", "Your computer · this browser tab"), chrome, scene, el("p", "st-inside", note));
  return win;
}

/** Network requests this page has made since `since` (a performance.now() time), from the browser's Resource Timing. */
export const requestsSince = (since) => performance.getEntriesByType("resource").filter((e) => e.startTime >= since);

/**
 * Under a scene's tracker: where the time really went for the last message (each step's extras/timing.js does the
 * sums). Each stage is a slice of one bar and a row with its time and share, coloured by where it ran: blue is your
 * browser, orange is the other end of the internet ("google" or "server"), striped is both, where the page can't split
 * them. While you wait, the stage you're waiting on counts up. A slice's width is its share of the time, however short
 * the stages are (CSS gives even the tiniest slice a few pixels, so you can see it's there).
 * It's redrawn several times a second, so it updates its rows in place: rebuilding them would restart the waiting pulse,
 * stop the bar from growing smoothly and clear any text you select.
 *
 * @param {object} o
 * @param {Record<string, string>} o.where What each kind of stage is called, e.g. { browser: "your browser" }.
 * @param {(ms: number) => string} o.fmt How a duration is shown.
 * @param {string} o.hint The note before the first message.
 * @param {string} o.measured The note when the stages bring none of their own.
 * @returns {{el: HTMLElement, show: (r: {rows: object[], total: number, live: boolean, note?: string}) => void}}
 */
export function timingPanel({ where, fmt, hint, measured }) {
  const box = el("div", "st-timing");
  const bar = el("div", "st-tbar"), list = el("ol", "st-tlist");
  const note = el("p", "st-note", hint);
  box.append(el("p", "st-label", "⏱ Where the time went: real times for your last message (the street view is slowed down)"), bar, list, note);
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
    /** Draws what a step's stages() returns: { rows: [{ name, where, ms, live }], total, live, note }. */
    show({ rows, total, live, note: text }) {
      const share = (ms) => (total > 0 ? `${Math.round((100 * ms) / total)}%` : "");
      const kind = (r) => `${r.where}${r.live ? " live" : ""}`;
      // Each slice grows by its share of the bar (in thousandths), not its raw time: when the grow values add up to less
      // than 1 (stages that are all under a millisecond, as in step 1), CSS fills only that part of the bar.
      const sum = rows.reduce((a, r) => a + (r.ms > 0 ? r.ms : 0), 0);
      const grow = (ms) => (sum > 0 ? (1000 * (ms > 0 ? ms : 0)) / sum : 1);
      keep(bar, rows.length, () => el("span")).forEach((slice, i) => {
        cls(slice, kind(rows[i]));
        slice.style.flexGrow = String(grow(rows[i].ms));      // the same node each time, so it grows smoothly
        slice.title = `${rows[i].name}: ${fmt(rows[i].ms)}`;
      });
      const items = [...rows.map((r) => [kind(r), r.name, where[r.where] ?? "", fmt(r.ms) + (r.live ? "…" : ""), share(r.ms)]),
        ["total", live ? "So far" : "Total: from Send to the reply on the page", "", fmt(total) + (live ? "…" : ""), ""]];
      keep(list, items.length, blank).forEach((li, i) => {
        const [name, ...texts] = items[i];
        cls(li, name);
        texts.forEach((s, j) => put(li.children[j + 1], s));
      });
      put(note, text || measured);
    },
  };
}

// ---------- Animation ----------

/** Thrown to end an older replay when a newer one starts. */
export const STOPPED = Symbol("stopped");
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const ease = (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);          // ease in and out (cubic)

/**
 * Runs replays one at a time: begin() cancels the previous one and returns its timing helpers.
 * tween(ms, fn) calls fn(eased 0→1, linear 0→1) every frame for ms (scaled by the speed button, 0 with
 * reduced motion); it throws STOPPED once a newer replay has begun.
 */
export function player() {
  let run = 0, speed = 1;
  return {
    /** 1× → 2× → ½× → 1×; returns the button text. */
    cycle() { speed = { 1: 2, 2: 0.5, 0.5: 1 }[speed]; return `Speed ${speed === 0.5 ? "½" : speed}×`; },
    begin() {
      const id = ++run;
      const alive = () => { if (id !== run) throw STOPPED; };
      const tween = (ms, fn) => new Promise((resolve, reject) => {
        const total = reduced() ? 0 : ms / speed, t0 = performance.now();
        const tick = (t) => {
          if (id !== run) { reject(STOPPED); return; }
          const p = total ? Math.min(1, (t - t0) / total) : 1;
          fn(ease(p), p);
          if (p < 1) requestAnimationFrame(tick); else resolve();
        };
        requestAnimationFrame(tick);
      });
      return { alive, tween, wait: (ms) => tween(ms, () => {}) };
    },
  };
}

// ---------- Styles (injected once; colours follow the page's light/dark variables) ----------

/** Three shades per material: top, the +y side, the +x side. */
const MATERIALS = {
  slab: ["--ground", "--soil1", "--soil2"], cloud: ["--cg", "--cs1", "--cs2"], wall: ["--w1", "--w2", "--w3"],
  gwall: ["--gw1", "--gw2", "--gw3"], roof: ["--r1", "--r2", "--r3"], booth: ["--o1", "--o2", "--o3"],
  brick: ["--k1", "--k2", "--k3"], bridge: ["--br1", "--br2", "--br3"], steel: ["--st1", "--st2", "--st3"],
};

const CSS = `
.street { --ground:#cfe2b3; --soil1:#b9a47c; --soil2:#a38e66; --road:#a9b4c4; --mark:#ffffff; --walk:#ece7dc; --edge:rgba(36,27,21,.38);
  --cg:#d3e3f5; --cs1:#9fb3d3; --cs2:#889dc2; --gw1:#ffffff; --gw2:#e6edf8; --gw3:#cdd8ec;
  --w1:#fffcf5; --w2:#efe5d2; --w3:#dccdb0; --r1:#e6d3b0; --r2:#d6c098; --r3:#c4aa7f;
  --o1:#efae8c; --o2:#d37a50; --o3:#b0603a; --k1:#c3ae92; --k2:#a99377; --k3:#8e7a60;
  --br1:#d9d4cc; --br2:#bdb6aa; --br3:#a39b8e; --st1:#8c86a6; --st2:#6e6890; --st3:#5a5579; --cloud:rgba(255,255,255,.75);
  --glass:#bcd0ef; --lamp:#ffd36b; --leaf:#6fae6c; --leaf2:#97cb93; --trunk:#8a6a4a; --smoke:#d8d2c8; --lock:#3b3550;
  background: var(--card); color: var(--ink); border: 3px solid var(--ink); border-radius: 22px; box-shadow: 6px 6px 0 var(--ink);
  padding: 14px 16px 12px; }
@media (prefers-color-scheme: dark) {
  .street { --ground:#33402c; --soil1:#2a221b; --soil2:#211a14; --road:#4a5262; --mark:#cfc6b6; --walk:#4a453d; --edge:rgba(0,0,0,.55);
    --cg:#2c3546; --cs1:#222a38; --cs2:#1b2230; --gw1:#4a5468; --gw2:#3c4557; --gw3:#313949;
    --w1:#5a4b3d; --w2:#4a3d31; --w3:#3c3128; --r1:#6b5845; --r2:#5a4a3a; --r3:#4b3d30; --glass:#4f6a95; --leaf:#3f7a3e; --leaf2:#5a965a;
    --br1:#5a554e; --br2:#48443e; --br3:#3a3732; --smoke:#9a9186; --st1:#8f89ad; --st2:#77719a; --st3:#625d82; --cloud:rgba(205,220,255,.16); }
}
.street h2 { margin: 0 0 2px; font-size: 1.05rem; }
.st-hint { margin: 0 0 8px; font-size: .85rem; color: var(--muted); }
.st-bar { display: flex; gap: 8px; flex-wrap: wrap; }
.st-bar button { font: inherit; font-size: .8rem; font-weight: 800; color: var(--ink); background: var(--bg); border: 2px solid var(--ink);
  border-radius: 10px; padding: 2px 10px; cursor: pointer; }
.st-bar button:disabled { opacity: .45; cursor: default; }
.st-world { display: flex; align-items: stretch; margin-top: 10px; }
.st-zone { font-size: .68rem; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); margin: 0 0 6px 4px; }
.st-browser { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
.st-chrome { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; background: color-mix(in srgb, var(--muted) 18%, var(--card));
  border: 3px solid var(--ink); border-bottom: 0; border-radius: 16px 16px 0 0; padding: 8px 12px; }
.st-dots { display: flex; gap: 5px; } .st-dots i { width: 11px; height: 11px; border-radius: 50%; border: 1.5px solid var(--ink); background: var(--bot); }
.st-dots i:nth-child(2) { background: var(--lamp); } .st-dots i:nth-child(3) { background: var(--ok, #5c8d55); }
.st-tab { font-size: .8rem; font-weight: 800; background: var(--card); border: 2px solid var(--ink); border-radius: 9px 9px 0 0; padding: 1px 12px; }
.st-url { flex: 1 1 220px; min-width: 0; font: 600 .78rem ui-monospace, Consolas, monospace; background: var(--card); border: 2px solid var(--ink);
  border-radius: 999px; padding: 2px 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.st-scene { display: block; width: 100%; height: auto; font-family: system-ui, "Segoe UI", sans-serif; background: var(--bg); }
.st-browser .st-scene { border: 3px solid var(--ink); border-top-width: 2px; }
.st-framed { border: 3px solid var(--ink); border-radius: 16px; }
.st-inside { margin: 0; padding: 8px 12px; font-size: .84rem; font-weight: 700; border: 3px solid var(--ink); border-top: 0;
  border-radius: 0 0 16px 16px; background: color-mix(in srgb, var(--ok, #5c8d55) 16%, var(--card)); }
.st-net { flex: 0 0 230px; display: flex; flex-direction: column; margin-left: 18px; min-width: 0; }
.st-wire { margin: 0 0 8px; padding-top: 4px; border-top: 3px dashed var(--muted); font-size: .72rem; font-weight: 800; color: var(--muted); line-height: 1.3; }
.st-server { flex: 1; border: 3px dashed var(--muted); border-radius: 16px; padding: 12px; font-size: .8rem; color: var(--muted);
  background: color-mix(in srgb, var(--muted) 7%, transparent); }
.st-server b { display: block; color: var(--ink); font-size: .88rem; margin: 6px 0 4px; }
.st-server p { margin: 6px 0; }
.st-rack { width: 52px; height: auto; display: block; } .st-rack rect { fill: var(--card); stroke: var(--muted); stroke-width: 2.5; }
.st-rack circle { fill: var(--muted); }
.st-server .st-label { margin-bottom: 0; font-weight: 800; color: var(--ink); }
.st-server .st-count { margin-top: 2px; font-size: 1.05rem; font-weight: 900; color: var(--ink); }
.st-server .st-count.zero { font-size: 2rem; line-height: 1.1; color: var(--ok, #5c8d55); }
.st-log { list-style: none; margin: 6px 0; padding: 0; font: 600 .72rem/1.35 ui-monospace, Consolas, monospace; color: var(--ink); }
.st-log li { padding: 4px 0; border-top: 1px dashed var(--muted); overflow-wrap: anywhere; }
.st-log li span { display: block; color: var(--muted); font-weight: 500; }
@media (max-width: 860px) {
  .st-world { flex-direction: column; }
  .st-net { flex: none; margin: 16px 0 0; }
}
.st-scene polygon { stroke: var(--edge); stroke-width: 1.2; stroke-linejoin: round; }
${Object.entries(MATERIALS).map(([m, [t, l, r]]) => `.st-${m} .t { fill: var(${t}); } .st-${m} .l { fill: var(${l}); } .st-${m} .r { fill: var(${r}); }`).join("\n")}
.st-cable { fill: none; stroke: var(--st3); stroke-width: 3.4; stroke-linecap: round; stroke-linejoin: round; }
.st-hanger { stroke: var(--st2); stroke-width: 1.4; } .st-truss { fill: none; stroke: var(--br3); stroke-width: 1.6; stroke-linejoin: round; }
.st-bsign rect { fill: var(--lock); stroke: var(--ink); stroke-width: 2; transition: fill .3s; }
.st-bsign text { fill: #fff8ec; font-weight: 900; letter-spacing: .12em; dominant-baseline: middle; }
.st-bsign.enc rect { fill: var(--you); } .st-bsign.dec rect { fill: var(--ok, #5c8d55); }
.st-https.bad .st-bsign rect { fill: var(--warn, #b14d44); }
.st-tag.key rect { fill: var(--lamp); } .st-tag.key .tg { fill: #241b15; }
.st-sky { fill: var(--muted); font-weight: 800; font-style: italic; paint-order: stroke; stroke: var(--card); stroke-width: 6px;
  stroke-linejoin: round; }
.st-walkway, .st-edgeband, .st-asphalt, .st-centre { fill: none; stroke-linejoin: round; }
.st-walkway { stroke: var(--walk); } .st-walkway-cap { fill: var(--walk); }
.st-edgeband { stroke: var(--mark); } .st-edgeband-cap { fill: var(--mark); }
.st-asphalt { stroke: var(--road); } .st-asphalt-cap { fill: var(--road); }
.st-centre { stroke: var(--mark); }
.st-rail { stroke: var(--muted); stroke-width: 2.5; }
.st-roof-front { fill: var(--r1); } .st-roof-gable { fill: var(--r3); }
.st-win { fill: var(--glass); transition: fill .3s; }
.st-door { fill: var(--r3); transition: fill .3s; }
.st-sign { fill: var(--you); }
.st-bldg.on .st-win, .st-bldg.on .st-door { fill: var(--lamp); }
.st-bldg.bad .st-win, .st-bldg.bad .st-door { fill: var(--warn, #b14d44); }
.st-boom { stroke: #fff; stroke-width: 5; stroke-linecap: round; }
.st-boom-stripe { stroke: #c8442f; stroke-width: 5; stroke-dasharray: 9 9; }
.st-tree line { stroke: var(--trunk); stroke-width: 4; stroke-linecap: round; }
.st-tree circle { fill: var(--leaf); stroke: var(--edge); stroke-width: 1.2; } .st-tree circle.hi { fill: var(--leaf2); stroke: none; }
.st-tree .shadow { fill: rgba(0, 0, 0, .12); }
.st-lamp line { stroke: #5d5a55; stroke-width: 2.5; } .st-lamp circle { fill: var(--lamp); stroke: #5d5a55; stroke-width: 1.5; }
.st-car polygon { stroke: #55555c; stroke-width: 1; }
.st-car .t { fill: #3a3a40; } .st-car .l { fill: #222226; } .st-car .r { fill: #151518; }
.st-car .gl { fill: #56657d; } .st-car .st-stripe { fill: #ececf0; stroke: none; }
.st-car .st-shadow { fill: rgba(0, 0, 0, .2); stroke: none; }
.st-car .st-headlight { fill: #fff3c4; } .st-car .st-taillight { fill: #e0402f; }
.st-wheel { fill: #111; stroke: #55555c; stroke-width: 1; } .st-hub { fill: #b9b9c0; }
.st-smoke circle { fill: var(--smoke); opacity: 0; transform-box: fill-box; transform-origin: center; }
.busy .st-smoke circle { animation: st-puff 1.35s ease-out infinite; }
@keyframes st-puff { 0% { opacity: 0; transform: translate(0, 0) scale(.5); } 25% { opacity: .95; }
  100% { opacity: 0; transform: translate(14px, -70px) scale(1.7); } }
.st-paint { fill: color-mix(in srgb, var(--ink) 45%, transparent); font-weight: 900; letter-spacing: .06em; }
.st-pin line { stroke: var(--ink); stroke-width: 2; stroke-dasharray: 4 4; } .st-pin circle { fill: var(--ink); }
.st-pin rect { fill: var(--card); stroke: var(--ink); stroke-width: 2.5; }
.st-pin .tt { font-weight: 800; fill: var(--ink); } .st-pin .ts { fill: var(--muted); }
.st-pin.on rect { fill: var(--you); } .st-pin.on .tt, .st-pin.on .ts { fill: #fff; }
.st-pin.bad rect { fill: var(--warn, #b14d44); } .st-pin.bad .tt, .st-pin.bad .ts { fill: #fff; }
.st-tag rect { stroke: var(--ink); stroke-width: 2.5; } .st-tag.you rect { fill: var(--you); } .st-tag.bot rect { fill: var(--bot); }
.st-tag.lock rect { fill: var(--lock); } .st-tag.err rect { fill: var(--warn, #b14d44); }
.st-tag .tg { font-weight: 800; fill: #fff; dominant-baseline: middle; }
.st-board rect { fill: var(--card); stroke: var(--ink); stroke-width: 2.5; }
.st-board .tt { font-weight: 800; fill: var(--ink); }
.st-board .rl { font-family: ui-monospace, Consolas, monospace; font-weight: 600; fill: var(--ink); } .st-board .rm { font-weight: 800; fill: var(--muted); }
.st-row circle { fill: var(--bg); stroke: var(--ink); stroke-width: 2; transition: fill .2s; }
.st-row.check circle { fill: var(--lamp); } .st-row.yes circle { fill: var(--ok, #5c8d55); } .st-row.yes .rm { fill: var(--ok, #5c8d55); }
.st-row.stop circle { fill: var(--warn, #b14d44); } .st-row.stop .rm { fill: var(--warn, #b14d44); }
.st-row.no circle { fill: var(--muted); } .st-row.skip { opacity: .35; }
.st-legend .lg { font-weight: 800; fill: var(--ink); } .st-legend .you { fill: var(--you); } .st-legend .bot { fill: var(--bot); }
.st-spark { fill: var(--lamp); stroke: var(--ink); stroke-width: 2; transform-box: fill-box; transform-origin: center; }
.busy .st-spark { animation: st-spin 1.2s linear infinite; }
@keyframes st-spin { to { transform: rotate(360deg); } }
.st-cloud { fill: var(--cloud); }
.st-drone .shadow { fill: rgba(0, 0, 0, .16); }
.st-drone .arm { stroke: #2b2b30; stroke-width: 3; }
.st-drone .core { fill: #2b2b30; stroke: var(--ink); stroke-width: 1.5; } .st-drone .eye { fill: var(--lamp); }
.st-drone .rotor { fill: rgba(40, 40, 46, .35); stroke: #2b2b30; stroke-width: 1; transform-box: fill-box; transform-origin: center;
  animation: st-rotor .12s linear infinite alternate; }
@keyframes st-rotor { to { transform: scaleX(.35); } }
.st-tag.ok rect { fill: var(--ok, #5c8d55); }
.st-trow .tn { font-weight: 800; fill: var(--ink); } .st-trow .ts { font-weight: 800; fill: var(--muted); }
.st-trow .tnote { fill: var(--muted); }
.st-trow.ok .ts { fill: var(--ok, #5c8d55); } .st-trow.bad .ts { fill: var(--warn, #b14d44); } .st-trow.wait .ts { fill: var(--you); }
.st-trow.used .tn { fill: var(--you); }
.st-steps { list-style: none; display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin: 8px 0; padding: 0; }
.st-steps li { position: relative; border: 2px solid var(--ink); border-radius: 12px; padding: 30px 10px 8px; font-size: .78rem;
  background: var(--card); line-height: 1.35; }
.st-steps li::before { content: attr(data-n); position: absolute; top: 6px; left: 10px; width: 20px; height: 20px; border-radius: 50%;
  display: grid; place-items: center; font-size: .7rem; font-weight: 900; color: #fff; background: var(--muted); }
.st-steps li b { position: absolute; top: 6px; left: 36px; font-size: .8rem; }
.st-steps li.done { border-color: var(--ok, #5c8d55); } .st-steps li.done::before { content: "✓"; background: var(--ok, #5c8d55); }
.st-steps li.bad { border-color: var(--warn, #b14d44); } .st-steps li.bad::before { content: "✕"; background: var(--warn, #b14d44); }
.st-steps li .state { display: block; margin-top: 4px; font-weight: 800; }
.st-steps li.bad .state { color: var(--warn, #b14d44); } .st-steps li.done .state { color: var(--ok, #5c8d55); }
.st-debug { margin-top: 10px; border: 3px solid var(--ink); border-radius: 16px; padding: 10px 14px; font-size: .84rem;
  background: color-mix(in srgb, var(--lamp) 14%, var(--card)); }
.st-debug .st-label { margin: 0; font-weight: 900; }
.st-life { margin: 4px 0 0; }
.st-tls { background: color-mix(in srgb, var(--you) 10%, var(--card)); }
.st-timing { margin-top: 10px; border: 3px solid var(--ink); border-radius: 16px; padding: 10px 14px; font-size: .84rem; }
.st-timing .st-label { margin: 0 0 6px; font-weight: 900; }
.st-tbar { display: flex; height: 22px; border: 2px solid var(--ink); border-radius: 8px; overflow: hidden; background: var(--bg); }
.st-tbar span { min-width: 3px; transition: flex-grow .25s; } .st-tbar span + span { border-left: 1.5px solid var(--card); }
.st-tbar .browser, .st-tlist .browser i { background: var(--you); }
.st-tbar .google, .st-tlist .google i, .st-tbar .server, .st-tlist .server i { background: var(--bot); }
.st-tbar .both, .st-tlist .both i { background: repeating-linear-gradient(135deg, var(--you) 0 4px, var(--bot) 4px 8px); }
.st-tbar .live, .st-tlist .live i { animation: st-wait .9s ease-in-out infinite alternate; }
@keyframes st-wait { to { opacity: .45; } }
.st-tlist { list-style: none; margin: 8px 0 0; padding: 0; max-width: 56rem; }
.st-tlist li { display: grid; grid-template-columns: 12px minmax(0, 1fr) auto 64px 40px; gap: 4px 10px; align-items: baseline; padding: 3px 0; }
.st-tlist i { align-self: start; margin-top: 4px; width: 12px; height: 12px; border-radius: 3px; border: 1.5px solid var(--ink); }
.st-tlist .wh, .st-tlist .pc { color: var(--muted); } .st-tlist b, .st-tlist .pc { text-align: right; font-variant-numeric: tabular-nums; }
.st-tlist .total { border-top: 1.5px dashed var(--muted); margin-top: 3px; padding-top: 6px; font-weight: 800; } .st-tlist .total i { border: 0; }
@media (max-width: 640px) { .st-tlist li { grid-template-columns: 12px minmax(0, 1fr) 60px 36px; }
  .st-tlist .wh { grid-column: 2; grid-row: 2; } .st-tlist .wh:empty { display: none; } }
.st-pad { fill: #4a4a50; stroke: var(--lamp); stroke-width: 3; } .st-padh { fill: var(--lamp); font-weight: 900; }
.st-banner .bt { font-weight: 900; letter-spacing: .08em; fill: var(--ink); } .st-banner .bs { font-weight: 700; fill: var(--muted); }
.st-vault { fill: #6b6f7a; }
.st-antenna line { stroke: #5d5a55; stroke-width: 3; }
.st-antenna circle { fill: none; stroke: var(--you); stroke-width: 3; opacity: 0; transform-box: fill-box; transform-origin: center; }
.sending .st-antenna circle { animation: st-ping 1.2s ease-out infinite; }
@keyframes st-ping { 0% { opacity: .9; transform: scale(.4); } 100% { opacity: 0; transform: scale(3); } }
.st-netlog { margin-top: 10px; border: 3px dashed var(--muted); border-radius: 16px; padding: 10px 14px; font-size: .82rem; }
.st-netlog .st-label { margin: 0; font-weight: 800; } .st-netlog .st-label b { font-size: 1.2rem; color: var(--you); }
.st-netlog .st-log { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 0 16px; }
.st-note { margin: 4px 0 0; color: var(--muted); font-size: .76rem; }
.st-track { list-style: none; display: grid; margin: 8px 0 0; padding: 0; overflow-x: auto; }
.st-track li { position: relative; text-align: center; font-size: .7rem; color: var(--muted); padding-top: 30px; line-height: 1.25; }
.st-track li b { display: block; color: var(--ink); font-size: .76rem; }
.st-track li::before { content: attr(data-n); position: absolute; top: 0; left: 50%; transform: translateX(-50%); z-index: 1;
  width: 24px; height: 24px; border-radius: 50%; border: 2.5px solid var(--ink); background: var(--bg); color: var(--ink);
  display: grid; place-items: center; font-weight: 900; font-size: .72rem; box-sizing: border-box; }
.st-track li::after { content: ""; position: absolute; top: 11px; left: -50%; width: 100%; height: 3px; background: var(--muted); opacity: .3; }
.st-track li:first-child::after { display: none; }
.st-track li.done::before { content: "✓"; background: var(--ok, #5c8d55); color: #fff; }
.st-track li.active::before { background: var(--you); color: #fff; box-shadow: 0 0 0 4px color-mix(in srgb, var(--you) 35%, transparent); }
.st-track li.done::after, .st-track li.active::after { background: var(--you); opacity: 1; }
.st-track li.skip { opacity: .35; }
.st-now { margin: 10px 0 0; padding: 8px 12px; border: 2px dashed var(--muted); border-radius: 12px; font-size: .88rem; min-height: 2.7em; }
@media (prefers-reduced-motion: reduce) { .busy .st-smoke circle, .busy .st-spark, .sending .st-antenna circle, .st-drone .rotor,
  .st-tbar .live, .st-tlist .live i { animation: none; opacity: .8; } .st-tbar span { transition: none; } }
`;

/** Adds the street-view styles to the page (once). */
export function ensureStyles() {
  if (document.getElementById("st-style")) return;
  const style = document.createElement("style");
  style.id = "st-style";
  style.textContent = CSS;
  document.head.append(style);
}
