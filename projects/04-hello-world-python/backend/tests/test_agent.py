"""
Tests for step 4 (Python). Run from the backend folder with the virtual environment active:
    python -m pytest
The expected replies are step 1's: same rules, now in Python on a server.
"""
import asyncio

import pytest
from fastapi.testclient import TestClient

from agent import chain, run_with_events
from main import MAX_CHARS, app

HINT = "Type something first. Try: Hello"
NUDGE = 'I only know one thing so far. Say "Hello"!'

# The same inputs step 3's tests compare against step 1, with step 1's replies.
SAME_AS_STEP_1 = [
    ("Hello", "Hello World"), ("  HELLO  ", "Hello World"), ("hi there", "Hello World"), ("hey!", "Hello World"),
    ("helloooo", NUDGE), ("say hello", NUDGE), ("What's the weather?", NUDGE),
    ("", HINT), ("   ", HINT), (None, HINT),
]


@pytest.mark.parametrize("message, expected", SAME_AS_STEP_1)
def test_same_replies_as_step_1(message, expected):
    assert chain.invoke(message)["reply"] == expected


def test_chain_names_the_branch():
    assert chain.invoke("hi") == {"reply": "Hello World", "rule": "greeting"}
    assert chain.invoke("weather?")["rule"] == "fallback"
    assert chain.invoke("  ")["rule"] == "empty"


def test_events_report_each_named_step():
    result, events, ms = asyncio.run(run_with_events("hello"))
    ended = [e["name"] for e in events if e["event"] == "on_chain_end"]
    for name in ["normalize", "is empty?", "is greeting?", "reply: Hello World", "rules", "hello-chain"]:
        assert name in ended, f"missing {name} in {ended}"
    assert "reply: fallback" not in ended, "the fallback branch must not run for a greeting"
    assert result["reply"] == "Hello World" and ms >= 0


client = TestClient(app)


def test_api_chat_returns_reply_and_trace():
    r = client.post("/api/step4/chat", json={"message": "hi there"})
    assert r.status_code == 200
    body = r.json()
    assert body["reply"] == "Hello World" and body["rule"] == "greeting"
    assert any(e["name"] == "is greeting?" for e in body["events"])


def test_api_rejects_oversized_input():
    r = client.post("/api/step4/chat", json={"message": "a" * (MAX_CHARS + 1)})
    assert r.status_code == 422


def test_api_health():
    body = client.get("/api/step4/health").json()
    assert body["ok"] is True and body["langchain_core"]
