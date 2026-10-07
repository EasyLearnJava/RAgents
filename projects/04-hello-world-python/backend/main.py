"""
The step 4 backend: a small FastAPI app that runs the LangChain chain from agent.py.

Endpoints (the browser calls these on the same site; see the README for how /api reaches this server):
    GET  /api/step4/health  -> {"ok": true, "python": "3.13.x", "langchain_core": "1.x"}
    POST /api/step4/chat    {"message": "hi"} -> {"reply", "rule", "events", "server_ms", ...}

Run locally (from this folder, with the virtual environment active):
    uvicorn main:app --host 127.0.0.1 --port 8000
On Cloud Run the Dockerfile starts the same app on the port Cloud Run gives it.
"""
import platform
from importlib.metadata import version

from fastapi import FastAPI
from pydantic import BaseModel, Field

from agent import run_with_events

# Longest message accepted. Step 1 has no limit, but a public server should never accept unbounded input:
# FastAPI rejects anything longer with a 422 error before the chain runs.
MAX_CHARS = 1000

app = FastAPI(title="RAgents step 4", docs_url=None, redoc_url=None)   # no public API docs page


class ChatIn(BaseModel):
    """Request body: what the user typed."""
    message: str = Field(default="", max_length=MAX_CHARS)


@app.get("/api/step4/health")
def health():
    """Lets the page show "Python backend ready" and which versions are running."""
    return {"ok": True, "python": platform.python_version(), "langchain_core": version("langchain-core")}


@app.post("/api/step4/chat")
async def chat(body: ChatIn):
    """Runs one message through the chain and returns the reply plus LangChain's event trace."""
    result, events, server_ms = await run_with_events(body.message)
    return {"reply": result["reply"], "rule": result["rule"], "events": events, "server_ms": server_ms}
