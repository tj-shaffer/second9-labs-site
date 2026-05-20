// Vault — envelope encryption for per-user provider credentials.
//
// Threat model:
//   - Provider credentials (Instacart username/password, eventually
//     others) are the single most sensitive secret in this system.
//   - Stored ciphertext lives in KV under `vault:<email>:<provider>`.
//   - Plaintext is only constructed at agent-run time, decrypted into
//     in-process variables, used immediately, and discarded.
//   - Compromise of KV (without the master key) reveals only ciphertext.
//   - Compromise of the master key (without KV) reveals nothing.
//   - Compromise of both is fatal — accept this, mitigate via short-
//     lived master keys + audit logs.
//
// Crypto:
//   - AES-GCM with a 256-bit per-user data key derived via HKDF-SHA256
//     from VAULT_MASTER_KEY + the user's email (deterministic per-user).
//   - 12-byte random nonce per ciphertext.
//   - Auth tag included in the ciphertext envelope.
//
// KV layout:
//   vault:<email>:<provider> -> {
//     nonce:    base64,
//     ct:       base64,        // ciphertext + auth tag
//     fields:   string[],      // names of the keys in the encrypted JSON
//     updatedAt: ms
//   }
//
// Credentials shape (all fields optional — at least one of username
// or cookies is required for the agent to do anything useful):
//   {
//     username?:  string,                      // for fallback login
//     password?:  string,                      // for fallback login
//     cookies?:   Cookie[] | Record<string,string>,
//                                              // pre-authenticated session
//                                              // see worker/agent/browser.js
//                                              // for the accepted shapes
//   }
// When cookies are present, the agent skips the login flow entirely —
// dramatically reducing CAPTCHA encounters across all providers. The
// user logs in once in their real browser per cookie-refresh cycle
// (typically 7–30 days) and pastes the cookies into vault.html.

const HKDF_INFO = new TextEncoder().encode('biba-playground vault per-user key v1');
const KEY_LEN_BITS = 256;
const NONCE_BYTES = 12;
const SUPPORTED_PROVIDERS = new Set(['instacart', 'ubereats', 'walmart', 'doordash']);

// ---------- public API ----------

export async function storeCredentials(env, { email, provider, credentials }) {
  assertConfigured(env);
  assertProvider(provider);
  assertEmail(email);
  if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials)) {
    throw new Error('credentials must be an object');
  }

  const key = await deriveDataKey(env, email);
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  const plaintext = new TextEncoder().encode(JSON.stringify(credentials));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plaintext);

  const envelope = {
    nonce: bytesToB64(nonce),
    ct: bytesToB64(new Uint8Array(ct)),
    fields: Object.keys(credentials).sort(),
    updatedAt: Date.now()
  };
  await env.BIBA_USERS.put(vaultKey(email, provider), JSON.stringify(envelope));
  return { provider, fields: envelope.fields, updatedAt: envelope.updatedAt };
}

export async function loadCredentials(env, { email, provider }) {
  assertConfigured(env);
  assertProvider(provider);
  assertEmail(email);

  const raw = await env.BIBA_USERS.get(vaultKey(email, provider));
  if (!raw) return null;
  const envelope = JSON.parse(raw);

  const key = await deriveDataKey(env, email);
  const nonce = b64ToBytes(envelope.nonce);
  const ct = b64ToBytes(envelope.ct);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ct);
  return JSON.parse(new TextDecoder().decode(pt));
}

// Returns vault metadata WITHOUT decrypting — for status displays.
export async function getVaultStatus(env, { email }) {
  if (!env?.BIBA_USERS || !email) return {};
  const out = {};
  for (const provider of SUPPORTED_PROVIDERS) {
    const raw = await env.BIBA_USERS.get(vaultKey(email, provider));
    if (!raw) continue;
    try {
      const envelope = JSON.parse(raw);
      out[provider] = { fields: envelope.fields, updatedAt: envelope.updatedAt };
    } catch { /* skip corrupt */ }
  }
  return out;
}

export async function deleteCredentials(env, { email, provider }) {
  assertProvider(provider);
  assertEmail(email);
  await env.BIBA_USERS.delete(vaultKey(email, provider));
}

export function listSupportedProviders() {
  return [...SUPPORTED_PROVIDERS];
}

// ---------- internals ----------

function vaultKey(email, provider) {
  return `vault:${email}:${provider}`;
}

function assertConfigured(env) {
  if (!env?.BIBA_USERS) throw new Error('BIBA_USERS KV not bound');
  if (!env?.VAULT_MASTER_KEY) throw new Error('VAULT_MASTER_KEY not set');
}

function assertProvider(p) {
  if (!SUPPORTED_PROVIDERS.has(p)) {
    throw new Error(`Unsupported vault provider: ${p}`);
  }
}

function assertEmail(e) {
  if (!e || typeof e !== 'string') throw new Error('email required');
}

// HKDF-SHA256: derive a 256-bit AES-GCM key from the master key + email
// salt. Deterministic — re-running with same inputs returns same key,
// so we never need to store per-user keys.
async function deriveDataKey(env, email) {
  const masterBytes = b64ToBytes(env.VAULT_MASTER_KEY);
  if (masterBytes.length < 32) {
    throw new Error('VAULT_MASTER_KEY must decode to >= 32 bytes (base64 of 32+ random bytes)');
  }
  const hkdfKey = await crypto.subtle.importKey(
    'raw', masterBytes, 'HKDF', false, ['deriveKey']
  );
  const salt = new TextEncoder().encode('biba-playground:' + email);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: HKDF_INFO },
    hkdfKey,
    { name: 'AES-GCM', length: KEY_LEN_BITS },
    false,
    ['encrypt', 'decrypt']
  );
}

function bytesToB64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
