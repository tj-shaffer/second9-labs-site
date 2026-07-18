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

**Essence:** *"Conditions for human flourishing."* WPA poster + early-Bauhaus +
constructivism — geometric and confident in form, warm and plain in voice. The
name is a promise: *a second pass, done better.*

**Color** — paper ground, ink structure, a primary triad for signal. *Red is
load-bearing, yellow is a punch, blue is a whisper — never all three at equal
volume.*
- Paper `#F2ECDE` · Paper Deep `#E8DFC8` · Paper Card `#F8F3E4`
- Ink `#141414` · Ink Soft `#3A3A36` · Ink Mute `#6B6A62`
- Red `#D42A1F` · Yellow `#F2B01E` · Blue `#1F4E8C`

**Type** — Fraunces (display serif), DM Sans (body), JetBrains Mono (labels).
Emphasis words and the "9" go italic + red.

**Illustration** — circles, rectangles, triangles only; thick strokes, flat
fills, asymmetric compositions; the logo aperture recurs as a motif. Covers are
`600×400` (3:2).

**Voice** — like a friend who happens to be good at software. "We," not the
company name; "you," not "clients." Allergic to *leverage / synergy / solutions
/ transform*; at home with *ship / build / boring / honest / useful*.

## Applying the brand beyond the site

Because it's built from simple geometric pieces in three colors, it travels well:
- **Business cards** — mark on the front, contact on the back in Fraunces / DM Sans, warm uncoated stock near the paper color.
- **Invoices & proposals** — primary lockup header, DM Sans body, the red-bar rule for section breaks.
- **Slide decks** — cream background, ink text, one primary accent per slide.
- **Social avatars** — the favicon works as-is on a cream square.

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
