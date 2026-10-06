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
| `test/agent.test.js` | Tests with a fake model (no network needed) |
| `SAFETY_AND_ABUSE.md` | Why this public project is safe: each risk, how it's handled, and the console checklist |

## Why there's no API key in the code

Anything in `public/` is readable by every visitor. Firebase AI Logic keeps the Gemini key on Google's side,
and **App Check** proves requests come from *your* site, so nobody can copy your page and spend your quota.
Since July 2026 Firebase enforces App Check for AI Logic; without it you get
`403 - PERMISSION_DENIED: ... you must enforce Firebase App Check`.

**Is it safe to publish?** See [SAFETY_AND_ABUSE.md](SAFETY_AND_ABUSE.md): every risk we anticipated (leaked keys,
copied code, spam, replayed tokens, surprise bills, XSS from model replies…), how each is handled, and what's still possible.

## One-time setup in the Firebase console (project RAgent, `ragent-eec65`)

1. **Register a web app:** Project Overview → **Add app** → **Web** (`</>`) → nickname `ragents-web` → **Register app**.
   You don't need to copy the snippet: on Firebase Hosting the page loads it from `/__/firebase/init.json`.
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

1. Paste your web app's `firebaseConfig` object into `FIREBASE_CONFIG` in `public/ai-config.js`
   (Project settings → General → Your apps). It isn't secret, but leave it `null` if you only test on Firebase Hosting.
2. Run `npm run serve` from the repo root and open http://127.0.0.1:5000.
3. On `127.0.0.1` the page uses an App Check **debug token**: open the browser console (F12), copy the token it prints,
   and add it under **Security → App Check → Apps → ⋮ → Manage debug tokens**. Never share that token.

## Good to know

- **Free-tier data:** the Gemini Developer API free tier may use prompts to improve Google's products. Type only made-up content.
- **Model name:** `MODEL` in `ai-config.js`. If Google retires it, use a current one from the AI Logic page.
- **What's missing:** it forgets everything between messages. Step 3 adds a conversation history.
