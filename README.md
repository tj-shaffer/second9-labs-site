# Second 9 Labs — Website & Brand Kit

Everything needed to run the Second 9 Labs marketing site and apply the brand
consistently (site, business cards, invoices, decks, social).

**Production:** https://second-9-labs.tj-shaffer.workers.dev

## What this repo is

A deliberately simple **static marketing site** served from Cloudflare —
hand-written HTML/CSS/JS, no build step, no framework, no backend. It's an
**assets-only Cloudflare Worker**: every request is served straight from
`public/`.

Each Second 9 product — **Bangers N Mash, Third Brain OS, Park PPA, MC Peels** —
is its own independent deployment on its own subdomain. This site is the hub
that links out to them.

> The recipes app (Biba's Playground) that used to live in this repo was
> extracted to its own subdomain on 2026-06-24; the backend, bindings, and
> secrets moved with it. See `CLAUDE.md` for the history.

## What's in this folder

```
second9-labs-site/
├── public/                      Everything served to the browser (the whole site)
│   ├── index.html               Home page
│   ├── projects.html            Project gallery
│   ├── project.html             Per-project detail view (?id=<slug>)
│   ├── privacypolicy.html
│   ├── termsofservice.html
│   ├── projects.json            ← content source for all projects (edit this)
│   ├── projects.js              Renders the gallery, home featured strip, and detail view
│   ├── script.js                Scroll reveals + nav polish
│   ├── styles.css               Brand system + all page styles
│   └── assets/
│       ├── favicon.svg
│       └── images/*.svg         Project cover art (hand-authored SVG)
├── wrangler.jsonc               Cloudflare config (assets-only; no Worker script)
├── package.json                 npm scripts (dev / deploy)
├── CLAUDE.md                    Orientation for Claude Code sessions
├── DESIGN.md                    The complete brand & design system
├── DEPLOYMENT.md                Non-technical deploy / onboarding guide
├── README.md                    This file
└── Docs/                        Per-product overview write-ups (source-of-truth descriptions)
```

- **Preview locally:** `npm run dev`
- **Publish:** `npm run deploy` — see `DEPLOYMENT.md` for the friendly walkthrough
- **Add or change a project:** edit `public/projects.json` — details in `CLAUDE.md`

## The brand, in one screen

The complete system — logo construction, exact tokens, the type scale,
illustration rules, components, and voice — lives in **`DESIGN.md`**, written to
be handed to a person or an AI as-is. The essentials:

**Essence:** *"Conditions for human flourishing."* WPA posters, early-Bauhaus
signage, and historic labor movements, executed as **linocut** — carved shapes,
rough edges, primary colors. The name is a promise: a second pass, done better.

**The mark** — the Second Sun: a 9 built as a rising sun with exactly nine
carved rays. The lockup is the **seal**: name on the top arc, "Human
flourishing" on the bottom, the sun in the middle.

**Color** — primaries lead. *Blue is the room, red is the second room, yellow
is the action, paper is the carve, ink is the impression.* Red never carries
body copy (contrast); blue does (7.1:1).
- Blue `#1F4E8C` · Blue Deep `#173B6B` · Red `#D42A1F` · Red Deep `#A8200F` · Yellow `#F2B01E`
- Paper `#F2ECDE` · Paper Deep `#E8DFC8` · Paper Card `#F8F3E4`
- Ink `#141414` · Ink Soft `#3A3A36` · Ink Mute `#6B6A62`

**Type** — Big Shoulders (display, 800 caps), Archivo (body/UI), Space Mono
(labels + the seal arcs). No italic emphasis-words — emphasis comes from the
sentence, or from scale, weight, and color blocks.

**Illustration** — circles, rectangles, triangles, carved: rough displacement
edges, gouge marks, flat fills, off-register color passes. Covers are `600×400`
(3:2).

**Voice** — like a friend who happens to be good at software. "We," not the
company name; "you," not "clients." Allergic to *leverage / synergy / solutions
/ transform*; at home with *ship / build / boring / honest / useful*.

## Applying the brand beyond the site

Because it's built from simple carved pieces in three colors, it travels well:
- **Business cards** — the seal on the front, contact on the back in Big Shoulders / Archivo, warm uncoated stock.
- **Invoices & proposals** — seal in the header, Archivo body, Space Mono labels.
- **Slide decks** — one room color per slide (blue lead, red sparingly), paper type, yellow only for the thing you want clicked or remembered.
- **Social avatars** — the favicon (the sun on blue) works as-is.

Need a new icon? Build it from the same vocabulary (circle + rectangle +
triangle, two colors max plus ink and paper) and it'll match. `DESIGN.md` has
the rules and reference SVGs.

## Rough starter budget (year one)

| Item | Cost |
|---|---|
| Domain (`.com` at Cloudflare cost) | ~$10/yr |
| Cloudflare Workers hosting (static assets) | $0 |
| Email (Cloudflare Email Routing) | $0 (or Fastmail ~$5/mo) |
| Calendar booking (Cal.com free tier) | $0 |
