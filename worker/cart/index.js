// Cart provider registry + dispatcher.
//
// Post-pivot (2026-05-21): we use official partner Recipe APIs (no autonomous
// agent, no website scraping). Providers are only listed when their API key
// secret is set on the Worker — so /api/cart/providers honestly reflects what
// the frontend can actually offer.
//
// Adding a new provider:
//   1. Create worker/cart/providers/<id>.js with default-export shape
//      { id, name, description, mode, requiredEnv, buildLink(recipe, env, opts) }
//   2. Import here and add to PROVIDERS.
//   3. Set the API key secret via `wrangler secret put`.

import instacart from './providers/instacart.js';

const PROVIDERS = [instacart];
const BY_ID = Object.fromEntries(PROVIDERS.map(p => [p.id, p]));

// Public summary used by /api/cart/providers + the frontend's recipe card.
// Filters to providers whose required secrets are set, so the UI only renders
// buttons that will actually work.
export function listProviders(env) {
  return PROVIDERS
    .filter(p => isProviderAvailable(p, env))
    .map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      mode: p.mode
    }));
}

// Build a hand-off link for a given provider. Throws if the provider is
// unknown or its required secret isn't set.
export async function buildCart(providerId, recipe, env, opts = {}) {
  const provider = BY_ID[providerId];
  if (!provider) throw new Error(`unknown_provider:${providerId}`);
  if (!isProviderAvailable(provider, env)) {
    throw new Error(`provider_not_configured:${providerId}`);
  }
  const result = await provider.buildLink(recipe, env, opts);
  return { ...result, provider: provider.id };
}

function isProviderAvailable(provider, env) {
  // Each provider declares which env secret(s) it requires. instacart.js
  // checks INSTACART_API_KEY at call-time too; we mirror that here so we
  // don't even list it when the key isn't set.
  if (provider.id === 'instacart') return Boolean(env?.INSTACART_API_KEY);
  return true;
}
