/**
 * Tests for step 1's rule-based agent (public/agent.js).
 * Run from the repo root with:  npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { respond } from "../public/agent.js";

test("step 1: greetings get Hello World", () => {
  for (const msg of ["Hello", "hello", "  HELLO  ", "hello there", "Hi", "hey!"]) {
    assert.equal(respond(msg), "Hello World", msg);
  }
});

test("step 1: other messages get a nudge", () => {
  for (const msg of ["What's the weather?", "helloooo", "say hello", "123"]) {
    assert.notEqual(respond(msg), "Hello World", msg);
  }
});

test("step 1: empty input is handled", () => {
  for (const msg of ["", "   ", undefined, null]) {
    assert.match(respond(msg), /Hello/);
  }
});
