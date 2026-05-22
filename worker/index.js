// Cloudflare Worker entrypoint for Second 9 Labs site.
//
// Phase 6 (Kitchen OS): Gemini drives conversation, Claude Opus 4.7
// authors recipes via tool-use, Imagen 3 generates the photo (cached
// in R2), and Spoonacular + Edamam + TheMealDB + Tasty cross-reference
// the LLM's output in the background via ctx.waitUntil.

import { runChat, buildSystemPrompt } from './llm.js';
import { TOOL_DECLARATIONS, dispatch } from './tools.js';
import { listProviders, buildCart } from './cart/index.js';
import { serveRecipeImage } from './image-gen.js';
import { getCrossReference } from './cross-reference.js';
import { recordMessage, recordApprovedRecipe, getMemorySnapshot } from './memory.js';
import { getCachedRecipeById } from './recipe-cache.js';
import { ingestPaste, ingestUrl, listSources, deleteSource } from './ingest.js';
import { startGoogleOAuth, handleGoogleCallback } from './auth-oauth.js';
import {
  generateMagicToken,
  generateSessionId,
  buildSessionCookie,
  buildLogoutCookie,
  readSessionId,
  isLikelyEmail
} from './auth.js';
import {
  putMagicToken,
  consumeMagicToken,
  putSession,
  getSession,
  deleteSession,
  ensureUser,
  getUser,
  updateUserPreferences,
  getHistory,
  appendHistory
} from './kv.js';
import { sendMagicLink } from './email.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/api/recipes/chat' && request.method === 'POST') {
      return handleChat(request, env, ctx);
    }

    if (path.startsWith('/api/recipes/xref/') && request.method === 'GET') {
      const id = decodeURIComponent(path.slice('/api/recipes/xref/'.length));
      const xref = await getCrossReference(env, id);
      return json(xref || { pending: true });
    }

    if (path.startsWith('/api/recipe-image/') && request.method === 'GET') {
      const key = decodeURIComponent(path.slice('/api/recipe-image/'.length));
      return serveRecipeImage(env, key);
    }

    if (path === '/api/cart/providers' && request.method === 'GET') {
      return json({ providers: listProviders(env) });
    }

    if (path === '/api/cart/build' && request.method === 'POST') {
      return handleCartBuild(request, env, ctx);
    }

    if (path === '/api/auth/request' && request.method === 'POST') {
      return handleAuthRequest(request, env);
    }

    if (path === '/api/auth/verify' && request.method === 'GET') {
      return handleAuthVerify(request, env);
    }

    if (path === '/api/auth/logout' && request.method === 'POST') {
      return handleAuthLogout(request, env);
    }

    if (path === '/api/auth/google/start' && request.method === 'GET') {
      return handleGoogleStart(request, env);
    }

    if (path === '/api/auth/google/callback' && request.method === 'GET') {
      return handleGoogleCallbackRoute(request, env);
    }

    if (path === '/api/profile' && request.method === 'GET') {
      return handleProfileGet(request, env);
    }

    if (path === '/api/profile' && request.method === 'PUT') {
      return handleProfilePut(request, env);
    }

    // ---- Phase 8: corpus (cookbook) routes ----
    if (path === '/api/corpus' && request.method === 'GET') {
      return handleCorpusList(request, env);
    }
    if (path === '/api/corpus/paste' && request.method === 'POST') {
      return handleCorpusPaste(request, env);
    }
    if (path === '/api/corpus/url' && request.method === 'POST') {
      return handleCorpusUrl(request, env);
    }
    if (path.startsWith('/api/corpus/') && request.method === 'DELETE') {
      const sourceId = decodeURIComponent(path.slice('/api/corpus/'.length));
      return handleCorpusDelete(request, env, sourceId);
    }

    return json({ error: 'not_found', path }, 404);
  }
};

// ---------- corpus handlers (Phase 8) ----------

async function handleCorpusList(request, env) {
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'unauthenticated' }, 401);
  const sources = await listSources(env, user.email);
  return json({ sources });
}

