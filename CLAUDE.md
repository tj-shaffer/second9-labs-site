# Claude Code orientation — second9-labs-site

This repo hosts (1) the Second 9 Labs marketing site and (2) **Biba's
Playground**, an evolving personal-AI project under
`/bibas-playground/recipes/`.

**Production URL:** https://second-9-labs.tj-shaffer.workers.dev

## Pivot 2026-05-21 — autonomous agent retired

Earlier work (Phase 10) built an autonomous Computer Use agent that
drove provider websites (Instacart, DoorDash, Uber Eats, Walmart) to
build grocery carts on the user's behalf. It was structurally losing an
asymmetric anti-bot war: Cloudflare datacenter IPs were flagged on
entry, cookies got rejected for IP mismatch, CAPTCHAs fired on the very
first navigation. **Every observed prod run failed with `needs_human`.**

The replacement uses official partner Recipe APIs. Currently shipped:

- **Instacart**: `POST https://connect.instacart.com/idp/v1/products/recipe`
  returns a `products_link_url`. The user opens it, lands on Instacart
  signed into their own residential session, recipe pre-loaded as a
  shoppable cart, picks store, checks out. Zero CAPTCHAs, zero stored
  credentials, no agent.

- **Walmart**: deferred. walmart.io has a Recipes API ("ingredients added
  directly to Walmart cart") but the docs page did not render via WebFetch
  during planning. Will ship in a follow-up once signup + endpoint shape
  are verified.

- **DoorDash + Uber Eats**: dropped entirely. Neither has a public
  recipe-to-cart endpoint.

The autonomous agent, vault, browser strategies, Computer Use loop,
audit log, BROWSER binding, and `@cloudflare/puppeteer` dependency were
**all deleted**. See git history for the deletion commit if any of the
code needs to be revived.

The plan document for this pivot is `~/.claude/plans/i-wonder-if-we-drifting-walrus.md`.

## What still ships (unchanged by the pivot)

- Recipe authoring: Gemini drives chat → calls `generate_recipe` → Claude
  Opus 4.7 (or Gemini 2.5 Pro fallback) authors the recipe → Imagen 4
  Fast generates a photo → 3 of 4 cross-reference DBs run in parallel.
- Magic-link sign-in (Resend), Google OAuth (code complete, awaiting
  client setup).
- Vectorize memory (per-user filter via `email` metadata):
  conversations, recipes, cookbook corpus.
- Cookbook ingestion (paste / URL → segment → embed → store).
- Recipe + cross-reference caches in R2 + KV.

## Architecture

Single Cloudflare Worker at [`worker/index.js`](worker/index.js)
routes to feature modules. Static assets under `public/` (set via
`assets.directory` in `wrangler.jsonc`).

### Worker modules

| Path | Owns |
|---|---|
| `worker/index.js` | HTTP route table + handler glue |
| `worker/llm.js` | Gemini conversation drive + system-prompt builder |
| `worker/tools.js` | Function-call schema + dispatcher (one tool: `generate_recipe`) |
| `worker/recipe-author.js` | Claude Opus 4.7 default + Gemini 2.5 Pro fallback (set `RECIPE_AUTHOR=gemini` to force Gemini) |
| `worker/image-gen.js` | Imagen 4 Fast → R2-cached photos (`imagen-4.0-fast-generate-001`) |
| `worker/recipe-cache.js` | KV-backed recipe cache (key = `sha256(query+prefs)`) |
| `worker/cross-reference.js` | Parallel fan-out via `ctx.waitUntil` (Edamam skipped at runtime; 3 of 4 DBs) |
| `worker/db-clients/{spoonacular,edamam,themealdb,tasty}.js` | DB-specific cross-ref clients |
| `worker/embed.js` | Workers AI bge-base-en-v1.5 wrapper (768d) |
| `worker/memory.js` | Vectorize wrapper for `MEMORY_{CONVERSATIONS,RECIPES,CORPUS}` |
| `worker/recipe-dna.js` | Heuristic feature extraction from recipe schema |
| `worker/ingest.js` | Cookbook ingestion: extract → segment → normalize → embed |
| `worker/auth.js` | Magic-link tokens + signed-cookie session helpers |
| `worker/auth-oauth.js` | Google OAuth 2.0 + PKCE (needs `GOOGLE_CLIENT_ID`/`SECRET`) |
| `worker/email.js` | Resend client + magic-link template |
| `worker/kv.js` | Typed wrappers over `BIBA_USERS` KV namespace |
| `worker/cart/index.js` | Provider registry + dispatcher; filters by env-key availability |
| `worker/cart/providers/instacart.js` | Instacart Recipe API client (POST to `connect.instacart.com/idp/v1/products/recipe`) |

### KV layout — `BIBA_USERS` namespace

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
```

Orphaned keys from the pre-pivot vault/agent era — leave alone, they're
inert: `vault:*`, `agent:runs:*`, `agent:log:*`. No TTL on `vault:*` but
nothing reads them; safe to ignore or delete manually.

### Vectorize indexes

- `biba-memory-conversations` — user messages
- `biba-memory-recipes` — send-to-cart approved recipes
- `biba-memory-corpus` — personal cookbook chunks

All 768-dim cosine, metadata index on `email`. Per-user filter
(`{email: {$eq: …}}`) on every query.

### R2 buckets

- `biba-recipe-images` — Imagen-generated photos keyed by
  `sha256(title|image_prompt)`.

### Cloudflare bindings live on prod

- KV namespace: `0db6c3acfbc44876900b37442cf91feb` (`BIBA_USERS`)
- R2: `biba-recipe-images`
- Vectorize × 3: `biba-memory-conversations`, `biba-memory-recipes`, `biba-memory-corpus`
- Workers AI binding (`env.AI`)

### Production secrets via `wrangler secret put`

Keep: `ANTHROPIC_API_KEY` (Claude Opus 4.7 recipe author), `GEMINI_API_KEY`,
`SPOONACULAR_API_KEY`, `RAPID_API_KEY` (Tasty), `RESEND_API_KEY`,
`EMAIL_FROM`, `SESSION_SECRET`.

**Required for ordering**: `INSTACART_API_KEY` — Bearer token from the
Instacart Developer Platform. Without it, `/api/cart/providers` returns
an empty list and the order buttons don't render. Sign up at
https://docs.instacart.com/developer_platform_api/.

Coming soon: `WALMART_API_KEY` (Walmart Recipes API, follow-up).

**Not set, on purpose**: `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (OAuth
gracefully degrades), `EDAMAM_APP_ID`/`KEY` (skipped — cross-ref uses 3
of 4 DBs).

**Obsolete** (remove via `wrangler secret delete` when convenient):
`VAULT_MASTER_KEY` (vault deleted in the pivot).

## Dev workflow

```sh
npm run dev    # wrangler dev --port 8787 --persist-to /tmp/wrangler-state-bibas
npm run deploy # wrangler deploy
```

The `--persist-to /tmp/...` flag is **load-bearing** — without it the
hot-reload hits a SQLite-lock loop.

`.dev.vars` (gitignored) holds local secrets. `.dev.vars.example` is the
canonical template.

### Useful prod read commands (require `wrangler login`)

```sh
# Inspect a recipe by id
npx wrangler kv key get 'recipe:byid:<recipeId>' \
  --namespace-id=0db6c3acfbc44876900b37442cf91feb --remote

# List keys with a prefix
npx wrangler kv key list \
  --namespace-id=0db6c3acfbc44876900b37442cf91feb \
  --prefix='session:' --remote

# Tail live Worker logs (90s window suggested)
npx wrangler tail second-9-labs --format=pretty
```

## Conventions

### Patterns to reuse

- **`escapeHtml(str)`** — same shape in `public/projects.js`,
  `public/bibas-playground/recipes/chat.js`, `cookbook.html`. Inline-copy
  this for any HTML-building frontend code.
- **Provider abstraction** — `worker/cart/providers/<id>.js` exports
  `default { id, name, description, mode, async buildLink(recipe, env, opts) }`.
  Adding a new provider is one file + one line in
  `worker/cart/index.js` + an env-key gate in `isProviderAvailable`.
- **DB clients** — `worker/db-clients/*.js` expose
  `crossRef(query, env) → {source, count, sampleImage} | null`.
- **Visual tokens** — `public/styles.css`: `--paper` `#F2ECDE`,
  `--paper-deep`, accents `#D42A1F` (red), `#F2B01E` (yellow),
  `#1F4E8C` (blue), `#141414` (ink). Fonts: Fraunces (display), DM Sans
  (UI), JetBrains Mono (labels).
- **`runChat({apiKey, system, contents, tools, env, dispatch, preferences,
  executionCtx, userEmail})`** — the conversational loop in `llm.js`.
- **Recipe schema → Instacart Recipe API** — direct mapping in
  `worker/cart/providers/instacart.js`. Unit normalization (e.g.,
  `tbsp → tablespoon`) lives in the `UNIT_ALIASES` map there.

### Architectural decisions

- **Single conversational tool** — `generate_recipe` is the only function
  Gemini calls. Earlier search+detail tools retired in Phase 6.
- **Implicit signals, not reactions** — send-to-cart is the positive
  signal; ask-for-alternatives is the soft negative.
- **Memory is authed-only** — anonymous users get the same v1 experience
  but no embeddings.
- **Ordering uses official APIs only** — no scraping, no automation, no
  stored credentials. If a provider has no public recipe-to-cart API,
  they're not offered.

### Anti-patterns to avoid

- **Don't put dev-only secrets in `wrangler.jsonc`.** Use `.dev.vars`
  locally and `wrangler secret put` for prod.
- **Don't break the prefix on `BIBA_USERS` keys.** List endpoints rely
  on these prefixes.
- **Don't add Vectorize bindings without `remote: true`.** Wrangler has
  no local-mode simulation; the binding errors at boot without it.
- **Don't bring back the autonomous agent without strong reason.** The
  anti-bot war is structural, not a bug. If a new provider emerges with
  a public recipe-to-cart API, add it the same way Instacart is wired.
- **Don't reintroduce reaction buttons.** Implicit signals are
  intentional UX.
- **Don't run `npm audit fix --force`.** Downgrades wrangler 4.x → 3.x
  and breaks Vectorize remote-mode + `--persist-to`. Flagged `ws` CVE
  is dev-only and not exploitable in our local-only setup.

## Where to find things

- **Pivot plan**: `~/.claude/plans/i-wonder-if-we-drifting-walrus.md`
- **Brand kit + marketing site**: `README.md` (separate from Biba's,
  same repo)
- **Deprecated** but historical: `PRD.md` (predates Kitchen OS pivot;
  v1 architecture only)

## Quick reference: where to start for common tasks

| Task | Start here |
|---|---|
| Add a new grocery provider (with an API) | `worker/cart/providers/<id>.js` + import in `worker/cart/index.js` + env-key gate in `isProviderAvailable` + add the API key via `wrangler secret put` |
| Tune the recipe author's tone | `worker/recipe-author.js` `SYSTEM_PROMPT_BASE` |
| Tune Gemini's conversational style | `worker/llm.js` `buildSystemPrompt()` |
| Change what gets remembered | `worker/memory.js` `recordMessage` / `recordApprovedRecipe` |
| Add a new chat route | `worker/index.js` route table near the top |
| Adjust frontend recipe card | `public/bibas-playground/recipes/chat.js` `renderRecipeCard` |
| Update brand colors / fonts | `public/styles.css` (root tokens) + `chat.css` |
| Flip recipe author Claude ↔ Gemini | `RECIPE_AUTHOR=gemini` env var (set or unset) |
