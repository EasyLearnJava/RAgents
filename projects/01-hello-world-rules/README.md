# Step 1 · Hello World (rules)

Say **Hello** (or hi / hey) and the agent replies **Hello World**. Anything else gets a nudge.

**The agent** (all you need to read to understand step 1):

| File | What it is |
|---|---|
| `public/agent.js` | The agent: `respond(message)`, three rules in a few lines |
| `public/index.html` | The chat page: `onSend()` calls `respond(text)` and shows the reply with `add()` |
| `public/style.css` | How the chat page looks |
| `test/agent.test.js` | Tests for `respond()` |
| `project.json` | Title, summary and "what you learn" shown in the site's left nav |

**Extras** (teaching aids, not part of the agent):

| File | What it is |
|---|---|
| `public/extras/diagram.js` | The "What happens when you press Send" diagram under the chat. It replays each message, naming each function (`onSend` → `respond` → `add`) |
| `test/extras.test.js` | Checks the diagram names the right rule for each reply |

To see the agent without the extras, delete the two lines marked `EXTRA` in `index.html`; the chat works the same.

**How it works:** the browser runs `respond()` directly. No server, no model, no API key.

**What's missing:** it only understands greetings. Step 2 replaces the rules with a real model.
