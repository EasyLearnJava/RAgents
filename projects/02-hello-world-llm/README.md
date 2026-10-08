# Step 2 · Hello World (real model)

Your message goes to a real model (**Gemini**, through **Firebase AI Logic**) and the reply appears in the chat.
It matches *Step 1 · Hello World agent* in the notes, with Gemini in place of Ollama: one message in, one reply out.

| File | What it is |
|---|---|
| `project.json` | Title, summary and "next" for the site's left nav |
| `public/agent.js` | Pure logic: input checks, call the model, friendly errors. No Firebase imports, so it's testable |
| `public/main.js` | Firebase wiring: config → App Check → AI Logic → model. A fresh single-use App Check token for every message, no cached (hourly) token, and a 90-second limit on the whole call (token, request and reply) |
| `public/ai-config.js` | **The only file you edit:** model name and App Check site key (neither is secret) |
| `public/index.html` | Chat window with a status badge and a "thinking…" bubble |
| `public/style.css` | How the chat page looks |
| `test/agent.test.js` | Tests with a fake model (no network needed) |
| `test/timing.test.js` | Tests for the timing sums in `public/extras/timing.js` |
| `SAFETY_AND_ABUSE.md` | Why this public project is safe: each risk, how it's handled, and the console checklist |

**Extras** (teaching aids, not part of the agent):

| File | What it is |
|---|---|
| `public/index.html` (the `<aside class="about">`) | The "About this step" panel next to the chat: what you learn, how a message travels, slow replies and errors, where the keys are, security features, what's still possible |
| `public/extras/street.js` | The "Street view" on its own row under the chat: your browser and Google Cloud as two pieces of land joined by the HTTPS bridge (a suspension bridge over the internet's clouds, with "HTTPS 🔒" on its portal). A black car carries your message along a winding road through the form, index.html, agent.js's checks and main.js, over the bridge (at its entrance the sign lights up "🔒 ENCRYPT", the TLS session key shows and the tag turns to scrambled text; at the far end "🔓 DECRYPT" turns it back with the same key, and what Google sends back, the reply or an error status, gets the same treatment the other way; after a timeout nothing comes back), through App Check's gate, Firebase AI Logic (adds the key) and Gemini, and back. It follows the real events, so a too-long message turns back inside your browser and a 403 stops at App Check. A courier drone fetches a fresh single-use App Check token before each message and shows the real result of each token request; if App Check refuses it (locally: an unregistered debug token, 403), it never gets through, or no token comes back in time, the car turns back at main.js, because the message is never sent. A token board shows the single-use 🎟 that rides with each message and what proves the page (locally the debug token, live reCAPTCHA); locally a panel explains the debug token's life. A panel under the scene explains what encrypts and decrypts (the TLS handshake, the session key, AES-GCM) and how to see the real settings in DevTools. Under its step tracker, "Where the time went" shows each stage's real time (see `timing.js`). A network log lists the page's real requests with their status. Built with `/lib/town.js` |
| `public/extras/timing.js` | The sums for the street view's "Where the time went" panel: the real time of each stage of a message (Send and respond()'s checks, the App Check proof and token request, the request to Gemini, the reply on the page), from the page's own clock and Resource Timing. Blue is your browser, orange is Google over the internet, striped is both where the page can't split them (live, reCAPTCHA asks Google for its proof from its own frame). The street view is slowed down; this shows where a slow reply really spends its time, counting up while you wait |
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
   `ragent-eec65.web.app` and `ragent-eec65.firebaseapp.com` (plus `ragents-eight.vercel.app` for Vercel, see below).
   Don't add `localhost`: local testing uses a debug
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
   Until it's registered, every message stops in your browser with an App Check error (the street view shows the 403).

## On Vercel (https://ragents-eight.vercel.app)

The Firebase SDK runs in the browser, so step 2 works on any domain App Check allows. `vercel.json` forwards
`/__/firebase/init.json` to the Firebase site, so the config stays out of the code. For Vercel that also means
the production domain `ragents-eight.vercel.app` is in the reCAPTCHA key's domain list (and, once the API key has
a Websites restriction, `https://ragents-eight.vercel.app/*` there too). Preview URLs change on every deploy and
aren't allowed, so step 2 shows an App Check error on previews; that's expected.

## Hourly token or a fresh one each time?

App Check can give the browser two kinds of token. This app uses **a fresh single-use token for every message**
(`useLimitedUseAppCheckTokens: true`) and keeps **no hourly token** (`isTokenAutoRefreshEnabled: false`), both in
`public/main.js`.

| | Hourly (cached) token | Fresh token each time (this app) |
|---|---|---|
| How it works | Fetched once, cached in the browser, reused for every request. Renewed in the background about 35 minutes into its 1-hour life | Fetched just before each request, and spent when Google checks it |
| Token requests | 1 per page load, plus renewals | 1 per message |
| Speed | Faster: a request never waits for a token | Each message first waits for its token request (a fraction of a second) |
| reCAPTCHA checks (limited free allowance a month) | 1 per renewal | 1 per message |
| If someone copies a token | They can reuse it until it expires (up to about 1 hour) | Useless: it's already spent |
| Long-lived connections (e.g. Firestore live updates) | Fits: sent when the connection opens, swapped on renewal | Doesn't fit: spent on first use |
| Supported by | Every product App Check protects: Firestore, Realtime Database, Cloud Storage, Cloud Functions, AI Logic | Only AI Logic, callable Cloud Functions and your own backend (they mark the token spent) |
| Best for | Frequent, cheap calls, like Firestore reads and writes | Rare, costly calls worth protecting, like Gemini |

**Why we chose a fresh token:** every Gemini call uses quota, so a token that could be replayed is worth blocking.
People send messages rarely, so the extra wait and reCAPTCHA check per message don't matter. If a later step adds
Firestore, it will need the hourly token back (`isTokenAutoRefreshEnabled: true`) for those reads and writes.

## Good to know

- **Free-tier data:** the Gemini Developer API free tier may use prompts to improve Google's products. Type only made-up content.
- **Model name:** `MODEL` in `ai-config.js`. If Google retires it, use a current one from the AI Logic page.
- **What's missing:** it forgets everything between messages. Step 3 adds a conversation history.
