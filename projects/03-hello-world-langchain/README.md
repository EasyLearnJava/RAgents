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
| `public/extras/diagram.js` | The "What happens when you press Send" diagram, built from LangChain's `streamEvents()` |
| `public/extras/langsmith-todo.js` + `.html` | The "To do: show a LangSmith trace" card (planning notes and risks) |

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

## What the diagram shows

`extras/diagram.js` runs the chain once more with `chain.streamEvents(text, { version: "v2" })` (instant, no model) and records LangChain's real events
(`on_chain_start` / `on_chain_end` for `hello-chain`, `normalize`, `rules`, `is empty?`, `is greeting?`, `reply: …`).
The whole chain takes a few milliseconds, so the diagram replays those events slowly. The trace shows the real event
names, outputs and times, and the `rules` box shows which checks ran, e.g. `is empty? no · is greeting? yes → reply: Hello World`.

## How LangChain gets into the browser (no build step)

- `index.html` has an **import map**: the name `@langchain/core/runnables` points to
  `https://cdn.jsdelivr.net/npm/@langchain/core@1.2.17/runnables/+esm`.
- In tests, Node resolves the same name from `node_modules`. Run `npm install` once in the repo root
  (`@langchain/core` is pinned to `1.2.17` in `package.json`). Keep the two versions in sync when upgrading.
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
