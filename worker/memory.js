// Cloudflare Vectorize wrapper. Two indexes today:
//
//   env.MEMORY_CONVERSATIONS — user-message embeddings
//                              metadata: { email, ts, text, signal? }
//   env.MEMORY_RECIPES       — approved-recipe embeddings (send-to-cart)
//                              metadata: { email, ts, recipeId, title,
//                                          cuisineTags, prepStyles, proteins,
//                                          totalMin, complexity, signal }
//
// `corpus` (Phase 8) joins the family later as MEMORY_CORPUS.
//
// All queries are scoped per-user via metadata filter so users never
// see another user's history.

import { embed, EMBED_DIMS } from './embed.js';
import { extractDna, embeddingText } from './recipe-dna.js';

const TOP_K = 3;
// Vectorize requires deterministic IDs <= 64 chars. SHA-256 hex of the
// content gives us idempotency (writing the same chunk twice is a no-op).
async function chunkId(parts) {
  const data = new TextEncoder().encode(parts.join('|'));
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 48);
}

// ---------- writes ----------

// Record a user message into the conversations index. Best-effort: any
// failure logs and swallows so the chat path never breaks because of
// memory. Caller should wrap in ctx.waitUntil() for fire-and-forget.
export async function recordMessage(env, { email, text, signal = null }) {
  if (!env?.MEMORY_CONVERSATIONS || !email || !text) return;
  try {
    const vector = await embed(text, env);
    if (!vector || vector.length !== EMBED_DIMS) return;
    const id = await chunkId([email, 'msg', text, Date.now()]);
    await env.MEMORY_CONVERSATIONS.upsert([{
      id,
      values: vector,
      metadata: {
        email,
        ts: Date.now(),
        text: text.slice(0, 500),
        signal: signal || undefined
      }
    }]);
  } catch (err) {
    console.warn('recordMessage failed:', err?.message || err);
  }
}

// Record an approved recipe into the recipes index. DNA extracted
// heuristically (no LLM call).
export async function recordApprovedRecipe(env, { email, recipe, signal = 'sent_to_cart' }) {
  if (!env?.MEMORY_RECIPES || !email || !recipe?.id || !recipe?.title) return;
  try {
    const dna = extractDna(recipe);
    const text = embeddingText(recipe, dna);
    const vector = await embed(text, env);
    if (!vector || vector.length !== EMBED_DIMS) return;
    const id = await chunkId([email, 'recipe', String(recipe.id)]);
    await env.MEMORY_RECIPES.upsert([{
      id,
      values: vector,
      metadata: {
        email,
        ts: Date.now(),
        recipeId: String(recipe.id),
        title: recipe.title.slice(0, 200),
        cuisineTags: dna.cuisineTags,
        prepStyles: dna.prepStyles,
        proteins: dna.proteins,
        totalMin: dna.totalMin,
        complexity: dna.complexity,
        signal
      }
    }]);
  } catch (err) {
    console.warn('recordApprovedRecipe failed:', err?.message || err);
  }
}

// ---------- reads ----------

// Retrieve a compact memory snapshot for `email` keyed off the current
// user query. Returns { messages, recipes } each capped at TOP_K with
// the score and metadata the prompt-builder needs.
export async function getMemorySnapshot(env, { email, query }) {
  if (!email || !query || !env?.MEMORY_CONVERSATIONS || !env?.MEMORY_RECIPES) {
    return { messages: [], recipes: [] };
  }

  let vector;
  try {
    vector = await embed(query, env);
  } catch (err) {
    console.warn('memory query embed failed:', err?.message || err);
    return { messages: [], recipes: [] };
  }
  if (!vector) return { messages: [], recipes: [] };

  const [msgRes, recipeRes] = await Promise.allSettled([
    env.MEMORY_CONVERSATIONS.query(vector, {
      topK: TOP_K,
      filter: { email: { $eq: email } },
      returnMetadata: 'all'
    }),
    env.MEMORY_RECIPES.query(vector, {
      topK: TOP_K,
      filter: { email: { $eq: email } },
      returnMetadata: 'all'
    })
  ]);

  return {
    messages: shape(msgRes),
    recipes: shape(recipeRes)
  };
}

function shape(settled) {
  if (settled.status !== 'fulfilled') {
    if (settled.reason) console.warn('memory query failed:', settled.reason?.message || settled.reason);
    return [];
  }
  return (settled.value?.matches || []).map(m => ({
    score: m.score,
    ...m.metadata
  }));
}
