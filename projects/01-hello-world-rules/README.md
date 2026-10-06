# Step 1 · Hello World (rules)

Say **Hello** (or hi / hey) and the agent replies **Hello World**. Anything else gets a nudge.

| File | What it is |
|---|---|
| `project.json` | Title, summary and "what you learn" shown in the site's left nav |
| `public/agent.js` | The agent: one rule in `respond(message)` |
| `public/index.html` | The chat window that calls the agent |
| `test/agent.test.js` | Tests for the rule |

**How it works:** the browser runs `respond()` directly. No server, no model, no API key.

**What's missing:** it only understands greetings. Step 2 replaces the rule with a real model.
