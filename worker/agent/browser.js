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
    if (startUrl) await this.page.goto(startUrl, { waitUntil: 'networkidle0' });
  }

  async screenshot() {
    if (!this.page) throw new Error('session not open');
    const buf = await this.page.screenshot({ fullPage: false, type: 'png' });
    return bytesToB64(buf);
  }

  async navigate(url) {
    await this.page.goto(url, { waitUntil: 'networkidle0' });
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
  async open(startUrl) { this.url = startUrl || this.url; this.history.push(['open', this.url]); }
  async screenshot()   { this.history.push(['screenshot']); return ONE_PX_PNG_B64; }
  async navigate(url)  { this.url = url; this.history.push(['navigate', url]); }
  async click(x, y)    { this.history.push(['click', x, y]); }
  async type(text)     { this.history.push(['type', text.length + ' chars']); }
  async key(name)      { this.history.push(['key', name]); }
  async currentUrl()   { return this.url; }
  async close()        { this.history.push(['close']); }
  get isDry() { return true; }
}

function bytesToB64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
