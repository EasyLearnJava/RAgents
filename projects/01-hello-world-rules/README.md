# Step 1 · Hello World (rules)

Say **Hello** (or hi / hey) and the agent replies **Hello World**. Anything else gets a nudge.

**The agent** (all you need to read to understand step 1):

| File | What it is |
|---|---|
| `public/agent.js` | The agent: `respond(message)`, three rules in a few lines |
| `public/index.html` | The chat page: `onSend()` calls `respond(text)` and shows the reply with `add()` |
| `public/style.css` | How the chat page looks |
| `test/agent.test.js` | Tests for `respond()` |
| `project.json` | Title, summary and "next" shown in the site's left nav |

**Extras** (teaching aids, not part of the agent):

| File | What it is |
|---|---|
| `public/index.html` (the `<aside class="about">`) | The "About this step" panel next to the chat: what you learn, how a message travels, what leaves your browser (the page's files once, nothing per message, and how to check in DevTools), limits, safety |
| `public/extras/street.js` | The "Street view" on its own row under the chat: a small isometric town, drawn inside a browser window with the server outside it, where a black sports car drives your message along a winding road from your house, through the form's gate (submit), to the index.html depot (`onSend`) and the agent.js factory (`respond`), then brings the reply back. A tracker and a line of narration follow each stop, with the real times in the narration, and the server panel counts the page's real network requests since your first message (it stays at 0). Under the tracker, "Where the time went" shows each stage's real time (see `timing.js`). Built with the shared toolkit `/lib/town.js` (plain SVG, no library) |
| `public/extras/timing.js` | The sums for the street view's "Where the time went" panel: the real time of each stage of a message, from the times `index.html` notes on its `EXTRA` lines (the "submit" event, `onSend` starting, just before and just after `respond()`, the reply on the page) and the next frame, which `street.js` times (when it starts, and when the browser has drawn it). Everything runs in your browser, so every stage is blue, and most take a fraction of a millisecond. The browser's clock is blurred on purpose and moves in steps (0.1 ms in Chrome and Edge; `clockStep()` measures it). A stage during which the clock didn't tick shows as "< 0.1 ms", and one it ticked once in as "~0.1 ms": one tick only means the clock happened to tick during it, so both are too quick to measure, as `respond()` usually is. Usually, most of the time goes to waiting for the browser's next frame (a 60 Hz screen draws one every 16.7 ms). The screen then shows that frame at its next refresh or so, which the page can't time |
| `public/extras/diagram.js` | The "What happens when you press Send" box diagram under the street view. It replays each message, naming each function (`onSend` → `respond` → `add`) |
| `test/extras.test.js` | Checks the diagram names the right rule for each reply, and the street view plans the right trip and narrates it (with the real times when it has them) |
| `test/timing.test.js` | Tests for the timing sums and the duration format in `public/extras/timing.js` |

To see the agent without the extras, delete the lines marked `EXTRA` in `index.html`; the chat works the same.

**How it works:** the browser runs `respond()` directly. No server, no model, no API key.

**What's missing:** it only understands greetings. Step 2 replaces the rules with a real model.
