// TheMealDB client.
// Docs: https://www.themealdb.com/api.php
// Test key "1" is the documented public key for personal use.

const BASE = 'https://www.themealdb.com/api/json/v1/1';

export async function crossRef(query, _env) {
  if (!query) return null;
  const url = new URL(BASE + '/search.php');
  url.searchParams.set('s', query);
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    const meals = data.meals || [];
    return {
      source: 'themealdb',
      count: meals.length,
      sampleImage: meals[0]?.strMealThumb || null
    };
  } catch {
    return null;
  }
}
