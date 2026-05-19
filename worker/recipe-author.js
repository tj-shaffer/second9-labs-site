// Recipe author. Two backends:
//
//   - Claude Opus 4.7 (default): Anthropic Messages API with forced
//     `record_recipe` tool call. Strongest culinary reasoning; needs
//     ANTHROPIC_API_KEY + active Anthropic credit balance.
//
//   - Gemini 2.5 Pro (fallback): set `RECIPE_AUTHOR=gemini` in env.
//     Reuses GEMINI_API_KEY. Use this when Anthropic credits are
//     unavailable or you want a cheaper author.
//
// Both backends emit the same shape: { title, summary, time, servings,
// ingredients, instructions, image_prompt, cuisine_tags }.
//
// Caching note: prompt caching on Opus 4.7 needs a >= 4096-token prefix
// to actually cache. Our SYSTEM_PROMPT_BASE is shorter than that today,
// so the `cache_control` marker is harmless but won't yield a cache hit
// until the prompt grows (e.g. when corpus snippets land in Phase 8).

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-opus-4-7';
const ANTHROPIC_VERSION = '2023-06-01';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL = 'gemini-2.5-pro';

const TOOL_NAME = 'record_recipe';

const RECIPE_TOOL = {
  name: TOOL_NAME,
  description:
    'Record a complete, structured recipe for the user. ' +
    'You MUST call this exactly once. Never reply with free-form text.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: {
        type: 'string',
        description: 'Short, evocative recipe name (≤ 60 chars).'
      },
      summary: {
        type: 'string',
        description: 'One-sentence description of the dish and what makes it good tonight.'
      },
      time: {
        type: 'object',
        additionalProperties: false,
        properties: {
          prep_min: { type: 'integer', minimum: 0 },
          cook_min: { type: 'integer', minimum: 0 },
          total_min: { type: 'integer', minimum: 1 }
        },
        required: ['prep_min', 'cook_min', 'total_min']
      },
      servings: { type: 'integer', minimum: 1, maximum: 24 },
      ingredients: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            qty: { type: 'number', description: 'Numeric quantity. Use 0 for "to taste" items.' },
            unit: { type: 'string', description: 'US unit: tsp, tbsp, cup, oz, lb, clove, etc. Empty string if unitless.' },
            name: { type: 'string', description: 'Ingredient name as it would appear in a grocery search.' }
          },
          required: ['qty', 'unit', 'name']
        }
      },
      instructions: {
        type: 'array',
        minItems: 2,
        items: { type: 'string', description: 'One numbered step. Imperative voice, concrete actions.' }
      },
      image_prompt: {
        type: 'string',
        description: 'Short prompt for an Imagen-style photo generator. Describe the finished plated dish only — no chef, no hands, no text.'
      },
      cuisine_tags: {
        type: 'array',
        items: { type: 'string' },
        description: '1–4 lowercase cuisine or technique tags (e.g. "sichuan", "weeknight", "one-pan").'
      }
    },
    required: [
      'title', 'summary', 'time', 'servings',
      'ingredients', 'instructions', 'image_prompt', 'cuisine_tags'
    ]
  }
};

const SYSTEM_PROMPT_BASE =
  "You are an expert home chef and recipe author. The user describes what they want to cook tonight, " +
  "and you author one complete, accurate, cookable recipe — not a list of options, not a search summary. " +
  "You are not browsing a catalog; you are writing from working culinary knowledge.\n\n" +
  "## Authoring rules\n" +
  "- Be specific. 'Sichuan chicken' is a category — pick a real dish (mapo, kung pao, chongqing) and commit.\n" +
  "- Quantities must be plausible. A real cook should be able to follow them and produce dinner.\n" +
  "- Respect intolerances absolutely. If the user is allergic to peanuts, do not write a peanut sauce.\n" +
  "- Respect dietary requirements absolutely (vegetarian, vegan, gluten-free, etc.).\n" +
  "- Lean toward whole-food, organic-friendly phrasing when the user has that preference, but never force it.\n" +
  "- Honor household size — scale ingredients to match.\n\n" +
  "## Output\n" +
  "Always call the `record_recipe` tool exactly once with the full structured recipe. Do not narrate, do not " +
  "apologize, do not introduce the recipe in prose. The tool call IS the response. The frontend renders " +
  "the structured fields directly.\n\n" +
  "## Tone for the `summary` field\n" +
  "Warm, specific, not gushy. One sentence. Refer to the dish by name. No emojis.";

