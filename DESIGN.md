# Second 9 Labs — Design Guide

> **For an AI reading this:** this is the complete, self-contained brand system
> for Second 9 Labs. Everything needed to produce on-brand work — colors, type,
> the logo, illustration rules, components, and voice — is in this one file,
> including copy-pasteable CSS and SVG source. When it conflicts with a generic
> default, this document wins. Apply it faithfully; don't invent new colors,
> faces, or motifs.

**Essence:** *"Conditions for human flourishing."*
The brand sits in the lineage of **WPA posters, early-Bauhaus signage, and
mid-century constructivism** — visual traditions rooted in the dignity of work
and tools that serve people. Geometric, confident, primary-colored in form;
warm and plain in voice. The name is a promise: **a second pass, done better.**

---

## 1. The mark

A **"9" constructed from three shapes in dialogue** — not drawn, built:

- a **red ring** — the bowl of the 9
- an **ink vertical bar** — the descender
- a small **yellow square** — the accent

It reads as a mark at a glance and as a "9" on a second look. Modernist, not
nostalgic.

**SVG source (canonical, on a paper ground):**

```svg
<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Second 9 Labs">
  <circle cx="52" cy="46" r="30" fill="#D42A1F"/>  <!-- red ring: the bowl -->
  <circle cx="52" cy="46" r="14" fill="#F2ECDE"/>  <!-- hole: matches the ground -->
  <rect x="76" y="46" width="14" height="58" fill="#141414"/>  <!-- ink bar: the descender -->
  <rect x="76" y="18" width="14" height="14" fill="#F2B01E"/>  <!-- yellow accent square -->
</svg>
```

**Adapting to the ground:**
- **On paper (`#F2ECDE`):** the bowl's hole is paper-colored (as above).
- **On ink (`#141414`):** the hole matches the ground (`#141414`), and the
  descender flips to paper (`#F2ECDE`) so it stays visible. Bowl stays red,
  square stays yellow.
- **On red (`#D42A1F`):** the mark inverts to ink — bowl becomes ink, hole
  becomes red, descender and square become paper.

**Rules:**
- Clear space around the mark = the height of the yellow accent square.
- Use the mark alone below ~64px (favicons, avatars, watermarks).
- **Don't** stretch, rotate, or recolor. The red is the red; the yellow is the yellow.
- **Don't** put the ink mark on a dark ground without inverting the descender.

**Wordmark:** "Second 9 Labs" set in Fraunces 700; the **9 is italic and red**
(`#D42A1F`). The favicon is the mark on a paper backplate (`rx=24` rounded square)
so it reads on any browser tab.

---

## 2. Color

| Role | Name | Hex | Use |
|---|---|---|---|
| Ground | **Paper** | `#F2ECDE` | Default background. Newsprint warmth. |
| Ground alt | **Paper Deep** | `#E8DFC8` | Section separation, alternating bands. |
| Card | **Paper Card** | `#F8F3E4` | Cards and raised surfaces. |
| Structure | **Ink** | `#141414` | Body text, borders, structural blocks. |
| Text soft | **Ink Soft** | `#3A3A36` | Secondary copy, ledes. |
| Text mute | **Ink Mute** | `#6B6A62` | Captions, meta, mono labels. |
| Signal | **Red** | `#D42A1F` | The dominant accent. The 9. Emphasis. CTAs. |
| Signal | **Red Deep** | `#A8200F` | Pressed / darker red states. |
| Accent | **Yellow** | `#F2B01E` | Secondary punch. Hover states. Highlights. |
| Secondary | **Blue** | `#1F4E8C` | Occasional, for variety. |

**The volume rule — the single most important color principle:**
**Red is load-bearing. Yellow is a punch. Blue is a whisper.** Never use all
three at equal volume — one color dominates per surface. The neutrals are warm
(paper is cream, "grey" is a warm ink), never pure white or cold grey.

```css
:root {
  --paper: #F2ECDE;
  --paper-deep: #E8DFC8;
  --paper-card: #F8F3E4;
  --ink: #141414;
  --ink-soft: #3A3A36;
  --ink-mute: #6B6A62;
  --red: #D42A1F;
  --red-deep: #A8200F;
  --yellow: #F2B01E;
  --blue: #1F4E8C;
}
/* Text selection is yellow: ::selection { background: #F2B01E; color: #141414; } */
```

---

## 3. Typography

Three free typefaces (Google Fonts), each with one job:

- **Fraunces** — display serif for headings. 700 for headlines, 600 for section
  titles. Emphasis words and the "9" go **italic + red**. Optical size maxed
  (`font-variation-settings: "opsz" 144`), tight tracking (`-0.025em`).
- **DM Sans** — body copy. 400 default, 500 for buttons and nav.
- **JetBrains Mono** — eyebrow labels, step numbers, meta, footer. Uppercase,
  wide tracking (`0.18em`).

```css
--serif: 'Fraunces', Georgia, serif;
--sans:  'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--mono:  'JetBrains Mono', ui-monospace, monospace;
```

