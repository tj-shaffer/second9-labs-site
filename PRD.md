# Product Requirements Document — Biba's Playground

**Project**: Biba's Playground — a hub for personal mini-apps inside the Second 9 Labs marketing site.
**First mini-app**: Recipes (a chat-based AI dinner assistant with grocery hand-off).
**Owner**: Second 9 Labs LLC (TJ Shaffer).

> **⚠ 2026-05-19 — Direction has pivoted.** This PRD describes the **v1** architecture (Phases 1–5, branch `bibas-playground-automated-recipes` → merging to `main`). After v1 shipped, the owner pushed for a much more ambitious vision called **Kitchen OS**: frontier-LLM-as-recipe-author with image gen, Cloudflare Vectorize RAG memory, personal cookbook ingestion, passkey/OAuth auth, and a Computer-use agent that drives Instacart autonomously. **For the active roadmap and architecture, read `.claude/plans/what-s-the-scoop-i-silly-kahn.md`.** This PRD remains accurate as a record of v1 design.

**Status**: v1 code-complete (Phases 1–5). Kitchen OS arc (Phases 6–12+) is sequenced and approved; Phase 6 (recipe brain swap) is next.
**Last updated**: by Claude during the building session.

---

## 1. TL;DR

Biba's Playground is a small section of the [Second 9 Labs marketing site](https://second9labs.com) that houses personal, playful web apps — built primarily for the owner's girlfriend (Biba), but designed to be usable by anyone who visits. The first mini-app is a chat-based recipe assistant: a warm, opinionated AI that helps someone decide what to cook tonight, surfaces real recipes from a recipe database, and hands the ingredient list off to a grocery delivery service so they can order what's needed.

The product's ambition is to move past "smart concierge" toward a real **personal-chef agent** — one that decides for you, remembers what you love, and proactively reaches out at meal time, asking only for a single confirmation tap before groceries are on their way.

The full autonomy ceiling is set by external constraints: **Instacart, DoorDash, and Uber Eats do not permit third-party order placement on a user's behalf** via official APIs. The user always taps through the provider's own checkout. Everything before that final tap is fair game, and that's where the agent's autonomy is built.

---

## 2. Background & motivation

The owner runs Second 9 Labs, a software-consulting LLC. The marketing site exists to describe the consultancy and surface case studies. The "Biba's Playground" section was introduced to give the site a more personal, hand-made dimension — small experiments built for someone the owner cares about, with the side benefit of being public demos of what thoughtful, AI-assisted craft looks like.

The recipe mini-app started from a real conversation: Biba mentioned she'd love a simple, focused AI that suggested dinners and ordered the groceries. The first instinct was a brittle full-automation goal; the realistic version (cart hand-off + opinionated suggestions) is what we built. Phase 5+ stretches it toward genuine autonomy where the API surface allows.

---

## 3. Goals

### Product goals
- **G1** — Help the user (Biba, primarily; anyone, secondarily) decide what to cook tonight in 30 seconds or less of active attention.
- **G2** — Surface real recipes with images, ingredient lists, and cooking instructions — no hallucination.
- **G3** — Make grocery hand-off feel obvious: one tap from "I want this" to "the search is open on Instacart with my ingredients in it."
- **G4** — Respect dietary requirements (intolerances, vegan/etc.) absolutely; respect preferences (organic-leaning, dislikes) strongly.
- **G5** — Stretch toward proactive autonomy: agent decides, remembers, and initiates contact.

### Engineering / craft goals
- **G6** — Cheap to run. Free tier on every external service where possible. Total monthly run-rate should fit in a low-double-digit budget.
- **G7** — Cheap to extend. Pluggable provider architecture so adding a new grocery service or a new mini-app is plumbing, not surgery.
- **G8** — Privacy-respecting by default. No third-party tracking, no analytics, no email gathering unless the user asks for proactive features.
- **G9** — Deployable as a static-ish artifact via Cloudflare Workers + KV. No EC2, no Docker, no managed databases.

### Brand
- **G10** — Visual and tonal consistency with the parent site (constructivist palette, Fraunces serif, warm-paper background). Mini-apps feel like part of Second 9 Labs, not a foreign tab.

---

## 4. Non-goals (explicit)

