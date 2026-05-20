# Claude Code orientation — second9-labs-site

This repo hosts (1) the Second 9 Labs marketing site and (2) **Biba's
Playground**, an evolving personal-AI project under
`/bibas-playground/recipes/`. As of HEAD on `main`, Phases 1–10 of
the Kitchen OS arc are **shipped to production**:

- **Production URL:** https://second-9-labs.tj-shaffer.workers.dev
- **Workers version pinned at write-time:** `9bf28e61-4056-44cb-828e-06a457d7f4e3` (commit `43fdc7e`)

The authoritative roadmap is `~/.claude/plans/what-s-the-scoop-i-silly-kahn.md`.
Read it first if anything below is ambiguous. The session-by-session
hand-off plan is `~/.claude/plans/continuing-biba-s-playground-binary-tulip.md`.

## Branches

- **`main`** — production. Phases 1–10 shipped. Deploy from here.
- **`kitchen-os`** — was the staging branch for Phases 6–10; merged
  into main with the production deploy.
- **`bibas-playground-automated-recipes`** — preserved v1 branch (snapshot).

## Open debugging thread (active when this doc was last written)

Phase 10's computer-use Instacart agent ships in two paths:
1. **Login flow** — agent types username/password macros. Hits
   CAPTCHA on every run because Cloudflare datacenter IPs are flagged.
2. **Cookie pre-auth flow** — user pastes session cookies into vault;
   agent skips login. **Currently failing with `needs_human` — Instacart
   redirects the agent's request to `/login` despite cookies being set.**

Latest diagnostic patch (commit `43fdc7e`) instruments the pre-auth
path so the next run will emit a `note` event with:
- `cookies_sent: N`
- `cookie_names: [...]`
- `cookie_domains: [...]`
- `target_url`, `landed_at`, `redirected: boolean`

**Two theories to differentiate via the diagnostic:**
- Theory 1 — Incomplete cookie jar. User grabbed 1-2 cookies but
  Instacart needs the full set (session + CSRF + `__cf_bm` + others).
  Fix: re-export with the Cookie-Editor browser extension.
- Theory 2 — IP binding. Instacart binds session cookies to the
  originating residential IP and rejects them from Cloudflare's
  datacenter IPs. Fix: switch to DoorDash / Uber Eats (less aggressive)
  or wait for Instacart IDP API approval.

To diagnose, read the most recent run's audit log:
```sh
npx wrangler kv key get 'agent:runs:tj.shaffer@secondninelabs.com' \
  --namespace-id=0db6c3acfbc44876900b37442cf91feb --remote
# Then for the specific runId:
npx wrangler kv key get 'agent:log:tj.shaffer@secondninelabs.com:<runId>' \
  --namespace-id=0db6c3acfbc44876900b37442cf91feb --remote
```

## Architecture

Single Cloudflare Worker at [`worker/index.js`](worker/index.js)
fronts a route table that delegates to feature modules. Static assets
under `public/` (set via `assets.directory` in `wrangler.jsonc`).

### Worker modules — what each file owns

