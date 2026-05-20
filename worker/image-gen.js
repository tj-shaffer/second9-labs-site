// Imagen 4 client via the Gemini API.
// Generates one square food photo per call, caches it in R2 forever
// (keyed by sha256(title|prompt)), and returns a worker-served URL.
//
// Docs: https://ai.google.dev/gemini-api/docs/imagen
// Endpoint: imagen-4.0-fast-generate-001:predict (best speed/cost for food).

const MODEL = 'imagen-4.0-fast-generate-001';
const BASE = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:predict`;

// Generate (or fetch from cache) a recipe photo. Returns a string URL
// pointing at the worker's /api/recipe-image/<key> endpoint.
// Never throws — returns null if generation fails so the caller can
// still serve the recipe text-only.
export async function generateRecipeImage({ title, prompt, env }) {
  if (!env?.BIBA_RECIPE_IMAGES) return null;
  if (!env?.GEMINI_API_KEY) return null;

  const key = await cacheKey(title, prompt);

  const existing = await env.BIBA_RECIPE_IMAGES.head(key);
  if (existing) {
    return `/api/recipe-image/${key}`;
  }

  const fullPrompt = buildFoodPrompt(title, prompt);

  let bytes;
  try {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        instances: [{ prompt: fullPrompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: '1:1',
          personGeneration: 'dont_allow'
        }
      })
    });
    if (!res.ok) {
      console.warn('imagen', res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const data = await res.json();
    const b64 = data?.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) return null;
    bytes = base64ToBytes(b64);
  } catch (err) {
    console.warn('imagen fetch failed:', err);
    return null;
  }

  await env.BIBA_RECIPE_IMAGES.put(key, bytes, {
    httpMetadata: { contentType: 'image/png' }
  });

  return `/api/recipe-image/${key}`;
}

// Serve a cached image. Returns Response or 404.
export async function serveRecipeImage(env, key) {
  if (!env?.BIBA_RECIPE_IMAGES || !key) {
    return new Response('Not Found', { status: 404 });
  }
  const obj = await env.BIBA_RECIPE_IMAGES.get(key);
  if (!obj) return new Response('Not Found', { status: 404 });
  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType || 'image/png',
      'cache-control': 'public, max-age=31536000, immutable'
    }
  });
}

async function cacheKey(title, prompt) {
  const data = new TextEncoder().encode(`${title}|${prompt}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('') + '.png';
}

function buildFoodPrompt(title, prompt) {
  const base = (prompt || title).trim();
  return `${base}. Photorealistic overhead food photography, natural daylight, shallow depth of field, rustic wooden surface, no text, no people, no hands.`;
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
