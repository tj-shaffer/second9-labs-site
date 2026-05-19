// Gemini client with function-calling loop.
// Docs: https://ai.google.dev/gemini-api/docs/function-calling

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const MAX_TOOL_LOOPS = 5;

// Run a chat turn with optional tool use. Loops until the model returns
// a text-only response or we hit MAX_TOOL_LOOPS.
//
// Args:
//   apiKey      — Gemini API key
//   model       — model id (default 'gemini-2.5-flash')
//   system      — system instruction string (optional)
//   contents    — chat history in Gemini format: [{ role, parts: [{text}|{functionCall}|{functionResponse}] }]
//   tools       — array of function declarations from tools.js
//   env         — passed through to dispatch
//   dispatch    — async (name, args, env) => result, raises on failure
//
// Returns: { text, history, toolResults }
//   text         — final assistant text
//   history      — full updated history including all model + tool turns
//   toolResults  — list of { name, args, result } in call order
export async function runChat({ apiKey, model = DEFAULT_MODEL, system, contents, tools, env, dispatch }) {
  const url = `${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent`;
  const declarations = tools && tools.length ? [{ function_declarations: tools }] : undefined;

  const history = [...contents];
  const toolResults = [];

  for (let i = 0; i < MAX_TOOL_LOOPS; i++) {
    const body = {
      contents: history,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1200
      }
    };
    if (system) body.system_instruction = { parts: [{ text: system }] };
    if (declarations) body.tools = declarations;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = (await res.text()).slice(0, 400);
      throw new Error(`Gemini ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    if (!candidate) {
      throw new Error('Gemini returned no candidates: ' + JSON.stringify(data).slice(0, 400));
    }

    const parts = candidate.content?.parts || [];
    const functionCallParts = parts.filter(p => p.functionCall);

    if (functionCallParts.length === 0) {
      // Final text response.
      const text = parts.map(p => p.text || '').join('').trim();
      return { text, history, toolResults };
    }

    // Model wants to call tools. Append its turn to history.
    history.push({ role: 'model', parts });

    // Dispatch each call and collect responses.
    const responseParts = [];
    for (const part of functionCallParts) {
      const { name, args } = part.functionCall;
      try {
        const result = await dispatch(name, args || {}, env);
        toolResults.push({ name, args: args || {}, result });
        responseParts.push({ functionResponse: { name, response: result } });
      } catch (err) {
        const errMsg = String(err?.message || err);
        toolResults.push({ name, args: args || {}, error: errMsg });
        responseParts.push({
          functionResponse: { name, response: { error: errMsg } }
        });
      }
    }

    // Append the function response turn. Gemini's current convention uses role 'user'
    // for the turn carrying functionResponse parts back to the model.
    history.push({ role: 'user', parts: responseParts });
  }

  throw new Error(`Gemini tool loop exceeded ${MAX_TOOL_LOOPS} iterations`);
}

// Build a system prompt from the user's stored preferences and (optionally) the
// recipes they've already seen in this conversation, so the model can call
// get_recipe_details with the right ID without re-searching.
// `history` is an array of { recipeId, title, reaction } from KV (most recent first).
export function buildSystemPrompt(preferences = {}, knownRecipes = [], history = []) {
  const {
    organic = true,
    householdSize = 2,
    diet = [],
    intolerances = [],
    dislikes = '',
    decisiveMode = false
  } = preferences;

  const lines = [
    "You are a warm, focused kitchen helper for someone deciding what to cook tonight.",
    "Be concise and friendly. Two or three sentences per turn, never long monologues.",
    "",
    "## How to suggest recipes",
    "- Never invent recipes. Always call `search_recipes` to find real options."
  ];

  if (decisiveMode) {
    lines.push(
      "- **DECISIVE MODE is ON.** Don't list options. Pick the single best match for what the user said.",
      "- Sequence: call `search_recipes` with number=3 to see options, silently pick the strongest fit, then immediately call `get_recipe_details` for that ID. Introduce the chosen recipe in 1–2 warm sentences (don't mention the other candidates you considered).",
      "- If the user pushes back or asks for an alternative, pick a different one — again, just one. Never list."
    );
  } else {
    lines.push(
      "- After a search, briefly introduce 1–3 of the best results in plain prose. The recipe cards themselves render separately, so don't repeat full ingredient lists in your text.",
      "- If the user picks one by name (says 'let's do X', names a specific recipe, says 'yes to the carbonara'), you MUST call `get_recipe_details` to fetch ingredients & instructions. Look up the ID in the \"Recipes already shown\" list below — never ask the user to repeat themselves, never search for an ID you already have.",
      "- If you genuinely don't have the ID for a recipe the user names (e.g., they describe something new), call `search_recipes` with a short core query (e.g., \"carbonara\", not the full marketing title) and then `get_recipe_details` with the ID from that result.",
      "- If the user asks for alternatives, call `search_recipes` again with a different angle."
    );
  }

  lines.push(
    "",
    "## Filters to respect",
    `- Cooking for ${householdSize} ${householdSize === 1 ? 'person' : 'people'}.`
  );

  if (organic) {
    lines.push(
      "- Lean toward whole-food, organic-friendly ingredients when there's a choice. Search queries should favor 'fresh', 'whole', or 'farm' phrasings when natural; don't be heavy-handed.",
    );
  }
  if (diet.length) {
    lines.push(`- Dietary requirement: ${diet.join(', ')}. Pass these to \`search_recipes\` via the \`diet\` parameter.`);
  }
  if (intolerances.length) {
    lines.push(`- Intolerances (must avoid): ${intolerances.join(', ')}. Pass these to \`search_recipes\` via the \`intolerances\` parameter — never skip.`);
  }
  if (dislikes && dislikes.trim()) {
    lines.push(`- The user dislikes: ${dislikes.trim()}. Avoid recipes that lean on these ingredients.`);
  }

  lines.push(
    "",
    "## Tone",
    "Warm, specific, not gushy. No emojis unless the user uses one first. Refer to recipes by name; don't say 'recipe #1', 'option A', etc."
  );

  if (Array.isArray(knownRecipes) && knownRecipes.length) {
    lines.push(
      "",
      "## Recipes already shown to the user in this conversation",
      "(Use these IDs directly when calling get_recipe_details — do not search again for these.)"
    );
    for (const r of knownRecipes) {
      if (r && r.id && r.title) {
        lines.push(`- id=${r.id} — "${r.title}"`);
      }
    }
  }

  // Memory: surface a compact view of past reactions so the model can lean toward
  // what the user has loved and avoid recipes they've skipped.
  if (Array.isArray(history) && history.length) {
    const loved = history.filter(h => h.reaction === 'loved').slice(0, 10);
    const liked = history.filter(h => h.reaction === 'liked').slice(0, 10);
    const skipped = history.filter(h => h.reaction === 'skipped').slice(0, 10);

    if (loved.length || liked.length || skipped.length) {
      lines.push(
        "",
        "## What the user has told you about past recipes",
        "Use this to steer suggestions. Don't mention the list verbatim; just let it shape your picks."
      );
      if (loved.length)   lines.push(`- Loved: ${loved.map(r => `"${r.title}"`).join(', ')}`);
      if (liked.length)   lines.push(`- Liked: ${liked.map(r => `"${r.title}"`).join(', ')}`);
      if (skipped.length) lines.push(`- Skip next time: ${skipped.map(r => `"${r.title}"`).join(', ')} — do not suggest these or close variants.`);
    }
  }

  return lines.join('\n');
}