| Path | Owns |
|---|---|
| `worker/index.js` | HTTP route table + handler glue |
| `worker/llm.js` | Gemini conversation drive + system-prompt builder |
| `worker/tools.js` | Function-call schema + dispatcher (currently one tool: `generate_recipe`) |
| `worker/recipe-author.js` | Claude Opus 4.7 default + Gemini 2.5 Pro fallback (set `RECIPE_AUTHOR=gemini` to force Gemini) |
| `worker/image-gen.js` | Imagen 4 Fast → R2-cached photos (`imagen-4.0-fast-generate-001`) |
| `worker/recipe-cache.js` | KV-backed recipe cache (key = `sha256(query+prefs)`) |
| `worker/cross-reference.js` | Parallel fan-out to four DBs via `ctx.waitUntil` |
| `worker/db-clients/{spoonacular,edamam,themealdb,tasty}.js` | DB-specific cross-ref clients (each returns `{source,count,sampleImage}` or null) |
| `worker/embed.js` | Workers AI bge-base-en-v1.5 wrapper (768d) |
| `worker/memory.js` | Vectorize wrapper for `MEMORY_{CONVERSATIONS,RECIPES,CORPUS}` |
| `worker/recipe-dna.js` | Heuristic feature extraction from recipe schema |
| `worker/ingest.js` | Cookbook ingestion: extract → segment → normalize → embed |
| `worker/auth.js` | Magic-link tokens + signed-cookie session helpers |
| `worker/auth-oauth.js` | Google OAuth 2.0 + PKCE flow (needs `GOOGLE_CLIENT_ID`/`SECRET`) |
| `worker/email.js` | Resend client + magic-link template |
| `worker/kv.js` | Typed wrappers over `BIBA_USERS` KV namespace |
| `worker/vault.js` | AES-GCM envelope encryption for grocery-service creds (username/password/cookies) |
| `worker/agent/index.js` | Computer-use agent orchestrator (SSE); cookie pre-auth lives here |
| `worker/agent/browser.js` | Cloudflare Browser Rendering wrapper + DrySession; `setCookies()` returns diagnostic report |
| `worker/agent/computer-use.js` | Claude Sonnet 4.5 Computer Use loop; correct `tool_use ↔ tool_result` protocol; `preAuthed` flag rewrites system prompt |
| `worker/agent/audit.js` | KV-backed action log (`agent:log:<email>:<runId>`) |
| `worker/agent/strategies/{instacart,ubereats,doordash,walmart}.js` | Provider-specific knowledge — startUrl, authedStartUrl (for cookie path), briefing, viewport, cart hints, ToS-grey consent language |
| `worker/cart/{index.js,utils.js}` + `cart/providers/{instacart,ubereats,walmart,doordash}.js` | Public search-URL hand-off (Phase 4 fallback for anonymous users / no-vault path) |

### KV layout — `BIBA_USERS` namespace

All keys are prefixed by domain so a single namespace serves the
whole app. **Don't add a second namespace** without strong reason.

```
magic:<token>                   {email,exp}        magic-link tokens (10-min TTL)
session:<sid>                   {email,exp}        session cookies (30-day TTL)
user:<email>                    {email,preferences,…}
history:<email>                 [{recipeId,title,signal,at}]
recipe:cache:<sha>              authored recipe JSON (30-day TTL)
recipe:byid:<id>                same JSON keyed by recipe.id (30-day TTL)
recipe:xref:<id>                cross-reference aggregate (30-day TTL)
oauth:state:<token>             {codeVerifier,returnTo}  (10-min TTL)
corpus:source:<email>:<srcId>   ingested cookbook source manifest
vault:<email>:<provider>        {nonce,ct,fields}  AES-GCM ciphertext
                                fields may include: username, password, cookies
agent:runs:<email>              [{runId,provider,status,…}]
agent:log:<email>:<runId>       [{ts,kind,payload}]  (30-day TTL)
```

### Vectorize indexes

- `biba-memory-conversations` — user messages (Phase 7)
- `biba-memory-recipes` — send-to-cart approved recipes (Phase 7)
- `biba-memory-corpus` — personal cookbook chunks (Phase 8)

All 768-dim cosine, metadata index on `email`. Per-user filter
(`{email: {$eq: …}}`) on every query.

### R2 buckets

- `biba-recipe-images` — Imagen-generated photos keyed by
  `sha256(title|image_prompt)`. Auto-provisioned during first deploy.

### Cloudflare bindings live on prod

- KV namespace: `0db6c3acfbc44876900b37442cf91feb` (`BIBA_USERS`)
- R2: `biba-recipe-images`
- Vectorize × 3: `biba-memory-conversations`, `biba-memory-recipes`, `biba-memory-corpus`
- Workers AI binding (`env.AI`)
- Browser Rendering binding (`env.BROWSER`) — Workers Paid plan + Browser Rendering enabled

### Production secrets set via `wrangler secret put`

Confirmed live via `wrangler secret list`:
`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `SPOONACULAR_API_KEY`,
`RAPID_API_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `SESSION_SECRET`,
`VAULT_MASTER_KEY` (fresh prod key, **NOT** the local-dev one).

**Not set yet:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google
OAuth UI gracefully degrades to `?error=oauth_not_configured`.
Magic-link sign in works on prod (Resend domain `secondninelabs.com`
verified).

**Not set, on purpose:** `EDAMAM_APP_ID`, `EDAMAM_APP_KEY` — user
skipped Edamam paid signup; cross-ref silently uses 3 of 4 DBs.

**Not set in prod (uses Claude):** `RECIPE_AUTHOR` env var is absent
in prod → defaults to Claude Opus 4.7 author. Local `.dev.vars` has
`RECIPE_AUTHOR=gemini` as a leftover from earlier debugging; remove
to flip local to Claude too.

