// Edamam Recipe Search API client.
// Docs: https://developer.edamam.com/edamam-docs-recipe-api
//
// Used only as a cross-reference signal in Phase 6 — never the
// authoritative recipe source.

const BASE = 'https://api.edamam.com/api/recipes/v2';

export async function crossRef(query, env) {
  const appId = env.EDAMAM_APP_ID;
  const appKey = env.EDAMAM_APP_KEY;
  if (!appId || !appKey || !query) return null;
  const url = new URL(BASE);
  url.searchParams.set('type', 'public');
  url.searchParams.set('q', query);
  url.searchParams.set('app_id', appId);
  url.searchParams.set('app_key', appKey);
  url.searchParams.set('field', 'label');
  url.searchParams.set('field', 'image');
  try {
    const res = await fetch(url.toString(), {
      headers: { 'Edamam-Account-User': 'biba-playground' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const hits = data.hits || [];
    return {
      source: 'edamam',
      count: data.count ?? hits.length,
      sampleImage: hits[0]?.recipe?.image || null
    };
  } catch {
    return null;
  }
}
