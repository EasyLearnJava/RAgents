/**
 * Tests for step 2's agent logic (public/agent.js).
 * They pass a fake `generate` function instead of Gemini, so they're fast, free and need no network.
 * Run from the repo root with:  npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_CHARS, createAgent, friendlyError, setupProblem } from "../public/agent.js";

test("step 2: sends the trimmed message to the model and returns its reply", async () => {
  const sent = [];
  const respond = createAgent(async (text) => { sent.push(text); return "  Hello World! Nice to meet you.  "; });
  assert.equal(await respond("  Hello  "), "Hello World! Nice to meet you.");
  assert.deepEqual(sent, ["Hello"]);
});

test("step 2: empty and too-long input never reach the model", async () => {
  let calls = 0;
  const respond = createAgent(async () => { calls++; return "x"; });
  assert.match(await respond("   "), /Type something/);
  assert.match(await respond("a".repeat(MAX_CHARS + 1)), /long message/);
  assert.equal(calls, 0);
});

test("step 2: model errors become friendly messages", async () => {
  const fail = (m) => createAgent(async () => { throw new Error(m); });
  assert.match(await fail("403 - PERMISSION_DENIED: To access this model, you must enforce Firebase App Check.")("Hi"), /App Check/);
  assert.match(await fail("429 RESOURCE_EXHAUSTED")("Hi"), /quota/);
  assert.match(await fail("Failed to fetch")("Hi"), /reach the model/);
  assert.match(await fail("boom")("Hi"), /Something went wrong.*boom/);
});

test("step 2: an empty model reply is handled", async () => {
  assert.match(await createAgent(async () => "")("Hi"), /empty reply/);
});

test("step 2: setup problems are reported before calling the model", () => {
  const config = { apiKey: "x", projectId: "ragent-eec65" };
  assert.match(setupProblem({ config: null, siteKey: "k", model: "m" }), /web config/);
  assert.match(setupProblem({ config, siteKey: "", model: "m" }), /site key/);
  assert.equal(setupProblem({ config, siteKey: "k", model: "m" }), null);
  assert.match(friendlyError("anything"), /anything/);
});
