// Cart provider registry + dispatcher.
//
// Add a new grocery service by:
//   1. Creating worker/cart/providers/<id>.js with the same shape as the others.
//   2. Importing it here and adding it to PROVIDERS.
// That's it. The settings page picks it up automatically via /api/cart/providers.

import instacart from './providers/instacart.js';
import ubereats from './providers/ubereats.js';

const PROVIDERS = [instacart, ubereats];
const BY_ID = Object.fromEntries(PROVIDERS.map(p => [p.id, p]));
const DEFAULT_PROVIDER_ID = 'instacart';

// Public summary used by /api/cart/providers and by the frontend's settings page.
export function listProviders() {
  return PROVIDERS.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    mode: p.mode
  }));
}

// Build a hand-off link for a given provider. If providerId is unknown or missing,
// falls back to the default. Returns { url, mode, provider } where provider is
// the id actually used (so the caller can honestly report which service handled it).
export async function buildCart(providerId, ingredients, env) {
  const provider = BY_ID[providerId] || BY_ID[DEFAULT_PROVIDER_ID];
  if (!provider) throw new Error(`No cart provider registered (looked for "${providerId}")`);
  const result = await provider.buildLink(ingredients, env);
  return { ...result, provider: provider.id };
}
