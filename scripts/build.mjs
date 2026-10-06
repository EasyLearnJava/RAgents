// Builds the site in dist/:
//   dist/index.html            the shell with the left nav (from shell/)
//   dist/projects.json         the nav list, generated from every projects/*/project.json
//   dist/projects/<folder>/    each project's public/ folder, unchanged
// Adding a version = adding a folder under projects/ with a project.json and a public/ folder.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST = join(ROOT, "dist");
const PROJECTS = join(ROOT, "projects");
const REQUIRED = ["step", "title", "summary"];

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

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) build();
