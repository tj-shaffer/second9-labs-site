// Personal cookbook ingestion pipeline.
//
// MVP supports two inputs: paste-text and URL. PDFs and image OCR are
// deferred — they require additional libraries / Workers AI vision models
// and aren't load-bearing for v1.
//
// Pipeline:
//   1. Extract text (paste = identity; URL = fetch + strip HTML)
//   2. Gemini segments the text into individual recipes via tool-use
//   3. Each recipe normalized to the same schema as authored recipes
//   4. Each recipe embedded with the bge-base model and upserted to the
//      MEMORY_CORPUS Vectorize index, scoped per-user
//   5. The source manifest (id, title, recipe count, original text head)
//      is written to KV under `corpus:source:<email>:<sourceId>` so the
//      cookbook UI can list and delete sources
//
// Auth required — all writes carry the user's email in Vectorize metadata.

import { embed, EMBED_DIMS } from './embed.js';
import { embeddingText, extractDna } from './recipe-dna.js';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL = 'gemini-2.5-pro';
const MAX_RECIPES_PER_SOURCE = 20;
const MAX_RAW_BYTES = 200_000; // 200KB cap on stored raw text per source

const SEGMENT_TOOL = {
  name: 'record_segmented_recipes',
  description:
    'Record every distinct recipe extracted from the provided source document. ' +
    'You MUST call this exactly once. Skip headers, intros, ads, and prose that ' +
    'is not itself a recipe.',
  parameters: {
    type: 'object',
    properties: {
      sourceTitle: {
        type: 'string',
        description: 'A short human-readable title for the source as a whole (e.g. cookbook name, blog post title).'
      },
      recipes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            summary: { type: 'string', description: 'One sentence describing the dish.' },
            time: {
              type: 'object',
              properties: {
                prep_min: { type: 'integer' },
                cook_min: { type: 'integer' },
                total_min: { type: 'integer' }
              },
              required: ['total_min']
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
                required: ['name']
              }
            },
            instructions: { type: 'array', items: { type: 'string' } },
            cuisine_tags: { type: 'array', items: { type: 'string' } }
          },
          required: ['title', 'ingredients', 'instructions']
        }
      }
    },
    required: ['sourceTitle', 'recipes']
  }
};

const SEGMENT_SYSTEM = [
  "You parse a document the user trusts (cookbook excerpt, blog post, pasted notes) into individual recipes.",
  "Rules:",
  "- Skip prose that isn't itself a recipe (intros, author bios, ads, headers).",
  "- One real recipe per array entry. Do not invent recipes that aren't in the source.",
  "- If quantities are missing in the source, infer the minimum that makes the recipe cookable. Don't pad with prose.",
  "- Always call `record_segmented_recipes` exactly once. Never reply with free text."
].join('\n');

// ---------- public entry points ----------

export async function ingestPaste({ email, text, env }) {
  return ingest({ email, sourceKind: 'paste', sourceRef: null, raw: text, env });
}

export async function ingestUrl({ email, url, env }) {
  const raw = await fetchAndStrip(url);
  return ingest({ email, sourceKind: 'url', sourceRef: url, raw, env });
}

// ---------- pipeline ----------

async function ingest({ email, sourceKind, sourceRef, raw, env }) {
  if (!email) throw new Error('email required (auth)');
  if (!raw || raw.trim().length < 80) {
    throw new Error('source text too short to ingest (need at least ~80 chars)');
  }

  // Trim to avoid blowing up the Gemini context window. The first ~30K
  // chars of any reasonable document carries the recipes; longer docs
  // can be split client-side or ingested twice with different ranges.
  const trimmedRaw = raw.slice(0, 30_000);

  const { sourceTitle, recipes } = await segmentWithGemini(trimmedRaw, env);
  if (!recipes?.length) {
    throw new Error('No recipes recognized in source.');
  }

  const sourceId = await stableSourceId(email, sourceKind, sourceRef || sourceTitle, raw);
  const ingestedAt = Date.now();
  const stored = [];

  for (const r of recipes.slice(0, MAX_RECIPES_PER_SOURCE)) {
    if (!r?.title || !Array.isArray(r?.ingredients) || !Array.isArray(r?.instructions)) continue;

    const normalized = normalize(r);
    const dna = extractDna(normalized);
    const text = embeddingText(normalized, dna);

    const vector = await embed(text, env).catch(err => {
      console.warn('corpus embed failed for', normalized.title, err?.message || err);
      return null;
    });
    if (!vector || vector.length !== EMBED_DIMS) continue;

    const chunkId = await stableChunkId(email, sourceId, normalized.title);
    await env.MEMORY_CORPUS.upsert([{
      id: chunkId,
      values: vector,
      metadata: {
        email,
        sourceId,
        sourceKind,
        sourceRef: sourceRef || null,
        sourceTitle: sourceTitle.slice(0, 200),
        title: normalized.title.slice(0, 200),
        cuisineTags: dna.cuisineTags,
        proteins: dna.proteins,
        prepStyles: dna.prepStyles,
        totalMin: dna.totalMin,
        complexity: dna.complexity,
        ingredientsJson: JSON.stringify(normalized.ingredients).slice(0, 4000),
        instructionsJson: JSON.stringify(normalized.instructions).slice(0, 6000),
        ingestedAt
      }
    }]).catch(err => {
      console.warn('corpus upsert failed for', normalized.title, err?.message || err);
    });

    stored.push({ chunkId, title: normalized.title });
  }

  // Source manifest in KV so the cookbook UI can list + delete.
  if (env.BIBA_USERS && stored.length) {
    const manifest = {
      sourceId,
      sourceKind,
      sourceRef: sourceRef || null,
      sourceTitle,
      recipeCount: stored.length,
      chunks: stored.map(s => s.chunkId),
      rawHead: raw.slice(0, MAX_RAW_BYTES),
      ingestedAt
    };
    await env.BIBA_USERS.put(`corpus:source:${email}:${sourceId}`, JSON.stringify(manifest));
  }

  return { sourceId, sourceTitle, recipeCount: stored.length, titles: stored.map(s => s.title) };
}