## Dev workflow

```sh
npm run dev    # wrangler dev --port 8787 --persist-to /tmp/wrangler-state-bibas
npm run deploy # wrangler deploy
```

The `--persist-to /tmp/...` flag is **load-bearing** — without it the
hot-reload hits a SQLite-lock loop. See
[`feedback_dev_environment.md`](../../.claude/projects/-Users-tjshaffer-Documents-second9-labs-site/memory/feedback_dev_environment.md).

`.dev.vars` (gitignored) holds local secrets. `.dev.vars.example` is
checked in as the canonical template.

### Useful prod read commands (require `wrangler login`)

```sh
# Last 20 agent runs for the dev user
npx wrangler kv key get 'agent:runs:tj.shaffer@secondninelabs.com' \
  --namespace-id=0db6c3acfbc44876900b37442cf91feb --remote

# Full event log for a specific runId
npx wrangler kv key get 'agent:log:<email>:<runId>' \
  --namespace-id=0db6c3acfbc44876900b37442cf91feb --remote

# List all keys with a prefix (vault entries, sessions, etc.)
npx wrangler kv key list \
  --namespace-id=0db6c3acfbc44876900b37442cf91feb \
  --prefix='vault:' --remote

# Tail live Worker logs (90s window suggested)
npx wrangler tail second-9-labs --format=pretty
```

## Conventions

### Patterns to reuse, don't reinvent

- **`escapeHtml(str)`** — same shape in `public/projects.js`,
  `public/bibas-playground/recipes/chat.js`, `cookbook.html`,
  `vault.html`. Inline-copy this. Any new HTML-building code on the
  frontend needs it.
- **Provider abstraction (two layers)** — `worker/cart/providers/*.js`
  (search URL hand-off, Phase 4) and `worker/agent/strategies/*.js`
  (computer-use, Phase 10) are independent. New grocery services
  drop into both (search-URL provider for anonymous users; agent
  strategy for signed-in vault users). All four providers exist in
  both layers as of HEAD.
- **DB clients** — `worker/db-clients/*.js` all expose
  `crossRef(query, env) → {source, count, sampleImage} | null`.
  Adding a new cross-reference DB is one file plus a line in
  `worker/cross-reference.js`.
- **Visual tokens** — `public/styles.css`. `--paper` `#F2ECDE`,
  `--paper-deep`, accents `#D42A1F` (red), `#F2B01E` (yellow),
  `#1F4E8C` (blue), `#141414` (ink). Fonts: Fraunces (display), DM
  Sans (UI), JetBrains Mono (labels).
- **`runChat({apiKey, system, contents, tools, env, dispatch,
  preferences, executionCtx, userEmail})`** — the conversational
  loop in `llm.js`. `dispatch` receives a `dispatchCtx` with the
  same payload so tool implementations have user context.
- **Vault credentials shape** — `credentials: { username?, password?, cookies? }`.
  Cookies preferred (bypass CAPTCHA). Accept two formats: array of
  Puppeteer-native cookie objects OR `{name: value}` map (domain
  derived from `strategy.startUrl`).
- **Agent strategy shape** — `{ id, name, startUrl, authedStartUrl?,
  agentBriefing, viewport, cartUrlHints, consentLanguage }`. New
  providers slot in as a ~35-line file in `worker/agent/strategies/`.

### Decisions baked into the architecture

- **Single tool, not many** — `generate_recipe` is the only function
  Gemini calls. Earlier search+detail tools were retired in Phase 6.
- **Implicit signals, not reactions** — Phase 6 retired
  `loved/liked/skipped` buttons. Send-to-cart is the positive
  signal; ask-for-alternatives is the soft negative.
- **Memory is authed-only** — anonymous users get the same v1
  experience. Embeddings only land in Vectorize when there's a
  `user.email`.
- **Cookie pre-auth bypasses login** — agent first opens browser
  without navigating, calls `setCookies()`, then navigates to
  `authedStartUrl`. The `preAuthed: true` flag rewrites the
  Computer Use system prompt so Claude doesn't look for a login form.
- **Dry-run as a first-class mode** — without `env.BROWSER` or
  `env.ANTHROPIC_API_KEY`, the computer-use agent runs in scripted
  dry mode end-to-end. Useful for testing UI/vault/audit without
  burning paid services.

