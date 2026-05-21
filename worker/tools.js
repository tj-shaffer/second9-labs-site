// Tool schemas + dispatcher for Gemini's function-calling loop.
// Phase 6: Gemini drives conversation, Claude Opus 4.7 authors the recipe.
// Spoonacular has been demoted to a background cross-reference only.

import { generateRecipe } from './recipe-author.js';
import { generateRecipeImage } from './image-gen.js';
import {
  buildCacheKey,
  getCachedRecipe,
  putCachedRecipe,
  putCachedRecipeById
} from './recipe-cache.js';
import { crossReference } from './cross-reference.js';
import { getCorpusSnapshot } from './memory.js';

export const TOOL_DECLARATIONS = [
  {
    name: 'generate_recipe',
    description:
      "Generate one complete recipe matching the user's request. " +
      'Always call this when the user expresses what they want to cook ' +
      '(free-text like "make me something cozy", a specific dish, a vibe). ' +
      'You are not searching a catalog — a separate expert chef authors the recipe.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            "The user's request distilled to a short culinary brief, e.g. " +
            '"Sichuan chicken with cumin oil", "cozy weeknight pasta", ' +
            '"vegetarian sheet-pan dinner". Keep it 4–12 words.'
        }
      },
      required: ['query']
    }
  }
];

export async function dispatch(name, args, env, dispatchCtx = {}) {
  if (name !== 'generate_recipe') {
    return { error: `Unknown tool: ${name}` };
  }

  const query = String(args?.query || '').trim();
  if (!query) {
    return { error: 'query is required' };
  }

  const { preferences = {}, executionCtx, userEmail = null } = dispatchCtx;
  const cacheKey = await buildCacheKey(query, preferences);

  let recipe = await getCachedRecipe(env, cacheKey);
  let fromCache = Boolean(recipe);

  if (!recipe) {
    // Phase 8: pull the user's trusted-source corpus and pass it to
    // the author so it can channel their cookbook. Authed only —
    // anonymous users get an empty snapshot, which is a no-op.
    const corpusSnapshot = userEmail
      ? await getCorpusSnapshot(env, { email: userEmail, query }).catch(() => [])
      : [];
    recipe = await generateRecipe({ query, preferences, env, corpusSnapshot });

    const imageUrl = await generateRecipeImage({
      title: recipe.title,
      prompt: recipe.image_prompt,
      env
    });
    recipe.imageUrl = imageUrl;
    recipe.cachedAt = Date.now();

    await Promise.all([
      putCachedRecipe(env, cacheKey, recipe),
      putCachedRecipeById(env, recipe)
    ]);
  }

  if (executionCtx?.waitUntil) {
    executionCtx.waitUntil(crossReference(recipe, env));
  }

  return {
    recipe: {
      id: recipe.id,
      title: recipe.title,
      summary: recipe.summary,
      time: recipe.time,
      servings: recipe.servings,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      cuisine_tags: recipe.cuisine_tags,
      imageUrl: recipe.imageUrl || null
    },
    fromCache
  };
}
