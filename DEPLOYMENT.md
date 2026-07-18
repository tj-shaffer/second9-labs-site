# Deploying the Second 9 Labs site

The site is a **static site on Cloudflare** — no servers, no database, no
monthly bill beyond a domain. This guide covers getting it live and keeping it
updated.

## The 30-second version

- It's already wired up. To publish changes: **`npm run deploy`**.
- To add a project: edit `public/projects.json`, drop a cover in
  `public/assets/images/`, then `npm run deploy`.
- Everything is in Git, so you can always roll back.

---

## What you need (one time)

1. **Node + npm** — install the LTS from [nodejs.org](https://nodejs.org).
2. **A Cloudflare account** — free, no card required, at [dash.cloudflare.com](https://dash.cloudflare.com).
3. **Install dependencies** — from the project folder, run `npm install` once.
4. **Sign Wrangler into Cloudflare** — run `npx wrangler login` once. It opens a
   browser to authorize your account. That's the only auth step.

(*Wrangler* is Cloudflare's command-line tool; it ships as a dev dependency, so
`npm install` sets it up for you.)

---

## Publish

From the project folder:

```sh
npm run deploy
```

That uploads everything in `public/` to Cloudflare and prints your live URL:
**https://second-9-labs.tj-shaffer.workers.dev**

Deploys take a few seconds. There's **no build step** — what's in `public/` is
exactly what ships. (Publishing is this manual command today, not automatic on
every Git push.)

To preview locally before publishing:

```sh
npm run dev      # serves at http://localhost:8787
```

---

## How to update the site

### Add or change a project

Your "admin panel" is one file: **`public/projects.json`**.

1. **(Optional) Art.** Add a cover to `public/assets/images/` — a hand-drawn
   brand SVG (see `DESIGN.md`) or a real screenshot (~1200×800, 3:2). A project
   with no cover degrades to a clean paper block, never a broken-image icon.
2. **Edit `public/projects.json`.** Copy an existing block and fill in `id`,
   `title`, `client`, `year`, `tagline`, `tags`, `cover`, `images`. Then either:
   - give it a **`url`** (e.g. a subdomain) so the card links straight out — an
     external `http(s)` url opens in a new tab; **or**
   - give it `description` + `outcome` + `stack` + `links` so the card opens a
     detail page instead.
   - Add `"featured": true` to surface it on the home page. The home strip shows
     the **first three** featured projects; the full gallery shows them all.
3. **Validate the JSON.** A syntax error makes the gallery show "Couldn't load
   projects." Check it with [jsonlint.com](https://jsonlint.com) or:
   ```sh
   node -e "JSON.parse(require('fs').readFileSync('public/projects.json','utf8')); console.log('ok')"
   ```
4. **Publish:** `npm run deploy`.

### Fix a typo anywhere

Edit the file in `public/`, run `npm run deploy`. Done.

---

## Custom domain

A `.workers.dev` URL works, but a real domain is nicer.

1. **Buy it** at Cloudflare → **Domain Registration** (sold at cost, ~$10/yr).
2. In the dashboard → **Workers & Pages** → the **second-9-labs** Worker →
   **Settings → Domains & Routes → Add → Custom domain**. Enter your domain; DNS
   and HTTPS configure themselves within a couple of minutes.

## Business email (optional)

Get `hello@yourdomain.com` forwarding to your inbox, free:
Cloudflare dashboard → your domain → **Email → Email Routing** → enable, then
route `hello@yourdomain.com` → your personal inbox. (Prefer a real mailbox?
Fastmail ~$5/mo or Google Workspace ~$7/mo.)

---

## If something breaks

- **Gallery says "Couldn't load projects":** almost always a JSON syntax error
  in `projects.json`. Validate it (above), fix, redeploy.
- **Roll back:** Cloudflare dashboard → the **second-9-labs** Worker →
  **Deployments** → pick a known-good version → **Rollback**. Or revert the
  commit in Git and `npm run deploy`.
- **Nuclear option:** everything is in GitHub, which keeps every version forever.
  You can't permanently lose anything.

## Cost, year one

| Item | Cost |
|---|---|
| Domain (at Cloudflare cost) | ~$10 |
| Cloudflare Workers hosting | $0 |
| Email forwarding (Cloudflare) | $0 |
| **Total** | **~$10** |
