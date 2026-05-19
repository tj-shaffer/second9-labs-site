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
export async function runChat({ apiKey, model = DEFAULT_MODEL, system, contents, tools, env, dispatch, preferences, executionCtx, userEmail = null }) {
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
        const result = await dispatch(name, args || {}, env, { preferences, executionCtx, userEmail });
        toolResults.push({ name, args: args || {}, result });
        responseParts.push({ functionResponse: { name, response: result } });
      } catch (err) {
        const errMsg = String(err?.message || err);
        console.error(`dispatch(${name}) failed:`, errMsg);
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

// Build the system prompt for the Phase 6 LLM-author flow. Gemini drives
// the conversation; when the user signals what they want, Gemini calls
// `generate_recipe`, which routes server-side to Claude Opus 4.7 as the
// recipe author. Gemini does NOT search a catalog and does NOT invent
// recipes itself.
//
// `history` is an array of { recipeId, title, signal, at } from KV
// (most recent first). Phase 6 retired reaction buttons in favor of
// implicit signals: sent_to_cart = positive, asked_alternatives = soft
// negative.
export function buildSystemPrompt(preferences = {}, knownRecipes = [], history = [], memorySnapshot = null) {
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
    "## How recipes happen",
    "- You do NOT search a catalog and you do NOT invent a recipe in prose.",
    "- When the user has expressed what they want (free-text or guided-wizard answers), call `generate_recipe` with a short culinary brief. An expert chef authors the full recipe server-side and the frontend renders the card.",
    "- Do not list options. One recipe per ask.",
    "- After `generate_recipe` returns, introduce the dish in 1–2 warm sentences. Don't restate ingredients or steps — the card shows them.",
    "- If the user asks for alternatives or 'something else', call `generate_recipe` again with a different angle (different cuisine, different protein, different effort level). This counts as a soft negative signal — pivot meaningfully, don't recycle."
  ];

  if (decisiveMode) {
    lines.push(
      "",
      "**DECISIVE MODE is ON.** Skip clarifying questions when you have enough to commit. If the user said 'something cozy', commit on the first generate_recipe call — don't ask 'soup or stew?' first."
    );
  }

  lines.push(
    "",
    "## Constraints to pass into `generate_recipe.query`",
    `- Household size: ${householdSize} ${householdSize === 1 ? 'person' : 'people'}.`
  );

  if (organic) {
    lines.push("- Phrase the brief to favor whole-food, organic-friendly ingredients when natural — never force it.");
  }
  if (diet.length) {
    lines.push(`- Dietary requirement (absolute): ${diet.join(', ')}. Bake into the query.`);
  }
  if (intolerances.length) {
    lines.push(`- Intolerances (absolute, must avoid): ${intolerances.join(', ')}. Bake into the query.`);
  }
  if (dislikes && dislikes.trim()) {
    lines.push(`- User dislikes: ${dislikes.trim()}. Avoid dishes that lean on these.`);
  }

  lines.push(
    "",
    "## Tone",
    "Warm, specific, not gushy. No emojis unless the user uses one first. Refer to dishes by name."
  );

  if (Array.isArray(knownRecipes) && knownRecipes.length) {
    lines.push(
      "",
      "## Recipes already shown in this conversation",
      "Don't re-author the same dish. If asked for variations, call generate_recipe with a varied brief."
    );
    for (const r of knownRecipes) {
      if (r && r.id && r.title) {
        lines.push(`- id=${r.id} — "${r.title}"`);
      }
    }
  }

  if (Array.isArray(history) && history.length) {
    const liked = history.filter(h => h.signal === 'sent_to_cart').slice(0, 10);
    const passed = history.filter(h => h.signal === 'asked_alternatives').slice(0, 10);
    if (liked.length || passed.length) {
      lines.push(
        "",
        "## Implicit signals from past sessions",
        "Use these to steer the brief. Don't mention the list — just let it shape what you ask for."
      );
      if (liked.length)  lines.push(`- Sent to cart (positive): ${liked.map(r => `"${r.title}"`).join(', ')}`);
      if (passed.length) lines.push(`- Asked for alternatives (soft negative): ${passed.map(r => `"${r.title}"`).join(', ')} — avoid close variants.`);
    }
  }

  // Vectorize-retrieved memory snapshot. Distinct from `history` —
  // these are semantically relevant chunks pulled by the current user
  // query, not a chronological list. Format as gentle context, not as
  // instructions to recite.
  if (memorySnapshot) {
    const msgs = (memorySnapshot.messages || []).filter(m => m.text);
    const recs = (memorySnapshot.recipes || []).filter(r => r.title);
    if (msgs.length || recs.length) {
      lines.push("", "## What you remember about this person",
        "Semantic recall from past sessions. Let it shape your culinary brief; don't recite it.");
      if (msgs.length) {
        lines.push("Things they've said before:");
        for (const m of msgs) lines.push(`- "${String(m.text).slice(0, 200)}"`);
      }
      if (recs.length) {
        lines.push("Recipes they actually cooked (sent-to-cart):");
        for (const r of recs) {
          const tags = [r.cuisineTags, r.proteins, r.prepStyles].flat().filter(Boolean).slice(0, 5).join(', ');
          lines.push(`- "${r.title}"${tags ? ` (${tags})` : ''}`);
        }
      }
    }
  }

  return lines.join('\n');
}