### Anti-patterns to avoid

- **Don't put dev-only secrets in `wrangler.jsonc`.** Use `.dev.vars`
  locally and `wrangler secret put` for prod.
- **Don't break the prefix on `BIBA_USERS` keys.** The list endpoints
  (vault status, cookbook sources, agent runs) rely on these prefixes.
- **Don't add Vectorize bindings without `remote: true`.** Wrangler
  has no local-mode simulation; the binding type errors at boot
  without `remote: true`.
- **Don't ship code that embeds API keys in the system prompt or
  message history.** The vault exists specifically to keep
  credentials out of LLM context. Computer Use uses `${USERNAME}`
  / `${PASSWORD}` macros that are substituted *after* Claude sees
  the request.
- **Don't reintroduce reaction buttons.** Implicit signals are the
  intentional UX choice (see Phase 6 plan rationale).
- **Don't run `npm audit fix --force`.** It downgrades wrangler 4.x →
  3.x and breaks Vectorize remote-mode + `--persist-to`. The flagged
  `ws` CVE is dev-only and not exploitable in our local-only setup.
- **Don't navigate Puppeteer with `waitUntil: 'networkidle0'`.** SPAs
  (Instacart, Uber Eats, etc.) never reach idle because of analytics
  beacons. Use `domcontentloaded` + a settle delay — already done
  in `worker/agent/browser.js`.
- **Don't pre-inject tool_results before Claude asks.** Computer Use
  protocol: assistant emits `tool_use` first, you respond with
  matching `tool_use_id` in the next user turn. Bootstrap with text
  only.

## Where to find things

- **Long-term roadmap + verification scenarios**:
  `~/.claude/plans/what-s-the-scoop-i-silly-kahn.md`
- **Hand-off plan for the active task (cookies + multi-provider)**:
  `~/.claude/plans/continuing-biba-s-playground-binary-tulip.md`
- **Live state of TJ's local dev + Cloudflare account**:
  the `project_status.md` and `feedback_dev_environment.md` memories
- **Brand kit + marketing site**: `README.md` (separate from Kitchen
  OS, lives alongside in the same repo)
- **Deprecated** but historical: `PRD.md` (predates Kitchen OS pivot;
  v1 architecture only)

## What's shipped vs deferred

| Status | Phase / feature |
|---|---|
| ✅ Live prod | 6 (LLM-author recipes), 7 (memory), 8 (cookbook ingestion), 9 (Google OAuth — code wired, awaiting client setup), 10 (vault + computer-use agent) |
| 🟡 In active debugging | Phase 10 cookie pre-auth — Instacart redirects to login despite cookies set. Diagnostic patch deployed (`43fdc7e`). Awaiting user's next retry. |
| 🔵 Deferred (intentional) | Phase 9.5 — Passkey/WebAuthn (OAuth covers the case); Phase 8.5 — PDF + image OCR cookbook ingestion |
| 🟢 Future | Phase 11 — Proactive scheduling (cron-triggered tonight's-dinner email); Phase 12+ — SMS/voice/MCP/pantry-awareness |

## Quick reference: where to start for common tasks

| Task | Start here |
|---|---|
| Add a new grocery service | `worker/agent/strategies/<provider>.js` + `worker/cart/providers/<provider>.js` + add to `SUPPORTED_PROVIDERS` in `worker/vault.js` + register in `worker/agent/index.js` STRATEGIES and `worker/cart/index.js` PROVIDERS |
| Tune the recipe author's tone | `worker/recipe-author.js` `SYSTEM_PROMPT_BASE` |
| Tune Gemini's conversational style | `worker/llm.js` `buildSystemPrompt()` |
| Change what gets remembered | `worker/memory.js` `recordMessage` / `recordApprovedRecipe` |
| Add a new chat route | `worker/index.js` route table near the top |
| Adjust frontend recipe card | `public/bibas-playground/recipes/chat.js` `renderRecipeCard` |
| Tune the agent's per-provider behavior | `worker/agent/strategies/<provider>.js` `agentBriefing` |
| Debug an agent run | Pull the run from KV: `agent:runs:<email>` + `agent:log:<email>:<runId>` |
| Update brand colors / fonts | `public/styles.css` (root tokens) + `chat.css` |
| Flip recipe author Claude ↔ Gemini | `RECIPE_AUTHOR=gemini` env var (set or unset) |
