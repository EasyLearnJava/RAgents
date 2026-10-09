/**
 * EXTRA: tests for the teaching aids (public/extras/record.js and trip.js), not for the agent.
 * They record LangChain's real events with the real chain, then check the street view plans the right trip from them.
 * Run from the repo root with:  npm install (once), then npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { chain } from "../public/agent.js";
import { STEPS, record } from "../public/extras/record.js";
import { TRACK, tripFor } from "../public/extras/trip.js";

/** Runs the chain for real, records it like index.html does, and plans the street view's trip from both. */
async function plan(text, took) {
  const result = await chain.invoke(text);
  const recording = await record(chain, text);
  return { result, recording, trip: tripFor(text, result, recording, took) };
}

test("extras: record() keeps the named steps' start and end events, in order, with their times", async () => {
  const { events, ms } = (await plan("hi there")).recording;
  assert.ok(events.every((e) => STEPS.has(e.name) && (e.event === "on_chain_start" || e.event === "on_chain_end")));
  assert.ok(events.every((e, i) => i === 0 || e.ms >= events[i - 1].ms), "times only go forward");
  assert.ok(ms >= events.at(-1).ms);
  const ends = events.filter((e) => e.event === "on_chain_end").map((e) => e.name);
  assert.deepEqual(ends, ["normalize", "is empty?", "is greeting?", "reply: Hello World", "rules", "hello-chain"]);
  assert.deepEqual(events.at(-1).output, { reply: "Hello World", rule: "greeting" });
});

test("extras: rules' board shows the conditions RunnableBranch really tried, for each rule", async () => {
  const boards = { "": ["yes", "skip", "skip"], "   ": ["yes", "skip", "skip"], "hi there": ["no", "yes", "skip"],
    "HEY!": ["no", "yes", "skip"], "weather?": ["no", "no", "yes"], "helloooo": ["no", "no", "yes"] };
  for (const [msg, board] of Object.entries(boards)) {
    const { result, trip } = await plan(msg);
    assert.deepEqual(trip.board, board, JSON.stringify(msg));
    assert.equal(trip.legs.length, TRACK.length);
    assert.equal(trip.said, `“${result.reply.length > 34 ? result.reply.slice(0, 33) + "…" : result.reply}”`);
  }
});

test("extras: the car's tag shows what normalize trims", async () => {
  const spaced = (await plan("  Hi there  ")).trip;
  assert.equal(spaced.typed, "“··Hi there··”");
  assert.equal(spaced.trimmed, "“Hi there”");
  assert.match(spaced.legs[0].say, /· marks a space/);
  assert.match(spaced.legs[3].say, /on_chain_end · normalize with output “Hi there”\. The spaces at the ends are gone/);
  assert.match((await plan("hello")).trip.legs[3].say, /Nothing to trim/);
  const blank = (await plan("   ")).trip;
  assert.equal(blank.typed, "“···”");
  assert.equal(blank.trimmed, "“”");
});

test("extras: the narration names the real events and outputs", async () => {
  const greet = (await plan("hi there", "9.4 ms")).trip;
  assert.match(greet.legs[4].say, /is empty\? → false, is greeting\? → true\. The first true one picks reply: Hello World/);
  assert.match(greet.legs[5].say, /chain\.invoke\(\) resolves to \{reply: “Hello World”, rule: greeting\}/);
  assert.match(greet.legs[7].say, /^You see “Hello World”\. The real trip took 9\.4 ms/);
  const other = (await plan("weather?")).trip;
  assert.match(other.legs[4].say, /None is true, so it runs the default, reply: fallback/);
  assert.match(other.legs[7].say, /^You see “I only know one thing so far\. Say "Hello"!”\. Nothing went over the network\./);
  const empty = (await plan("")).trip;
  assert.match(empty.legs[0].say, /without typing anything/);
  assert.match(empty.legs[2].say, /adds no bubble/);
  assert.match(empty.legs[4].say, /is empty\? → true\. The first true one picks reply: hint/);
});
