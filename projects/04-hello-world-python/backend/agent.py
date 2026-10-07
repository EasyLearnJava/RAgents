"""
Step 4: the Hello World agent as a LangChain chain, in Python, running on a server.

Same rules and replies as step 1 (plain JS) and step 3 (LangChain.js):

    normalize (RunnableLambda: trim the text)
      | rules (RunnableBranch: is empty? -> is greeting? -> fallback)

Python's LangChain uses the same building blocks as LangChain.js; `a | b` is Python's `a.pipe(b)`.
No model, no keys: this step is about moving the agent to a backend. main.py exposes it over HTTP.

main.py's chat() endpoint calls run_with_events(message) for every message; tests/test_agent.py tests the chain.
"""
import re
import time

from langchain_core.runnables import RunnableBranch, RunnableLambda

# Same greeting rule as steps 1 and 3: hello / hi / hey at the start, any case, as a whole word.
GREETING = re.compile(r"^\s*(hello|hi|hey)\b", re.IGNORECASE)


def step(name, fn):
    """Wraps a plain function as a named Runnable, so it shows up by name in the event trace."""
    return RunnableLambda(fn).with_config(run_name=name)


# Chain step 1: turn whatever came in into trimmed text (None becomes "").
normalize = step("normalize", lambda message: str(message if message is not None else "").strip())

# Chain step 2: pick the reply. RunnableBranch runs the action of the first condition that is true;
# the last entry is the default. Each reply carries the rule that produced it.
rules = RunnableBranch(
    (step("is empty?", lambda text: text == ""),
     step("reply: hint", lambda _: {"reply": "Type something first. Try: Hello", "rule": "empty"})),
    (step("is greeting?", lambda text: bool(GREETING.match(text))),
     step("reply: Hello World", lambda _: {"reply": "Hello World", "rule": "greeting"})),
    step("reply: fallback", lambda _: {"reply": 'I only know one thing so far. Say "Hello"!', "rule": "fallback"}),
).with_config(run_name="rules")

# The whole agent: normalize, then rules. chain.invoke(message) returns {"reply": ..., "rule": ...}.
chain = (normalize | rules).with_config(run_name="hello-chain")

# Named steps reported back to the page (LangChain also emits unnamed internal runs).
SHOWN = {"hello-chain", "normalize", "rules", "is empty?", "is greeting?",
         "reply: hint", "reply: Hello World", "reply: fallback"}


async def run_with_events(message):
    """
    Runs the chain and returns (result, events, total_ms): the reply plus each named step LangChain reported,
    [{"event": "on_chain_start" | "on_chain_end", "name": ..., "ms": time since start, "output": ...}].
    The events are for the page's diagram (an extra); the reply works the same without them.
    """
    events, result = [], None
    t0 = time.perf_counter()
    async for e in chain.astream_events(message, version="v2"):
        if e["name"] not in SHOWN or e["event"] not in ("on_chain_start", "on_chain_end"):
            continue
        output = e.get("data", {}).get("output") if e["event"] == "on_chain_end" else None
        events.append({"event": e["event"], "name": e["name"],
                       "ms": round((time.perf_counter() - t0) * 1000, 2), "output": output})
        if e["event"] == "on_chain_end" and e["name"] == "hello-chain":
            result = output
    return result, events, round((time.perf_counter() - t0) * 1000, 2)
