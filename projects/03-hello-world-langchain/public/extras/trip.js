/**
 * EXTRA: a teaching aid, not part of the agent.
 *
 * Plans one message's trip for the street view (street.js draws it) from LangChain's own events for that message
 * (record.js): what the car carries at each stop, what rules' board shows, and the narration for each stop on the
 * tracker, with the real event names and outputs.
 *
 * Pure: no page needed, so test/extras.test.js runs it in Node with the real chain.
 */

/** The tracker under the scene: one entry per stop. "\u00ad" is a soft hyphen: on a phone the long names break there. */
export const TRACK = [
  ["Typed", "You"], ["Submit", "<form>"], ["onSend(e)", "index.html"], ["normalize", "Runnable\u00adLambda"],
  ["rules", "Runnable\u00adBranch"], ["Returned", "{ reply, rule }"], ["add(reply)", "index.html"], ["Shown", "You"],
];

/** rules' branches in agent.js, in the order RunnableBranch tries them: [condition, reply step]; null is the default. */
export const BRANCHES = [["is empty?", "reply: hint"], ["is greeting?", "reply: Hello World"], [null, "reply: fallback"]];

/** Quotes text for a label, shortened to `max` characters. */
export const quote = (s, max) => `“${s.length > max ? s.slice(0, max - 1) + "…" : s}”`;

/** Text as the car's tag shows it: spaces at either end become ·, so you can see what normalize trims. */
export const visible = (s) => s.replace(/^\s+|\s+$/g, (m) => "·".repeat(m.length));

/** A chain result as a short label, e.g. {reply: “Hello World”, rule: greeting}. */
export const resultLabel = (r, max = 18) => `{reply: ${quote(r.reply, max)}, rule: ${r.rule}}`;

/**
 * Plans the trip.
 * @param {string} text What the user typed.
 * @param {{reply: string, rule: string}} result What the real chain.invoke() returned.
 * @param {{events: {event: string, name: string, output?: unknown}[]}} recording record.js's events for this message.
 * @param {string} [took] How long the real trip took (from "Where the time went"), for the last stop.
 * @returns {{typed: string, trimmed: string, carried: string, said: string, board: string[], legs: {stop: string, say: string}[]}}
 *   typed and trimmed: the car's tag before and after normalize; carried: the result it brings back; said: the reply;
 *   board: each branch's state on rules' board ("yes", "no" or "skip"); legs: one per tracker entry.
 */
export function tripFor(text, result, { events }, took) {
  const raw = String(text ?? "");
  const ends = events.filter((e) => e.event === "on_chain_end");
  const output = String(ends.find((e) => e.name === "normalize")?.output ?? raw.trim());
  const checks = ends.filter((e) => e.name.endsWith("?"));                 // rules' conditions, in the order they ran
  const ran = ends.find((e) => e.name.startsWith("reply:"))?.name ?? "";   // the reply step rules picked
  const board = BRANCHES.map(([condition, step]) => {
    if (!condition) return ran === step ? "yes" : "skip";
    const check = checks.find((e) => e.name === condition);
    return !check ? "skip" : check.output ? "yes" : "no";
  });
  const typed = quote(visible(raw), 26), trimmed = quote(output, 26);
  const carried = resultLabel(result), said = quote(result.reply, 34);
  const tried = checks.map((e) => `${e.name} → ${e.output}`).join(", ");
  const picked = checks.some((e) => e.output) ? `The first true one picks ${ran}` : `None is true, so it runs the default, ${ran}`;
  const legs = [
    { stop: "house", say: raw === ""
      ? "You pressed Send without typing anything. The empty message still gets into the car, which never leaves this browser tab."
      : `You typed ${typed}${raw !== raw.trim() ? " (· marks a space)" : ""} and pressed Send. The message gets into the car, ` +
        "which never leaves this browser tab." },
    { stop: "gate", say: 'The browser fires a "submit" event on <form id="form">: the gate opens and onSend(e) starts.' },
    { stop: "depot", say: `${raw.trim() ? 'onSend(e) adds your bubble with add(text, "you"), clears the box'
      : "onSend(e) adds no bubble (there's nothing to show), clears the box"} and calls chain.invoke(${typed}). ` +
      "LangChain starts the chain: on_chain_start · hello-chain." },
    { stop: "normalize", say: "normalize, a RunnableLambda, runs String(message ?? \"\").trim(): on_chain_start · normalize, then " +
      `on_chain_end · normalize with output ${trimmed}. ${output !== raw ? `The spaces at the ends are gone, so the tag changes to ${trimmed}.`
        : "Nothing to trim, so the text stays the same."} .pipe() hands it on to rules.` },
    { stop: "rules", say: `rules, a RunnableBranch, tries its conditions in order, and LangChain reports each result: ${tried}. ` +
      `${picked}, which returns ${carried}.` },
    { stop: "depot", say: `on_chain_end · rules, then on_chain_end · hello-chain: chain.invoke() resolves to ${carried}, and ` +
      "onSend(e) carries on after its await." },
    { stop: "depot", say: 'onSend(e) calls add(result.reply, "bot"): a new <div class="msg bot"> goes on the page, its text set with textContent.' },
    { stop: "house", say: `You see ${quote(result.reply, 80)}. ${took ? `The real trip took ${took} ("Where the time went" below has ` +
      "each stage), and nothing" : "Nothing"} went over the network.` },
  ];
  return { typed, trimmed, carried, said, board, legs };
}
