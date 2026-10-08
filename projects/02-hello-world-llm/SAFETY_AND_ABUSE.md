# Step 2 · Safety and abuse: why this public project is safe

This project is a public web page in a public repo that calls a real model. This file lists every risk we
thought about, how each one is handled, and what is still possible. Read it before you copy this pattern
into a new step.

## The short answer

- **No secret is in the repo or the browser.** The Gemini API key lives only on Google's side, inside Firebase AI Logic.
- **Only this site can call the model.** App Check (reCAPTCHA Enterprise) rejects requests from other sites and scripts with `403`.
- **There's no bill to run up.** The project is on the free Spark plan with no billing account, so the worst case is
  "free quota used up" (`429`) until it resets.
- **It isn't our server.** Gemini runs on Google's servers, so heavy traffic can't crash anything of ours.

## How a request flows

```text
Browser (public code)
  │  1. reCAPTCHA Enterprise scores the visitor (site key, only valid on our domains)
  │  2. App Check turns that into a short-lived, single-use token
  ▼
Firebase AI Logic (Google's servers)
  │  3. Rejects the request unless the App Check token is valid  ← enforced
  │  4. Adds the Gemini API key (never sent to the browser)
  ▼
Gemini (Google's servers) ──► reply ──► shown in the chat as plain text
```

## What's public, and why that's fine

| Value | Where it lives | Secret? | Why it's safe to publish |
|---|---|---|---|
| reCAPTCHA site key `6LdVR…` | `public/ai-config.js` | No | Designed to be public. Only works on the domains listed on the key |
| Firebase web config (`apiKey`, `projectId`, `appId`…) | Served by Hosting at `/__/firebase/init.json` (not in the code; Vercel and the local server forward to it) | No | It names the project, it doesn't unlock it. Access is controlled by App Check and API-key restrictions |
| Model name | `public/ai-config.js` | No | Just a label |
| **Gemini API key** | **Firebase AI Logic, on Google's side** | **Yes** | **Never in the code, the repo or the browser** |
| reCAPTCHA *secret* key | Google Cloud only | Yes | Never copied anywhere; App Check uses it server-side |
| App Check debug token | Your browser console, then the Firebase console | Yes | Never committed; only used for local testing |

## Each risk and how we handle it

### 1. Someone finds the Gemini key in the public repo
- **Risk:** a key in code can be copied and used for anything, billed to you.
- **How we solved it:** we don't have a Gemini key in code. Firebase AI Logic holds it and adds it on Google's side.
  `main.js` only knows the Firebase project config.
- **Check it yourself:** search the repo for `AIza` or `generativelanguage`. Neither appears.

### 2. Someone copies our code to their own site, or calls the API from a script
- **Risk:** they'd use our project, and our free quota, from their site or a bot.
- **How we solved it:** **App Check is enforced for Firebase AI Logic.** Each request must carry a token that
  reCAPTCHA Enterprise issues only on our domains (`ragent-eec65.web.app`, `ragent-eec65.firebaseapp.com`,
  `ragents-eight.vercel.app`).
  Requests from anywhere else get `403 PERMISSION_DENIED`.
- **Where:** Firebase console → App Check → APIs → Firebase AI Logic = **Enforced**. In code: `initializeAppCheck(...)` in `public/main.js`.

### 3. Someone runs our copied code on their own `localhost`
- **Risk:** if `localhost` is an allowed domain on the reCAPTCHA key, anyone can serve our page on their own machine
  and get valid App Check tokens.
- **How we solve it:** remove `localhost` from the key's domain list (console checklist item A below). For our own local
  testing, `main.js` switches to an App Check **debug token** on `localhost`/`127.0.0.1`. That token only works after we
  register it in the Firebase console, and we never commit it.

### 4. Someone captures a token and replays it
- **Risk:** a valid token reused many times.
- **How we solved it:** `useLimitedUseAppCheckTokens: true` in `public/main.js`. Each AI Logic request uses a fresh
  single-use token, so a captured token is worthless. We also keep no hourly (cached) token in the browser
  (`isTokenAutoRefreshEnabled: false`). The trade-offs are in the README: "Hourly token or a fresh one each time?".

### 5. The Firebase browser API key is "unrestricted"
- **Risk:** the Cloud console warns that the project has an unrestricted API key. Unrestricted means it works from any
  website and for any enabled API.
- **How we solve it:** Firebase already limited the key to its own APIs (not the Gemini API). We add a website
  restriction so it only works from our two domains (console checklist item C).
  App Check still protects AI Logic even before this is done; this is defence in depth.

### 6. One visitor (or a bot driving a real browser) spams messages on our real site
- **Risk:** App Check proves the request came from *our page in a real browser*, not that the person is well-behaved.
  Someone could keep pressing Send and use up the free quota for everyone.
- **How we solve it:**
  - Set a low per-user rate limit in Firebase AI Logic (console checklist item B).
  - reCAPTCHA Enterprise scores each visitor, and very bot-like traffic is refused.
  - The free tier has its own Google-side limits, so the damage stops at "quota used up", never a bill.
- **Still possible:** a determined person can still use up the day's free quota. See "What's still possible".

### 7. Huge prompts
- **Risk:** very long messages use more of the quota per request.
- **How we solved it:** `MAX_CHARS = 500` in `public/agent.js`. Empty or too-long input is rejected **before** the model is
  called (covered by `test/agent.test.js`).

