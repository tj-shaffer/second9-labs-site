// Typed wrappers around the BIBA_USERS KV namespace.
//
// Key layout:
//   magic:<token>     -> { email, exp } — 10-min TTL, single-use
//   session:<sid>     -> { email, exp } — 30-day TTL
//   user:<email>      -> { email, createdAt, preferences } — no TTL
//   history:<email>   -> Array<{ recipeId, title, reaction, at }> — no TTL
//
// All values are JSON.

const MAGIC_TTL_S = 10 * 60;             // 10 minutes
const SESSION_TTL_S = 30 * 24 * 60 * 60; // 30 days
const HISTORY_MAX = 200;                 // cap per-user history length

// ---------- magic tokens ----------
export async function putMagicToken(env, token, email) {
  const value = JSON.stringify({ email, createdAt: Date.now() });
  await env.BIBA_USERS.put(`magic:${token}`, value, { expirationTtl: MAGIC_TTL_S });
}

// Returns email if token is valid and consumes it (single-use). null otherwise.
export async function consumeMagicToken(env, token) {
  const key = `magic:${token}`;
  const raw = await env.BIBA_USERS.get(key);
  if (!raw) return null;
  await env.BIBA_USERS.delete(key);
  try {
    const { email } = JSON.parse(raw);
    return email || null;
  } catch {
    return null;
  }
}

// ---------- sessions ----------
export async function putSession(env, sid, email) {
  const value = JSON.stringify({ email, createdAt: Date.now() });
  await env.BIBA_USERS.put(`session:${sid}`, value, { expirationTtl: SESSION_TTL_S });
}

export async function getSession(env, sid) {
  if (!sid) return null;
  const raw = await env.BIBA_USERS.get(`session:${sid}`);
  if (!raw) return null;
  try { return JSON.parse(raw); }
  catch { return null; }
}

export async function deleteSession(env, sid) {
  if (!sid) return;
  await env.BIBA_USERS.delete(`session:${sid}`);
}

// ---------- user profile ----------
const DEFAULT_PROFILE_PREFS = {
  organic: true,
  householdSize: 2,
  diet: [],
  intolerances: [],
  dislikes: '',
  cartProvider: 'instacart',
  decisiveMode: false
};

export async function getUser(env, email) {
  if (!email) return null;
  const raw = await env.BIBA_USERS.get(`user:${email}`);
  if (!raw) return null;
  try { return JSON.parse(raw); }
  catch { return null; }
}

export async function ensureUser(env, email) {
  const existing = await getUser(env, email);
  if (existing) return existing;
  const fresh = {
    email,
    createdAt: Date.now(),
    preferences: { ...DEFAULT_PROFILE_PREFS }
  };
  await env.BIBA_USERS.put(`user:${email}`, JSON.stringify(fresh));
  return fresh;
}

export async function updateUserPreferences(env, email, preferences) {
  const user = (await getUser(env, email)) || { email, createdAt: Date.now(), preferences: {} };
  user.preferences = { ...DEFAULT_PROFILE_PREFS, ...user.preferences, ...preferences };
  user.updatedAt = Date.now();
  await env.BIBA_USERS.put(`user:${email}`, JSON.stringify(user));
  return user;
}

// ---------- history ----------
export async function getHistory(env, email) {
  if (!email) return [];
  const raw = await env.BIBA_USERS.get(`history:${email}`);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

// Append a reaction; keep the list capped to HISTORY_MAX entries (most recent first).
export async function appendHistory(env, email, entry) {
  const list = await getHistory(env, email);
  list.unshift({
    recipeId: entry.recipeId,
    title: entry.title,
    reaction: entry.reaction, // 'loved' | 'liked' | 'skipped'
    at: Date.now()
  });
  const trimmed = list.slice(0, HISTORY_MAX);
  await env.BIBA_USERS.put(`history:${email}`, JSON.stringify(trimmed));
  return trimmed;
}
