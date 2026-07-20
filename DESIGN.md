# Second 9 Labs — Design Guide (v3, "The Linocut Cut")

> **For an AI reading this:** this is the complete, self-contained brand system
> for Second 9 Labs, locked 2026-07-18. Everything needed to produce on-brand
> work — colors, type, the mark, the seal, craft rules, components, and voice —
> is in this one file, including copy-pasteable CSS and SVG source. When it
> conflicts with a generic default, this document wins. Apply it faithfully;
> don't invent new colors, faces, or motifs. This version supersedes the v2
> (Fraunces / paper-led / aperture-mark) system.

**Essence:** *"Conditions for human flourishing."*
The brand sits in the lineage of **WPA posters, early-Bauhaus signage, and
historic labor movements** — traditions rooted in the dignity of work and tools
that serve people. We actively reject frictionless, hyper-polished, corporate
SaaS minimalism. The craft language is **linocut**: bold shapes carved by hand,
printed in primary colors, rough edges and gouge marks left in. The name is a
promise: **a second pass, done better.**

---

## 1. The mark — the Second Sun

A **9 built as a rising sun**: a disc with **exactly nine carved rays** and a
tail swinging down like a flag pole. Constructed forms, carved execution.

**SVG source (geometry; recolor per ground, below):**

```svg
<!-- The sun. Center (96,86); nine rays at 40° intervals; tail rotated 14°. -->
<g id="sun">
  <g fill="RAY_COLOR">
    <!-- repeat this polygon rotated 0,40,80,...,320 degrees about (96,86): -->
    <g transform="rotate(0 96 86)"><polygon points="96,30 89,50 103,50"/></g>
  </g>
  <circle cx="96" cy="86" r="30" fill="DISC_COLOR"/>
  <circle cx="96" cy="86" r="12" fill="GROUND_COLOR"/>  <!-- the aperture: always the ground -->
  <rect x="112" y="104" width="17" height="48" fill="RAY_COLOR" transform="rotate(14 112 104)"/>
</g>
```

**Colorways (linocut logic — the hole is always the ground):**

| Ground | Rays + tail | Disc | Hole |
|---|---|---|---|
| Blue `#1F4E8C` | Paper | Yellow | Blue |
| Paper `#F2ECDE` | Ink | Red | Paper |
| Ink `#141414` | Paper | Yellow | Ink |
| Yellow `#F2B01E` | Red or ink | Red | Yellow |

**Rules:**
- Nine rays. Always nine. It's the hidden signature.
- Carved execution: apply the rough filter (§5) at display sizes; **drop the
  filter below ~48px** (favicons) so the mark stays crisp.
- Don't stretch, rotate the whole mark, or add rays.
- The favicon is the sun alone on a blue `rx=24` rounded square (`public/assets/favicon.svg`).

---

## 2. The seal — the lockup

Mark + name + promise fused into **one carved roundel**. This is the primary
lockup; the mark and wordmark never float separately.

**Layout (split-arc, for legibility):**
- Outer rough ring, stroke 5 on `r=88` (viewBox `0 0 200 200`).
- **Top arc:** `SECOND 9 LABS` — Space Mono 700, ~19px, letter-spacing 3.6,
  on `M 30,100 A 70,70 0 0 1 170,100`, centered.
- **Bottom arc (upright):** `HUMAN FLOURISHING` — Space Mono 700, ~13px,
  letter-spacing 2.2, on `M 30,100 A 70,70 0 0 0 170,100`, centered.
- Accent points `r=3` at nine and three o'clock (`24,100` / `176,100`).
- Inner rough ring, stroke 2.5 on `r=52`; the sun centered inside at scale 0.67
  (`translate(35, 42) scale(0.67)`).

**Ring/accent colors per ground:** on blue — paper rings/text, yellow inner ring
and points; on paper — ink rings/text, red inner ring and points; on ink —
paper rings/text, yellow inner ring and points.

**Rules:**
- The full phrase "Conditions for human flourishing" is a *sentence* — it lives
  in the footer line, not the ring. The ring keeps the two short arcs.
- Below ~56px the seal drops text entirely: use the sun alone.
- Use the seal for: nav, footer, invoices/proposals, email signature, merch.
- Canonical markup lives in `public/index.html` (nav, manifesto, footer — the
  three ground colorways).

---

## 3. Color — primaries lead