- **Autonomous order placement on Instacart / DoorDash / Uber Eats.** Not allowed by their APIs without partner-tier access; not pursued.
- **Browser automation against grocery providers.** ToS violation, credential-storage risk; off the table.
- **Real-time grocery prices in the chat.** Store-specific data; Instacart only loads prices after a store is selected.
- **Calendar integration (Google/Apple)** in initial scope. Possibly future.
- **Multi-tenant SaaS, billing, ops dashboard, admin tooling.** Not a SaaS. Personal app + public demo.
- **Native mobile, voice input, multi-language.** Pinned for "maybe later, low priority."

---

## 5. Users & personas

| Persona | Description | Primary needs |
|---|---|---|
| **Biba** (primary) | The owner's girlfriend. Cooks for herself + the household. Prefers organic, whole-food ingredients. Busy weeknights; appreciates not having to decide. | Decisive recommendations, memory of what she loves, low-friction grocery ordering |
| **Curious-visitor** (secondary) | Someone landing on `second9labs.com` from a referral or LinkedIn. Wants to see what the consultancy is like through this small public artifact. | Friction-free first impression, no required login to experience the core flow |
| **Future-Biba-equivalent** (tertiary) | Anyone who could plausibly use this app for themselves. | Same as Biba |

We optimize for Biba; we don't lock out anyone else.

---

## 6. Key product experiences

