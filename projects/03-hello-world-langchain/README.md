# Step 3 · Hello World (LangChain)

Step 1 again, with the same rules and the same replies, built with **LangChain.js**. There's no model yet: this step is
about LangChain's building blocks, so the model can drop into place later.

| File | What it is |
|---|---|
| `project.json` | Title, summary and "what you learn" for the site's left nav |
| `public/agent.js` | The agent as a LangChain chain: `normalize` (RunnableLambda) `.pipe(` `rules` (RunnableBranch) `)`. The page calls `chain.invoke(text)` |
| `public/index.html` | Chat window + import map (loads LangChain from the CDN) |
| `public/style.css` | How the chat page looks |
| `test/agent.test.js` | Checks every reply matches step 1, and that `streamEvents()` reports each step |

**Extras** (teaching aids, not part of the agent):

| File | What it is |
|---|---|
| `public/index.html` (the `<aside class="about">`) | The "About this step" panel next to the chat: what you learn, how a message travels, what leaves your browser, why LangChain for three rules, limits, and safety and what's still possible |
| `public/extras/street.js` | The "Street view" on its own row under the chat: the trip as a car ride through an isometric town drawn inside a browser window, with the outside world (this site's server and the jsDelivr CDN) next to it (under the timings on a phone), a tracker, narration, Replay and Speed. Under the tracker, "Where the time went". See below. Built with `/lib/town.js` |
| `public/extras/trip.js` | Plans each street-view trip from LangChain's events: what the car carries at each stop, what rules' board shows, and the narration (no page needed, so it's tested) |
| `public/extras/record.js` | Records LangChain's report of each message once: one more run of the chain with `streamEvents()`, after the reply is drawn. The diagram and the street view share the recording |
| `public/extras/timing.js` | The sums for "Where the time went": the real run's stages, the recorded run's split, and durations shown no finer than the browser's clock |
| `public/extras/diagram.js` | The "What happens when you press Send" diagram, replayed from the recording |
| `public/extras/langsmith-todo.js` + `.html` | The "To do: show a LangSmith trace" card (planning notes and risks) |
| `test/extras.test.js` | Records the real chain for each rule and checks the trip planned from it: the board, the tags, the narration |
| `test/timing.test.js` | Tests for the sums in `timing.js` |

To see the agent without the extras, delete the lines marked `EXTRA` in `index.html`; the chat works the same.

## Step 1 vs step 3

```js
// Step 1: plain JavaScript
export function respond(message) {
  const text = String(message ?? "").trim();
  if (text === "") return "Type something first. Try: Hello";
  if (GREETING.test(text)) return "Hello World";
  return 'I only know one thing so far. Say "Hello"!';
}

// Step 3: the same logic as a LangChain chain
const normalize = step("normalize", (m) => String(m ?? "").trim());          // RunnableLambda
const rules = RunnableBranch.from([
  [step("is empty?", (t) => t === ""),         step("reply: hint", ...)],
  [step("is greeting?", (t) => GREETING.test(t)), step("reply: Hello World", ...)],
  step("reply: fallback", ...),                                                // default branch
]);
export const chain = normalize.pipe(rules);
await chain.invoke("hi there");   // → { reply: "Hello World", rule: "greeting" }
```

**Why bother, if it does the same thing?** In LangChain every piece is a *Runnable* with the same methods
(`.invoke`, `.pipe`, `.batch`, `.stream`, `.streamEvents`), whether it's a function, a prompt, a model or a tool.
So a later step can swap `reply: fallback` for a real model and keep the rest of the chain. You also get
`streamEvents()` for free: LangChain reports each step as it runs.

## Recording LangChain's events, once per message

The page can't see inside `chain.invoke()`, so after each reply `extras/record.js` runs the chain once more with
`chain.streamEvents(text, { version: "v2" })` (instant, no model) and keeps LangChain's real events (`on_chain_start` /
`on_chain_end` for `hello-chain`, `normalize`, `rules`, `is empty?`, `is greeting?`, `reply: …`) with their outputs and
the time the page received each one. `index.html` records once and hands the recording to both the diagram and the
street view. It waits until the browser has drawn the reply: a run of this chain finishes without giving the browser a
chance to draw, so starting it straight away would hold up the reply and the real run's timings.

## What the street view shows

A black car carries your message along one road, stopping where each piece runs, all inside a drawn browser window:

1. **Your house** (the chat): the car's tag shows what you typed. Spaces at either end show as `·`.
2. **The form's gate**: the browser fires the "submit" event and `onSend(e)` starts.
3. **The index.html depot**: `onSend(e)` adds your bubble (none for an empty message), clears the box and calls
   `chain.invoke(text)`.
4. **The normalize station** (a RunnableLambda): `on_chain_end · normalize` brings the trimmed text, and the tag changes
   to it.
5. **The rules station** (a RunnableBranch): its board lights up each condition it really tried, in order, with what it
   returned (`is empty?` → no, `is greeting?` → yes…), then the reply step it picked. The car loads `{ reply, rule }`.
6. **Back at the depot**: `chain.invoke()` resolves, and `add(result.reply, "bot")` puts the reply on the page.
7. **Home**: you see the reply, with the real time the trip took.

The narration under the tracker names the real events and outputs at each stop. `.pipe()` is painted on the road as it
leaves the normalize station for rules, and the rules station's chimney smokes while its board is checked. It's all
slowed right down: Replay plays the last trip again, Speed switches between 1×, 2× and ½×.

**Outside the browser window** are the two places the page downloaded files from while it loaded: this site's server
(the page's own files) and the jsDelivr CDN. The CDN panel sums up what really came from it, from the browser's Resource
Timing: the import map has one entry, `@langchain/core/runnables`, and that file imports langsmith, zod and a few small
helpers from jsDelivr too, so about a dozen files arrive (around 0.3 MB, 1.2 MB of JavaScript unpacked), and Send stays
off until they have. The list of files folds open under that summary. Under it, the page's network requests since your
first message: it stays at 0, and the page works offline once it has loaded. On a narrow screen (a phone) this panel
goes last, under the timings, so the scene keeps its tracker and narration right under it.

## Where the time went

Under the tracker, the real time of each stage of your last message, from the page's own clock. The lines marked `EXTRA`
in `index.html` note the moments: the submit event's own timestamp (`e.timeStamp`), `onSend(e)` starting, the real
`chain.invoke()` being called and resolving, and `onSend(e)` finishing. `street.js` adds the start of the browser's next
frame, which draws the reply. The stages are back to back, so they add up to the total:

| Stage | From → to |
|---|---|
| 1–2 · the submit event fires → `onSend(e)` starts | `e.timeStamp` → right after `e.preventDefault()`, the first line of `onSend(e)` |
| 3 · `onSend(e)`: `add(text, "you")`, clear the box | → just before `chain.invoke(text)` |
| 4–6 · `chain.invoke(text)`, the real call | → when it resolves |
| 7 · `add(result.reply, "bot")`, `input.focus()` | → right after `input.focus()` |
| 8 · waiting for the browser's next frame | → the start of the frame that draws the reply |

It's all blue: everything runs in your browser, with no network time. The whole trip takes milliseconds, and the wait
for the next frame (up to about 17 ms at 60 Hz) is often the biggest part. The note also says whether your bubble and
the reply appeared in the same frame: `chain.invoke()` is async, but here it finishes without giving the browser a
chance to draw.

**The clock is coarse on purpose:** browsers blur `performance.now()` to make timing attacks harder. In Chrome and Edge
it moves in 0.1 ms steps. `timing.js` measures the step when the page loads, never shows more precision than that, and
shows anything shorter as `< 0.1 ms`.

**Inside `chain.invoke()`** the page can't time LangChain's steps, so a second panel splits the *recorded* run instead:
normalize, each step rules ran, RunnableBranch's own work, and LangChain's bookkeeping (starting the run, handing the
text on, reporting the events). It has its own total and is never added to the real run's. That run is usually slower
than the real call, because LangChain reports every step, and each part is the time between events as the page
received them, so it includes that reporting work.

## What the diagram shows

`extras/diagram.js` replays the same recording slowly, box by box. The trace shows the real event names, outputs and
times, and the `rules` box shows which checks ran, e.g. `is empty? no · is greeting? yes → reply: Hello World`.

## How LangChain gets into the browser (no build step)

- `index.html` has an **import map**: the name `@langchain/core/runnables` points to
  `https://cdn.jsdelivr.net/npm/@langchain/core@1.2.17/runnables/+esm`. That file is built by jsDelivr, and it imports
  its own dependencies from jsDelivr by version (langsmith 0.10.8, zod 4.6.5, … when this was written): those versions
  are chosen inside jsDelivr's file, not by this repo.
- In tests, Node resolves the same name from `node_modules`. Run `npm install` once in the repo root
  (`@langchain/core` is pinned to `1.2.17` in `package.json`). Keep the two versions in sync when upgrading.
- **Integrity:** nothing checks the downloaded code. The import map has no integrity hashes, and jsDelivr's `+esm`
  files say themselves not to use them ("Do NOT use SRI with dynamically generated files!"). Serving LangChain from this
  site, with hashes and a Content Security Policy, would close that gap; it isn't done yet.
- **Privacy:** the browser only *downloads* LangChain's code from jsDelivr. Messages never leave the page:
  there's no model, and LangSmith tracing (LangChain's hosted tracing service) is off unless you configure it.

## Try it

```bat
npm install
npm test
npm run serve
```

Open http://127.0.0.1:5000/#03-hello-world-langchain and send `hi there`, `weather?` and an empty message.
Compare the replies with step 1: they're identical, and the tests check that.
