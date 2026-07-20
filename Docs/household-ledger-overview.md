# The Household Ledger

*A Second 9 Labs product · live at [ledger.secondninelabs.com](https://ledger.secondninelabs.com)*

---

## Tagline (pick one)

- Your family's whole financial picture, in one calm view — a fitness score, debt payoff, and the money you're leaving on the table, encrypted entirely on your device.
- A private financial-fitness dashboard for families — no bank login, no account, no server. Just the numbers, scored.
- The advisor's checklist without the advisor — net worth, debt, college savings, and a ranked list of the tax moves you're missing.

## One-line description

The Household Ledger is a privacy-first financial dashboard for families: net worth, a 0–100 financial-fitness score, debt payoff strategy, real-estate equity, college-savings projections, and a ranked "money finder" of tax and savings opportunities — all computed from numbers the household types in themselves, encrypted in the browser, and never sent anywhere.

---

## What it's for

Most personal-finance apps ask for a bank login before they'll tell you anything — Plaid, account aggregation, a server somewhere holding a linked view of your whole financial life. The Household Ledger takes the opposite bet: a family types in what a good fee-only advisor would ask for (assets, debts, income, contribution levels), and gets back the advisor-grade analysis — a fitness score, a debt-payoff order, a ranked list of the specific tax and savings moves worth making this year — without ever handing account access to anyone. It's the moves an upper-middle-class household is often already eligible for and simply hasn't gotten around to: the 401(k) match left on the table, idle cash earning nothing, a 529 that was never opened.

## Who it's for

Families who want a real financial checkup — not a subscription that watches their spending, but a private planning session they can return to. Built first for one family member's own household, now set up as a standing Second 9 Labs product anyone can use.

## How it works

1. **Create a private vault.** One password, set once. It derives an encryption key on-device (PBKDF2-SHA256, 250k iterations) and nothing is ever transmitted — there's no account to sign up for and no email address collected.
2. **Fill in the numbers.** Assets and liabilities, debts and their rates, the mortgage, the kids' college goals, income and tax bracket, current retirement contributions — as much or as little as the household wants to enter.
3. **See where you stand.** A 0–100 fitness score against a tiered checklist (foundations → wealth-building → advanced moves), true net worth, debt payoff two ways (avalanche and snowball), and college-savings projections against a goal.
4. **Get the ranked opportunity list.** A rules engine checks roughly fifteen advisor-grade moves — idle cash sitting in a low-yield account, an unclaimed employer match, 401(k)/IRA/HSA room left unfilled, a backdoor Roth once income phases out, tax-loss harvesting, asset location, an umbrella policy once there's real net worth to protect — and ranks the ones that apply with an estimated dollar value per year.
5. **Watch the market, calmly.** An optional tab reads a small, self-hosted status feed (S&P 500 drawdown + VIX, pulled from FRED by a scheduled job) and surfaces a factual, non-panicky heads-up when the market is meaningfully off its highs — framed for long-term investors, never a buy/sell signal.

---

## Key features

- **Everything encrypted client-side, nothing stored anywhere else.** AES-GCM with a password-derived key (Web Crypto API, PBKDF2-SHA256, 250k iterations) — only ciphertext ever touches `localStorage`. No backend, no database, no account. Lose the password and the data is unrecoverable — by design, not by accident.
- **A 0–100 financial-fitness score** built on a three-tier checklist (Foundations, Building Wealth, Optimization) modeled on the order a real advisor would walk a family through, from a starter emergency fund up through backdoor Roths and tax-efficient asset location.
- **A tax & savings opportunity engine.** Roughly fifteen rules — HYSA idle-cash, employer match, 401(k)/IRA/HSA headroom, Dependent Care FSA, backdoor and mega-backdoor Roth, tax-loss harvesting, 529 openings, umbrella liability, high-interest debt — each with a plain-English explanation and an estimated dollar value, kept current against the year's actual IRS contribution limits.
- **Debt payoff, two ways.** Avalanche (highest rate first) and snowball (smallest balance first), computed from a household's own debt list, with blended rate and total annual interest cost shown alongside.
- **Net worth, real estate equity, and college-savings projections** — straightforward, but computed live as numbers change, with a compounding projection against each child's own goal and timeline.
- **A calm market heads-up**, not a trading tool — reads a static feed with no API key ever exposed to the browser, and is explicit that dips can deepen further and nobody reliably calls a bottom.
- **Zero-dependency architecture.** One self-contained HTML file for the app itself — no framework, no build step, no client SDKs calling out anywhere. Anyone can read exactly what it does by opening the file.

---

## Under the hood

- **App:** a single self-contained HTML/CSS/JS file — no framework, no build step, no bundler. Fraunces/Inter/IBM Plex Mono for the type system, matching the Second 9 Labs house style.
- **Encryption:** the browser's native Web Crypto API — AES-GCM 256 for the vault, PBKDF2-SHA256 (250k iterations) to derive the key from a password. The key and password exist only in memory; only ciphertext is persisted.
- **Hosting:** an assets-only Cloudflare Worker, same shape as the Second 9 Labs marketing site — `public/` ships exactly as written, no server-side code at all.
- **Market data:** a small Node job (`check-market.js`) pulls the S&P 500 and VIX from FRED on a daily GitHub Actions schedule, computes a drawdown tier, and publishes a static `status.json` the app reads same-origin — the FRED API key never reaches a browser.
- **No database. No accounts. No bank integration of any kind** — deliberately, matching the same declared-data-only posture as Third Brain OS.

## Status

Live in production at `ledger.secondninelabs.com`, with a marketing homepage at `/` and the tool itself at `/app`. Actively used; not yet wired into Third Brain OS as a connected "spoke" (see the hub-integration playbook) — that's a deliberate later phase, since it would mean introducing server-held, read-only financial data for the first time, gated behind OAuth, with no money-movement tool ever reachable from a chat model.

---

## Ready-to-paste `projects.json` entry

Matches the schema the other project tiles use. Cover/image asset still needs to be produced — swap the `TODO` path once art exists (the homepage's hero mock — vitals strip + fitness gauge + top opportunities — would translate well into a cover image).

```json
{
  "id": "household-ledger",
  "title": "The Household Ledger — private family financial fitness",
  "client": "Second 9 Labs",
  "year": "2026",
  "tagline": "Your family's whole financial picture, in one calm view — a fitness score, debt payoff, and the money you're leaving on the table, encrypted entirely on your device.",
  "tags": ["Family finance", "Privacy-first", "Financial planning"],
  "cover": "TODO: assets/images/household-ledger.svg",
  "images": ["TODO: assets/images/household-ledger.svg"],
  "description": "The Household Ledger is a privacy-first financial dashboard for families: net worth, a 0-100 financial-fitness score, debt payoff strategy, real-estate equity, college-savings projections, and a ranked money-finder of tax and savings opportunities — all computed from numbers the household types in themselves, encrypted in the browser with AES-GCM, and never sent anywhere.",
  "url": "https://ledger.secondninelabs.com",
  "featured": true
}
```
