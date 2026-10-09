# Step 4 · Hello World (Python backend)

The same LangChain chain as step 3, rewritten in **Python** and moved to a **server**. The page (still HTML/JS,
because browsers only run JavaScript) sends your message to `/api/step4/chat`. FastAPI runs the chain and sends back
the reply plus LangChain's event trace, which the page replays in its diagram.

This is the first step with a backend. The agent logic stays the known rule-based one, so the only new thing is the
backend itself: an API, input validation, running locally, deploying. Gemini moves to the server in step 5.

```
Browser (index.html) ── POST /api/step4/chat ──► FastAPI (main.py) ──► LangChain chain (agent.py)
        ▲                                                                   normalize | rules
        └──────────── JSON: { reply, rule, events, server_ms } ◄────────────────┘
```

| File | What it is |
|---|---|
| `project.json` | Title, summary and "what you learn" for the site's left nav |
| `public/index.html` | The chat; calls the backend with `fetch` and shows the reply (or why it failed) |
| `public/style.css` | How the chat page looks |
| `backend/agent.py` | The chain in Python: `normalize \| rules` (`RunnableLambda`, `RunnableBranch`), and `run_with_events()`, which main.py calls (it also returns LangChain's events for the diagram) |
| `backend/main.py` | FastAPI: `GET /api/step4/health`, `POST /api/step4/chat` (rejects > 1000 characters with 422) |
| `backend/tests/test_agent.py` | pytest: same replies as step 1, events reported, API status codes |
| `backend/requirements*.txt` | Pinned packages (server / server + tests) |
| `backend/Dockerfile`, `.gcloudignore` | How Cloud Run builds and runs it (used only when deploying) |
| `test/timing.test.js` | Tests for the timing sums in `public/extras/timing.js`, with made-up Resource Timing entries (run with `npm test` from the repo root) |

**Extras** (teaching aids, not part of the agent):

| File | What it is |
|---|---|
| `public/index.html` (the `<aside class="about">`) | The "About this step" panel next to the chat: what you learn, how a message travels, errors and limits, safety, where it runs, and whether your message is private |
| `public/extras/street.js` | The "Street view" on its own row under the chat: your browser tab and the Python server as two pieces of land joined by a bridge. A black car carries your message through the form, index.html's `onSend(e)` and `api()` (which sends it with `fetch`), over the bridge to the server's front door (live, Vercel sends `/api/*` to `api/index.py`; locally, the site server forwards it to uvicorn), FastAPI's gate in `main.py` (at most 1000 characters) and `agent.py`, and brings the JSON reply back. Live (`https://`) the bridge is the HTTPS bridge from step 2: the request is encrypted at your end and decrypted at the server's front door, and the answer comes back the same way. Locally it's plain HTTP on 127.0.0.1, which never leaves your computer, and the scene says so instead. It follows `api()`'s real result: a network error fails on the bridge, a 502 or 404 stops at the front door with the reason, a 500 or 504 stops there too (the server is there but something on it failed, so the tracker shows "?" for `chat()` and the chain), a 422 stops at FastAPI's gate, and with a slow answer the car waits at the front door until it's in (where a cold start shows up). The chain's board lights up from the server's own LangChain events in the JSON reply. A courier drone replays the page-load health check (`GET /api/step4/health`) and the health board shows the Python and langchain-core versions, or why there's no backend; the wire board shows what `api()` really sent and got back. Under its step tracker, "Where the time went" shows each stage's real time (see `timing.js`), then a panel on the bridge (the TLS steps live, why there's nothing to encrypt locally) and a network log of the page's real requests. Built with `/lib/town.js` |
| `public/extras/timing.js` | The sums for the street view's "Where the time went" panel: the real time of each stage of a message, from the moments `index.html` reports (the submit event, just before `fetch`, `api()` resolved, the reply added) and the next frame after them, the Resource Timing entry for `/api/step4/chat` and `server_ms` from the JSON reply. Your browser sees the request as one call, so the network, Vercel (or the site server and uvicorn) and FastAPI are one stage, and a cold start lands there too; the chain gets its own row because the server timed it. Blue is your browser, orange is the server's side, striped is both, where the page can't split them (a new connection's handshake, the wait before the browser reports the request, or a request that got no answer). The street view is slowed down; this shows the real times, counting up while you wait. So that their own drawing isn't counted, the street view and the diagram start only after the frame that draws the reply (with an answer slower than 300 ms the car starts then, and the note says the browser's last stages can include a little of its drawing), and the parked drone's rotors stand still |
| `public/extras/diagram.js` | The "What happens when you press Send" diagram: onSend → api → chat() → run_with_events() → chain, and back, using the server's events from the JSON reply |

