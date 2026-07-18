# MC Peels

*A Second 9 Labs product · live at [mc-peels.secondninelabs.com](https://mc-peels.secondninelabs.com)*

---

## Tagline (pick one)

- Takes the grocery-list translation off your plate — say what you want to eat, get a checkout-ready cart already filtered to your family's diet.
- The grocery concierge that already knows your family's diet — say what you want, MC Peels builds the cart.
- Turns "organic bananas and grass-fed beef" into a ready-to-checkout Instacart cart, filtered to your household's rules before you ever see it.

## One-line description

MC Peels is a household grocery concierge: say what you want in plain language and it builds a ready-to-checkout cart at your preferred store, automatically filtered to your family's standing dietary rules. It's also a small food app of its own invention — save a recipe from TikTok or Pinterest, and once you've saved enough of one cuisine, MC Peels quietly mints an AI-designed restaurant around it: a name, a voice, a palette, a hero image, unique to your household.

---

## What it's for

Every grocery app makes you do the same translation work, over and over: you know you want organic produce, or need to dodge a peanut allergy, but you re-apply that filter item by item, order after order. MC Peels moves that translation into software, once. A household sets its dietary profile — organic-preferring, specific allergies, brands it trusts — and that profile applies itself automatically to every request from then on, for every member of the household.

## How it works

1. **Say it.** A household member describes what they want in plain language — *"go buy organic bananas, blueberries, and grass-fed beef"* — no filter menus, no hunting through listings.
2. **MC Peels translates it.** The request is parsed into line items, and the household's standing dietary profile is applied automatically: eligible items get upgraded to organic, allergens get excluded, trusted brands get preferred.
3. **A cart gets built.** MC Peels resolves the household's preferred retailer and hands back a ready-to-checkout link.
4. **A human checks out.** MC Peels never sees a payment method or a retailer password. Checkout always finishes on the retailer's own site, completed by a person — on purpose, not as a limitation.

---

## Key features

- **Plain-language cart building.** No search, no filter checkboxes — describe what you want and MC Peels resolves it.
- **A standing household dietary profile**, set once and applied to every order automatically. The product is explicit that filters are strong preferences, not safety certifications — for households managing real allergies, the human review at checkout stays the final gate, and MC Peels never claims otherwise.
- **Two fulfillment rails.** Instacart (a checkout link) and Kroger (an OAuth-linked account cart, filled with real shelf prices), built on a pluggable provider interface designed so more retailers can be added without touching the core product.
- **Human-in-the-loop checkout, always.** MC Peels can assemble a cart, but a human completes every purchase, on the retailer's own site, with their own account. No stored payment methods, no stored retailer credentials — that's a hard architectural constraint, not a feature toggle.
- **A second front door for AI agents.** MC Peels exposes an MCP server, so an assistant like Third Brain's Chief of Staff can build and hand back a grocery cart on a household's behalf — same dietary rules applied, same human-approves-checkout guarantee.
- **The Shelf.** Send MC Peels a link — a TikTok, an Instagram reel, a Pinterest pin, a YouTube video — and it extracts a full recipe: ingredients, native-language dish name, spice level, everything needed to cart it later.
- **Kitchens that mint themselves.** Save four dishes of one cuisine to the Shelf and MC Peels opens a themed "kitchen" around it, automatically. A few flagship cuisines get a hand-designed identity — 山城 (Mountain City) for Sichuan-Chongqing, Столовая for post-Soviet comfort food, La Milpa for Mexican — and every other cuisine gets its own AI-generated restaurant: a name, a voice, a color palette, and hero art, written fresh for that household. Two families who both cook a lot of Thai food end up with two different Thai kitchens.

---

## Under the hood

- **Client:** Expo / React Native — one codebase for iOS, Android, and web.
- **Backend:** TypeScript on Vercel, Supabase for Postgres + auth, Drizzle ORM.
- **Intelligence:** the Anthropic API — parsing plain-language requests into structured line items, extracting recipes from social links, and generating each household's kitchen identities.
- **Fulfillment:** the Instacart Developer Platform API and the Kroger Partner API, behind a shared provider interface built to add more retailers later.
- **Multi-tenant from day one.** Households, members, and dietary profiles are first-class objects — not a personal script for one family.

## Status

Live and in active development. Currently a Second 9 Labs product (not client work).

---

## Ready-to-paste `projects.json` entry

Matches the schema the other project tiles use. Cover/image assets still need to be produced — swap the `TODO` paths once art exists (a screenshot of the Ask screen or the Eats poster wall would both work well).

```json
{
  "id": "mc-peels",
  "title": "MC Peels — the grocery concierge",
  "client": "Second 9 Labs",
  "year": "2026",
  "tagline": "Takes the grocery-list translation off your plate — say what you want to eat, get a checkout-ready cart already filtered to your family's diet.",
  "tags": ["Groceries", "Household tools", "Agentic commerce"],
  "cover": "TODO: assets/images/mc-peels.svg",
  "images": ["TODO: assets/images/mc-peels.svg"],
  "description": "MC Peels is a household grocery concierge: say what you want in plain language and it builds a ready-to-checkout Instacart or Kroger cart, automatically filtered to your family's standing dietary rules. Save a recipe from TikTok or Pinterest, and once a household has saved enough of one cuisine, MC Peels mints a themed AI-designed kitchen around it — a name, a voice, a palette, all its own.",
  "url": "https://mc-peels.secondninelabs.com",
  "featured": true
}
```
