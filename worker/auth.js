// Magic-link auth helpers — token generation, HMAC-signed cookies, header parsing.
// Uses Web Crypto (available in Workers); no Node.js APIs.
//
// Cookie format: `bpsession=<sid>.<sig>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=...`
// The signature is HMAC-SHA256(SESSION_SECRET, sid), so a leaked sid alone isn't enough
// — an attacker would also need the SESSION_SECRET to forge a valid cookie.

const COOKIE_NAME = 'bpsession';
const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60; // 30 days

// ---------- random tokens ----------
export function randomHex(bytes = 32) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map(b => b.toString(16).padStart(2, '0')).join('');
}

export const generateMagicToken = () => randomHex(32);
export const generateSessionId  = () => randomHex(32);

// ---------- HMAC ----------
async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function sign(secret, data) {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifySig(secret, data, expected) {
  const actual = await sign(secret, data);
  // Constant-time-ish equality.
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

// ---------- session cookie ----------
export async function buildSessionCookie(sid, secret, { maxAgeSeconds = SESSION_MAX_AGE_S, secure = true } = {}) {
  const sig = await sign(secret, sid);
  const value = `${sid}.${sig}`;
  const parts = [
    `${COOKIE_NAME}=${value}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${maxAgeSeconds}`
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function buildLogoutCookie({ secure = true } = {}) {
  const parts = [
    `${COOKIE_NAME}=`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=0`
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

// Extract & verify the session id from a Request's cookie header.
// Returns the sid string if valid, null otherwise.
export async function readSessionId(request, secret) {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = parseCookies(cookieHeader);
  const raw = cookies[COOKIE_NAME];
  if (!raw) return null;
  const dot = raw.lastIndexOf('.');
  if (dot < 0) return null;
  const sid = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const ok = await verifySig(secret, sid, sig);
  return ok ? sid : null;
}

function parseCookies(header) {
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

// ---------- input validation ----------
// Loose-but-reasonable email check (we only use this to gate sending mail;
// Resend will do the real validation server-side).
export function isLikelyEmail(s) {
  if (typeof s !== 'string') return false;
  s = s.trim();
  if (s.length < 3 || s.length > 254) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return false;
  return true;
}
