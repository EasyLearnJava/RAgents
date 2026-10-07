# RAgents

Agents built one step at a time, from a rule-based Hello World to a real model, and later memory, tools and more.
Every version is its own project folder. One website shows them all, with a left nav to move between steps.

**Live site:** https://ragent-eec65.web.app (Firebase Hosting, project `ragent-eec65`)

| Step | Project | What it adds |
|---|---|---|
| 1 | [`projects/01-hello-world-rules`](projects/01-hello-world-rules) | Say Hello, get Hello World. One rule, no model |
| 2 | [`projects/02-hello-world-llm`](projects/02-hello-world-llm) | Your message goes to a real model (Gemini via Firebase AI Logic) |
| 3 | [`projects/03-hello-world-langchain`](projects/03-hello-world-langchain) | Step 1 rebuilt with LangChain.js: the same rules as a Runnable chain |
| 4 | [`projects/04-hello-world-python`](projects/04-hello-world-python) | The same chain in Python on a server (FastAPI); the page calls `/api` |

**How it was built:** [docs/BUILD_AND_DEPLOY_GUIDE.md](docs/BUILD_AND_DEPLOY_GUIDE.md) walks through every step,
from creating the Firebase project to deploying and hardening, with screenshots.

## How the repo works

```text
RAgents/
├─ projects/                 one folder per version (step)
│  ├─ 01-hello-world-rules/
│  │  ├─ project.json        title, summary, "what you learn": feeds the left nav
│  │  ├─ public/             the project's web files (deployed as-is)
│  │  ├─ test/               tests for that step
│  │  └─ README.md
│  ├─ 02-hello-world-llm/
│  ├─ 03-hello-world-langchain/
│  └─ 04-hello-world-python/
│     └─ backend/            Python steps add a server: FastAPI + LangChain, pytest tests, Dockerfile for Cloud Run
├─ shell/index.html          the site: left nav + the selected project
├─ shell/lib/flow.js         live "what happens when you press Send" diagram, shared by every step
├─ scripts/build.mjs         builds dist/ from shell/ + every projects/*/public
├─ scripts/serve.mjs         local preview on http://127.0.0.1:5000 (forwards /api/* to a local Python backend on :8000)
├─ firebase.json             deploys dist/ (runs the build first)
└─ .firebaserc               default project: ragent-eec65
```

The site lists projects from each `project.json`, sorted by `step`. Each project also works on its own at
`/projects/<folder>/`.

### `project.json` fields

| Field | Required | Shown as |
|---|---|---|
| `step` | yes | The number in the left nav; also the sort order. Must be unique |
| `title` | yes | The nav link and the header title |
| `summary` | yes | One sentence under the title |
| `badge` | no | Small label under the nav link, e.g. `No model`, `Gemini` |
| `learn` | no | Bullet list "what you learn" in the header |
| `next` | no | "Next: …", i.e. what's missing, which becomes the next step |

`scripts/build.mjs` checks the required fields and fails the build (and so the deploy) if one is missing.

### How a request flows

- **Step 1:** browser → `agent.js` (one rule) → reply. Nothing leaves the browser.
- **Step 2:** browser → `main.js` → Firebase App Check (proves the request comes from this site) →
  Firebase AI Logic (holds the Gemini key) → Gemini → reply. `agent.js` checks the input first and turns
  errors into readable messages.
- **Step 3:** browser → LangChain chain (`normalize` → `rules` branch) → reply. Nothing leaves the browser; LangChain.js
  itself is downloaded from the jsDelivr CDN.
- **Step 4:** browser → `POST /api/step4/chat` → FastAPI (Python) → LangChain chain → JSON reply + event trace → browser.
  Locally `/api` goes to `127.0.0.1:8000`; on the live site Firebase Hosting forwards it to Cloud Run (once deployed).

Each step's page shows this live under the chat: press Send and each box lights up as your message passes through it.
A box turns red where something failed, and a timed trace lists what happened.

## Everyday commands (run in the repo root)

```powershell
npm install                      # once: installs LangChain for step 3's tests (node_modules/ is not committed)
npm test                         # all projects' tests
npm run serve                    # build + preview at http://127.0.0.1:5000 (Ctrl+C to stop)
firebase deploy --only hosting   # build + publish every project to https://ragent-eec65.web.app
```

Python steps (4 onwards) also have a backend, with its own virtual environment and tests:

```powershell
cd projects\04-hello-world-python\backend
.venv\Scripts\python -m pytest                                          # Python tests
.venv\Scripts\python -m uvicorn main:app --host 127.0.0.1 --port 8000   # backend for npm run serve
```
First-time setup and the Cloud Run deploy are in [step 4's README](projects/04-hello-world-python/README.md).

On this laptop, run `$env:NODE_OPTIONS = "--use-system-ca"` first in each new terminal: the corporate proxy (Zscaler)
re-signs HTTPS, and this makes Node trust the Windows certificate store. Step 2 also needs a one-time Firebase setup:
see [its README](projects/02-hello-world-llm/README.md).

## Adding the next version

1. Copy the latest project folder, e.g. `projects/02-hello-world-llm` → `projects/03-chat-with-history`.
2. In its `project.json`, set the next `step` number, a `title`, `summary`, `learn` list and `next`.
3. Change the code, add tests, run `npm test` and `npm run serve`.
   Update the diagram under the chat: the page passes its own boxes to `createFlow()` (from `/lib/flow.js`) and
   lights them up as the agent reports each stage. See step 2's `index.html` for the pattern.
4. Deploy. The new step appears in the left nav automatically.

No other file needs to change.
