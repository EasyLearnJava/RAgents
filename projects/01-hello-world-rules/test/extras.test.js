/**
 * EXTRA: tests for the teaching diagram (public/extras/diagram.js), not for the agent.
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
