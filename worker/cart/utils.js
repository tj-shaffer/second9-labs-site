// Shared helpers for cart providers.

// Take a recipe-detail ingredients array and produce a clean, deduped list
// of ingredient names suitable for a search query.
//   input:  [{ name: "Yellow onion", qty: 1, unit: "large", original: "1 large yellow onion, chopped" }, ...]
//   output: ["yellow onion", "garlic", ...]
export function dedupedNames(ingredients) {
  if (!Array.isArray(ingredients)) return [];
  const seen = new Set();
  const out = [];
  for (const i of ingredients) {
    const name = String(i?.name || '').trim().toLowerCase();
    if (!name) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}