| Role | Name | Hex | Use |
|---|---|---|---|
| Room | **Blue** | `#1F4E8C` | The lead ground: nav, hero, process. Body text sits on it directly. |
| Room shadow | **Blue Deep** | `#173B6B` | Letterpress text-shadow and pressed states on blue. |
| Second room | **Red** | `#D42A1F` | Section grounds and display accents. Never body copy (see below). |
| Room shadow | **Red Deep** | `#A8200F` | Letterpress shadow / pressed states on red and yellow. |
| Action | **Yellow** | `#F2B01E` | Buttons, hovers, toggles, accent points. If it's yellow, you can press it. |
| Carve | **Paper** | `#F2ECDE` | The negative space of the print: type on primaries, breathing sections. |
| | Paper Deep `#E8DFC8` / Paper Card `#F8F3E4` | | Alternating bands / cards. |
| Impression | **Ink** | `#141414` | Borders, chrome, footer, text on light grounds. |
| | Ink Soft `#3A3A36` / Ink Mute `#6B6A62` | | Secondary copy / meta. |

**The volume rule (v3):** blue is the room, red is the second room, yellow is
the action, paper is the carve, ink is the impression. Red and blue never share
a surface — one primary per room.

**Accessibility (hard constraints, measured):**
- Paper on blue = **7.1:1** — body copy allowed directly on blue.
- Ink on yellow = **9.7:1** — any text size on yellow.
- Paper on red = **4.3:1** — **red never carries body copy.** Display type and
  labels at large sizes only; reading text on red sections sits on paper cards
  (ink on paper card ≈ 13:1).
- Focus rings: red on light grounds, yellow on blue/red/ink grounds.

```css
:root {
  --paper: #F2ECDE; --paper-deep: #E8DFC8; --paper-card: #F8F3E4;
  --ink: #141414; --ink-soft: #3A3A36; --ink-mute: #6B6A62;
  --red: #D42A1F; --red-deep: #A8200F;
  --yellow: #F2B01E;
  --blue: #1F4E8C; --blue-deep: #173B6B;
}
/* ::selection { background: #F2B01E; color: #141414; } */
```

---

## 4. Typography

Three free typefaces (Google Fonts), each with one job:

- **Big Shoulders** — display. 800, uppercase, `font-variation-settings:
  'opsz' 72`, letter-spacing `0.015em`, line-height `~0.98`. Chicago industrial
  signage lineage — named for Sandburg's poem about working people. On primary
  grounds it takes a hard letterpress shadow (`4px 4px 0` in the room's deep
  color).
- **Archivo** — body and UI. 400 default, 600–700 for buttons, 800 for card
  titles and FAQ questions.
- **Space Mono** — labels, eyebrows, meta, the seal arcs. 700, uppercase,
  letter-spacing `0.13–0.17em`.

```css
--display: 'Big Shoulders', 'Big Shoulders Display', Impact, sans-serif;
--body-face: 'Archivo', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--mono: 'Space Mono', ui-monospace, monospace;
```

```html
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders:opsz,wght@10..72,300..900&family=Archivo:wght@400..800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
```

**Type scale:**

| Role | Face / size | Notes |
|---|---|---|
| H1 | Big Shoulders 800, `clamp(2.9rem, 7vw, 5.4rem)` | caps, letterpress shadow on rooms |
| H2 | Big Shoulders 800, `clamp(2rem, 4.6vw, 3.4rem)` | caps |
| H3/H4 (cards) | Archivo 800, `~1.1rem` | sentence case |
| Project-card titles | Big Shoulders 700, `1.55rem` | caps |
| Lede | Archivo 400, `clamp(1.1rem, 1.4vw, 1.3rem)` | |
| Body | Archivo 400, `17px` / 1.55 | ~62ch max |
| Eyebrow / label | Space Mono 700, `0.74rem`, caps, `0.16em` | short red (or yellow) rule before it |

**Emphasis rule: no italic flag-words.** Emphasis comes from the sentence, or
from scale, weight, and color blocks — never from italicizing a word or two.
(Flagged as an AI-design tell; treat as a hard rule in copy and display type.)

---

## 5. Craft — the linocut rule

Every illustration reads as **carved and printed**, not drawn:

- **Primitives only** — circles, rectangles, triangles — but with **rough,
  displaced edges**. The standard filters (define once per page):