To see the agent without the extras, delete the lines marked `EXTRA` in `index.html` (and the About panel under its `EXTRA`
comment); the chat works the same.

## Run it on your machine

Two terminals, from the repo root (`...\FDE\Evolution\RAgents`).

**Terminal 1: the Python backend** (first time: create the virtual environment and install)
```bat
cd projects\04-hello-world-python\backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements-dev.txt
.venv\Scripts\python -m pytest
.venv\Scripts\python -m uvicorn main:app --host 127.0.0.1 --port 8000
```
After the first time, only the last line is needed (from the `backend` folder).

**Terminal 2: the site**
```bat
npm run serve
```
Open http://127.0.0.1:5000/#04-hello-world-python. The local site server forwards `/api/*` to the backend on
port 8000, the same way Vercel forwards `/api/*` to the Python function on the live site. The badge shows the Python and
langchain-core versions when the backend is running. If the backend isn't running, the chat says so.

Things to try: `hi there`, `weather?`, an empty message, and more than 1000 characters (the server answers 422).
Then stop uvicorn and send again: the site server answers 502, and the street view stops the car at the server's front door.

## Live on Vercel (no billing needed)

Step 4 runs at https://ragents-eight.vercel.app/#04-hello-world-python. Vercel runs this same backend as a Python
function: `vercel.json` sends `/api/*` to `api/index.py` (repo root), which loads `backend/main.py`. Packages come from
the root `requirements.txt`, so keep it the same as `backend/requirements.txt`. Every `git push` to `main` redeploys it.

## Alternative: Cloud Run behind Firebase Hosting (needs billing)

On https://ragent-eec65.web.app, step 4 says *"The Python backend isn't deployed on this site yet"* until these steps
are done. Cloud Run needs the **Blaze** plan (billing on). It has a monthly free tier that a project like this normally
stays within, but set a budget alert first.

1. **Turn on Blaze and set a budget alert:** Firebase console → Upgrade → Blaze. Then Google Cloud → Billing → Budgets
   & alerts → a small budget (e.g. $5) with email alerts.
2. **Install the Google Cloud CLI** (`gcloud`) and sign in with your personal account:
   ```bat
   gcloud auth login
   gcloud config set project ragent-eec65
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
   ```
   Behind a corporate proxy (Zscaler), gcloud may need the proxy's root certificate:
   `gcloud config set core/custom_ca_certs_file C:\path\to\zscaler-root.pem`.
3. **Deploy the backend.** Cloud Build builds the Dockerfile in the cloud, so Docker isn't needed locally:
   ```bat
   gcloud run deploy ragents-step4 --source projects\04-hello-world-python\backend --region us-central1 --allow-unauthenticated --max-instances 2 --memory 512Mi
   ```
   `--max-instances 2` caps how many copies can run, which also caps cost if someone floods it.
4. **Route `/api/step4/*` to it.** Add this to `firebase.json` under `"hosting"`, then `firebase deploy --only hosting`:
   ```json
   "rewrites": [
     { "source": "/api/step4/**", "run": { "serviceId": "ragents-step4", "region": "us-central1" } }
   ]
   ```
   Don't add this before the service exists: the Hosting deploy can fail if the Cloud Run service is missing.

## Safety notes for this step

- **No secrets yet:** step 4 has no model and no keys. The server only runs the rules.
- **Input limit:** FastAPI rejects messages over 1000 characters (422) before LangChain runs.
- **Cost cap:** `--max-instances 2` and tiny memory. The endpoint is public, so in the worst case someone uses up the
  free request quota.
- **Not yet:** App Check verification on the server. Step 5 adds it (Python `firebase-admin`) before Gemini moves to
  the server, because that's when a call starts costing quota.
- Locally, everything binds to `127.0.0.1` only.
