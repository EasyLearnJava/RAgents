/**
 * serve.mjs: a tiny static file server for previewing dist/ on your own machine.
 *
 * - Listens on 127.0.0.1 only, so nothing on your network (or public Wi-Fi) can reach it.
 * - Sends correct Content-Types; browsers refuse to run <script type="module"> files otherwise,
 *   which is also why opening index.html directly from disk (file://) doesn't work.
 * - Serves folder URLs as their index.html and refuses paths that escape dist/ (e.g. "/../").
 *
 * Usage:  npm run serve                 build, then serve on http://127.0.0.1:5000
 *         node scripts/serve.mjs 5050   serve an existing dist/ on another port
 * Stop with Ctrl+C.
 */
import { createServer } from "node:http";
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

// One handler for every request: map the URL to a file inside dist/ and send it.
createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = normalize(join(DIST, urlPath));
  if (!file.startsWith(DIST)) { res.writeHead(403).end("Forbidden"); return; }   // no ../ escapes
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) { res.writeHead(404, { "Content-Type": "text/plain" }).end(`Not found: ${urlPath}`); return; }
  res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
  res.end(readFileSync(file));
}).listen(PORT, "127.0.0.1", () => console.log(`Serving dist/ at http://127.0.0.1:${PORT}  (Ctrl+C to stop)`));
