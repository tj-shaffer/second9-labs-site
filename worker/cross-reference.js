// Background cross-reference: fan out the LLM's generated recipe title
// against four public recipe databases and persist an aggregate signal
// to KV. The frontend polls /api/recipes/xref/:id to upgrade the recipe
// card with "verified against N similar recipes" once results land.
//
// Caller pattern (from tools.js):
//   ctx.waitUntil(crossReference(recipe, env));

import { crossRef as spoonacularCrossRef } from './db-clients/spoonacular.js';
import { crossRef as edamamCrossRef } from './db-clients/edamam.js';
import { crossRef as themealdbCrossRef } from './db-clients/themealdb.js';
import { crossRef as tastyCrossRef } from './db-clients/tasty.js';

const XREF_TTL_S = 60 * 60 * 24 * 30; // 30 days

export async function crossReference(recipe, env) {
  if (!recipe?.id || !recipe?.title || !env?.BIBA_USERS) return;

  const query = simplifyTitle(recipe.title);

  const settled = await Promise.allSettled([
    spoonacularCrossRef(query, env),
    edamamCrossRef(query, env),
    themealdbCrossRef(query, env),
    tastyCrossRef(query, env)
  ]);

  const sources = settled
    .map(s => (s.status === 'fulfilled' ? s.value : null))
    .filter(Boolean);

  const matchCount = sources.reduce((sum, s) => sum + (s.count || 0), 0);
  const bestImage = sources.map(s => s.sampleImage).find(Boolean) || null;

  const payload = {
    recipeId: recipe.id,
    query,
    matchCount,
    bestImage,
    sources: sources.map(s => ({ source: s.source, count: s.count })),
    at: Date.now()
  };

  await env.BIBA_USERS.put(
    `recipe:xref:${recipe.id}`,
    JSON.stringify(payload),
    { expirationTtl: XREF_TTL_S }
  );
}

export async function getCrossReference(env, recipeId) {
  if (!env?.BIBA_USERS || !recipeId) return null;
  const raw = await env.BIBA_USERS.get(`recipe:xref:${recipeId}`);
  if (!raw) return null;
  try { return JSON.parse(raw); }
  catch { return null; }
}

// Reduce the LLM's full title to its core dish concept so we get
// meaningful overlap with public databases. "Sichuan chicken with
// charred cumin oil and napa slaw" → "sichuan chicken".
function simplifyTitle(title) {
  return String(title)
    .toLowerCase()
    .split(/\s+(?:with|and|featuring|in a|over|for|on)\s+/i)[0]
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 4)
    .join(' ');
}
