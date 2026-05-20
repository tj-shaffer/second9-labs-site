// Heuristic recipe-DNA extraction. No LLM call — pulls features
// directly from the structured recipe Claude/Gemini already authored.
// Stored alongside the embedding as Vectorize metadata so retrieval
// can filter or boost on structured fields, not just semantic match.

const COMPLEXITY_FROM_STEPS = [
  { max: 4, label: 'minimal' },
  { max: 8, label: 'moderate' },
  { max: Infinity, label: 'involved' }
];

const PREP_STYLE_SIGNALS = {
  'one-pan': /one[-\s]?pan|sheet[-\s]?pan|skillet|wok/i,
  'no-cook': /no[-\s]?cook|raw|cold/i,
  'oven': /\b(roast|bake|broil|oven)\b/i,
  'stovetop': /\b(saut[ée]|fry|simmer|boil|sear|braise)\b/i,
  'grill': /\bgrill/i,
  'slow': /\b(slow[-\s]?cook|braise|simmer for|low and slow)\b/i
};

const PROTEIN_SIGNALS = {
  chicken: /chicken/i,
  beef: /\b(beef|steak|brisket|ground beef)\b/i,
  pork: /\b(pork|bacon|sausage|ham)\b/i,
  fish: /\b(salmon|tuna|cod|halibut|trout|fish)\b/i,
  shellfish: /\b(shrimp|prawn|scallop|crab|lobster|clam|mussel|oyster)\b/i,
  tofu: /\btofu\b/i,
  egg: /\beggs?\b/i,
  vegetarian: /\b(vegetable|veggie|bean|lentil|chickpea)\b/i
};

export function extractDna(recipe) {
  const ingredients = recipe?.ingredients || [];
  const instructions = recipe?.instructions || [];
  const allText = [
    recipe?.title || '',
    recipe?.summary || '',
    instructions.join(' '),
    ingredients.map(i => i?.name || '').join(' ')
  ].join(' ').toLowerCase();

  const totalMin = recipe?.time?.total_min || 0;

  const complexity = COMPLEXITY_FROM_STEPS.find(t => instructions.length <= t.max)?.label || 'moderate';

  const prepStyles = Object.entries(PREP_STYLE_SIGNALS)
    .filter(([, re]) => re.test(allText))
    .map(([style]) => style);

  const proteins = Object.entries(PROTEIN_SIGNALS)
    .filter(([, re]) => re.test(allText))
    .map(([p]) => p);

  // Top three key ingredients by typical importance heuristic: first
  // 3 listed ingredients are usually the dish-defining ones.
  const keyIngredients = ingredients
    .slice(0, 3)
    .map(i => String(i?.name || '').toLowerCase())
    .filter(Boolean);

  return {
    cuisineTags: Array.isArray(recipe?.cuisine_tags) ? recipe.cuisine_tags : [],
    prepStyles,
    proteins,
    keyIngredients,
    totalMin,
    complexity,
    servings: recipe?.servings || null
  };
}

// Render the DNA + recipe core into one embedding-ready text blob.
// Goal: dense semantic signal in ~120 tokens. We don't pass the full
// ingredient list because that bloats the embedding without changing
// the dish's semantic identity.
export function embeddingText(recipe, dna = null) {
  const d = dna || extractDna(recipe);
  const lines = [
    recipe?.title,
    recipe?.summary,
    d.cuisineTags.length ? `Cuisine: ${d.cuisineTags.join(', ')}.` : '',
    d.proteins.length ? `Protein: ${d.proteins.join(', ')}.` : '',
    d.prepStyles.length ? `Style: ${d.prepStyles.join(', ')}.` : '',
    d.keyIngredients.length ? `Key ingredients: ${d.keyIngredients.join(', ')}.` : '',
    d.totalMin ? `About ${d.totalMin} minutes, ${d.complexity}.` : ''
  ].filter(Boolean);
  return lines.join(' ');
}
