/**
 * Tests for step 3's LangChain agent (public/agent.js).
 * The replies must match step 1 exactly: same rules, different building blocks.
 * Run from the repo root with:  npm install (once), then npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { chain } from "../public/agent.js";
import { respond as step1 } from "../../01-hello-world-rules/public/agent.js";

test("step 3: gives exactly the same replies as step 1", async () => {
  for (const msg of ["Hello", "  HELLO  ", "hi there", "hey!", "helloooo", "say hello", "What's the weather?", "", "   ", null, undefined]) {
    assert.equal((await chain.invoke(msg)).reply, step1(msg), String(msg));
  }
});

test("step 3: the chain names the branch that fired", async () => {
  assert.deepEqual(await chain.invoke("hi"), { reply: "Hello World", rule: "greeting" });
  assert.equal((await chain.invoke("weather?")).rule, "fallback");
  assert.equal((await chain.invoke("  ")).rule, "empty");
});

test("step 3: streamEvents() reports each named step (the diagram uses this)", async () => {
  const names = [];
  for await (const e of chain.streamEvents("hello", { version: "v2" })) {
    if (e.event === "on_chain_end") names.push(e.name);
  }
  for (const name of ["normalize", "is empty?", "is greeting?", "reply: Hello World", "rules", "hello-chain"]) {
    assert.ok(names.includes(name), `missing ${name} in ${names.join(", ")}`);
  }
  assert.ok(!names.includes("reply: fallback"), "the fallback branch must not run for a greeting");
});
