// Instacart cart provider — official Recipe API.
//
// Calls the Instacart Developer Platform's Create Recipe Page endpoint:
//   POST https://connect.instacart.com/idp/v1/products/recipe
// Returns a `products_link_url` the user opens to land on Instacart with the
// recipe pre-loaded as a shoppable cart, signed into their own residential
// session — zero CAPTCHAs, zero stored credentials.
//
// Docs: https://docs.instacart.com/developer_platform_api/api/products/create_recipe_page
//
// Requires INSTACART_API_KEY (Bearer token from Instacart Developer Platform
// signup). Without it, this provider throws — there is no public-search
// fallback in the post-pivot architecture.

const RECIPE_API_URL = 'https://connect.instacart.com/idp/v1/products/recipe';

// Units Instacart accepts in `measurements[].unit`. Map our common aliases to
// the canonical form. Anything unknown is sent through as-is — the API will
// best-effort match against the catalog.
const UNIT_ALIASES = {
  tbsp: 'tablespoon',
  tbsps: 'tablespoon',
  tablespoons: 'tablespoon',
  tsp: 'teaspoon',
  tsps: 'teaspoon',
  teaspoons: 'teaspoon',
  oz: 'ounce',
  ozs: 'ounce',
  ounces: 'ounce',
  lb: 'pound',
  lbs: 'pound',
  pounds: 'pound',
  cups: 'cup',
  pints: 'pint',
  quarts: 'quart',
  gallons: 'gallon',
  grams: 'gram',
  g: 'gram',
  kg: 'kilogram',
  ml: 'milliliter',
  milliliters: 'milliliter',
  l: 'liter',
  liters: 'liter',
  cloves: 'each',
  pieces: 'each',
  pcs: 'each',
  large: 'each',
  medium: 'each',
  small: 'each'
};

export default {
  id: 'instacart',
  name: 'Instacart',
  description: 'One-tap to a pre-loaded shoppable cart at your local store.',
  mode: 'cart',

  async buildLink(recipe, env, opts = {}) {
    if (!env?.INSTACART_API_KEY) {
      throw new Error('INSTACART_API_KEY is not set on the Worker.');
    }
    if (!recipe || !Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
      throw new Error('Recipe has no ingredients to map to a cart.');
    }

    const body = buildRequestBody(recipe, opts);
    const res = await fetch(RECIPE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.INSTACART_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      throw new Error(`Instacart Recipe API ${res.status}: ${detail}`);
    }
    const data = await res.json();
    if (!data?.products_link_url) {
      throw new Error('Instacart Recipe API returned no products_link_url.');
    }
    return { url: data.products_link_url, mode: 'cart' };
  }
};

function buildRequestBody(recipe, { preferences = {}, partnerLinkbackUrl } = {}) {
  const body = {
    title: recipe.title,
    ingredients: recipe.ingredients.map(i => mapIngredient(i, preferences)),
    expires_in: 30
  };

  if (recipe.imageUrl) body.image_url = recipe.imageUrl;
  if (recipe.servings) body.servings = recipe.servings;
  if (recipe.time?.total_min) body.cooking_time = recipe.time.total_min;
  if (Array.isArray(recipe.instructions) && recipe.instructions.length) {
    body.instructions = recipe.instructions;
  }
  body.author = 'Biba';

  const landing = {};
  if (partnerLinkbackUrl) landing.partner_linkback_url = partnerLinkbackUrl;
  landing.enable_pantry_items = true;
  body.landing_page_configuration = landing;

  return body;
}

function mapIngredient(ing, preferences) {
  const out = { name: String(ing.name || '').trim() };
  if (!out.name) return out;

  const qty = Number(ing.qty);
  if (Number.isFinite(qty) && qty > 0) {
    out.measurements = [{
      quantity: qty,
      unit: normalizeUnit(ing.unit)
    }];
  }

  if (preferences.organic) {
    out.filters = { health_filters: ['ORGANIC'] };
  }
  return out;
}

function normalizeUnit(raw) {
  if (!raw) return 'each';
  const key = String(raw).trim().toLowerCase();
  return UNIT_ALIASES[key] || key;
}