### 6.1 The anonymous happy path (v1, verified)
1. Visit homepage → see "Biba's Playground" tile in the projects strip.
2. Click → playground hub → click **Recipes & Instacart** card.
3. Land in the recipes chat. Welcome screen offers two doors: **free chat** or **a 3-question guided wizard**.
4. Pick a door, describe what you want (or answer chips).
5. Real recipes appear with photos, time-to-make, and a one-line description.
6. Tap **Let's do this one →** on the recipe you like.
7. The approval card shows ingredient list, step-by-step instructions, and a **Send to Instacart →** button (or "Send to Uber Eats →", depending on the user's preferred service).
8. Tap **Send →** → new browser tab opens at the provider's site with the ingredients pre-filled in search.
9. Complete the provider's normal checkout flow.

### 6.2 The signed-in happy path (v2, code complete)
Adds three layers on top of 6.1:
- **Decisive mode**: instead of three options, the agent presents one recipe (its best read) with a one-tap yes/no/swap.
- **Memory**: every approval card has ❤️ / 👍 / 👎 reaction buttons. Reactions persist server-side. Future recommendations weight toward what's been loved and avoid what's been skipped.
- **Cross-device**: preferences and history follow the user across browsers via magic-link sign-in.

### 6.3 The proactive happy path (v2 Phase 6, target)
The ultimate "one tap per meal" experience:
1. User configures a schedule in Settings (e.g., Tue/Thu/Sun at 4pm, with timezone).
2. Tuesday 4pm rolls around. The agent picks tonight's recipe based on the user's profile + history.
3. The user receives a short email: *"Tonight: Cacio e Pepe — 25 min, serves 2. Cook this or pick something else?"*
4. They click **Cook this** → land on the site already-authed → approval card pre-rendered → one tap to **Build my Instacart cart**.
5. Provider's checkout completes; groceries arrive.

---

## 7. Functional requirements

### 7.1 Recipe chat
- **R1** Two entry doors: free-text and 3-question guided wizard (mood / time / cooking energy).
- **R2** Real recipes from a recipe database (Spoonacular). Hallucination is forbidden — the LLM must call `search_recipes` rather than invent.
- **R3** Recipe cards include: image, title, ready-in-minutes, servings, short description, source link.
- **R4** Approval card includes: image, parsed ingredients with quantities + units, step-by-step instructions.
- **R5** Conversation supports multi-turn: pick → details, ask for alternatives, refine.
- **R6** Multi-turn picks must use server-known recipe IDs (not re-search by title), to avoid losing the picked recipe.
- **R7** Frontend renders a typing indicator during LLM calls; an inline retry chip on errors.

### 7.2 Preferences & settings
- **R8** Settings page exposes: organic-leaning toggle, decisive-mode toggle, household size (1–12), dietary multi-select (vegetarian / vegan / gluten-free / dairy-free / low-carb / pescatarian), intolerances multi-select (peanut / tree-nut / dairy / gluten / soy / egg / shellfish / all-seafood), dislikes free-text, preferred grocery service.
- **R9** Preferences stored in `localStorage` for anonymous users.
- **R10** For signed-in users, preferences also stored server-side in Cloudflare KV and synced across devices.

### 7.3 Grocery hand-off (multi-provider)
- **R11** Pluggable provider registry. Each provider implements `buildLink(ingredients, env) → { url, mode }`.
- **R12** Three honest hand-off modes, surfaced in the UX so we never overpromise:
  - `cart` — ingredients pre-loaded as a real shoppable cart (Instacart post-IDP approval).
  - `search` — provider's search results page is pre-filled with the ingredients (Instacart now, Uber Eats).
  - `browse` — drops user on grocery section, no pre-fill (DoorDash; not in v1).
- **R13** Ingredient names are parsed (e.g., "yellow onion") and deduped before being sent in the URL.
- **R14** v1 ships with **Instacart + Uber Eats**. DoorDash deferred per its weak API surface. Walmart, Amazon Fresh, and other providers are addable as new files.
- **R15** When `INSTACART_API_KEY` is configured (post-Instacart Developer Platform approval), Instacart silently upgrades from `search` mode to `cart` mode — the frontend doesn't change.

### 7.4 Identity & memory (v2)
- **R16** Sign-in via email-only magic link. No passwords. Token TTL 10 minutes, single-use.
- **R17** Session cookie is HTTP-only, Secure (on HTTPS), SameSite=Lax, HMAC-signed with a server-side secret, 30-day expiry.
- **R18** Anonymous users can still use the recipe chat (just no memory / no decisive mode / no scheduling).
- **R19** Recipe reactions (loved / liked / skipped) are recorded per user. Last ~10 of each surface to the LLM as context.
- **R20** History is capped at 200 most-recent entries per user to keep KV small.

### 7.5 Decisive mode (v2)
- **R21** When enabled, the LLM presents one recipe (its best pick), not a list.
- **R22** The LLM still calls `search_recipes` to find real candidates — it just chooses one to present.

### 7.6 Proactive scheduling (v2 Phase 6, not yet built)
- **R23** Schedule editor in Settings: day-of-week multi-select × time-of-day + timezone.
- **R24** A Cloudflare Worker Cron Trigger runs every 15 minutes, walks the user list, fires reminders for matches.
- **R25** Reminder emails contain a signed magic-confirm link valid for 24 hours so the user lands at the site already-authed.
- **R26** Email subject line, body, and two CTAs (**Cook this** / **Pass — pick something else**).

---

## 8. Non-functional requirements

### Privacy
- **N1** No third-party analytics. No tracking pixels. No tag manager.
- **N2** No email gathering for anonymous users. Anonymous mode is genuinely anonymous.
- **N3** Stored user data is limited to: email (as ID), preferences, recipe history. No sensitive fields.
- **N4** All API keys live server-side (Cloudflare Worker secrets or `.dev.vars` for local). Never exposed to the browser.

### Security
- **N5** Session cookies are signed; tampering invalidates them.
- **N6** Magic-link tokens are single-use, short-lived, and stored hashed-by-randomness (32 bytes of entropy).
- **N7** Worker source is excluded from the assets directory; no source code served at any public URL.
- **N8** Dotfiles, configs, `node_modules/`, `wrangler.jsonc`, `package.json`, `.env`, `.dev.vars`, `README.md`, `DEPLOYMENT.md` all blocked from being served as static assets (achieved by `public/` directory pattern).

### Performance / cost
- **N9** Cold-start latency target: < 500ms for static assets, < 6s for an LLM recipe-search turn.
- **N10** Monthly run-rate cap: Cloudflare Workers free tier (~$0 in steady state). Gemini paid tier billed per request — at personal-use volume, expected < $5/month. Spoonacular free tier ~150 req/day (sufficient). Resend free tier ~3k emails/month (sufficient).

### Reliability
- **N11** Graceful degradation: Instacart API errors fall back to public search URL; Gemini rate-limit errors surface a retry chip; Spoonacular failures surface as a friendly error inside the chat.
- **N12** Anonymous mode never fails — even if KV / Resend / auth completely break, the v1 anonymous chat keeps working.

### Maintainability
- **N13** No build step. Vanilla HTML/CSS/JS for frontend. ES modules for the Worker. Anyone can `npm run dev` and be productive in 2 minutes.
- **N14** Provider abstraction kept narrow (single `buildLink` function per provider) so adding services costs ~30 lines of code.

---

## 9. Information architecture

```
/                                       (Second 9 Labs marketing home)
/projects.html                          (case studies index)
/project.html?id=<slug>                 (case study detail; redirects if project has a custom url)
/bibas-playground/                      (playground hub)
/bibas-playground/recipes/              (recipe chat — the mini-app)
/bibas-playground/recipes/settings      (preferences)
/bibas-playground/recipes/login         (magic-link sign-in)
/api/recipes/chat            POST       (LLM + Spoonacular tool-use loop)
/api/cart/providers          GET        (lists registered grocery providers)
/api/cart/build              POST       (returns hand-off URL for given provider+ingredients)
/api/auth/request            POST       (sends magic-link email)
/api/auth/verify             GET        (consumes token, sets session cookie, redirects)
/api/auth/logout             POST       (clears session)
/api/profile                 GET/PUT    (load / update user prefs server-side)
/api/recipes/feedback        POST       (record ❤️/👍/👎 reaction; appends to history)
```

---

## 10. Technical architecture

### Stack
- **Frontend**: vanilla HTML / CSS / ES-modules JS. No framework, no bundler.
- **Backend**: single Cloudflare Worker (`worker/index.js`) bundled by Wrangler. ES-modules entry, Web Crypto for HMAC/random.
- **Static assets**: served from `public/` via Cloudflare's static-assets binding.
- **Data**: Cloudflare KV (one namespace, `BIBA_USERS`). No relational database.
- **LLM**: Google Gemini Flash (currently `gemini-2.5-flash`; trivial to upgrade) via REST.
- **Recipe data**: Spoonacular Recipe API (free tier).
- **Email**: Resend transactional API.
- **Dev**: Wrangler 4.x (`npm run dev`).
- **Deploy target**: Cloudflare Workers (paid plan needed for Cron Triggers in Phase 6; free plan sufficient up to that point).

### Data flow — recipe-chat happy path
```
Browser ──POST /api/recipes/chat──▶ Worker
                                       │
                                       │ buildSystemPrompt(prefs, knownRecipes, history)
                                       │
                                       ▼
                                    Gemini  (function-calling loop)
                                       │
                                       ├── functionCall:search_recipes ───▶ Spoonacular
                                       │                                          │
                                       │◀──── recipes summary ────────────────────┘
                                       │
                                       ├── functionCall:get_recipe_details ─▶ Spoonacular
                                       │                                            │
                                       │◀──── full recipe with steps ───────────────┘
                                       │
                                       ▼ final text + tool results
Browser ◀──JSON:{message,recipes,recipeDetail}── Worker
```

### Data flow — cart hand-off
```
Browser ──POST /api/cart/build──▶ Worker
                                     │
                                     │ buildCart(providerId, ingredients, env)
                                     │
                                     ▼
                          worker/cart/providers/<id>.js
                                     │
                                     │ (if INSTACART_API_KEY set → IDP API)
                                     │ (else → public search URL)
                                     │
                                     ▼
Browser ◀──JSON:{url,mode,provider}── Worker ──▶ window.open(url, '_blank')
```

### Repository layout
```
second9-labs-site/
  public/                       (served to the public)
    index.html, projects.html, project.html, projects.js, projects.json, script.js, styles.css
    bibas-playground/
      index.html                (playground hub)
      recipes/
        index.html, chat.css, chat.js
        settings.html
        login.html
  worker/                       (Cloudflare Worker — NOT served as assets)
    index.js                    (route table + handlers)
    llm.js                      (Gemini client + system-prompt builder)
    recipes.js                  (Spoonacular client)
    tools.js                    (Gemini function-declarations + dispatcher)
    auth.js                     (tokens, HMAC cookies, email validation)
    kv.js                       (typed KV wrappers)
    email.js                    (Resend client + magic-link template)
    cart/
      index.js                  (provider registry + dispatcher)
      utils.js                  (shared ingredient cleanup)
      providers/instacart.js
      providers/ubereats.js
  wrangler.jsonc                (Cloudflare config — main, assets, kv_namespaces, future crons)
  package.json                  (Wrangler dev/deploy scripts)
  .dev.vars                     (LOCAL ONLY, gitignored — GEMINI / SPOONACULAR / SESSION_SECRET / EMAIL_FROM / RESEND keys)
  .gitignore, .DS_Store, .git/, .claude/, .wrangler/   (none served)
  node_modules/                 (never served)
  README.md, DEPLOYMENT.md      (internal docs)
  PRD.md                        (this file)
```

---

## 11. Data model

All data lives in one Cloudflare KV namespace (`BIBA_USERS`), with prefixed keys:

| Key pattern | Value | TTL | Purpose |
|---|---|---|---|
| `magic:<token>` | `{ email, createdAt }` | 10 min | Single-use sign-in token |
| `session:<sid>` | `{ email, createdAt }` | 30 days | Authenticated session |
| `user:<email>` | `{ email, createdAt, preferences, updatedAt }` | none | User profile |
| `history:<email>` | `Array<{recipeId,title,reaction,at}>` (capped 200) | none | Recipe reactions for memory |

The `preferences` object inside `user:<email>`:
```ts
{
  organic: boolean,           // default true
  decisiveMode: boolean,      // default false
  householdSize: number,      // default 2, range 1–20
  diet: string[],             // e.g. ["vegetarian", "gluten-free"]
  intolerances: string[],     // e.g. ["peanut", "shellfish"]
  dislikes: string,           // free text, max 1000 chars
  cartProvider: string        // "instacart" | "ubereats" | future...
  // Phase 6: schedule, timezone
}
```

No relational links; everything is keyed off `email`. Email is normalized to lowercase before use.

---

## 12. External integrations

| Service | Purpose | Tier | Key env var |
|---|---|---|---|
| **Google Gemini** | LLM (recipe chat, decisive picks, system-prompt-driven behavior) | Paid (owner upgraded mid-build); free tier hit limits during dev | `GEMINI_API_KEY` |
| **Spoonacular** | Real recipe database — search + details | Free tier (~150 req/day) | `SPOONACULAR_API_KEY` |
| **Instacart Developer Platform** | Real shoppable-cart API (post-approval) | Invite-only application; ~30–40 day review; user applied during build | `INSTACART_API_KEY` (optional; absent → public search-URL mode) |
| **Resend** | Transactional email (magic links; future reminders) | Free tier (~3k emails/month) | `RESEND_API_KEY` |
| **Cloudflare Workers + KV** | Hosting + storage | Workers Free plan sufficient through Phase 5; **paid plan required for Phase 6 Cron Triggers** | (Cloudflare account auth) |

---

## 13. Constraints & assumptions

### Hard constraints
- **C1** **Instacart / DoorDash / Uber Eats** do not allow third-party programmatic order placement. We hand off; the user completes checkout on the provider's site. This is unchangeable without partner-tier access we don't have.
- **C2** **Cloudflare Workers CPU limit** (50ms on free, 30s wall-clock on paid). LLM tool-use loops max at 5 iterations to stay safe.
- **C3** **Spoonacular free tier** rate-limits to 150 requests/day. Plenty for one user, would need upgrade for any real adoption.

### Soft assumptions
- **A1** Owner-paid Gemini account exists with sufficient credit. (Verified.)
- **A2** Owner has access to the Cloudflare account that owns the production deployment. (Verified.)
- **A3** Owner is fine with the static-vs-dynamic content separation (no SSR, no per-user pre-rendered HTML).
- **A4** Biba is comfortable receiving an email to sign in. (Tested for v2.)

---

## 14. Phases & roadmap

| Phase | Scope | Status |
|---|---|---|
| **1** | Mini-app shell with canned responses; site renovated to include Biba's Playground | ✅ shipped & verified |
| **1.5** | Node + Wrangler installed; `.assetsignore` fix for "asset too large" crash | ✅ |
| **2** | Worker module + Settings page (localStorage-only) | ✅ |
| **3** | Real chat — Gemini + Spoonacular + tool-use loop | ✅ |
| **4** | Multi-provider grocery hand-off (Instacart + Uber Eats) | ✅ |
| **5** | Identity (magic-link auth) + Memory (recipe history) + Decisive mode | ✅ code complete; needs real Resend key for sign-in end-to-end test |
| **6** | Proactive scheduling — Worker Cron Triggers + reminder emails | not started |
| **7** | Quality of life — history view, schedule preview, optional Instacart IDP upgrade once approved, MCP server, etc. | not started |

### What's deferred (intentionally)
- **Pantry awareness** (only buy what's missing) — interesting; defer to Phase 7+ pending Phase 5–6 stability.
- **Calendar integration** — defer.
- **Per-recipe provider chooser** (override default in-flight) — defer; v1 default-only is fine.
- **Affiliate/UTM tracking** — defer; not interesting until traffic warrants.
- **MCP server** — defer; expose same backend as Claude Desktop tools if/when motivated.
- **Voice input, native mobile, multi-language** — out of scope.

---

## 15. Success metrics

This is a personal-use + demo product, so metrics are intentionally light:

- **M1** Biba uses it ≥ 2× / week, by her own reporting.
- **M2** From "I open the app" to "Instacart tab is open with my cart pre-filled" takes < 60 seconds (anonymous mode), < 30 seconds (signed-in decisive mode).
- **M3** Zero hallucinated recipes. Every recipe surfaced is a real recipe from Spoonacular.
- **M4** ≥ 90% of meals Biba reacts to are ❤️/👍 (i.e., the agent's picks are good once it has memory).
- **M5** Monthly run-rate stays under $10.

We are explicitly not tracking page views, time-on-site, or conversion funnels.

---

## 16. Risks & open questions

### Risks
- **Spoonacular free-tier exhaustion** — 150 req/day is plenty for single-user use, but if the site gets unexpected attention (e.g., a viral share), we'd hit the wall. Mitigation: fail gracefully ("Sorry, the recipe service is at its limit for the day; try again tomorrow"). Future: pay for higher tier (~$9/mo Basic), or cache popular searches.
- **Gemini cost creep** — paid tier billing scales linearly with use. Mitigation: capping tool-use loop at 5 iterations; tight context window; cheap model (Flash). Monitor.
- **Instacart IDP approval delay** — 30–40 days; we may not see real cart-mode for a month+. Architecture absorbs this — public search URL is good enough in the meantime.
- **Cron-trigger free-tier limit** — Workers Cron Triggers require the paid Workers plan ($5/mo). Mitigation: confirmed acceptable cost when Phase 6 starts.

### Open questions (to resolve in-flight)
- **Q1** Phase 6: what happens if a user ignores a proactive email for 2+ hours? Resend? Silent fail? Move to next day?
- **Q2** Phase 6: what's the maximum reasonable reminder cadence — 1/day, 2/day? Throttle?
- **Q3** Should anonymous reactions (👎 in particular) trigger a sign-in nudge inline, or stay quietly disabled?
- **Q4** When Instacart IDP eventually approves, do we want to enable affiliate tracking by default? (Probably not for personal use; revisit if/when this becomes more public.)

---

## 17. Appendix — design language

- **Palette** — Paper background `#F2ECDE`, ink `#141414`, signal red `#D42A1F`, marigold `#F2B01E`, blue `#1F4E8C`.
- **Type** — Fraunces (display / italics), DM Sans (UI), JetBrains Mono (tags / labels / monospaced bits).
- **Card pattern** — 2px ink border, paper background, offset-shadow on hover.
- **Voice** — Warm, specific, not gushy. Brief sentences. No emojis unless the user uses one first. The agent should sound like a thoughtful friend who happens to know food.

---

## 18. Appendix — what "done" looks like for v2 sign-off

User can execute this full flow without any developer intervention:

1. Visit recipes mini-app while signed out → core chat works, sees a friendly "Sign in to unlock memory" nudge.
2. Click **Sign in** → enter email → receive magic-link email in inbox within 30s → click it → land authed.
3. Set decisive mode + dietary preferences → save → reload chat → settings persisted from server.
4. Ask for dinner → ONE recipe appears in decisive mode.
5. React ❤️ a few pasta dishes → ask again → suggestions skew toward pasta.
6. React 👎 a salmon recipe → ask again → no salmon, and similar recipes are deprioritized.
7. Sign out → sign in on phone → preferences and history visible on phone.
8. Send to Instacart → Instacart tab opens with the recipe's ingredients pre-filled.

Phase 6 sign-off adds: schedule something for the next available 15-min window → email arrives → click "Cook this" → land at the chat already-authed with the recipe approved → tap "Build my cart" → Instacart opens with the ingredients.

---

*End of document.*