async function handleCorpusPaste(request, env) {
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'unauthenticated' }, 401);
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'bad_request', message: 'Body must be valid JSON.' }, 400); }
  const text = String(body?.text || '');
  if (!text.trim()) return json({ error: 'bad_request', message: '`text` is required.' }, 400);
  try {
    const result = await ingestPaste({ email: user.email, text, env });
    return json({ ok: true, ...result });
  } catch (err) {
    console.error('corpus paste failed:', err);
    return json({ error: 'ingest_failed', message: String(err?.message || err) }, 500);
  }
}

async function handleCorpusUrl(request, env) {
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'unauthenticated' }, 401);
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'bad_request', message: 'Body must be valid JSON.' }, 400); }
  const url = String(body?.url || '').trim();
  if (!url) return json({ error: 'bad_request', message: '`url` is required.' }, 400);
  try {
    const result = await ingestUrl({ email: user.email, url, env });
    return json({ ok: true, ...result });
  } catch (err) {
    console.error('corpus url failed:', err);
    return json({ error: 'ingest_failed', message: String(err?.message || err) }, 500);
  }
}

async function handleCorpusDelete(request, env, sourceId) {
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'unauthenticated' }, 401);
  const ok = await deleteSource(env, user.email, sourceId);
  if (!ok) return json({ error: 'not_found' }, 404);
  return json({ ok: true });
}

// ---------- shared helper: resolve current authed user ----------
async function currentUser(request, env) {
  if (!env.BIBA_USERS || !env.SESSION_SECRET) return null;
  const sid = await readSessionId(request, env.SESSION_SECRET);
  if (!sid) return null;
  const session = await getSession(env, sid);
  if (!session?.email) return null;
  return getUser(env, session.email);
}

// ---------- profile handlers ----------

async function handleProfileGet(request, env) {
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'unauthenticated' }, 401);
  // Include the (lightweight) history summary so the frontend can show counts/badges.
  const history = await getHistory(env, user.email);
  return json({
    email: user.email,
    preferences: user.preferences || {},
    historyCount: history.length,
    lastSeenAt: history[0]?.at || null
  });
}

async function handleProfilePut(request, env) {
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'unauthenticated' }, 401);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'bad_request', message: 'Body must be valid JSON.' }, 400); }

  const incoming = body?.preferences;
  if (!incoming || typeof incoming !== 'object') {
    return json({ error: 'bad_request', message: 'Body must include a "preferences" object.' }, 400);
  }

  // Only let the client touch the fields we actually expose; ignore anything else.
  const sanitized = {};
  if (typeof incoming.organic === 'boolean') sanitized.organic = incoming.organic;
  if (Number.isInteger(incoming.householdSize) && incoming.householdSize > 0 && incoming.householdSize <= 20) {
    sanitized.householdSize = incoming.householdSize;
  }
  if (Array.isArray(incoming.diet)) sanitized.diet = incoming.diet.filter(x => typeof x === 'string').slice(0, 20);
  if (Array.isArray(incoming.intolerances)) sanitized.intolerances = incoming.intolerances.filter(x => typeof x === 'string').slice(0, 20);
  if (typeof incoming.dislikes === 'string') sanitized.dislikes = incoming.dislikes.slice(0, 1000);
  if (typeof incoming.cartProvider === 'string') sanitized.cartProvider = incoming.cartProvider;
  if (typeof incoming.decisiveMode === 'boolean') sanitized.decisiveMode = incoming.decisiveMode;

  const updated = await updateUserPreferences(env, user.email, sanitized);
  return json({ email: updated.email, preferences: updated.preferences });
}

// ---------- auth handlers ----------

async function handleAuthRequest(request, env) {
  if (!env.BIBA_USERS) return json({ error: 'misconfigured', message: 'KV namespace BIBA_USERS not bound.' }, 500);
  if (!env.RESEND_API_KEY) return json({ error: 'misconfigured', message: 'RESEND_API_KEY not set.' }, 500);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'bad_request', message: 'Body must be valid JSON.' }, 400); }

  const email = String(body?.email || '').trim().toLowerCase();
  if (!isLikelyEmail(email)) {
    return json({ error: 'bad_request', message: 'Please provide a valid email address.' }, 400);
  }

  const token = generateMagicToken();
  await putMagicToken(env, token, email);

  // Build the magic URL from the inbound request so dev (localhost) and prod (your domain) both work.
  const url = new URL(request.url);
  const magicUrl = `${url.origin}/api/auth/verify?token=${encodeURIComponent(token)}`;

  try {
    await sendMagicLink(env, { to: email, magicUrl });
  } catch (err) {
    console.error('sendMagicLink failed:', err);
    return json({ error: 'email_failed', message: 'Could not send the email. Try again in a moment.' }, 502);
  }

  return new Response(null, { status: 204 });
}