async function segmentWithGemini(text, env) {
  if (!env?.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');

  const url = `${GEMINI_URL}/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;
  const body = {
    system_instruction: { parts: [{ text: SEGMENT_SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: `Source document:\n\n${text}` }] }],
    tools: [{ function_declarations: [SEGMENT_TOOL] }],
    tool_config: {
      function_calling_config: {
        mode: 'ANY',
        allowed_function_names: [SEGMENT_TOOL.name]
      }
    },
    generationConfig: { temperature: 0.2, maxOutputTokens: 6000 }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    throw new Error(`Gemini segment ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const fc = parts.find(p => p.functionCall?.name === SEGMENT_TOOL.name);
  if (!fc?.functionCall?.args) {
    throw new Error('Segmenter returned no recipes.');
  }
  return fc.functionCall.args;
}

// ---------- URL fetch + HTML strip ----------

async function fetchAndStrip(url) {
  let parsed;
  try { parsed = new URL(url); }
  catch { throw new Error('Invalid URL.'); }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http(s) URLs are supported.');
  }

  const res = await fetch(url, {
    headers: { 'user-agent': 'BibaPlayground/0.1 (cookbook-ingest)' },
    redirect: 'follow'
  });
  if (!res.ok) throw new Error(`Source fetch ${res.status} from ${url}`);

  const html = await res.text();
  return stripHtml(html);
}

function stripHtml(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------- shape helpers ----------

function normalize(r) {
  const time = r.time || {};
  return {
    title: String(r.title || '').trim(),
    summary: String(r.summary || '').trim(),
    time: {
      prep_min: int(time.prep_min, 0),
      cook_min: int(time.cook_min, 0),
      total_min: int(time.total_min, int(time.prep_min, 0) + int(time.cook_min, 0))
    },
    servings: int(r.servings, 2),
    ingredients: (r.ingredients || []).map(i => ({
      qty: typeof i?.qty === 'number' ? i.qty : 0,
      unit: String(i?.unit || ''),
      name: String(i?.name || '').trim()
    })).filter(i => i.name),
    instructions: (r.instructions || []).map(s => String(s || '').trim()).filter(Boolean),
    cuisine_tags: Array.isArray(r.cuisine_tags) ? r.cuisine_tags : []
  };
}

function int(v, fallback) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

async function stableSourceId(email, kind, ref, raw) {
  const seed = `${email}|${kind}|${ref || ''}|${raw.slice(0, 5000)}`;
  return (await sha256Hex(seed)).slice(0, 16);
}

async function stableChunkId(email, sourceId, title) {
  const seed = `${email}|${sourceId}|${title}`;
  return (await sha256Hex(seed)).slice(0, 48);
}

async function sha256Hex(s) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ---------- list + delete ----------

export async function listSources(env, email) {
  if (!env?.BIBA_USERS || !email) return [];
  const prefix = `corpus:source:${email}:`;
  const list = await env.BIBA_USERS.list({ prefix, limit: 100 });
  const out = [];
  for (const { name } of list.keys) {
    const raw = await env.BIBA_USERS.get(name);
    if (!raw) continue;
    try {
      const m = JSON.parse(raw);
      out.push({
        sourceId: m.sourceId,
        sourceKind: m.sourceKind,
        sourceRef: m.sourceRef,
        sourceTitle: m.sourceTitle,
        recipeCount: m.recipeCount,
        ingestedAt: m.ingestedAt
      });
    } catch { /* skip corrupt */ }
  }
  return out.sort((a, b) => (b.ingestedAt || 0) - (a.ingestedAt || 0));
}

export async function deleteSource(env, email, sourceId) {
  if (!env?.BIBA_USERS || !env?.MEMORY_CORPUS || !email || !sourceId) return false;
  const key = `corpus:source:${email}:${sourceId}`;
  const raw = await env.BIBA_USERS.get(key);
  if (!raw) return false;
  let manifest;
  try { manifest = JSON.parse(raw); } catch { return false; }

  // Delete every chunk in Vectorize, then the manifest in KV.
  if (Array.isArray(manifest.chunks) && manifest.chunks.length) {
    try {
      await env.MEMORY_CORPUS.deleteByIds(manifest.chunks);
    } catch (err) {
      console.warn('corpus deleteByIds failed:', err?.message || err);
    }
  }
  await env.BIBA_USERS.delete(key);
  return true;
}
