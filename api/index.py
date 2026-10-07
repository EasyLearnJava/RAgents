"""
Vercel entry point for the Python backend (used only on Vercel; locally you run uvicorn in the backend folder).

Vercel turns this file into one Python function. vercel.json sends every /api/* request here, and
FastAPI routes it by its original path (/api/step4/health, /api/step4/chat). The app itself lives in
projects/04-hello-world-python/backend/main.py; this file only puts that folder on the import path.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "projects" / "04-hello-world-python" / "backend"))

from main import app  # noqa: E402  (import after the path is set)