### 8. A surprise bill
- **Risk:** paid usage growing without anyone noticing.
- **How we solved it:** the project is on the **Spark (free) plan with no billing account**, using the **Gemini
  Developer API free tier**. There's no payment method to charge. If we ever upgrade to Blaze, set a budget alert first
  (Google Cloud → Billing → Budgets & alerts).

### 9. The model is overloaded or the free quota runs out
- **Risk:** Gemini returns `429` (quota) or `500`/`503` (high demand), and the chat shows a confusing raw error.
- **How we solved it:**
  - `MODEL = "gemini-3.5-flash-lite"` in `public/ai-config.js`: Flash-Lite had free-tier headroom when `gemini-3.8-flash`
    kept returning `429` and `500`.
  - `friendlyError()` in `public/agent.js` turns `403`, `429`, `500`/`503`, timeouts and network errors into clear messages
    (tested in `test/agent.test.js`).
  - A 90-second time limit (`REPLY_TIMEOUT_MS` in `public/main.js`; free-tier replies can take 20 seconds or more): if no
    reply comes, the request is stopped and the chat says the model took too long, instead of "thinking…" waiting for the
    SDK's default of 3 minutes.
- **Note:** nothing of ours goes down. These are Google's servers saying "not right now".

### 10. The model's reply contains HTML or script (prompt injection → XSS)
- **Risk:** a user tricks the model into replying with `<script>` or `<img onerror=…>`. If we inserted the reply as HTML,
  it would run in the visitor's browser.
- **How we solved it:** every message is shown with `textContent`, never `innerHTML` (`public/index.html`). The reply is
  always displayed as plain text. The site shell does the same.

### 11. Private data sent to the free tier
- **Risk:** the Gemini Developer API free tier may use prompts to improve Google's products.
- **How we handle it:** this is a learning demo, so type **only made-up content**. Never type work data, customer data
  or personal details.

### 12. Old code stays in browsers after a fix is deployed
- **Risk:** Hosting let browsers keep `.js` files for an hour, so a security or config fix wouldn't reach visitors right
  away. (This is what made the "add your site key" message stick after the key was deployed.)
- **How we solved it:** `firebase.json` sends `Cache-Control: no-cache` for every file (`"source": "**"`). Browsers check for a
  newer version on every load.

### 13. Secrets or logs committed to git by accident
- **Risk:** `.env` files, debug logs or the debug token end up in the public repo.
- **How we solved it:** `.gitignore` excludes `.env`, `.env.*`, `firebase-debug.log`, `*-debug.log`, `.firebase/` and
  `dist/`. The debug token is only ever pasted into the Firebase console.

## Console checklist (one-time, done by the project owner)

| | Change | Where | Status |
|---|---|---|---|
| ✅ | Register web app `ragents-web` | Firebase → Project Overview → Add app → Web | Done |
| ✅ | App Check with reCAPTCHA Enterprise for `ragents-web` | Firebase → App Check → Apps | Done |
| ✅ | Turn on AI Logic (Gemini Developer API) + **enforce** App Check | Firebase → AI Logic → Get started | Done |
| ✅ | **A.** Remove `localhost` from the reCAPTCHA key's domains | Google Cloud → Security → Fraud Defense → key `ragents-web` → Edit key → Domain list → 🗑 `localhost` → Save changes | Done |
| ⬜ | **B.** Lower the per-user rate limit for AI Logic from 100 to 10 requests/minute | Google Cloud → IAM & Admin → Quotas & System Limits → Firebase AI Logic API → *Generate content requests per minute per project per user* (default) → ⋮ → Edit quota | To do |
| ⬜ | **C.** Restrict the browser API key | Google Cloud → APIs & Services → Credentials → the browser key (auto-created by Firebase) | To do |

For **C** (key "Browser key (auto created by Firebase)"):
- **API restrictions are already set.** Firebase limited the key to 25 Firebase APIs, including Firebase AI Logic API,
  Firebase App Check API and Firebase Installations API. The Gemini API (Generative Language API) is **not** on it, so the
  key can't call Gemini directly. Leave this list as it is.
- **Application restrictions are missing (currently "None").** Choose **Websites** and add `https://ragent-eec65.web.app/*`,
  `https://ragent-eec65.firebaseapp.com/*` and `https://ragents-eight.vercel.app/*` (the Vercel site uses the same key),
  then **Save**. It can take up to 5 minutes to apply. Local testing sends the key from `http://127.0.0.1:5000`, so add
  `http://127.0.0.1:5000/*` too if you still want to test locally; App Check still refuses it without your registered
  debug token.

Then test step 2 on the live sites. If requests fail with `API_KEY_HTTP_REFERRER_BLOCKED`, check the website entries
for typos.

## What's still possible (honest limits)

- **Quota use-up by a real visitor.** Someone patient using the real site in a real browser can use up the free daily
  quota. Everyone then sees "quota used up" until it resets. No cost, no data exposure; at worst the demo is unavailable for a while.
- **The model can be wrong or say odd things.** The system instruction keeps it on task, but it's a demo, not a moderated
  product. Replies are shown as plain text, so they can't run code.
- **Google's free tier can change.** Models get retired and limits change. If replies stop, check the error message and
  `MODEL` in `ai-config.js`.

## Checklist for future steps

- [ ] No API key or secret in `public/` (search for `AIza`, `sk-`, `secret`, `token`).
- [ ] Every model call goes through Firebase AI Logic with App Check, never directly to a model API from the browser.
- [ ] User input is length-checked before it reaches the model.
- [ ] Model output is shown with `textContent`, never `innerHTML`.
- [ ] Errors go through `friendlyError()` (or the next step's equivalent).
- [ ] Only made-up data in demos on the free tier.
