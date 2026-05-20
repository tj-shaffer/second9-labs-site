// Google OAuth 2.0 authorization-code flow with PKCE.
//
// Phase 9 promotes Google OAuth from "not implemented" to the primary
// sign-in option. Magic-link (Phase 5) stays around as a recovery /
// no-Google-account fallback.
//
// Flow:
//   1. /api/auth/google/start
//        - generates random `state` and PKCE `code_verifier`
//        - stores both in KV (oauth:state:<state>) with 10-minute TTL
//        - 302 → Google's authorize endpoint with code_challenge
//   2. Google → /api/auth/google/callback?code=…&state=…
//        - looks up + consumes the stored state (single-use)
//        - exchanges code + code_verifier for tokens (PKCE confirmation)
//        - fetches /userinfo to get the verified email
//        - ensures the user row exists, mints a session cookie
//        - 302 → /bibas-playground/recipes/
//
// No tokens are stored client-side — we extract the email at callback
// time and discard everything else.

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const SCOPE = 'openid email profile';
const OAUTH_STATE_TTL_S = 10 * 60;

// ---------- step 1: build the redirect to Google ----------

export async function startGoogleOAuth(env, { origin, returnTo = '/bibas-playground/recipes/' }) {
  if (!env?.GOOGLE_CLIENT_ID) throw new Error('GOOGLE_CLIENT_ID not set');
  if (!env?.BIBA_USERS) throw new Error('BIBA_USERS KV not bound');

  const state = randomToken(32);
  const codeVerifier = randomToken(64);
  const codeChallenge = await pkceChallenge(codeVerifier);

  await env.BIBA_USERS.put(
    `oauth:state:${state}`,
    JSON.stringify({ codeVerifier, returnTo, createdAt: Date.now() }),
    { expirationTtl: OAUTH_STATE_TTL_S }
  );

  const redirectUri = `${origin}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'online',
    prompt: 'select_account',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });

  return `${AUTHORIZE_URL}?${params.toString()}`;
}

// ---------- step 2: handle the callback from Google ----------

export async function handleGoogleCallback(env, { origin, code, state }) {
  if (!env?.GOOGLE_CLIENT_ID || !env?.GOOGLE_CLIENT_SECRET) {
    throw new Error('Google OAuth credentials not set');
  }
  if (!code || !state) throw new Error('Missing code or state');

  const stateKey = `oauth:state:${state}`;
  const raw = await env.BIBA_USERS.get(stateKey);
  if (!raw) throw new Error('expired_or_invalid_state');
  await env.BIBA_USERS.delete(stateKey); // single-use

  let stored;
  try { stored = JSON.parse(raw); }
  catch { throw new Error('corrupt_state'); }

  const redirectUri = `${origin}/api/auth/google/callback`;
  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: stored.codeVerifier
    }).toString()
  });
  if (!tokenRes.ok) {
    throw new Error(`Google token exchange ${tokenRes.status}: ${(await tokenRes.text()).slice(0, 300)}`);
  }
  const tokens = await tokenRes.json();
  if (!tokens?.access_token) throw new Error('No access_token returned');

  const userRes = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  });
  if (!userRes.ok) {
    throw new Error(`userinfo ${userRes.status}: ${(await userRes.text()).slice(0, 300)}`);
  }
  const profile = await userRes.json();
  const email = String(profile?.email || '').trim().toLowerCase();
  if (!email) throw new Error('No verified email on Google account');
  if (profile.email_verified === false) throw new Error('Google email not verified');

  return { email, returnTo: stored.returnTo || '/bibas-playground/recipes/' };
}

// ---------- helpers ----------

function randomToken(byteLen) {
  const bytes = new Uint8Array(byteLen);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function pkceChallenge(verifier) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(hash));
}

function base64UrlEncode(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
