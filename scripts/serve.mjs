/**
 * serve.mjs: a tiny static file server for previewing dist/ on your own machine.
 *
 * - Listens on 127.0.0.1 only, so nothing on your network (or public Wi-Fi) can reach it.
 * - Sends correct Content-Types; browsers refuse to run <script type="module"> files otherwise,
 *   which is also why opening index.html directly from disk (file://) doesn't work.
 * - Serves folder URLs as their index.html and refuses paths that escape dist/ (e.g. "/../").
 * - Forwards /api/* to a Python backend on http://127.0.0.1:8000 (step 4 onwards), the same way Firebase
 *   Hosting forwards /api/* to Cloud Run on the live site. Start that backend separately (see step 4's README).
 * - Fetches /__/firebase/init.json (step 2's public Firebase config) from the Firebase site, like vercel.json
 *   does on Vercel, so the config never has to be pasted into the code. Behind Zscaler, set
 *   NODE_OPTIONS=--use-system-ca first.
 *
 * Usage:  npm run serve                 build, then serve on http://127.0.0.1:5000
 *         node scripts/serve.mjs 5050   serve an existing dist/ on another port
 * Stop with Ctrl+C.
 */
import { createServer, request } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

/** Folder being served (the output of scripts/build.mjs). */
const DIST = fileURLToPath(new URL("../dist", import.meta.url));
/** Port from the first command-line argument, default 5000. */
const PORT = Number(process.argv[2]) || 5000;
/** File extension -> Content-Type header. Unknown types are sent as binary downloads. */
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".md": "text/plain; charset=utf-8",
};

/** Where /api/* requests go locally: the Python backend started with uvicorn. */
const API_PORT = 8000;

/** Passes one /api request to the local backend and pipes its answer back (or a clear 502 if it isn't running). */
function proxyApi(req, res) {
  const upstream = request({ host: "127.0.0.1", port: API_PORT, path: req.url, method: req.method, headers: req.headers }, (up) => {
    res.writeHead(up.statusCode, up.headers);
    up.pipe(res);
  });
  upstream.on("error", () => {
    res.writeHead(502, { "Content-Type": "application/json" })
      .end(JSON.stringify({ error: `Python backend not running on 127.0.0.1:${API_PORT} (see step 4's README)` }));
  });
  req.pipe(upstream);
}

/** Where step 2's Firebase web config is published (Firebase Hosting serves it for every project). */
const FIREBASE_INIT = "https://ragent-eec65.web.app/__/firebase/init.json";

/** Returns the Firebase config from the live site (or a 502 the page turns into a "setup needed" message). */
async function proxyFirebaseInit(res) {
  try {
    const up = await fetch(FIREBASE_INIT);
    res.writeHead(up.status, { "Content-Type": "application/json", "Cache-Control": "no-cache" }).end(await up.text());
  } catch (err) {
    res.writeHead(502, { "Content-Type": "application/json" }).end(JSON.stringify({ error: `Couldn't fetch ${FIREBASE_INIT}: ${err.cause?.code || err.message}` }));
  }
}

// One handler for every request: /api/* goes to the backend; everything else maps to a file inside dist/.
createServer((req, res) => {
  if (req.url.startsWith("/api/")) { proxyApi(req, res); return; }
  if (req.url === "/__/firebase/init.json") { proxyFirebaseInit(res); return; }
  const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = normalize(join(DIST, urlPath));
  if (!file.startsWith(DIST)) { res.writeHead(403).end("Forbidden"); return; }   // no ../ escapes
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) { res.writeHead(404, { "Content-Type": "text/plain" }).end(`Not found: ${urlPath}`); return; }
  res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
  res.end(readFileSync(file));
}).listen(PORT, "127.0.0.1", () => console.log(`Serving dist/ at http://127.0.0.1:${PORT}  (Ctrl+C to stop)`));
