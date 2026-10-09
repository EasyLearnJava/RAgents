# Step 2 · Hello World (real model)

Your message goes to a real model (**Gemini**, through **Firebase AI Logic**) and the reply appears in the chat.
It matches *Step 1 · Hello World agent* in the notes, with Gemini in place of Ollama: one message in, one reply out.

| File | What it is |
|---|---|
| `project.json` | Title, summary and "next" for the site's left nav |
| `public/agent.js` | Pure logic: input checks, call the model, friendly errors. No Firebase imports, so it's testable |
| `public/main.js` | Firebase wiring: config → App Check → AI Logic → model. One hourly App Check token, fetched when the page loads, cached and renewed in the background, and sent with every message (no token request per message), plus a 90-second limit on the whole call |
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
| `public/extras/street.js` | The "Street view" on its own row under the chat: your browser and Google Cloud as two pieces of land joined by the HTTPS bridge (a suspension bridge over the internet's clouds, with "HTTPS 🔒" on its portal). A black car carries your message along a winding road through the form, index.html, agent.js's checks and main.js, over the bridge (at its entrance the sign lights up "🔒 ENCRYPT", the TLS session key shows and the tag turns to scrambled text; at the far end "🔓 DECRYPT" turns it back with the same key, and what Google sends back, the reply or an error status, gets the same treatment the other way; after a timeout nothing comes back), through App Check's gate, Firebase AI Logic (adds the key) and Gemini, and back. It follows the real events, so a too-long message turns back inside your browser and a 403 stops at App Check. A courier drone fetches App Check's hourly token when the page loads (it stays home if a fresh one is saved in the browser) and shows the real result of each token request. Every message carries that 🎫, so the drone only flies for a message that finds no valid token; without one, the SDK sends a placeholder and the car is refused at App Check's gate (403). Only if no token comes back in time does the car turn back at main.js, because the message is never sent. A token board shows the 🎫 with a countdown to its expiry and what proves the page (locally the debug token, live reCAPTCHA); locally a panel explains the debug token's life. A panel under the scene explains what encrypts and decrypts (the TLS handshake, the session key, AES-GCM) and how to see the real settings in DevTools. Under its step tracker, "Where the time went" shows each stage's real time (see `timing.js`). A network log lists the page's real requests with their status. Built with `/lib/town.js` |
| `public/extras/timing.js` | The sums for the street view's "Where the time went" panel: the real time of each stage of a message (Send and respond()'s checks, the App Check token (usually the cached one, with no request; otherwise the proof and the token request), the request to Gemini, the reply on the page), from the page's own clock and Resource Timing. Blue is your browser, orange is Google over the internet, striped is both where the page can't split them (live, reCAPTCHA asks Google for its proof from its own frame). The street view is slowed down; this shows where a slow reply really spends its time, counting up while you wait |
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
   Then in **Security → App Check → APIs → Firebase AI Logic**, keep App Check **Enforced** and set **replay protection**
   to **Unenforced (monitoring only)**: this app sends App Check's hourly token, which AI Logic refuses (403) when replay
   protection is Enforced.
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
   Until it's registered, App Check refuses the token (403), so every message goes out with a placeholder token and is
   refused too (the street view shows both).

## On Vercel (https://ragents-eight.vercel.app)

The Firebase SDK runs in the browser, so step 2 works on any domain App Check allows. `vercel.json` forwards
`/__/firebase/init.json` to the Firebase site, so the config stays out of the code. For Vercel that also means
the production domain `ragents-eight.vercel.app` is in the reCAPTCHA key's domain list (and, once the API key has
a Websites restriction, `https://ragents-eight.vercel.app/*` there too). Preview URLs change on every deploy and
aren't allowed, so step 2 shows an App Check error on previews; that's expected.

## Hourly token or a fresh one each time?

App Check can give the browser two kinds of token. This app uses **one hourly token**: App Check fetches it when the
page loads, the browser keeps it (memory and IndexedDB, so a reload reuses it) and renews it in the background, and
every request carries it. No message makes a token request of its own. In `public/main.js`:
`isTokenAutoRefreshEnabled: true` and `useLimitedUseAppCheckTokens: false` (`true` would fetch a fresh single-use token
for every request instead).

| | Hourly (cached) token (this app) | Fresh token each time |
|---|---|---|
| How it works | Fetched when the page loads, cached in the browser (also across reloads), reused for every request. Renewed in the background about 35 minutes into its 1-hour life | Fetched just before each request, and spent when Google checks it |
| Token requests | 1 on your first visit (none on a reload while the saved one is under about 35 minutes old), then 1 about every 35 minutes while the page is open | 1 per message |
| Speed | Faster: a message doesn't wait for a token | Each message first waits for its token request (a fraction of a second) |
| reCAPTCHA checks (limited free allowance a month) | 1 per token: about 2 an hour while the page is open, even if you send nothing | 1 per message |
| If someone copies a token | They can reuse it until it expires (up to about 1 hour) | Useless once Google has checked it (with replay protection Enforced) |
| Long-lived connections (e.g. Firestore live updates) | Fits: sent when the connection opens, swapped on renewal | Doesn't fit: spent on first use |
| Supported by | Every product App Check protects: Firestore, Realtime Database, Cloud Storage, Cloud Functions, AI Logic | Only AI Logic, callable Cloud Functions and your own backend (they mark the token spent) |
| AI Logic's replay protection (Firebase console) | Must be **Unenforced** (monitoring only): when Enforced, AI Logic refuses hourly tokens (403) | Enforced, or a copied token still works until it expires |
| Strongest at | Speed, and fewer reCAPTCHA checks | Stopping replays of costly calls, like Gemini |

**Why we use the hourly token:** messages never wait for a token, and reCAPTCHA checks happen about twice an hour
instead of once per message. The cost: someone who copies a token from their browser could replay it from a script
until it expires (about an hour) and use up the free quota. On the free Spark plan that means "quota used up" for a
while, never a bill. The same token also works for Firestore if a later step adds it.

**Check it in DevTools** (F12 → Network): on a first visit the page makes one token request
(`…:exchangeRecaptchaEnterpriseToken`, with reCAPTCHA's `reload` before it); after that, each message makes one request,
`…:generateContent`, carrying the same token in its `X-Firebase-AppCheck` header.

## If App Check refuses (403)

The chat says "The request was refused (403): App Check didn't accept this page's token". The street view shows where.

- **Every message is refused, and the token board shows a valid 🎫:** AI Logic's replay protection is **Enforced**, so it
  accepts only single-use tokens. Set it to **Unenforced (monitoring only)** in **Security → App Check → APIs → Firebase
  AI Logic** (see the setup above).
- **Locally, the board shows "✕ none: refused (403)":** this browser's debug token isn't registered (see "Testing on
  your own machine").
- **On a Vercel preview URL:** expected; previews aren't on the reCAPTCHA key's domain list (see "On Vercel").
- **On the live site, the board shows "✕ none":** check the App Check setup (steps 1–3) and that the domain is on the
  reCAPTCHA key. After a refusal the SDK waits a day before asking again, so reload the page once it's fixed.

## Good to know

- **Free-tier data:** the Gemini Developer API free tier may use prompts to improve Google's products. Type only made-up content.
- **Model name:** `MODEL` in `ai-config.js`. If Google retires it, use a current one from the AI Logic page.
- **What's missing:** it forgets everything between messages. Step 3 adds a conversation history.
