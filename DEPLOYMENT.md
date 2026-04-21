# Deployment guide — getting Second 9 Labs live

From zero to published in about 45 minutes. You only do this once.

---

## The 10-second version

1. Put the site files in a GitHub repo
2. Connect Cloudflare Pages to that repo
3. Buy a domain (optional but nice)
4. After launch: to add a project, edit `projects.json` on GitHub. Site redeploys automatically.

That's it. No servers, no passwords to manage, no monthly hosting bill.

---

## Step 1 — Make a GitHub account (skip if you have one)

1. Go to [github.com](https://github.com) and sign up. Use an email address you'll keep (not your school/work email).
2. **Turn on 2FA immediately** — *Settings → Password and authentication → Two-factor authentication*. Use an authenticator app, not SMS.

This GitHub account is your admin login for Second 9 Labs. Protect it.

---

## Step 2 — Put the site in a repository

1. On GitHub, click the **+** in the top right → **New repository**.
2. Repository name: `second9-labs-site` (or anything you like — this never appears on your public site).
3. Set it to **Public**. (Private works too, but public is simpler and free, and there's nothing secret in a marketing site.)
4. Leave everything else unchecked. Click **Create repository**.
5. On the new repo page, click **uploading an existing file** on the "Quick setup" screen.
6. Drag every file and folder from the `second9-labs/` folder you got from me directly into the upload area. Wait for all of them to finish uploading (you'll see each one listed with a green check).
7. In the commit message box, type `initial site`. Click **Commit changes**.

You now have a GitHub repo with the whole site in it. If you visit `github.com/YOUR-USERNAME/second9-labs-site` you should see all the files.

---

## Step 3 — Deploy to Cloudflare Pages

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) and sign up for a free account (no credit card required).
2. In the left sidebar, click **Workers & Pages**.
3. Click **Create** → the **Pages** tab → **Connect to Git**.
4. Click **Connect GitHub** and authorize Cloudflare to see your repos. When it asks which repos, pick **Only select repositories** and choose `second9-labs-site`. (Don't give it access to all your repos — principle of least privilege.)
5. Back in Cloudflare, select `second9-labs-site` from the list and click **Begin setup**.
6. On the build settings page:
   - **Project name:** `second9-labs` (this becomes your temporary URL)
   - **Production branch:** `main`
   - **Framework preset:** None
   - **Build command:** leave blank (or type `exit 0`)
   - **Build output directory:** leave blank (or type `/`)
7. Click **Save and Deploy.**

Wait about 30 seconds. Cloudflare will show "Success!" and give you a URL like `https://second9-labs.pages.dev`. Click it — your site is live.

---

## Step 4 — Custom domain (optional but recommended)

A `.pages.dev` URL works, but `second9labs.com` is what goes on a business card.

### 4a. Buy the domain

Cheapest way: buy it through **Cloudflare Registrar** (they sell at cost, no markup).

1. In the Cloudflare dashboard → left sidebar → **Domain Registration** → **Register Domains**.
2. Search for `second9labs.com`. If available, it's ~$10/year. If not, try variations (`second9.co`, `second9labs.io`, etc).
3. Complete the purchase.

### 4b. Connect it to Pages

1. Go back to **Workers & Pages** → your `second9-labs` project.
2. Click the **Custom domains** tab → **Set up a custom domain**.
3. Enter `second9labs.com` and click **Continue**. Then do it again for `www.second9labs.com`.
4. Because the domain is on Cloudflare already, DNS configures itself automatically. HTTPS is issued within a couple of minutes.

Test: visit `https://second9labs.com`. You should see your site.

---

## Step 5 — Business email (recommended before handing out the URL)

You'll want `hello@second9labs.com` to receive mail before the site goes public, otherwise you have a dead email on your homepage.

**Cheapest path: Cloudflare Email Routing forwarding (free).**

This forwards `hello@second9labs.com` to your personal Gmail. You can reply from Gmail, but replies will come from your personal address unless you also set up "send as."

1. In Cloudflare dashboard → pick `second9labs.com` → **Email** → **Email Routing**.
2. Enable it. Cloudflare adds the DNS records for you.
3. Create a route: `hello@second9labs.com` → `your-personal@gmail.com`.
4. Check your personal inbox; verify the forwarding address.

**Nicer path: a proper mailbox.** Fastmail ($5/mo) or Google Workspace ($7/mo) both give you a real inbox at your domain. Follow their setup wizard; they'll tell you which DNS records to add in Cloudflare.

---

## How to update the site after launch

### Add a new project

This is your "admin panel": you edit `projects.json` directly on GitHub.

1. Take screenshots of the project. Aim for 1200×800 or larger, roughly 3:2 ratio. PNG or JPG.
2. Go to `github.com/YOUR-USERNAME/second9-labs-site` → click into `assets/images/`.
3. Click **Add file** → **Upload files**. Drag your screenshots in. Name them sensibly (e.g. `acme-dashboard-1.png`).
4. Commit the uploads with a message like "add acme screenshots."
5. Navigate back to the repo root, click `projects.json`, and click the pencil icon (top right) to edit.
6. Copy one of the existing project blocks, paste it at the top of the `"projects"` array, and fill in:
   - `id` — a short url-slug, e.g. `"acme-dashboard"` (letters, numbers, hyphens only)
   - `title`, `client`, `year`, `tagline`, `description`, `outcome`
   - `tags` — short labels matching your service vocabulary
   - `cover` — the main screenshot, e.g. `"assets/images/acme-dashboard-1.png"`
   - `images` — array of all images including the cover
   - `stack` — list of technologies
   - `links` — array of `{ label, url }` objects
   - `featured: true` if you want it on the homepage (otherwise `false`)
7. Scroll down, click **Commit changes**. Use a message like "add acme dashboard project."

Cloudflare Pages automatically detects the change and redeploys in about 30 seconds. Refresh the site and your project appears.

You can do all of this from GitHub's mobile app too — useful for adding a project from your phone.

### Fix a typo anywhere

Same flow: find the file on GitHub, click the pencil, edit, commit. Cloudflare redeploys automatically.

### Get a preview before going live

If you want to stage a change without affecting the live site:

1. On GitHub, create a new branch (e.g. `draft-new-project`) instead of committing to `main`.
2. Make your edits on that branch.
3. Cloudflare will automatically build a preview URL (e.g. `draft-new-project.second9-labs.pages.dev`) that only you know about.
4. Happy with it? Merge the branch into `main` → live site updates.
5. Not happy? Just delete the branch. No harm done.

---

## Things to update before launch

Before you hand out the URL:

- [ ] Replace the email `hello@second9labs.com` in `index.html`, `projects.html`, `project.html` if you prefer a different one
- [ ] Replace the calendar placeholder in `script.js` with your real [Cal.com](https://cal.com) or [Calendly](https://calendly.com) link, and update the "Book a free call" link in the contact section
- [ ] Replace the three placeholder projects in `projects.json` with real ones (or delete them and start with one real project when you have it)
- [ ] Replace placeholder cover images in `assets/images/` with real screenshots
- [ ] Update footer year if needed, and add your state of LLC registration if required

---

## Estimated cost, year one

| Item | Cost |
|---|---|
| Domain (at Cloudflare cost) | ~$10 |
| Cloudflare Pages hosting | $0 |
| Email forwarding (Cloudflare) | $0 |
| Or: real mailbox (Fastmail) | $60 |
| Calendar booking (Cal.com free tier) | $0 |
| **Total (free email)** | **~$10** |
| **Total (with mailbox)** | **~$70** |

---

## If something breaks

- **Site shows 404 or blank page after a commit:** go to Cloudflare → Workers & Pages → your project → Deployments. Find the latest deployment. If it says "Failed," click into it to see the error log. Usually a typo in `projects.json` — malformed JSON is the most common issue. Fix it on GitHub, commit again, Cloudflare redeploys.

- **Projects gallery shows "Couldn't load projects":** almost always a JSON syntax error. Paste the contents of `projects.json` into [jsonlint.com](https://jsonlint.com) — it will point to the exact character that's wrong.

- **Want to roll back:** in Cloudflare → Deployments → find a known-good deployment → click its three-dot menu → **Rollback**. You're instantly back to that version. No data lost.

- **Nuclear option:** the whole site is in GitHub, and GitHub keeps every version of every commit forever. You literally cannot permanently lose anything.
