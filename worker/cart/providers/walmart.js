// Walmart cart provider — search-URL hand-off (mode: search).
//
// Walmart has no public consumer cart API. We pre-fill the grocery
// search with comma-separated ingredient names so the user lands on
// results they can add to a cart manually. This is the fallback for
// anonymous users or for when no vault credentials are stored; the
// computer-use agent path is the higher-autonomy option.

import { dedupedNames } from '../utils.js';

const SEARCH_URL = 'https://www.walmart.com/search';

export default {
  id: 'walmart',
  name: 'Walmart',
  description: 'Walmart Grocery (search pre-filled)',
  mode: 'search',

  async buildLink(ingredients, env) {
    const names = dedupedNames(ingredients);
    if (names.length === 0) {
      throw new Error('No ingredient names to build link for.');
    }
    const u = new URL(SEARCH_URL);
    u.searchParams.set('q', names.join(','));
    // Hint Walmart to scope to grocery rather than general merchandise.
    u.searchParams.set('cat_id', '976759');
    return { url: u.toString(), mode: 'search' };
  }
};
