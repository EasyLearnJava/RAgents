/**
 * EXTRA: tests for the teaching aids (public/extras/diagram.js and street.js), not for the agent.
 * The diagram works out which rule fired from the reply; this checks it gets that right for every rule.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { respond } from "../public/agent.js";
import { ruleFromReply } from "../public/extras/diagram.js";

test("extras: the diagram names the rule that produced each reply", () => {
  const cases = { "": "empty", "   ": "empty", "hi there": "greeting", "HEY!": "greeting", "weather?": "fallback", "helloooo": "fallback" };
  for (const [msg, rule] of Object.entries(cases)) {
    assert.equal(ruleFromReply(respond(msg)), rule, JSON.stringify(msg));
  }
});

test("extras: the street view plans the trip for each rule", async () => {
  const { tripFor } = await import("../public/extras/street.js");
  const checks = { "": ["yes"], "hi there": ["no", "yes"], "weather?": ["no", "no", "yes"] };
  for (const [msg, expected] of Object.entries(checks)) {
    const trip = tripFor(msg, respond(msg));
    assert.deepEqual(trip.checks, expected, JSON.stringify(msg));
    assert.equal(trip.legs.length, 7);
    assert.match(trip.legs.at(-1).say, /^You see “/);
  }
  assert.equal(tripFor("hello", "Hello World").said, "“Hello World”");
});
