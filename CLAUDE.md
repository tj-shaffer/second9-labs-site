# Claude Code orientation — second9-labs-site

This repo is the **Second 9 Labs marketing site** — a static site served from
Cloudflare. It's deliberately simple: hand-written HTML/CSS/JS, no build step,
no framework, no backend.

**Production URL:** https://second-9-labs.tj-shaffer.workers.dev

## History — recipes app extracted 2026-06-24

This repo used to also host **Biba's Playground**, a personal-AI recipe app
(Gemini conversation → Claude-authored recipes → Imagen photos → Instacart
Recipe API cart hand-off, plus magic-link/Google auth and Vectorize memory). On
2026-06-24 that app was **extracted to take another swing at it on its own
subdomain** — the same pattern as the other Second 9 projects (Third Brain OS,
Bangers N Mash), which live as independent deployments linked from this site.

The extraction deleted the entire `worker/` backend (21 modules), the
`public/bibas-playground/` frontend, every `wrangler.jsonc` binding (KV
`BIBA_USERS`, R2 `biba-recipe-images`, 3 Vectorize indexes, Workers AI),
`.dev.vars.example`, and `PRD.md`. **The Cloudflare resources and their data
were preserved** on the account for the rebuild to reuse — they're just no
longer referenced here. To revive any deleted code, check git history before
the 2026-06-24 extraction commit.

## Architecture

A single **assets-only Cloudflare Worker** — there is no Worker script.
`wrangler.jsonc` declares `name` + `assets.directory: ./public` and nothing
else, so every request is served as a static file. Clean URLs
(`/privacypolicy`, `/termsofservice`) resolve to their `.html` files via
Cloudflare's default asset `html_handling`.

### public/ — the whole site

| Path | Purpose |
|---|---|
| `index.html` | Home page (hero, services, process, FAQ, contact, featured-projects strip) |
| `projects.html` | Full project gallery |
| `project.html` | Per-project detail view (`?id=<slug>`) |
| `privacypolicy.html` / `termsofservice.html` | Legal |
| `projects.json` | **Content source for all project work** — edit this to add / remove / feature projects |
| `projects.js` | Renders the gallery, the home featured strip, and the detail view from `projects.json` |
| `script.js` | Reveal animations, smooth-scroll nav, calendar-link placeholder |
| `styles.css` | All styling + brand tokens (`:root`) |
| `assets/favicon.svg` | Favicon — the logo mark on a paper backplate |
| `assets/images/*.svg` | Project cover art (hand-authored SVG) |

### projects.json → projects.js (the one dynamic-ish piece)

`projects.js` fetches `projects.json` and renders one of three views depending
on which mount element the page contains:

- `#gallery` (projects.html) → all projects
- `#featured-gallery` (index.html) → `projects.filter(p => p.featured).slice(0,3)`,
  falling back to the first 3 if none are flagged featured
- `#project-root` (project.html) → detail view for `?id=<slug>`

**Card linking rules** (in `renderGallery`):
- Project **with** a `url` → the card links straight there. If the url is
  external (`http(s)://`) it opens in a **new tab** (`target="_blank"
  rel="noopener"`); internal/relative urls stay in-tab.
- Project **without** a `url` → card links to `project.html?id=<id>`, and the
  detail view renders from the JSON (`description`, `outcome`, `stack`, `links`).
- **Sister projects on subdomains** are featured exactly this way: add a card
  with `"url": "https://<sub>.secondninelabs.com"`. See the `everstory-bangers-n-mash`
  entry for the canonical example.

## Conventions

### Patterns to reuse
- **`escapeHtml(str)`** — defined inline at the top of `projects.js`. Copy it
  into any HTML-building frontend code rather than importing.
- **Brand tokens** (`styles.css` `:root`): `--paper #F2ECDE`, `--paper-deep
  #E8DFC8`, `--paper-card #F8F3E4`, `--ink #141414` (+ `--ink-soft #3A3A36`,
  `--ink-mute #6B6A62`), accents `--red #D42A1F`, `--yellow #F2B01E`, `--blue
  #1F4E8C`. Fonts: Fraunces (display), DM Sans (UI), JetBrains Mono (labels).
- **Project cover art** — hand-authored SVG in `public/assets/images/`,
  `viewBox="0 0 600 400"` (3:2), bold geometric Bauhaus-ish brand style with the
  logo aperture (red circle + paper hole) recurring as a motif. A missing cover
  degrades to a clean paper-colored block (`.project-cover` has a `--paper`
  background), not a broken-image icon. Real screenshots (~1200×800, 3:2) drop
  in just as well.

### Adding / changing project work
Edit `public/projects.json`. To add a project, copy an existing block and set
`id / title / client / year / tagline / tags / cover / images`, then either give
it a `url` (card links out) **or** `description` + `outcome` + `stack` + `links`
(card opens a detail page). Add `featured: true` to surface it on the home strip.

### Anti-patterns to avoid
- **Don't add a Worker script or bindings back** unless the site genuinely grows
  a backend need — it's intentionally assets-only now.
- **Don't break the cover aspect ratio** — `.project-cover` is `aspect-ratio:
  3 / 2`; covers are authored at 600×400.
- **Don't run `npm audit fix --force`** — it downgrades wrangler 4.x → 3.x.

## Dev workflow

```sh
npm run dev    # wrangler dev --port 8787 --persist-to /tmp/wrangler-state-bibas
npm run deploy # wrangler deploy → https://second-9-labs.tj-shaffer.workers.dev
```

There's no build step — what's in `public/` is what ships. (The `--persist-to`
flag on `dev` is a harmless holdover from the stateful-app era; a static site
has no local state to persist.) Validate `projects.json` before deploying — a
JSON syntax error makes the gallery show "Couldn't load projects."

## Where to find things
- **Brand kit + marketing copy:** `README.md`
- **Complete brand & design system:** `DESIGN.md` (logo, tokens, type,
  illustration rules, components, voice — written to hand to a person or an AI)
- **Non-technical deploy / onboarding guide:** `DEPLOYMENT.md` (the real
  `npm run deploy` wrangler flow)
- **Per-product overviews:** `Docs/*-overview.md` (source-of-truth descriptions
  for each Second 9 product — Bangers N Mash, Third Brain OS, MC Peels)
- **Deleted recipes app:** git history before the 2026-06-24 extraction commit
