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
| `public/index.html` | Chat + diagram; calls the backend with `fetch` |
| `backend/agent.py` | The chain in Python: `normalize \| rules` (`RunnableLambda`, `RunnableBranch`) and `run_with_events()` |
| `backend/main.py` | FastAPI: `GET /api/step4/health`, `POST /api/step4/chat` (rejects > 1000 characters with 422) |
| `backend/tests/test_agent.py` | pytest: same replies as step 1, events reported, API status codes |
| `backend/requirements*.txt` | Pinned packages (server / server + tests) |
| `backend/Dockerfile`, `.gcloudignore` | How Cloud Run builds and runs it (used only when deploying) |

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
port 8000, the same way Firebase Hosting will forward `/api/*` to Cloud Run. The badge shows the Python and
langchain-core versions when the backend is running. If the backend isn't running, the chat says so.

Things to try: `hi there`, `weather?`, an empty message, and more than 1000 characters (the server answers 422).

## Put it on the live site (needs billing)

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