async function handleAuthVerify(request, env) {
  if (!env.BIBA_USERS) return json({ error: 'misconfigured', message: 'KV namespace BIBA_USERS not bound.' }, 500);
  if (!env.SESSION_SECRET) return json({ error: 'misconfigured', message: 'SESSION_SECRET not set.' }, 500);

  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return redirectWithMsg(url.origin, 'missing_token');

  const email = await consumeMagicToken(env, token);
  if (!email) return redirectWithMsg(url.origin, 'expired_or_invalid');

  // Make sure the user record exists.
  await ensureUser(env, email);

  // Mint a session.
  const sid = generateSessionId();
  await putSession(env, sid, email);

  const secure = url.protocol === 'https:';
  const cookie = await buildSessionCookie(sid, env.SESSION_SECRET, { secure });

  return new Response(null, {
    status: 302,
    headers: {
      'Location': `${url.origin}/bibas-playground/recipes/`,
      'Set-Cookie': cookie
    }
  });
}

async function handleAuthLogout(request, env) {
  if (!env.SESSION_SECRET) return json({ error: 'misconfigured', message: 'SESSION_SECRET not set.' }, 500);
  const url = new URL(request.url);

  // Best-effort: clear the session from KV too.
  if (env.BIBA_USERS) {
    const sid = await readSessionId(request, env.SESSION_SECRET);
    if (sid) await deleteSession(env, sid);
  }

  const secure = url.protocol === 'https:';
  return new Response(null, {
    status: 204,
    headers: { 'Set-Cookie': buildLogoutCookie({ secure }) }
  });
}

function redirectWithMsg(origin, kind) {
  // Send the user back to the login page with a hint in the query string;
  // login.html reads ?error=... and shows a friendly message.
  return new Response(null, {
    status: 302,
    headers: { 'Location': `${origin}/bibas-playground/recipes/login.html?error=${encodeURIComponent(kind)}` }
  });
}

// ---------- Google OAuth route handlers (Phase 9) ----------

async function handleGoogleStart(request, env) {
  const url = new URL(request.url);
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return redirectWithMsg(url.origin, 'oauth_not_configured');
  }
  try {
    const returnTo = url.searchParams.get('return_to') || '/bibas-playground/recipes/';
    const authUrl = await startGoogleOAuth(env, { origin: url.origin, returnTo });
    return Response.redirect(authUrl, 302);
  } catch (err) {
    console.error('google oauth start failed:', err);
    return redirectWithMsg(url.origin, 'oauth_start_failed');
  }
}

