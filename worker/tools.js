// Tool schemas + dispatcher for Gemini function-calling.
// Tools talk to Spoonacular; the LLM calls them via function declarations.

import { searchRecipes, getRecipeDetails } from './recipes.js';

// Gemini function-declaration format (OpenAPI 3.0 subset, lowercase types).
export const TOOL_DECLARATIONS = [
  {
    name: 'search_recipes',
    description:
      "Search a real recipe database for dishes matching the user's request. " +
      'Use this whenever the user asks for ideas, has finished the guided wizard, ' +
      'or asks for alternatives. Never invent recipes — always call this.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Natural-language search query, e.g. "creamy mushroom pasta", ' +
            '"quick weeknight chicken", "no-cook summer dinner". Keep it short and specific.'
        },
        diet: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Dietary tags the recipe must satisfy. Allowed values: ' +
            '"vegetarian", "vegan", "gluten free", "ketogenic", "paleo", "pescetarian", "primal", "whole30", "lacto vegetarian", "ovo vegetarian", "low FODMAP".'
        },
        intolerances: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Ingredient categories to exclude entirely. Allowed values: ' +
            '"dairy", "egg", "gluten", "grain", "peanut", "seafood", "sesame", "shellfish", "soy", "sulfite", "tree nut", "wheat".'
        },
        maxReadyTime: {
          type: 'integer',
          description: 'Maximum total time in minutes (prep + cook).'
        },
        cuisine: {
          type: 'string',
          description: 'Optional cuisine filter, e.g. "italian", "mexican", "thai", "japanese".'
        },
        number: {
          type: 'integer',
          description: 'How many recipes to return. Default 3. Maximum 5.'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'get_recipe_details',
    description:
      'Fetch the full ingredient list and step-by-step instructions for one recipe. ' +
      'Call this once the user has chosen a specific recipe from a previous search.',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'integer',
          description: 'The Spoonacular recipe ID, as returned by search_recipes.'
        }
      },
      required: ['id']
    }
  }
];

// Dispatch a tool call by name. Returns the raw JSON object to send back to Gemini
// as a functionResponse. Caller should JSON-stringify if needed.
export async function dispatch(name, args, env) {
  if (name === 'search_recipes') {
    const recipes = await searchRecipes(env.SPOONACULAR_API_KEY, {
      query: args.query,
      diet: args.diet,
      intolerances: args.intolerances,
      maxReadyTime: args.maxReadyTime,
      cuisine: args.cuisine,
      number: clamp(args.number ?? 3, 1, 5)
    });
    return { recipes };
  }

  if (name === 'get_recipe_details') {
    const recipe = await getRecipeDetails(env.SPOONACULAR_API_KEY, args.id);
    return { recipe };
  }

  return { error: `Unknown tool: ${name}` };
}

function clamp(n, min, max) {
  n = Math.floor(Number(n));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}
