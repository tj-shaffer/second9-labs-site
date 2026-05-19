// Cloudflare Workers AI embedding wrapper.
//
// Default model: @cf/baai/bge-base-en-v1.5 (768 dimensions, free tier
// covers personal use). The same model must be used at query time and
// write time — different models produce incompatible vector spaces.
//
// All Vectorize indexes in this project are sized at 768 dims to match.

const MODEL = '@cf/baai/bge-base-en-v1.5';

export async function embed(text, env) {
  if (!env?.AI) {
    throw new Error('Workers AI binding (env.AI) not configured');
  }
  const clean = String(text || '').trim();
  if (!clean) return null;

  const result = await env.AI.run(MODEL, { text: clean });
  // Workers AI returns { shape: [1, 768], data: [[...]] } for single inputs
  // and { shape: [N, 768], data: [[...], ...] } for arrays.
  const vector = Array.isArray(result?.data?.[0]) ? result.data[0] : null;
  if (!vector || vector.length === 0) {
    throw new Error('Workers AI returned empty embedding');
  }
  return vector;
}

export async function embedBatch(texts, env) {
  if (!env?.AI) {
    throw new Error('Workers AI binding (env.AI) not configured');
  }
  const cleanTexts = (texts || []).map(t => String(t || '').trim()).filter(Boolean);
  if (cleanTexts.length === 0) return [];

  const result = await env.AI.run(MODEL, { text: cleanTexts });
  return Array.isArray(result?.data) ? result.data : [];
}

export const EMBED_MODEL = MODEL;
export const EMBED_DIMS = 768;
