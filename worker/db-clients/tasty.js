// Tasty API client via RapidAPI.
// Docs: https://rapidapi.com/apidojo/api/tasty/

const HOST = 'tasty.p.rapidapi.com';
const BASE = `https://${HOST}`;

export async function crossRef(query, env) {
  const key = env.RAPID_API_KEY;
  if (!key || !query) return null;
  const url = new URL(BASE + '/recipes/list');
  url.searchParams.set('from', '0');
  url.searchParams.set('size', '5');
  url.searchParams.set('q', query);
  try {
    const res = await fetch(url.toString(), {
      headers: {
        'x-rapidapi-host': HOST,
        'x-rapidapi-key': key
      }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const results = data.results || [];
    return {
      source: 'tasty',
      count: data.count ?? results.length,
      sampleImage: results[0]?.thumbnail_url || null
    };
  } catch {
    return null;
  }
}
