// Per-user audit log for agent runs. KV-backed.
//
// Each run gets a runId. Every screenshot, decision, and action is
// appended to the run's log. The UI can replay these for transparency.
//
// KV layout:
//   agent:runs:<email>            -> Array<{runId, provider, status, startedAt, finishedAt?}> (most recent first)
//   agent:log:<email>:<runId>     -> Array<{ts, kind, payload}> events
//
// Logs auto-expire 30 days after the run finishes.

const RUNS_KEY = (email) => `agent:runs:${email}`;
const LOG_KEY = (email, runId) => `agent:log:${email}:${runId}`;
const MAX_RUNS_KEPT = 50;
const LOG_TTL_S = 30 * 24 * 60 * 60;

export async function startRun(env, { email, provider, recipeId, recipeTitle }) {
  const runId = await randomId(16);
  const meta = {
    runId,
    provider,
    recipeId,
    recipeTitle,
    status: 'running',
    startedAt: Date.now(),
    finishedAt: null
  };
  await appendRunMeta(env, email, meta);
  await appendEvent(env, email, runId, 'run.start', { provider, recipeId, recipeTitle });
  return runId;
}

export async function finishRun(env, { email, runId, status, summary = null }) {
  const meta = await getRunMeta(env, email, runId);
  if (meta) {
    meta.status = status;
    meta.finishedAt = Date.now();
    if (summary) meta.summary = summary;
    await replaceRunMeta(env, email, meta);
  }
  await appendEvent(env, email, runId, 'run.finish', { status, summary });
}

export async function logScreenshot(env, { email, runId, hint, base64 = null }) {
  // Screenshots are large; we store only hint text in the audit log by
  // default. Pass base64 to attach the image for in-flight review (UI
  // streams it then can drop it).
  await appendEvent(env, email, runId, 'screenshot', {
    hint,
    bytesPreview: base64 ? base64.length : 0
  });
}

export async function logDecision(env, { email, runId, reasoning, nextAction }) {
  await appendEvent(env, email, runId, 'decision', { reasoning, nextAction });
}

export async function logAction(env, { email, runId, action, args, ok = true, error = null }) {
  await appendEvent(env, email, runId, 'action', { action, args, ok, error });
}

export async function logNote(env, { email, runId, note }) {
  await appendEvent(env, email, runId, 'note', { note });
}

// ---------- reads ----------

export async function listRuns(env, email, { limit = 20 } = {}) {
  if (!env?.BIBA_USERS || !email) return [];
  const raw = await env.BIBA_USERS.get(RUNS_KEY(email));
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, limit) : [];
  } catch { return []; }
}

export async function getRunLog(env, email, runId) {
  if (!env?.BIBA_USERS || !email || !runId) return [];
  const raw = await env.BIBA_USERS.get(LOG_KEY(email, runId));
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

// ---------- internals ----------

async function appendEvent(env, email, runId, kind, payload) {
  if (!env?.BIBA_USERS || !email || !runId) return;
  const list = await getRunLog(env, email, runId);
  list.push({ ts: Date.now(), kind, payload });
  await env.BIBA_USERS.put(LOG_KEY(email, runId), JSON.stringify(list), { expirationTtl: LOG_TTL_S });
}

async function getRunMeta(env, email, runId) {
  const runs = await listRuns(env, email);
  return runs.find(r => r.runId === runId) || null;
}

async function appendRunMeta(env, email, meta) {
  const runs = await listRuns(env, email);
  runs.unshift(meta);
  const trimmed = runs.slice(0, MAX_RUNS_KEPT);
  await env.BIBA_USERS.put(RUNS_KEY(email), JSON.stringify(trimmed));
}

async function replaceRunMeta(env, email, meta) {
  const runs = await listRuns(env, email);
  const i = runs.findIndex(r => r.runId === meta.runId);
  if (i >= 0) runs[i] = meta;
  await env.BIBA_USERS.put(RUNS_KEY(email), JSON.stringify(runs));
}

async function randomId(bytes) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}