```svg
<filter id="rough1" x="-8%" y="-8%" width="116%" height="116%">
  <feTurbulence type="fractalNoise" baseFrequency="0.038" numOctaves="3" seed="7" result="n"/>
  <feDisplacementMap in="SourceGraphic" in2="n" scale="6"/>
</filter>
<filter id="rough2" x="-8%" y="-8%" width="116%" height="116%">
  <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" seed="23" result="n"/>
  <feDisplacementMap in="SourceGraphic" in2="n" scale="5"/>
</filter>
```

- **Gouge marks** — a few thin, tapered paper-colored slivers cut through
  fills; proof a hand held the tool. Two or three per block, not confetti.
- **Icon chips** — services and features get a 58–60px square block (blue or
  yellow, alternating, rough-filtered) with a two-color carved figure.
- **Flat fills only.** No gradients, no blurs.

### Misregistration — the technique that sells it

Rough edges alone still read as "digital pretending to be print." What makes it
land is that a block print is pressed in **separate plates that never line up
perfectly.** Build every illustration in two passes:

1. **Color plate** — flat fill, *no stroke*, offset **+5–6px down-right**.
2. **Ink plate** — outlines and solid ink at **true position**, wrapped in a
   rough filter.

```svg
<!-- COLOR PLATE: pressed first, slipped -->
<g transform="translate(6, 6)">
  <circle cx="175" cy="135" r="22" fill="#1F4E8C"/>
</g>
<!-- INK PLATE: carved, true position -->
<g filter="url(#rough2)">
  <circle cx="175" cy="135" r="22" fill="none" stroke="#141414" stroke-width="3"/>
</g>
```

**Rules that keep it from turning to mush:**

- **One direction per piece.** Every plate slips the same way — one press, one
  slip. Mixed offset directions read as broken, not printed.
- **5–6px at `600×400`.** Beyond ~10px it stops reading as a misprint and
  starts reading as a mistake.
- **Light tone surfaces stay on the key plate.** Big paper-ish shapes (a card,
  a sheet stack, a bag) keep their fill *registered* with their outline. Slip
  only the chromatic accents — blue, red, yellow. If everything slips, the
  illustration dissolves.
- **Watch the paint order.** An opaque surface drawn in the ink plate will
  cover the color plate beneath it. When color accents sit *on* a surface, draw
  them in their own group **after** that surface, then their outlines after
  that: key plate → color plate → ink plate.
- **Under solid-ink shapes**, offset in Ink Mute `#6B6A62` — a grey plate under
  a black one, not a drop shadow.
- **Misregistration scales with display size.** Only apply it at **≥240px**.
  The seal at 64px, the favicon, and the 58px icon chips stay perfectly
  registered — at small sizes the slip just reads as blur. That is why
  `#sun-on-blue-lg` (misregistered, hero only) is a separate def from
  `#sun-on-blue` (registered, nav and seal).

**Two valid idioms**, and mixing them across the set is fine:
- **Key-block** — color plates under carved ink outlines (the four covers:
  Bangers N Mash, Third Brain OS, Park PPA, MC Peels).
- **Reduction** — flat rough-filtered shapes with no outlines at all, one
  off-register pass for grit (`household-ledger.svg`).

- **Covers** stay `600×400` (3:2), hand-authored SVG, all cut in the linocut
  language. A missing cover degrades to a clean paper block, never a broken
  image.

---

## 6. Components

Hard edges, hard shadows, **no rounded corners on UI**. Printed and physical:
2.5px ink borders, solid un-blurred offset shadows.

**Buttons** — yellow is the action color:
```css
.btn { border: 2.5px solid #141414; padding: 0.95rem 1.5rem; font: 700 1rem 'Archivo'; }
.btn-primary { background: #F2B01E; color: #141414; box-shadow: 5px 5px 0 #141414; }
.btn-primary:hover { transform: translate(-2px, -2px); box-shadow: 7px 7px 0 #141414; }
/* On yellow grounds the primary flips: ink bg, paper text, red-deep shadow. */
.btn-ghost { border-color: currentColor; }  /* paper outline on rooms, ink on paper */
```

**Nav** — solid blue, sticky, 2.5px ink bottom border; the seal (64px) as the
logo; links in Space Mono 700 caps with a yellow underline wipe; CTA is a
yellow chip with a hard ink shadow.

**Cards** (services, projects) — paper-card, 2.5px ink border, `5–6px` ink
shadow; hover lifts and the shadow flips to red on project cards.