```html
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..900;1,9..144,400..900&family=DM+Sans:opsz,wght@9..40,300..700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

**Type scale** (all headings: `--serif`, `letter-spacing: -0.025em`, `line-height: ~1.02`):

| Role | Size | Weight |
|---|---|---|
| H1 | `clamp(2.85rem, 7.5vw, 6rem)` | 700 |
| H2 | `clamp(2rem, 4.5vw, 3.5rem)` | 700 |
| H3 | `clamp(1.3rem, 2vw, 1.55rem)` | 600 |
| Lede | `clamp(1.15rem, 1.5vw, 1.35rem)`, color Ink Soft | 400 |
| Body | `17px` / line-height `1.55` | 400 |
| Eyebrow / label | `0.75rem`, `letter-spacing: 0.18em`, uppercase, `--mono` | 500 |

Body copy stays near ~62ch wide.

---

## 4. Illustration — the geometric rule

Every cover and icon uses **one vocabulary** so the whole set feels related:

- **Circles, rectangles, triangles only** — no curves beyond those primitives
  (rounded-rect corners are fine).
- **Thick, solid strokes** (2–4px). **Flat fills only** — no gradients, no soft
  blurred shadows on illustrations. (The *hard offset shadow* on buttons/cards is
  a separate, structural device — see §5.)
- **Constructed, never hand-drawn.** No wobble, no sketch lines.
- Compositions lean **asymmetric** — one dominant element, small accents; avoid
  dead-centered-and-balanced.
- Colors: paper ground, ink strokes, primary-triad fills following the volume rule.

**The aperture motif:** the logo's red-circle-with-a-punched-hole recurs across
the set as a node, accent, or focal point (e.g. a graph hub, a card's EMV chip,
a header dot).

**Cover spec:** `viewBox="0 0 600 400"` (**3:2**). Authored as hand-written SVG.
A missing cover must degrade to a clean paper-colored block (`aspect-ratio: 3/2`,
`background: #F2ECDE`), never a broken-image icon. Real screenshots (~1200×800,
3:2) drop in the same slot. See the reference artwork in the Appendix.

---

## 5. Components

Hard edges, hard shadows, **no rounded corners on UI**. The feel is printed and
physical: 2.5px ink borders and solid, un-blurred offset shadows.

**Buttons**
```css
.btn { border: 2.5px solid #141414; padding: 0.95rem 1.6rem; font-weight: 500;
       font-family: var(--sans); display: inline-flex; gap: 0.55rem; }
.btn-primary { background: #141414; color: #F2ECDE; box-shadow: 5px 5px 0 #D42A1F; }
.btn-primary:hover { transform: translate(-2px, -2px); box-shadow: 7px 7px 0 #D42A1F; }
.btn-ghost { background: transparent; color: #141414; }
.btn-ghost:hover { background: #F2B01E; }
/* Trailing arrow "→" slides 4px right on hover. */
```

**Tags** — mono, `1.5px` ink border on paper:
```css
.tag { font-family: var(--mono); font-size: 0.7rem; letter-spacing: 0.06em;
       padding: 0.25rem 0.65rem; border: 1.5px solid #141414;
       color: #141414; background: #F2ECDE; }
```

**Project card** — offset shadow flips ink→red and the card lifts on hover:
```css
.project-card { background: #F8F3E4; border: 2.5px solid #141414;
                box-shadow: 6px 6px 0 #141414; }
.project-card:hover { transform: translate(-3px, -3px); box-shadow: 9px 9px 0 #D42A1F; }
.project-cover { aspect-ratio: 3/2; border-bottom: 2.5px solid #141414; background: #F2ECDE; }
/* Meta line: mono, uppercase, 0.72rem; the year is red. */
```

**Eyebrow label** — mono with a short red rule before it:
```css
.eyebrow { font-family: var(--mono); font-size: 0.75rem; letter-spacing: 0.18em;
           text-transform: uppercase; display: inline-flex; align-items: center; gap: 0.75rem; }
.eyebrow::before { content: ''; width: 32px; height: 3px; background: #D42A1F; }
```

**Nav** — sticky, translucent paper with `backdrop-filter: blur`, `2px` ink
bottom border; links get a red underline that wipes in on hover.

---

## 6. Motifs & texture

- **Hard offset shadow** — solid color, no blur (`5–9px` offset, red or ink).
  Grows and the element lifts on hover. Structural, not illustrative.
- **2.5px ink borders** — nearly every block is outlined.
- **Striped rule** — a `14px` bar of `repeating-linear-gradient(90deg, #D42A1F 0 40px, #141414 40px 80px, #F2B01E 80px 120px, #141414 120px 160px)` at section tops.
- **Halftone dots** — `radial-gradient(circle 2px, <color> 2px, transparent 2.5px)` at `background-size: 20px 20px`; yellow dots on ink grounds.
- **Red underline** — a `~0.12em` red bar under a key word for emphasis.
- **Newsprint grain** — a faint fractal-noise texture multiplied over paper:

