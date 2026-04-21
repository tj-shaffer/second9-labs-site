# Second 9 Labs — Website & Brand Kit

Everything you need to publish the site and apply the brand consistently elsewhere (business cards, invoices, proposals, social).

---

## 1. What's in this folder

```
second9-labs/
├── index.html            Homepage
├── projects.html         Project gallery
├── project.html          Project detail template
├── projects.json         ← your "admin panel" — edit this to add projects
├── styles.css            Brand system + all page styles
├── script.js             Scroll reveals + nav polish
├── projects.js           Loads projects.json and renders the gallery/detail
├── README.md             This file (brand guide)
├── DEPLOYMENT.md         Step-by-step hosting instructions
└── assets/
    ├── favicon.svg
    ├── logo-mark.svg         The 9 mark alone
    ├── logo-primary.svg      Mark + wordmark
    ├── icon-*.svg            Six service icons
    └── images/               Project screenshots go here
        └── placeholder-*.svg
```

**To publish the site:** read `DEPLOYMENT.md`. Start-to-finish in about 45 minutes.
**To add a project after launch:** edit `projects.json` on GitHub. Site redeploys automatically.

---

## 2. Brand identity

### 2.1 The idea
**"Conditions for human flourishing."** The brand sits in the lineage of WPA posters, early Bauhaus signage, and mid-century constructivism — visual traditions rooted in the dignity of work and tools that serve people. Geometric, confident, primary-colored. Warm in voice, structural in form.

The name is a promise: *a second pass, done better.* The mark is a 9 built from three shapes in dialogue — a red ring (the bowl), a black vertical bar (the descender), and a small yellow accent square. Constructed, not drawn. Modernist, not nostalgic.

### 2.2 Logo usage
- **Primary lockup** (`assets/logo-primary.svg`) — for headers, letterhead, pitch decks.
- **Mark alone** (`assets/logo-mark.svg`) — for avatars, favicons, watermarks, anywhere under ~64px.
- Keep a clear space equal to the height of the yellow accent square around the logo.
- Don't stretch, recolor, or rotate. The red is the red. The yellow is the yellow.
- On ink backgrounds, the inner "hole" of the bowl should match the background color (not the paper color).

### 2.3 Color palette

| Role | Name | Hex | Use |
|---|---|---|---|
| Background | Paper | `#F2ECDE` | Default background, newsprint warmth |
| Background alt | Paper Deep | `#E8DFC8` | Section separation, FAQ |
| Card | Paper Card | `#F8F3E4` | Service cards, step cards |
| Structural | Ink | `#141414` | All body text, borders, structural blocks |
| Signal | Red | `#D42A1F` | The dominant accent. The 9. Emphasis. CTAs. |
| Accent | Yellow | `#F2B01E` | Secondary punch. Step 4. Accents. Hover states. |
| Secondary | Blue | `#1F4E8C` | Occasional, for variety. Step 3. AI icon. |

**Rule of thumb:** red is load-bearing. Yellow is a punch. Blue is a whisper. Never use all three at equal volume — one dominates per surface.

### 2.4 Typography
- **Fraunces** — display serif for headings. Use weight 700 for headlines, 600 for section titles. Italic + red for emphasis words and "9".
- **DM Sans** — body copy. Weight 400 default, 500 for buttons and nav.
- **JetBrains Mono** — eyebrow labels, step numbers, footer. Small caps tracking (0.18em letter-spacing).

All three are free Google Fonts, already loaded via the CDN in `index.html`.

### 2.5 The geometric rule
All illustrative SVGs follow the same vocabulary so they feel like one set:
- Circles, rectangles, triangles. No curves beyond those primitives.
- No hand-drawn wobble. No dashed sketch lines. Everything constructed.
- Strokes are thick (2–3px minimum) and solid.
- Compositions are asymmetric — one dominant element, small accent shapes, never centered-and-balanced.
- Flat fills only. No gradients, no shadows on illustrations. (The buttons have a hard shadow — that's different, it's a structural choice.)

### 2.6 Voice
- Warm, plain, confident. Like a friend who happens to be good at software.
- Short sentences beat long ones.
- "We" not "Second 9 Labs." "You" not "clients."
- Allergic to: *leverage, synergy, solutions, transform, unlock, journey, partner as a verb*.
- At home with: *ship, build, listen, boring, afternoon, honest, useful*.

---

## 3. Publishing the site

See `DEPLOYMENT.md` in this folder for the full step-by-step. Short version: put the files in a GitHub repo, connect Cloudflare Pages, done.

---

## 5. Rough starter budget

| Item | Cost |
|---|---|
| Domain (`.com` at Cloudflare cost) | ~$10/year |
| Cloudflare Pages hosting | $0 |
| Email (Fastmail, 1 address) | $5/mo |
| Calendar booking (Cal.com free tier) | $0 |
| **Total year one** | **~$70** |

---

## 6. Applying the brand beyond the website

Because the brand is built from simple geometric pieces in three colors, it travels well:

- **Business cards** — mark on the front (bleed red to edge on one side), contact info on the back in Fraunces / DM Sans. Printed on a warm uncoated stock close to the paper color.
- **Invoices & proposals** — header is the primary lockup, body uses DM Sans, section breaks use the red bar treatment from the hero.
- **Slide decks** — cream paper background, ink text, one primary-color accent per slide. Copy the service icon style for any custom illustrations.
- **Social avatars** — the favicon works as-is. Square, 400×400, cream background.
- **Email signature** — mark + wordmark inline, name in Fraunces 600, everything else in DM Sans.

The system is easy to extend: if you need a new icon, build it from the same vocabulary (circle + rectangle + triangle, two colors max plus ink and paper), and it'll match.

---

## 7. When you want to grow the site

Easy next additions, in order of usefulness:
1. **Case studies page** (once you have 2–3 clients) — `case-studies.html` using the same styles.
2. **Blog** — drop a `/writing/` folder with markdown; use a static site generator like Astro or Eleventy if you want proper blog tooling.
3. **Contact form** — switch to Netlify for free form handling, or use [Formspree](https://formspree.io) on Cloudflare Pages.
4. **Testimonials block** — add between Process and Manifesto sections.

The CSS is organized in clearly labeled sections, so extending it should feel friendly.
