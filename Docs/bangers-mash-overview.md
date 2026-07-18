# Bangers & Mash — brief for the Second 9 Labs "Projects" page

This is source material for whoever is writing copy for the Second 9 Labs home
page, not finished copy itself. It's a grounded, code-verified summary of what
Bangers & Mash actually does and how it's built, as of 2026-07-18. Where the
product oversells something that isn't real yet (see "What's not live" below),
that's called out explicitly — please don't let marketing copy claim it.

Internal codename in the repo is "TestForge"; the public product name is
**Bangers & Mash**. On the Second 9 Labs site itself the "by Second 9 Labs"
suffix used elsewhere is redundant — just "Bangers & Mash" reads fine here.

## Try it

- **Live site:** https://bangersnmash.secondninelabs.com
- **Direct demo link** (skips the landing page, drops straight into a
  populated live demo, no signup): https://bangersnmash.secondninelabs.com/?demo=1

The demo runs entirely in the visitor's browser against sample data (a
fictional company, "Northwind") — no account, no backend calls, nothing saved.
Good candidate for a screenshot or embed on the projects page; take a fresh
one from the live URL rather than reusing anything from this repo.

## What it is

Bangers & Mash is a Jira-native test case management app: it replaces
spreadsheet-based QA tracking with one workspace where a team organizes test
cases, runs them against a release, and files defects straight to Jira with
full traceability from test case → execution → defect → Jira issue.

**Problem it solves:** teams doing manual/regression QA alongside Jira
development typically track test cases in scattered spreadsheets that don't
connect to the actual defects filed against a release. Bangers & Mash gives
that process a single system of record with role-appropriate workflows for
authors, testers, and approvers, and a live link into Jira instead of a
copy-paste handoff.

**Who it's for:** teams running structured manual/regression QA cycles
(release testing, UAT sign-off) who already live in Jira and want defect
creation and traceability wired directly into their test process, not living
in a separate spreadsheet.

## Status

In active pilot use with an early customer (details confidential — do not
name the client, industry, or their internal systems in public copy; describe
the pilot only in generic terms like "in active use by an early customer").
Core workflows (authoring, execution, QC/approval, Jira defect creation,
reporting) are real and running in production, not a mockup. AI-assisted
features are modeled in the data layer but not yet wired up — see below.

## Core features

- **Repository** — Organize test cases into a folder tree; each case has an
  objective, preconditions, ordered steps (action / test data / expected
  result), priority, and status. Bulk CSV/Excel import with column mapping
  and a downloadable template. Duplicate, bulk-edit, and bulk-delete cases.
- **Pipeline (test runs & cycles)** — A Kanban board moves test runs through
  In progress → QC review → Ready for approval → Approved. Testers step
  through a run case-by-case, marking each step Pass/Fail/Blocked/Skipped,
  attaching screenshots (some steps can require one before they can be
  marked), and logging a defect inline on a failure. Multiple testers' runs
  on the same release can be bundled into one cycle with a rolled-up pass
  rate and a single sign-off.
- **Jira integration (live)** — Defects logged during a run can be filed
  directly as a real Jira issue (configurable issue type, e.g. "Problem"),
  or linked to an existing one. Test cases can search and link existing Jira
  stories live while authoring. This is a real, working integration against
  Jira's REST API — not a placeholder.
- **Dashboard** — Pass-rate and coverage KPIs, an execution-status breakdown,
  and results broken down by vendor/system, environment, and tester. Filter
  by project, application area, run, test type, or tester. Export a full
  results workbook (summary + detail) as an Excel file.
- **Role-based access** — Five roles (from read-only observer up through a
  full admin) gate what a person can see and do, enforced on the server, not
  just hidden in the UI: an operator/tester can execute and log defects; an
  author can build the test repository; a manager controls QC, defect
  filing, and sign-off; an admin manages users and roles.

## What's not live yet (please don't oversell these)

- **Microsoft Teams notifications** — not implemented. Only two environment
  variable names exist as placeholders; there's no notification code, no
  triggering event, nothing wired. Don't describe Teams as an integration
  the product has today.
- **AI-assisted features** (e.g. duplicate test-case detection, test-step
  clarity suggestions) — not implemented. The database has columns and a
  table shaped to hold this kind of analysis, and the Anthropic Claude SDK is
  an installed dependency, but nothing in the app actually calls it yet. If
  you want to mention AI at all, frame it as "on the roadmap" or
  "architected for," never as a feature that works today.

## How it's built

- **Frontend:** Vite + React 18, TanStack Query for data fetching, Recharts
  for the dashboard, client-side Excel/CSV handling (xlsx, PapaParse), a
  hand-rolled lightweight router (no React Router dependency).
- **Backend:** Node.js + Express, Prisma ORM, Zod for validation, JWT-based
  sessions (admin-provisioned accounts, no public self-serve signup).
- **Database:** Neon (serverless Postgres).
- **Hosting:** Vercel (static frontend + serverless API function), deployed
  straight from `git push` to the main branch — no separate deploy step.
- **External integration:** Jira Cloud REST API (v3) for defect creation,
  issue search, and story linking.

This stack (Vite/React, Node/Express/Prisma, Neon, Vercel) is reasonable to
mention as a "built with" tag list if the projects page does that kind of
thing for other entries.

## Optional starting language

Not final copy — just a rough pitch to riff on if useful:

> **Bangers & Mash** — a Jira-native test case management workspace. Organize
> test cases, run them against a real release, and file defects straight to
> Jira with full traceability from test case to execution to issue. Built to
> replace the spreadsheet a QA team outgrows.
