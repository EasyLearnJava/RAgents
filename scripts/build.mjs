/**
 * build.mjs: assembles the deployable website in dist/.
 *
 * Output:
 *   dist/index.html            the shell page with the left nav (copied from shell/)
 *   dist/projects.json         the nav list, generated from every projects/<folder>/project.json
 *   dist/projects/<folder>/    each project's public/ folder, copied unchanged
 *
 * Adding a version only means adding a folder under projects/ that has a project.json and a
 * public/index.html; this script discovers it automatically.
 *
 * Usage:  npm run build        (also runs automatically before `firebase deploy`, see firebase.json)
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** Repo root (the folder above scripts/). */
const ROOT = fileURLToPath(new URL("..", import.meta.url));
/** Build output folder; recreated from scratch on every build. */
const DIST = join(ROOT, "dist");
/** Folder holding one sub-folder per project/step. */
const PROJECTS = join(ROOT, "projects");
/** Fields every project.json must have (see "project.json fields" in the README). */
const REQUIRED = ["step", "title", "summary"];

/**
 * Reads and validates every project under `projectsDir`.
 *
 * A folder counts as a project only if it contains a project.json. Each project must also have
 * public/index.html, the required fields, and a step number no other project uses.
 *
 * @param {string} [projectsDir] Folder to scan (defaults to the repo's projects/ folder).
 * @returns {Array<object>} The project.json contents, each extended with `folder` (folder name)
 *   and `path` (URL path on the site, e.g. "projects/01-hello-world-rules/"), sorted by step.
 * @throws {Error} When a project is missing a required field or file, or two projects share a step.
 */
export function loadProjects(projectsDir = PROJECTS) {
  const list = [];
  for (const entry of readdirSync(projectsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(projectsDir, entry.name);
    const metaFile = join(dir, "project.json");
    if (!existsSync(metaFile)) continue;            // not a project folder
    const meta = JSON.parse(readFileSync(metaFile, "utf8"));
    for (const key of REQUIRED) {
      if (meta[key] === undefined || meta[key] === "") throw new Error(`${entry.name}/project.json is missing "${key}"`);
    }
    if (!existsSync(join(dir, "public", "index.html"))) throw new Error(`${entry.name}/public/index.html is missing`);
    list.push({ ...meta, folder: entry.name, path: `projects/${entry.name}/` });
  }
  list.sort((a, b) => a.step - b.step || a.folder.localeCompare(b.folder));
  const steps = list.map((p) => p.step);
  const dup = steps.find((s, i) => steps.indexOf(s) !== i);
  if (dup !== undefined) throw new Error(`two projects use step ${dup}`);
  return list;
}

/**
 * Rebuilds dist/: wipes it, copies the shell, copies each project's public/ folder,
 * and writes projects.json for the left nav.
 */
function build() {
  const projects = loadProjects();
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });
  cpSync(join(ROOT, "shell"), DIST, { recursive: true });
  for (const p of projects) {
    cpSync(join(PROJECTS, p.folder, "public"), join(DIST, "projects", p.folder), { recursive: true });
  }
  writeFileSync(join(DIST, "projects.json"), JSON.stringify(projects, null, 2));
  console.log(`Built dist/ with ${projects.length} project(s): ${projects.map((p) => `${p.step}. ${p.title}`).join(" | ")}`);
}

// Run the build only when this file is executed directly (node scripts/build.mjs),
// not when another module imports loadProjects().
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) build();
