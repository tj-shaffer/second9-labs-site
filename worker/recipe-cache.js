// KV-backed recipe cache. Keyed by sha256(normalized_query + preferences)
// so the same ask returns the same recipe + photo without burning tokens
// or image-gen dollars.
//
// Lives in the existing BIBA_USERS namespace with a `recipe:cache:`
// prefix to avoid spinning up a second namespace.

const RECIPE_TTL_S = 60 * 60 * 24 * 30; // 30 days

export async function getCachedRecipe(env, key) {
  if (!env?.BIBA_USERS || !key) return null;
  const raw = await env.BIBA_USERS.get(`recipe:cache:${key}`);
  if (!raw) return null;
  try { return JSON.parse(raw); }
  catch { return null; }
}

export async function putCachedRecipe(env, key, recipe) {
  if (!env?.BIBA_USERS || !key || !recipe) return;
  await env.BIBA_USERS.put(
    `recipe:cache:${key}`,
    JSON.stringify(recipe),
    { expirationTtl: RECIPE_TTL_S }
  );
}

export async function getCachedRecipeById(env, recipeId) {
  if (!env?.BIBA_USERS || !recipeId) return null;
  const raw = await env.BIBA_USERS.get(`recipe:byid:${recipeId}`);
  if (!raw) return null;
  try { return JSON.parse(raw); }
  catch { return null; }
}

export async function putCachedRecipeById(env, recipe) {
  if (!env?.BIBA_USERS || !recipe?.id) return;
  await env.BIBA_USERS.put(
    `recipe:byid:${recipe.id}`,
    JSON.stringify(recipe),
    { expirationTtl: RECIPE_TTL_S }
  );
}

// Stable key from the user's query + the subset of preferences that
// actually affect the recipe (intolerances, diet, dislikes,
// householdSize). Organic-leaning is a soft signal so we leave it out
// of the cache key — same dish, organic prompt nudge tolerated.
export async function buildCacheKey(query, preferences = {}) {
  const norm = String(query || '').toLowerCase().trim().replace(/\s+/g, ' ');
  const relevant = {
    diet: (preferences.diet || []).slice().sort(),
    intolerances: (preferences.intolerances || []).slice().sort(),
    dislikes: String(preferences.dislikes || '').trim().toLowerCase(),
    householdSize: preferences.householdSize ?? 2
  };
  const data = new TextEncoder().encode(norm + '|' + JSON.stringify(relevant));
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}
