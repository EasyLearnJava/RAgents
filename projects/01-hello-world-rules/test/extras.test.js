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

test("extras: the narration gives the real times when it has them", async () => {
  const { tripFor } = await import("../public/extras/street.js");
  const timed = tripFor("hello", respond("hello"), { respond: "too quick for your browser's clock to measure", total: "9.8 ms" });
  assert.match(timed.legs[3].say, /Real time: too quick for your browser's clock to measure\.$/);
  assert.match(timed.legs[6].say, /Real time from Send until the browser drew it: 9\.8 ms\. Nothing went to a server\.$/);
  assert.doesNotMatch(tripFor("hello", respond("hello")).legs[6].say, /Real time/);
});

test("extras: a blank message (nothing typed, or only spaces) gets no bubble of yours, and is quoted as it is", async () => {
  const { tripFor } = await import("../public/extras/street.js");
  const nothing = tripFor("", respond(""));
  assert.equal(nothing.typed, "“”");
  assert.match(nothing.legs[0].say, /^You pressed Send with nothing typed\./);
  assert.match(nothing.legs[2].say, /: nothing typed, so text\.trim\(\) is empty and there's no bubble of yours to add\./);
  assert.match(nothing.legs[2].say, /It calls respond\(“”\)\.$/);
  const spaces = tripFor("   ", respond("   "));
  assert.equal(spaces.typed, "“   ”");
  assert.match(spaces.legs[0].say, /^You pressed Send with only spaces typed\./);
  assert.match(spaces.legs[2].say, /: only spaces typed, so text\.trim\(\) is empty and there's no bubble of yours to add\./);
  assert.match(spaces.legs[2].say, /It calls respond\(“   ”\)\.$/);           // what onSend(e) really passes
  assert.equal(tripFor("  hi  ", respond("  hi  ")).typed, "“hi”");     // a real message is shown without its spaces
});
