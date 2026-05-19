// Spoonacular Recipe API client.
// Docs: https://spoonacular.com/food-api/docs

const BASE = 'https://api.spoonacular.com';

// Search for recipes matching a free-text query and optional filters.
// Returns a compact array safe for the LLM to reason about.
export async function searchRecipes(apiKey, params = {}) {
  const url = new URL(BASE + '/recipes/complexSearch');
  url.searchParams.set('apiKey', apiKey);
  url.searchParams.set('number', String(params.number ?? 3));
  url.searchParams.set('addRecipeInformation', 'true');
  url.searchParams.set('fillIngredients', 'true');
  url.searchParams.set('instructionsRequired', 'true');
  url.searchParams.set('sort', 'popularity');

  if (params.query) url.searchParams.set('query', params.query);
  if (params.diet && params.diet.length) url.searchParams.set('diet', params.diet.join(','));
  if (params.intolerances && params.intolerances.length) {
    url.searchParams.set('intolerances', params.intolerances.join(','));
  }
  if (params.maxReadyTime) url.searchParams.set('maxReadyTime', String(params.maxReadyTime));
  if (params.cuisine) url.searchParams.set('cuisine', params.cuisine);
  if (params.type) url.searchParams.set('type', params.type);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Spoonacular search failed: ${res.status} ${await safeText(res)}`);
  }
  const data = await res.json();
  return (data.results || []).map(summarize);
}

// Fetch full details (ingredients + instructions) for a single recipe.
export async function getRecipeDetails(apiKey, id) {
  const url = new URL(`${BASE}/recipes/${encodeURIComponent(id)}/information`);
  url.searchParams.set('apiKey', apiKey);
  url.searchParams.set('includeNutrition', 'false');

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Spoonacular details failed: ${res.status} ${await safeText(res)}`);
  }
  const r = await res.json();
  return {
    id: r.id,
    title: r.title,
    image: r.image,
    sourceUrl: r.sourceUrl,
    readyInMinutes: r.readyInMinutes,
    servings: r.servings,
    summary: stripHtml(r.summary || ''),
    ingredients: (r.extendedIngredients || []).map(i => ({
      name: i.name,
      qty: i.measures?.us?.amount ?? i.amount ?? null,
      unit: i.measures?.us?.unitShort ?? i.unit ?? '',
      original: i.original
    })),
    instructions: extractInstructions(r),
    diets: r.diets || [],
    dishTypes: r.dishTypes || []
  };
}

// Compact summary used in search results (less data → fewer LLM tokens).
function summarize(r) {
  return {
    id: r.id,
    title: r.title,
    image: r.image,
    readyInMinutes: r.readyInMinutes,
    servings: r.servings,
    sourceUrl: r.sourceUrl,
    summary: stripHtml(r.summary || '').slice(0, 240),
    diets: r.diets || [],
    dishTypes: r.dishTypes || []
  };
}

function extractInstructions(r) {
  if (Array.isArray(r.analyzedInstructions) && r.analyzedInstructions.length) {
    return r.analyzedInstructions
      .flatMap(group => group.steps || [])
      .map(step => step.step)
      .filter(Boolean);
  }
  if (typeof r.instructions === 'string' && r.instructions.trim()) {
    return stripHtml(r.instructions).split(/\.\s+/).map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function stripHtml(s) {
  return String(s).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

async function safeText(res) {
  try { return (await res.text()).slice(0, 200); } catch { return ''; }
}
