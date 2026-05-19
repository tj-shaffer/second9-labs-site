// Instacart cart provider.
//
// Behavior depends on whether INSTACART_API_KEY is configured:
//   - With key (post-IDP-approval): calls the real Recipe API to mint a pre-loaded
//     shopping list URL. Returns mode 'cart'.
//   - Without key (v1 default): builds a public search URL that pre-fills the
//     consumer-facing Instacart search with the ingredient names. Returns mode 'search'.
//
// The frontend uses mode to render honest UX text — "Cart pre-loaded" vs "Pre-searched".

import { dedupedNames } from '../utils.js';

const SEARCH_URL = 'https://www.instacart.com/store/s';
const IDP_URL = 'https://connect.instacart.com/idp/v1/products/products_link';

export default {
  id: 'instacart',
  name: 'Instacart',
  description: 'Grocery delivery from local stores',
  mode: 'search', // baseline mode; buildLink may upgrade to 'cart' if IDP key is set

  async buildLink(ingredients, env) {
    const names = dedupedNames(ingredients);
    if (names.length === 0) {
      throw new Error('No ingredient names to build link for.');
    }

    // If IDP API key is configured, try the real Recipe API first.
    if (env?.INSTACART_API_KEY) {
      try {
        const url = await callIDP(names, env.INSTACART_API_KEY);
        if (url) return { url, mode: 'cart' };
      } catch (err) {
        console.error('[instacart] IDP call failed, falling back to search URL:', err);
        // fall through to search URL
      }
    }

    // v1 default: public search URL.
    const u = new URL(SEARCH_URL);
    u.searchParams.set('k', names.join(','));
    return { url: u.toString(), mode: 'search' };
  }
};

// Call the Instacart Developer Platform Recipe API to mint a pre-loaded
// shopping list URL. Endpoint:
//   POST https://connect.instacart.com/idp/v1/products/products_link
async function callIDP(names, apiKey) {
  const res = await fetch(IDP_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: 'Recipe shopping list',
      line_items: names.map(n => ({ name: n, quantity: 1 }))
    })
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200);
    throw new Error(`IDP ${res.status}: ${detail}`);
  }
  const data = await res.json();
  return data?.products_link_url;
}
