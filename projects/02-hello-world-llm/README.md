# Step 2 · Hello World (real model)

Your message goes to a real model (**Gemini**, through **Firebase AI Logic**) and the reply appears in the chat.
It matches *Step 1 · Hello World agent* in the notes, with Gemini in place of Ollama: one message in, one reply out.

| File | What it is |
|---|---|
| `project.json` | Title, summary and "what you learn" for the site's left nav |
| `public/agent.js` | Pure logic: input checks, call the model, friendly errors. No Firebase imports, so it's testable |
| `public/main.js` | Firebase wiring: config → App Check → AI Logic → model |
| `public/ai-config.js` | **The only file you edit:** model name and App Check site key (neither is secret) |
| `public/index.html` | Chat window with a status badge and a "thinking…" bubble |
| `public/style.css` | How the chat page looks |
| `test/agent.test.js` | Tests with a fake model (no network needed) |
| `SAFETY_AND_ABUSE.md` | Why this public project is safe: each risk, how it's handled, and the console checklist |

**Extras** (teaching aids, not part of the agent):

| File | What it is |
|---|---|
| `public/extras/diagram.js` | The "What happens when you press Send" diagram: onSend → respond → generate → AI Logic → Gemini, and back. It follows the agent's real stages through the optional `onEvent` callback |

To see the agent without the extras, delete the lines marked `EXTRA` in `index.html`; the chat works the same.

## Why there's no API key in the code

Anything in `public/` is readable by every visitor. Firebase AI Logic keeps the Gemini key on Google's side,
and **App Check** proves requests come from *your* site, so nobody can copy your page and spend your quota.
Since July 2026 Firebase enforces App Check for AI Logic; without it you get
`403 - PERMISSION_DENIED: ... you must enforce Firebase App Check`.

**Is it safe to publish?** See [SAFETY_AND_ABUSE.md](SAFETY_AND_ABUSE.md): every risk we anticipated (leaked keys,
copied code, spam, replayed tokens, surprise bills, XSS from model replies…), how each is handled, and what's still possible.

## One-time setup in the Firebase console (project RAgent, `ragent-eec65`)

1. **Register a web app:** Project Overview → **Add app** → **Web** (`</>`) → nickname `ragents-web` → **Register app**.
   You don't need to copy the config snippet: the page loads it at runtime from `/__/firebase/init.json`, which
   Firebase Hosting serves (Vercel and the local server forward that request to the Firebase site).
2. **Turn on AI Logic:** **AI services → AI Logic → Get started** → choose **Gemini Developer API** (works on the free Spark plan) → follow the guided setup.
3. **Set up App Check:** the guided setup (or **Security → App Check → Apps**) asks for a **reCAPTCHA Enterprise** site key for your web app.
   Create one in Google Cloud console → **Security → reCAPTCHA** → **Create key**, type **Website**, domains
   `ragent-eec65.web.app` and `ragent-eec65.firebaseapp.com` only. Don't add `localhost`: local testing uses a debug
   token instead (see below), and allowing `localhost` would let anyone run a copy of the page locally and pass App Check.
   Paste the key into App Check **and** into `RECAPTCHA_SITE_KEY` in `public/ai-config.js`.
   *Check before you click:* if Google asks to enable billing for reCAPTCHA, stop and decide; this guide hasn't verified whether it's needed.
4. **Deploy** from the repo root: `firebase deploy --only hosting`, then open https://ragent-eec65.web.app and pick step 2.
   The badge in the chat header turns green with the model name when everything is connected.

## Testing on your own machine (optional)

1. Nothing to paste: the local server fetches the config from the Firebase site (set `NODE_OPTIONS=--use-system-ca` behind Zscaler).
2. Run `npm run serve` from the repo root and open http://127.0.0.1:5000.
3. On `127.0.0.1` the page uses an App Check **debug token**: open the browser console (F12), copy the token it prints,
   and add it under **Security → App Check → Apps → ⋮ → Manage debug tokens**. Never share that token.

## On Vercel (https://ragents-eight.vercel.app)

The Firebase SDK runs in the browser, so step 2 works on any domain App Check allows. `vercel.json` forwards
`/__/firebase/init.json` to the Firebase site, so the config stays out of the code. For Vercel that also means
the production domain `ragents-eight.vercel.app` is in the reCAPTCHA key's domain list (and, once the API key has
a Websites restriction, `https://ragents-eight.vercel.app/*` there too). Preview URLs change on every deploy and
aren't allowed, so step 2 shows an App Check error on previews; that's expected.

## Good to know

- **Free-tier data:** the Gemini Developer API free tier may use prompts to improve Google's products. Type only made-up content.
- **Model name:** `MODEL` in `ai-config.js`. If Google retires it, use a current one from the AI Logic page.
- **What's missing:** it forgets everything between messages. Step 3 adds a conversation history.
