# Claude Code orientation — second9-labs-site

This repo hosts (1) the Second 9 Labs marketing site and (2) **Biba's
Playground**, an evolving personal-AI project under
`/bibas-playground/recipes/`. As of the last commit on `kitchen-os`,
Phases 1–10 of the Kitchen OS arc have shipped.

The authoritative roadmap is `~/.claude/plans/what-s-the-scoop-i-silly-kahn.md`.
Read it first if anything below is ambiguous.

## Branches

- **`main`** — v1 (Phases 1–5). Polished demo with Spoonacular-driven
  recipe chat, magic-link auth, multi-provider grocery hand-off. Treat
  as a snapshot; do not develop here.
- **`kitchen-os`** — active development. Phases 6–10 shipped:
  - 6 — LLM-authored recipes (Claude Opus 4.7 default, Gemini 2.5 Pro
    fallback) + Imagen 4 photos + R2 cache + 4-DB cross-reference
  - 7 — Per-user Vectorize memory (conversations, recipes, corpus)
  - 8 — Personal cookbook ingestion via paste/URL
  - 9 — Google OAuth primary; magic-link recovery
  - 10 — Encrypted vault + computer-use agent (Instacart strategy;
    Uber Eats / Walmart / DoorDash extensible)
- **`bibas-playground-automated-recipes`** — preserved v1 branch.

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
| `worker/recipe-author.js` | Claude Opus 4.7 / Gemini 2.5 Pro recipe author with forced tool-use |
| `worker/image-gen.js` | Imagen 4 Fast → R2-cached photos |
| `worker/recipe-cache.js` | KV-backed recipe cache (key = `sha256(query+prefs)`) |
| `worker/cross-reference.js` | Parallel fan-out to four DBs via `ctx.waitUntil` |
| `worker/db-clients/{spoonacular,edamam,themealdb,tasty}.js` | DB-specific cross-ref clients |
| `worker/embed.js` | Workers AI bge-base-en-v1.5 wrapper (768d) |
| `worker/memory.js` | Vectorize wrapper for `MEMORY_{CONVERSATIONS,RECIPES,CORPUS}` |
| `worker/recipe-dna.js` | Heuristic feature extraction from recipe schema |
| `worker/ingest.js` | Cookbook ingestion: extract → segment → normalize → embed |
| `worker/auth.js` | Magic-link tokens + signed-cookie session helpers |
| `worker/auth-oauth.js` | Google OAuth 2.0 + PKCE flow |
| `worker/email.js` | Resend client + magic-link template |
| `worker/kv.js` | Typed wrappers over `BIBA_USERS` KV namespace |
| `worker/vault.js` | AES-GCM envelope encryption for grocery-service creds |
| `worker/agent/index.js` | Computer-use agent orchestrator (SSE) |
| `worker/agent/browser.js` | Cloudflare Browser Rendering wrapper + DrySession fallback |
| `worker/agent/computer-use.js` | Claude Computer Use loop + dry-mode equivalent |
| `worker/agent/audit.js` | KV-backed action log (`agent:log:<email>:<runId>`) |
| `worker/agent/strategies/instacart.js` | Provider-specific knowledge (startUrl, briefing, cart hints) |
| `worker/cart/{index.js,utils.js}` + `cart/providers/*.js` | Public search-URL hand-off (v1 fallback) |

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
  `sha256(title|image_prompt)`.

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

For prod deploy, every var needs `npx wrangler secret put NAME`.

### External resources to provision (one-time, per environment)

- KV namespace `biba_users` → paste ID into `wrangler.jsonc`
- R2 bucket `biba-recipe-images`
- Vectorize indexes `biba-memory-{conversations,recipes,corpus}` (each
  768d cosine + `email` metadata index)
- `wrangler login` for Workers AI + Vectorize remote-mode dev access
- Optional, when going to live computer-use:
  - Workers Paid plan + Browser Rendering subscription
  - `BROWSER` binding uncommented in `wrangler.jsonc`
  - `npm install @cloudflare/puppeteer`

## Conventions

### Patterns to reuse, don't reinvent

- **`escapeHtml(str)`** — same shape in `public/projects.js`,
  `public/bibas-playground/recipes/chat.js`, `cookbook.html`,
  `vault.html`. Inline-copy this. Any new HTML-building code on the
  frontend needs it.
