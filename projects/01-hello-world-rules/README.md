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
| `public/extras/street.js` | The "Street view" on its own row under the chat: a small isometric town, drawn inside a browser window with the server outside it, where a black sports car drives your message along a winding road from your house, through the form's gate (submit), to the index.html depot (`onSend`) and the agent.js factory (`respond`), then brings the reply back. A tracker and a line of narration follow each stop, and the server panel counts the page's real network requests since your first message (it stays at 0). Built with the shared toolkit `/lib/town.js` (plain SVG, no library) |
| `public/extras/diagram.js` | The "What happens when you press Send" box diagram under the street view. It replays each message, naming each function (`onSend` → `respond` → `add`) |
| `test/extras.test.js` | Checks the diagram names the right rule for each reply, and the street view plans the right trip |

To see the agent without the extras, delete the lines marked `EXTRA` in `index.html`; the chat works the same.

**How it works:** the browser runs `respond()` directly. No server, no model, no API key.

**What's missing:** it only understands greetings. Step 2 replaces the rules with a real model.