**FAQ** — bordered paper cards; the toggle is a **yellow square** with an ink
plus that loses its vertical bar when open.

**Process steps** — carved yellow numeral blocks (Big Shoulders 800 ink
numerals on rough yellow squares) on the blue room.

**Page rhythm (the homepage as reference):** blue nav+hero → paper philosophy
→ red services (copy on cards) → deep-paper projects → blue process → paper
manifesto (the seal moment) → deep-paper FAQ → **yellow contact** → ink footer.

---

## 7. Motifs & texture

- **Print grain** — fractal-noise multiply overlay, fixed, `opacity: 0.14`
  (see `styles.css body::before`). The press was real.
- **Letterpress shadow** — display type on rooms carries `text-shadow:
  3-4px 3-4px 0` in the room's deep color (blue-deep / red-deep).
- **Hard offset shadow** — 4–9px solid, ink (or red-deep on yellow); grows on hover.
- **2.5px ink borders** — nearly every block is outlined; rooms are separated
  by full-width 2.5px ink rules.
- **The nine rays** — the sun's rays recur as a counting motif (nine of
  anything is on-brand).

---

## 8. Voice

**Warm, plain, confident — like a friend who happens to be good at software.**
Short sentences beat long ones. Write from the reader's side of the screen.

- **"We," not "Second 9 Labs." "You," not "clients."**
- **Concrete over clever** — name the real outcome (hours back, the spreadsheet
  retired, the afternoon returned).
- **Declarative headlines, no italic emphasis** (see §4). The locked voice is
  the manifesto register: *Tools should serve the people who use them.*
- **Honest about scope** — a concept is a concept; a pitch is a pitch.

**Allergic to:** leverage, synergy, solutions, transform, unlock, journey,
partner (as a verb).
**At home with:** ship, build, listen, boring, afternoon, honest, useful.

**Locked copy (Copy B, in production):**
- Hero: "Tools should serve the people who use them."
- Philosophy: "Work should leave people with more energy, not less."
- Manifesto: "The small, annoying problems that quietly eat people's days are
  worth solving. That is the work."
- Contact: "Tell us what's eating your afternoons."
- Footer line: "Second 9 Labs LLC · Conditions for human flourishing"

**Real taglines (the voice in practice):**
- "Takes the mental load off families — a shared brain for managing the chaos of life." *(Third Brain OS)*
- "Test case management built for one IT team — UAT, regression, and vendor case studies, all in one place." *(Bangers N Mash)*
- "Collect parking-lease payments digitally — the custom payment app the Pittsburgh Parking Authority didn't have." *(Park PPA)*
- "Takes the grocery-list translation off your plate — say what you want to eat, get a checkout-ready cart already filtered to your family's diet." *(MC Peels)*

---

## Appendix — reference artwork (SVG source)

Real project covers, `600×400` (3:2). These predate the linocut cut and remain
valid — recutting them with rough edges and gouges is the sanctioned follow-up.

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
  <circle cx="300" cy="200" r="34" fill="#D42A1F" stroke="#141414" stroke-width="3"/>
  <circle cx="300" cy="200" r="14" fill="#F2ECDE"/>
</svg>
```

**Park PPA — a parking "P" sign + a payment card:**

```svg
<svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Park PPA">
  <rect x="0" y="0" width="600" height="400" fill="#F2ECDE"/>
  <rect x="104" y="80" width="232" height="232" rx="28" fill="#1F4E8C" stroke="#141414" stroke-width="4"/>
  <text x="220" y="266" font-family="Helvetica, Arial, sans-serif" font-size="210" font-weight="700" fill="#F2ECDE" text-anchor="middle">P</text>
  <g transform="rotate(-8 405 312)">
    <rect x="300" y="252" width="212" height="120" rx="16" fill="#F8F3E4" stroke="#141414" stroke-width="3.5"/>
    <rect x="300" y="272" width="212" height="22" fill="#141414"/>
    <circle cx="338" cy="332" r="16" fill="#D42A1F" stroke="#141414" stroke-width="2.5"/>
    <circle cx="338" cy="332" r="6" fill="#F2ECDE"/>
    <rect x="374" y="320" width="104" height="10" rx="5" fill="#6B6A62"/>
    <rect x="374" y="342" width="78" height="10" rx="5" fill="#6B6A62"/>
  </g>
</svg>
```

*Second 9 Labs LLC · Conditions for human flourishing.*