- **Provider abstraction** — `worker/cart/providers/*.js` (search URL
  hand-off, Phase 4) and `worker/agent/strategies/*.js` (computer-use,
  Phase 10) are independent layers. New grocery services add to both
  (search-URL provider for anonymous users; agent strategy for
  signed-in vault users).
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

### Decisions baked into the architecture

- **Single tool, not many** — `generate_recipe` is the only function
  Gemini calls. Earlier search+detail tools were retired in Phase 6.
- **Implicit signals, not reactions** — Phase 6 retired
  `loved/liked/skipped` buttons. Send-to-cart is the positive
  signal; ask-for-alternatives is the soft negative. Signals
  surface as `signal: 'sent_to_cart'` entries in
  `appendHistory()` and Vectorize metadata.
- **Memory is authed-only** — anonymous users get the same v1
  experience. Embeddings only land in Vectorize when there's a
  `user.email`.
- **Dry-run as a first-class mode** — the computer-use agent runs
  end-to-end (vault decrypt, audit log, SSE) even without paid
  services. Flipping to live is a config change, not a code change.

### Anti-patterns to avoid

- **Don't put dev-only secrets in `wrangler.jsonc`.** Use `.dev.vars`
  locally and `wrangler secret put` for prod.
- **Don't break the prefix on `BIBA_USERS` keys.** The list endpoints
  (vault status, cookbook sources) rely on these prefixes.
- **Don't add Vectorize bindings without `remote: true`.** Wrangler
  has no local-mode simulation; the binding type errors at boot
  without `remote: true`.
- **Don't ship code that embeds API keys in the system prompt or
  message history.** The vault exists specifically to keep
  credentials out of LLM context.
- **Don't reintroduce reaction buttons.** Implicit signals are the
  intentional UX choice (see Phase 6 plan rationale).

## Where to find things

- **Long-term roadmap + verification scenarios**:
  `~/.claude/plans/what-s-the-scoop-i-silly-kahn.md`
- **Per-environment provisioning checklist**: this file + `.dev.vars.example`
- **Live state of TJ's local dev (.dev.vars, Cloudflare account)**:
  the `project_status.md` and `feedback_dev_environment.md` memories
- **Brand kit + marketing site**: `README.md` (separate from Kitchen
  OS, lives alongside in the same repo)
- **Deprecated** but historical: `PRD.md` (predates Kitchen OS pivot;
  v1 architecture only — useful as a reference for v1 surface area)

## What's deferred (not "todo" but worth knowing about)

- **Passkey/WebAuthn** — Phase 9 shipped OAuth but skipped passkey;
  ~300 lines of CBOR/COSE server parsing for marginal added value
  given Google OAuth covers the common case. Folder ready: a
  `worker/auth-passkey.js` slot can drop in.
- **PDF + image OCR cookbook ingestion** — Phase 8 MVP did paste +
  URL only. PDF needs pdf.js or similar; image OCR via Workers AI
  vision models. One extra extractor step in `ingest.js`.
- **Phase 11 — Proactive scheduling** — cron-triggered emails with
  tonight's recipe. Needs Workers Paid plan + cron triggers.
- **Phase 12+ — SMS (Twilio), voice (Web Speech API), MCP server,
  pantry awareness** — sketched in the plan file.

## Quick reference: where to start for common tasks

| Task | Start here |
|---|---|
| Add a new grocery service (Uber Eats, Walmart, DoorDash) | `worker/agent/strategies/<provider>.js` + provider entry in `worker/vault.js` `SUPPORTED_PROVIDERS` |
| Tune the recipe author's tone or constraints | `worker/recipe-author.js` `SYSTEM_PROMPT_BASE` |
| Tune Gemini's conversational style | `worker/llm.js` `buildSystemPrompt()` |
| Change what gets remembered | `worker/memory.js` `recordMessage` / `recordApprovedRecipe` |
| Add a new chat route | `worker/index.js` route table near the top |
| Adjust frontend recipe card | `public/bibas-playground/recipes/chat.js` `renderRecipeCard` |
| Update brand colors / fonts | `public/styles.css` (root tokens) + `chat.css` |
