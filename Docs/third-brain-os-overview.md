# Third Brain OS — brief for the Second 9 Labs home page

Source of truth as of **2026-07-18**, read directly from the live codebase
(`household-os/`, branch `third`, deployed at
**https://brainos.secondninelabs.com**). Use this to write the Projects-page
entry; don't invent features not listed here.

---

## One-liner

> A private, agentic operating system for running a household — the family's
> extra brain. You forward the email, dictate the errand, or just show up;
> a small cast of agents reads it, files it, and chases the follow-through.

## Purpose

Third Brain OS exists to take the *administrative load* of running a
household — or any small group of people coordinating life — off the humans
and onto software that acts like a competent chief of staff. It's the
opposite of a to-do app: instead of asking you to enter and triage your own
tasks, it's built to have things already handled by the time you look.

It started as one family's internal tool (Second Nine Labs) and is now
**multi-tenant** — any group can sign up and run their own fully isolated
instance of it.

## Who it's for

- Families and households coordinating kids, appointments, helpers
  (babysitters, tutors), and recurring logistics.
- Anyone who wants an "email it and forget it" intake for life admin.
- Small groups more broadly — a household is just "a group of people with
  shared logistics," and one person's email can belong to several separate
  households at once (e.g. an in-law helping run two families' calendars),
  each fully data-isolated from the others.

---

## Core functionality

**The agent cast** — five named agents, each with a distinct job, a
signature color, and a hand-drawn glyph, visible everywhere they act (feed,
drafts, chat):

| Agent | Does |
|---|---|
| **Scout** | Reads what comes in (forwarded email, dictated voice notes, photos) and turns it into filed deadlines/tasks, with confidence scoring — anything it's unsure about is flagged `needs confirmation` rather than silently filed. |
| **Herald** | Drafts outreach to helpers (babysitters, tutors) asking for coverage — approval-gated, one-tap "approve & send," delivered by magic-link email or SMS. |
| **Ranger** | Sweeps the open web on a schedule for things worth knowing — jobs, local events — tuned to a household's declared watchlist. |
| **Envoy** | Negotiates and schedules appointments over email on the household's behalf, threading replies back into the conversation. |
| **Chief of Staff** | The cross-subsystem reasoner — connects a new event to an existing coverage gap, a conflict, a recurring rhythm; drives the Chat tab and the conversational onboarding interview; can now read the household's own inbound mail when asked. |

**Feature surfaces built on top of the agent cast:**

- **Unified feed / task queue** — the home surface; everything the agents do
  lands here as one time-ordered log, signed by whichever agent did it.
- **Chat** — a tool-using conversational agent grounded in live household
  data. It *proposes*, it never writes directly — every applied change still
  lands in the feed like anything else, so nothing happens invisibly.
- **Threads** — project/thread-based grouping for anything with multiple
  moving parts (folds in what used to be a separate "Discoveries" tab).
- **People** — the household roster: adults, dependents, and helpers, each
  with their own color, and multi-household membership support.
- **Coverage ("who has the kids")** — declared care windows with automatic
  gap detection and one-tap "I've got it" claiming.
- **Rhythms** — a recurrence engine: define a cadence once (e.g. "trash night
  every Sunday"), it materializes into real deadlines/events on schedule.
- **Load balance** — operational-only tracking of how task volume is
  distributed across household members (deliberately *not* a wellbeing or
  fairness score — just a count).
- **Cost tracking without banking** — deadlines can carry a dollar amount for
  budgeting visibility; there is no bank-account or Plaid integration, by
  design (see Privacy).
- **Onboarding-as-conversation** — new households are set up by a short,
  warm interview with the Chief rather than a blank settings form; it
  extracts people, rhythms, coverage windows, and a household profile from
  natural language and shows a review-before-commit plan.
- **"On the desk"** — a persistent side-sheet surfacing what's actually
  waiting on you vs. waiting on others, so nothing needed from a human gets
  buried in the feed.
- **Pulse** — a weekly numbers view (household activity at a glance).
- **Data export** — a one-click full-household JSON export (secrets
  stripped) for portability; the household's data was never meant to be a
  lock-in.

---

## Connectivity — what it talks to, and what it deliberately doesn't

**Identity & sign-in**
- Independent, passwordless: emailed one-time magic links + signed 90-day
  session cookies. **No Google, no Microsoft, no third-party identity
  provider anywhere in the product.**
- Passkeys (WebAuthn) also supported as an additive sign-in method.
- "Sign out everywhere" revokes all live sessions for an email instantly.

**Calendar**
- **First-party**: events live in the app's own Postgres database — there is
  no calendar OAuth of any kind.
- **Inbound**: a household can subscribe to *read-only* external ICS feed
  URLs (school district calendars, Canvas, a Proton Calendar "share via
  link" URL) — refreshed daily.
- **Outbound**: each adult gets a personal ICS export URL they can subscribe
  to from iPhone Calendar or Proton — no account linking required either
  direction.

**Email**
- Outbound and inbound via **Resend**, with inbound webhook signatures
  verified (svix) and all inbound content treated as untrusted data — never
  as instructions — before it ever reaches the extraction model.
- Household intake addresses are randomly-slugged (`{random}@domain`), never
  guessable from the family's name.

**SMS**
- Optional, via **Twilio**: helpers can be texted instead of emailed, but
  only with a phone number *and* recorded consent on file — SMS is never
  the default fallback.

**Voice**
- Dictated voice notes are transcribed via **Cloudflare Workers AI
  (Whisper)** — chosen specifically so raw audio never has to leave a
  first-party-controlled edge to reach Google or OpenAI. Transcripts then
  flow through Scout's normal extraction pipeline.

**iOS Shortcut capture**
- A bearer-token endpoint (`/api/capture`) lets an iOS Shortcut dictate
  straight into the queue from the lock screen — no app install required.

**Cross-app connectivity (the "hub" pattern)**
- Third Brain is becoming the connective layer for a family's *other* apps.
  The first case is **MC Peels** (a separate grocery-planning app): a member
  taps "Connect," authenticates on MC Peels' own site (one-click OAuth +
  PKCE), and Third Brain holds only an encrypted, refreshable access token —
  it never touches MC Peels' credentials. The Chief then calls MC Peels'
  own tools through the Anthropic MCP connector. This is the intended shape
  for connecting future sibling apps: **per-user OAuth grant, zero shared
  domain logic, no credentials in Third Brain's database.**

**What it explicitly will never do:** read anyone's Gmail/Outlook inbox,
sync a Google/Microsoft calendar, or move money. Financial tracking is
declared-only cost visibility, never an account/banking integration.

---

## Architecture & stack

- **Next.js 16** (App Router) on **Vercel**, Cloudflare DNS in front
  (`brainos.secondninelabs.com`).
- **Neon Postgres + Drizzle ORM** — every table is tenant-scoped by
  `household_id`; every query in the app (pages, actions, the chat agent's
  data snapshot, crons, the export endpoint) filters through the signed-in
  person's *active* household. There is no cross-household read/write path.
- **Anthropic API (Claude)** powers every agent — extraction (Scout),
  drafting (Herald/Envoy), discovery reasoning (Ranger), and the
  orchestration/chat layer (Chief). All model calls are server-side only.
- **Resend** for email, **Twilio** for SMS, **Cloudflare Workers AI** for
  voice transcription.
- Recurring jobs (rhythm materialization, ICS refresh, digest sends, raw
  inbound pruning) run on **Vercel Cron**.
- Ships as a **PWA**.

## Privacy & security posture

- No third party ever holds household data; no household can see another's
  (enforced at the query layer, re-checked on every server read — not just
  at sign-in).
- Sensitive fields are encrypted at rest (AES-256-GCM).
- All tokens (login, ask, device, MC Peels grants) are ≥256-bit random and
  stored hashed/encrypted, never in plaintext.
- HSTS, strict security headers, rate limiting on every public endpoint, no
  analytics or trackers, no client-exposed secrets.

## Design

House style is **"The Ledger"** — a warm-paper, ink-and-terracotta aesthetic
(Fraunces + Inter/DM Sans, hairline rules, small-caps labels, status dots
instead of colored chips, hand-drawn stroke icons, no emoji anywhere). The
brand thesis is deliberately **"calm intelligence"**: most productivity
software is an anxiety machine (streaks, red badges, urgency); Third Brain
is built to feel like a calm presence that already has it handled.

## Status

**Live in production**, actively developed, multi-tenant, currently used by
the founder's own household plus early invited households. Not yet publicly
self-serve-marketed — signup is invite/allowlist-gated while the product
matures.

---

### Suggested one-paragraph blurb for the S9L Projects page

> **Third Brain OS** — a private operating system for running a household.
> Forward it an email, dictate an errand, or just show up: a small cast of
> named agents (Scout, Herald, Ranger, Envoy, and a Chief of Staff that ties
> it all together) reads what comes in, files it, chases the follow-through,
> and asks for a human's OK before anything goes out the door. No Google, no
> third-party identity, no bank integration — everyone's data is
> independently owned and isolated. Multi-tenant: any household can run
> their own private instance.