async function handleGoogleCallbackRoute(request, env) {
  const url = new URL(request.url);
  if (!env.BIBA_USERS || !env.SESSION_SECRET) {
    return redirectWithMsg(url.origin, 'misconfigured');
  }
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');
  if (errorParam) return redirectWithMsg(url.origin, `google_${errorParam}`);

  try {
    const { email, returnTo } = await handleGoogleCallback(env, { origin: url.origin, code, state });
    await ensureUser(env, email);

    const sid = generateSessionId();
    await putSession(env, sid, email);
    const secure = url.protocol === 'https:';
    const cookie = await buildSessionCookie(sid, env.SESSION_SECRET, { secure });

    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${url.origin}${returnTo}`,
        'Set-Cookie': cookie
      }
    });
  } catch (err) {
    console.error('google oauth callback failed:', err);
    return redirectWithMsg(url.origin, 'oauth_callback_failed');
  }
}

async function handleCartBuild(request, env, ctx) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'bad_request', message: 'Body must be valid JSON.' }, 400); }

  const { provider = 'instacart', recipeId, preferences = {} } = body || {};
  if (!recipeId) {
    return json({ error: 'bad_request', message: '`recipeId` required.' }, 400);
  }

  const recipe = await getCachedRecipeById(env, recipeId);
  if (!recipe) {
    return json({ error: 'recipe_not_found', message: 'Recipe not found in cache. Re-generate it first.' }, 404);
  }

  const origin = new URL(request.url).origin;
  const partnerLinkbackUrl = `${origin}/bibas-playground/recipes/`;

  try {
    const result = await buildCart(provider, recipe, env, { preferences, partnerLinkbackUrl });

    // Send-to-cart is the positive implicit signal that replaced the
    // retired reaction buttons. Best-effort writes to KV (chronological
    // history) AND Vectorize (semantic memory). Never blocks the response.
    const user = await currentUser(request, env).catch(() => null);
    if (user) {
      await appendHistory(env, user.email, {
        recipeId,
        title: recipe.title,
        signal: 'sent_to_cart'
      }).catch(err => console.warn('history append failed:', err));

      if (ctx?.waitUntil) {
        ctx.waitUntil(
          recordApprovedRecipe(env, { email: user.email, recipe, signal: 'sent_to_cart' })
            .catch(err => console.warn('memory record failed:', err))
        );
      }
    }

    return json(result);
  } catch (err) {
    console.error('cart build failed:', err);
    return json({ error: 'cart_failed', message: String(err?.message || err) }, 500);
  }
}

async function handleChat(request, env, ctx) {
  // Validate environment early so misconfiguration is obvious.
  // Gemini is always required (conversational drive + Imagen 3).
  // The recipe author can be either Claude (default) or Gemini Pro
  // (when RECIPE_AUTHOR=gemini). recipe-author.js raises if neither
  // backend is configured, so we only hard-fail on the always-needed key.
  if (!env.GEMINI_API_KEY) {
    return json({ error: 'misconfigured', message: 'GEMINI_API_KEY not set on the Worker.' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_request', message: 'Body must be valid JSON.' }, 400);
  }

  const { messages = [], preferences: incomingPrefs = {}, knownRecipes = [] } = body || {};

  // If the user is signed in, prefer server-side preferences + load their history.
  // Server-side wins over what the browser sent so the LLM always has the latest.
  let preferences = incomingPrefs;
  let history = [];
  const user = await currentUser(request, env).catch(() => null);
  if (user) {
    preferences = { ...incomingPrefs, ...(user.preferences || {}) };
    history = await getHistory(env, user.email);
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: 'bad_request', message: 'messages must be a non-empty array.' }, 400);
  }

  // Convert frontend format → Gemini format.
  // Frontend sends { role: 'user'|'assistant', text: string }.
  const contents = messages
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.text || '').trim() }]
    }))
    .filter(c => c.parts[0].text);

  if (contents.length === 0) {
    return json({ error: 'bad_request', message: 'No message text after normalization.' }, 400);
  }

  // Phase 7: pull a memory snapshot keyed off the most recent user
  // message. Authed-only — anonymous users get the same v1 experience.
  let memorySnapshot = null;
  const lastUserText = [...messages].reverse().find(m => m.role === 'user')?.text || '';
  if (user && lastUserText) {
    memorySnapshot = await getMemorySnapshot(env, { email: user.email, query: lastUserText })
      .catch(err => { console.warn('memory snapshot failed:', err?.message || err); return null; });

    // Record the user message into the conversations index for future
    // sessions. Fire-and-forget — never block the response on it.
    if (ctx?.waitUntil) {
      ctx.waitUntil(recordMessage(env, { email: user.email, text: lastUserText }));
    }
  }

  const system = buildSystemPrompt(preferences, knownRecipes, history, memorySnapshot);

  try {
    const { text, toolResults } = await runChat({
      apiKey: env.GEMINI_API_KEY,
      system,
      contents,
      tools: TOOL_DECLARATIONS,
      env,
      dispatch,
      preferences,
      executionCtx: ctx,
      userEmail: user?.email || null
    });

    // Phase 6: a single LLM-authored recipe per turn (no list).
    const lastRecipe = toolResults
      .filter(t => t.name === 'generate_recipe' && t.result?.recipe)
      .pop();

    return json({
      message: { role: 'assistant', text },
      recipe: lastRecipe?.result?.recipe || null,
      fromCache: lastRecipe?.result?.fromCache || false,
      xrefPending: Boolean(lastRecipe?.result?.recipe && !lastRecipe.result.fromCache)
    });
  } catch (err) {
    console.error('chat error:', err);
    return json(
      { error: 'chat_failed', message: String(err?.message || err) },
      500
    );
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}
