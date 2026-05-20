// Browser session wrapper. Two backends:
//
//   "cloudflare" — env.BROWSER binding (Cloudflare Browser Rendering).
//                  Real headless Chromium. Needs Workers Paid + Browser
//                  Rendering enabled on the account. Set up by adding:
//                    "browser": { "binding": "BROWSER" }
//                  to wrangler.jsonc.
//
//   "dry"        — no-op stub. Returns canned screenshots (1×1 PNG) and
//                  records calls in memory. The orchestrator + Computer
//                  Use loop still exercise correctly; we just don't
//                  actually drive a real browser.
//
// The dry backend lets us test the whole stack — including audit
// logging, vault decryption, and SSE plumbing — without paying for
// Browser Rendering. Flip to live by setting up the binding and
// passing { mode: 'cloudflare' } when opening a session.

const ONE_PX_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8' +
  '/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

export async function openBrowserSession(env, { mode = 'auto' } = {}) {
  const resolved = mode === 'auto'
    ? (env?.BROWSER ? 'cloudflare' : 'dry')
    : mode;
  if (resolved === 'cloudflare') {
    if (!env?.BROWSER) throw new Error('BROWSER binding missing for cloudflare mode');
    return new CloudflareSession(env);
  }
  return new DrySession();
}

class CloudflareSession {
  constructor(env) {
    this.env = env;
    this.browser = null;
    this.page = null;
  }

  async open(startUrl) {
    // The exact API surface depends on the BROWSER binding shape that
    // Cloudflare exposes (currently a Puppeteer-compatible facade).
    // We import dynamically so dry-mode workers don't need the dep at
    // module init.
    const puppeteer = await import('@cloudflare/puppeteer').catch(() => null);
    if (!puppeteer) {
      throw new Error('@cloudflare/puppeteer not installed; cannot open real browser');
    }
    this.browser = await puppeteer.default.launch(this.env.BROWSER);
    this.page = await this.browser.newPage();
    // If startUrl is omitted, the caller intends to setCookies() first;
    // they'll call navigate() explicitly afterward.
    if (startUrl) await this._navigate(startUrl);
  }

  // Inject session cookies before the first navigation. Accepts the
  // two formats the vault stores:
  //   array  — Puppeteer-native [{name, value, domain, path, ...}, ...]
  //   object — { name: value, ... } map; we derive domain from
  //            `urlOrDomain` (typically strategy.startUrl).
  // Returns { count, names, domains } for diagnostic logging — values
  // are never returned.
  async setCookies(cookies, urlOrDomain) {
    if (!this.page) throw new Error('setCookies: session not open');
    const normalized = normalizeCookies(cookies, urlOrDomain);
    if (normalized.length === 0) return { count: 0, names: [], domains: [] };
    await this.page.setCookie(...normalized);
    return {
      count: normalized.length,
      names: normalized.map(c => c.name),
      domains: [...new Set(normalized.map(c => c.domain))]
    };
  }

  async screenshot() {
    if (!this.page) throw new Error('session not open');
    const buf = await this.page.screenshot({ fullPage: false, type: 'png' });
    return bytesToB64(buf);
  }

  async navigate(url) {
    await this._navigate(url);
  }

  // Modern SPAs (Instacart, Uber Eats, etc.) never reach `networkidle0`
  // because of analytics/beacons. Use `domcontentloaded` and add a
  // small settle window so the React/JS render lands before Claude
  // takes its first screenshot.
  async _navigate(url) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 1500));
  }

  async click(x, y) {
    await this.page.mouse.click(Math.round(x), Math.round(y));
  }

  async type(text) {
    await this.page.keyboard.type(text, { delay: 20 });
  }

  async key(name) {
    await this.page.keyboard.press(name);
  }

  async currentUrl() {
    return this.page?.url() || null;
  }

  async close() {
    try { await this.page?.close(); } catch { /* ignore */ }
    try { await this.browser?.close(); } catch { /* ignore */ }
  }
}

class DrySession {
  constructor() {
    this.url = 'about:blank';
    this.history = [];
  }
  async open(startUrl)            { this.url = startUrl || this.url; this.history.push(['open', this.url]); }
  async setCookies(cookies, _ref) {
    const n = Array.isArray(cookies) ? cookies.length : Object.keys(cookies || {}).length;
    this.history.push(['setCookies', n]);
    const names = Array.isArray(cookies) ? cookies.map(c => c?.name) : Object.keys(cookies || {});
    return { count: n, names, domains: [] };
  }
  async screenshot()              { this.history.push(['screenshot']); return ONE_PX_PNG_B64; }
  async navigate(url)             { this.url = url; this.history.push(['navigate', url]); }
  async click(x, y)               { this.history.push(['click', x, y]); }
  async type(text)                { this.history.push(['type', text.length + ' chars']); }
  async key(name)                 { this.history.push(['key', name]); }
  async currentUrl()              { return this.url; }
  async close()                   { this.history.push(['close']); }
  get isDry() { return true; }
}

function bytesToB64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

// Normalize the two stored cookie shapes into Puppeteer's
// page.setCookie(...args) format: an array of objects each with at
// least { name, value, domain }.
function normalizeCookies(cookies, urlOrDomain) {
  if (!cookies) return [];
  const defaultDomain = deriveDomain(urlOrDomain);
  if (Array.isArray(cookies)) {
    return cookies
      .filter(c => c && c.name && c.value)
      .map(c => ({
        name: c.name,
        value: String(c.value),
        domain: c.domain || defaultDomain,
        path: c.path || '/',
        secure: c.secure ?? true,
        httpOnly: c.httpOnly ?? false,
        sameSite: c.sameSite || 'Lax'
      }));
  }
  if (typeof cookies === 'object') {
    return Object.entries(cookies)
      .filter(([k, v]) => k && v != null)
      .map(([name, value]) => ({
        name,
        value: String(value),
        domain: defaultDomain,
        path: '/',
        secure: true,
        sameSite: 'Lax'
      }));
  }
  return [];
}

function deriveDomain(urlOrDomain) {
  if (!urlOrDomain) return '';
  try {
    const u = new URL(urlOrDomain);
    // Leading dot lets the cookie apply to subdomains; cleaner default
    // for sites that have both www and api hostnames.
    return '.' + u.hostname.replace(/^www\./, '');
  } catch {
    // Caller passed a bare domain.
    return urlOrDomain.startsWith('.') ? urlOrDomain : '.' + urlOrDomain;
  }
}
