// Agent orchestrator. Wires together:
//
//   - vault.js (decrypt provider credentials)
//   - browser.js (open a session — Cloudflare or dry)
//   - strategies/<provider>.js (per-provider knowledge)
//   - computer-use.js (the perception → action loop)
//   - audit.js (every screenshot, decision, action gets logged)
//
// Exposes runAgent({email, recipe, providerId, env, ctx}) which returns
// an SSE-friendly Response that streams events to the frontend.

import { loadCredentials } from '../vault.js';
import { openBrowserSession } from './browser.js';
import { runComputerUseLoop } from './computer-use.js';
import {
  startRun,
  finishRun,
  logScreenshot,
  logDecision,
  logAction,
  logNote
} from './audit.js';

import instacart from './strategies/instacart.js';
import ubereats from './strategies/ubereats.js';
import doordash from './strategies/doordash.js';
import walmart from './strategies/walmart.js';

const STRATEGIES = {
  [instacart.id]: instacart,
  [ubereats.id]: ubereats,
  [doordash.id]: doordash,
  [walmart.id]: walmart
};

export function listAgentProviders() {
  return Object.values(STRATEGIES).map(s => ({ id: s.id, name: s.name }));
}

export async function runAgentSSE({ email, recipe, providerId, env, ctx }) {
  const strategy = STRATEGIES[providerId];
  if (!strategy) {
    return new Response(`event: error\ndata: ${JSON.stringify({ message: `Unknown provider: ${providerId}` })}\n\n`, {
      status: 400,
      headers: sseHeaders()
    });
  }
  if (!recipe?.ingredients?.length) {
    return new Response(`event: error\ndata: ${JSON.stringify({ message: 'Recipe has no ingredients' })}\n\n`, {
      status: 400,
      headers: sseHeaders()
    });
  }

  const credentials = await loadCredentials(env, { email, provider: providerId }).catch(() => null);
  if (!credentials) {
    return new Response(`event: error\ndata: ${JSON.stringify({ message: 'No credentials in vault for ' + providerId })}\n\n`, {
      status: 412,
      headers: sseHeaders()
    });
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  async function send(event, payload) {
    await writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
  }

  // Kick off the run in the background so the response stream returns
  // immediately. waitUntil keeps the Worker alive past the initial
  // request boundary for the duration of the agent loop.
  const promise = (async () => {
    let runId;
    try {
      runId = await startRun(env, {
        email,
        provider: providerId,
        recipeId: recipe.id,
        recipeTitle: recipe.title
      });
      await send('start', { runId, provider: providerId, recipeTitle: recipe.title });

      // If the vault entry includes session cookies, open the browser
      // without a startUrl, inject the cookies, and navigate to the
      // authed start URL. This bypasses the login form — where most
      // provider CAPTCHAs live — and dramatically improves the
      // autonomous-completion rate.
      const session = await openBrowserSession(env, { mode: 'auto' });
      const hasCookies = credentials.cookies &&
        (Array.isArray(credentials.cookies)
          ? credentials.cookies.length > 0
          : Object.keys(credentials.cookies).length > 0);

      if (hasCookies) {
        await session.open();
        await session.setCookies(credentials.cookies, strategy.startUrl);
        const target = strategy.authedStartUrl || strategy.startUrl;
        await session.navigate(target);
        await logNote(env, { email, runId, note: `Pre-authed via vault cookies → ${target}` });
        await send('note', { note: `Pre-authed via vault cookies; skipping login.` });
      } else {
        await session.open(strategy.startUrl);
      }

      const result = await runComputerUseLoop({
        session,
        strategy,
        ingredients: recipe.ingredients,
        credentials,
        env,
        preAuthed: hasCookies,
        emit: makeEmit(env, email, runId, send)
      });

      await session.close();
      await finishRun(env, { email, runId, status: result.status, summary: result });
      await send('done', { runId, result });
    } catch (err) {
      const message = String(err?.message || err);
      if (runId) {
        await logNote(env, { email, runId, note: 'fatal: ' + message });
        await finishRun(env, { email, runId, status: 'errored', summary: { error: message } });
      }
      await send('error', { runId, message });
    } finally {
      await writer.close();
    }
  })();

  if (ctx?.waitUntil) ctx.waitUntil(promise);

  return new Response(readable, { headers: sseHeaders() });
}

function makeEmit(env, email, runId, send) {
  return async function emit(kind, payload) {
    if (kind === 'screenshot') {
      await logScreenshot(env, { email, runId, hint: payload.hint, base64: payload.base64 });
      // Don't include the raw base64 in the SSE event (too large).
      await send('screenshot', { hint: payload.hint, hasImage: !!payload.base64 });
    } else if (kind === 'decision') {
      await logDecision(env, { email, runId, reasoning: payload.reasoning, nextAction: payload.nextAction });
      await send('decision', payload);
    } else if (kind === 'action') {
      await logAction(env, { email, runId, action: payload.action, args: payload.args, ok: payload.ok, error: payload.error });
      await send('action', payload);
    } else if (kind === 'note') {
      await logNote(env, { email, runId, note: payload.note });
      await send('note', payload);
    }
  };
}

function sseHeaders() {
  return {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store',
    'connection': 'keep-alive'
  };
}
