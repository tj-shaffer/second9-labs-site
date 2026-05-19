// Uber Eats cart provider.
//
// Uber Eats has no public consumer cart API, only the search endpoint.
// We pre-fill the search query with comma-separated ingredient names so the
// user lands on results they can add to a cart manually.

import { dedupedNames } from '../utils.js';

const SEARCH_URL = 'https://www.ubereats.com/search';

export default {
  id: 'ubereats',
  name: 'Uber Eats',
  description: 'Grocery delivery via Uber Eats (search pre-filled)',
  mode: 'search',

  async buildLink(ingredients, env) {
    const names = dedupedNames(ingredients);
    if (names.length === 0) {
      throw new Error('No ingredient names to build link for.');
    }
    const u = new URL(SEARCH_URL);
    u.searchParams.set('q', names.join(','));
    return { url: u.toString(), mode: 'search' };
  }
};