```css
body::before {
  content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 100;
  opacity: 0.18; mix-blend-mode: multiply;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.1 0 0 0 0 0.1 0 0 0 0 0.1 0 0 0 0.1 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
}
```

---

## 7. Voice

**Warm, plain, confident — like a friend who happens to be good at software.**
Short sentences beat long ones. Write from the reader's side of the screen.

- **"We," not "Second 9 Labs." "You," not "clients."**
- **Concrete over clever** — name the real outcome (hours saved, the spreadsheet
  retired, the afternoon back).
- **Honest about scope** — a concept is a concept; a pitch is a pitch. Don't dress it up.

**Allergic to:** *leverage, synergy, solutions, transform, unlock, journey,
partner (as a verb).*
**At home with:** *ship, build, listen, boring, afternoon, honest, useful.*

**Real taglines (the voice in practice):**
- "Takes the mental load off families — a shared brain for managing the chaos of life." *(Third Brain OS)*
- "Test case management built for one IT team — UAT, regression, and vendor case studies, all in one place." *(Bangers N Mash)*
- "Collect parking-lease payments digitally — the custom payment app the Pittsburgh Parking Authority didn't have." *(Park PPA)*
- "Takes the grocery-list translation off your plate — say what you want to eat, get a checkout-ready cart already filtered to your family's diet." *(MC Peels)*

---

## Appendix — reference artwork (SVG source)

These are real project covers. They demonstrate the geometric rule (§4): flat
fills, ink strokes, primary triad, the aperture motif, `600×400` (3:2).

**Third Brain OS — a knowledge graph with the aperture as the hub node:**

```svg
<svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Third Brain OS">
  <rect x="0" y="0" width="600" height="400" fill="#F2ECDE"/>
  <g stroke="#141414" stroke-width="3" stroke-linecap="round">
    <line x1="300" y1="200" x2="175" y2="135"/><line x1="300" y1="200" x2="435" y2="150"/>
    <line x1="300" y1="200" x2="165" y2="278"/><line x1="300" y1="200" x2="440" y2="275"/>
    <line x1="300" y1="200" x2="300" y2="76"/><line x1="300" y1="200" x2="300" y2="330"/>
    <line x1="175" y1="135" x2="300" y2="76"/><line x1="435" y1="150" x2="300" y2="76"/>
    <line x1="175" y1="135" x2="165" y2="278"/><line x1="435" y1="150" x2="440" y2="275"/>
    <line x1="165" y1="278" x2="300" y2="330"/><line x1="440" y1="275" x2="300" y2="330"/>
    <line x1="175" y1="135" x2="108" y2="205"/><line x1="440" y1="275" x2="498" y2="205"/>
  </g>
  <circle cx="175" cy="135" r="22" fill="#1F4E8C" stroke="#141414" stroke-width="2.5"/>
  <circle cx="435" cy="150" r="19" fill="#F2B01E" stroke="#141414" stroke-width="2.5"/>
  <circle cx="165" cy="278" r="17" fill="#141414"/>
  <circle cx="440" cy="275" r="23" fill="#1F4E8C" stroke="#141414" stroke-width="2.5"/>
  <circle cx="300" cy="76" r="15" fill="#F2B01E" stroke="#141414" stroke-width="2.5"/>
  <circle cx="300" cy="330" r="16" fill="#141414"/>
  <circle cx="108" cy="205" r="10" fill="#1F4E8C" stroke="#141414" stroke-width="2"/>
  <circle cx="498" cy="205" r="11" fill="#F2B01E" stroke="#141414" stroke-width="2"/>
  <circle cx="300" cy="200" r="34" fill="#D42A1F" stroke="#141414" stroke-width="3"/>  <!-- aperture hub -->
  <circle cx="300" cy="200" r="14" fill="#F2ECDE"/>
</svg>
```

**Park PPA — a parking "P" sign + a payment card (aperture as the EMV chip):**

```svg
<svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Park PPA">
  <rect x="0" y="0" width="600" height="400" fill="#F2ECDE"/>
  <rect x="104" y="80" width="232" height="232" rx="28" fill="#1F4E8C" stroke="#141414" stroke-width="4"/>
  <text x="220" y="266" font-family="Helvetica, Arial, sans-serif" font-size="210" font-weight="700" fill="#F2ECDE" text-anchor="middle">P</text>
  <g transform="rotate(-8 405 312)">
    <rect x="300" y="252" width="212" height="120" rx="16" fill="#F8F3E4" stroke="#141414" stroke-width="3.5"/>
    <rect x="300" y="272" width="212" height="22" fill="#141414"/>
    <circle cx="338" cy="332" r="16" fill="#D42A1F" stroke="#141414" stroke-width="2.5"/>  <!-- aperture chip -->
    <circle cx="338" cy="332" r="6" fill="#F2ECDE"/>
    <rect x="374" y="320" width="104" height="10" rx="5" fill="#6B6A62"/>
    <rect x="374" y="342" width="78" height="10" rx="5" fill="#6B6A62"/>
  </g>
</svg>
```

*Second 9 Labs LLC · Conditions for human flourishing.*