export async function generateRecipe({ query, preferences = {}, env }) {
  if (!query || typeof query !== 'string') {
    throw new Error('query is required');
  }

  const useGemini = env?.RECIPE_AUTHOR === 'gemini' || !env?.ANTHROPIC_API_KEY;
  const recipe = useGemini
    ? await authorViaGemini({ query, preferences, env })
    : await authorViaClaude({ query, preferences, env });

  return {
    id: await stableId(query, recipe.title),
    ...recipe,
    authoredAt: Date.now()
  };
}

async function authorViaClaude({ query, preferences, env }) {
  const body = {
    model: ANTHROPIC_MODEL,
    max_tokens: 2000,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT_BASE,
        cache_control: { type: 'ephemeral' }
      }
    ],
    tools: [RECIPE_TOOL],
    tool_choice: { type: 'tool', name: TOOL_NAME },
    output_config: { effort: 'medium' },
    messages: [{ role: 'user', content: buildUserMessage(query, preferences) }]
  };

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': ANTHROPIC_VERSION
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = (await res.text()).slice(0, 500);
    throw new Error(`Anthropic ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const toolBlock = (data.content || []).find(
    b => b.type === 'tool_use' && b.name === TOOL_NAME
  );
  if (!toolBlock?.input) {
    throw new Error('Claude returned no tool_use block; refusing to fabricate a recipe.');
  }

  return { ...toolBlock.input, authorModel: ANTHROPIC_MODEL };
}

async function authorViaGemini({ query, preferences, env }) {
  if (!env?.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not set (required for Gemini fallback author)');
  }

  const url = `${GEMINI_URL}/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;
  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT_BASE }] },
    contents: [{ role: 'user', parts: [{ text: buildUserMessage(query, preferences) }] }],
    tools: [{ function_declarations: [geminiRecipeTool()] }],
    tool_config: {
      function_calling_config: {
        mode: 'ANY',
        allowed_function_names: [TOOL_NAME]
      }
    },
    generationConfig: { temperature: 0.7, maxOutputTokens: 2000 }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': env.GEMINI_API_KEY
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = (await res.text()).slice(0, 500);
    throw new Error(`Gemini ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const fc = parts.find(p => p.functionCall?.name === TOOL_NAME);
  if (!fc?.functionCall?.args) {
    throw new Error('Gemini returned no function_call; refusing to fabricate a recipe.');
  }
  return { ...fc.functionCall.args, authorModel: GEMINI_MODEL };
}

// Gemini's tool schema uses OpenAPI subset, which doesn't accept
// `additionalProperties` and requires `type` strings rather than nested
// JSON Schema. We hand-translate the Claude tool to that shape.
function geminiRecipeTool() {
  return {
    name: TOOL_NAME,
    description: RECIPE_TOOL.description,
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        summary: { type: 'string' },
        time: {
          type: 'object',
          properties: {
            prep_min: { type: 'integer' },
            cook_min: { type: 'integer' },
            total_min: { type: 'integer' }
          },
          required: ['prep_min', 'cook_min', 'total_min']
        },
        servings: { type: 'integer' },
        ingredients: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              qty: { type: 'number' },
              unit: { type: 'string' },
              name: { type: 'string' }
            },
            required: ['qty', 'unit', 'name']
          }
        },
        instructions: { type: 'array', items: { type: 'string' } },
        image_prompt: { type: 'string' },
        cuisine_tags: { type: 'array', items: { type: 'string' } }
      },
      required: [
        'title', 'summary', 'time', 'servings',
        'ingredients', 'instructions', 'image_prompt', 'cuisine_tags'
      ]
    }
  };
}

function buildUserMessage(query, preferences) {
  const lines = [`Tonight's ask: ${query}`];

  const {
    householdSize = 2,
    diet = [],
    intolerances = [],
    dislikes = '',
    organic = true
  } = preferences;

  lines.push('', `Cooking for: ${householdSize} ${householdSize === 1 ? 'person' : 'people'}.`);
  if (diet.length) lines.push(`Dietary: ${diet.join(', ')}.`);
  if (intolerances.length) lines.push(`Must avoid (intolerances): ${intolerances.join(', ')}.`);
  if (dislikes.trim()) lines.push(`User dislikes: ${dislikes.trim()}.`);
  if (organic) lines.push('Prefers whole-food, organic-friendly ingredients when it does not compromise the dish.');

  lines.push('', 'Author one recipe via the `record_recipe` tool.');
  return lines.join('\n');
}

async function stableId(query, title) {
  const data = new TextEncoder().encode(`${query}|${title}|${Date.now()}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}
