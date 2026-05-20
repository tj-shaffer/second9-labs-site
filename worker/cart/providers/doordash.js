// DoorDash cart provider — search-URL hand-off (mode: search).
//
// DoorDash has no public consumer cart API, and their search URL
// pattern is less friendly than Instacart's: it expects the query
// param on a per-store basis rather than catalog-wide. We drop the
// user on the convenience-and-grocery surface with the query
// pre-filled — they pick a store and search lands automatically.

import { dedupedNames } from '../utils.js';

const SEARCH_URL = 'https://www.doordash.com/convenience-and-grocery';

export default {
  id: 'doordash',
  name: 'DoorDash',
  description: 'DoorDash grocery (convenience surface + pre-filled query)',
  mode: 'search',

  async buildLink(ingredients, env) {
    const names = dedupedNames(ingredients);
    if (names.length === 0) {
      throw new Error('No ingredient names to build link for.');
    }
    const u = new URL(SEARCH_URL);
    u.searchParams.set('query', names.join(','));
    return { url: u.toString(), mode: 'search' };
  }
};
