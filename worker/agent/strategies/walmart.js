// Provider-specific knowledge for driving Walmart Grocery via
// Computer Use.
//
// WARNING: Walmart fronts every page with Akamai Bot Manager — among
// the most aggressive anti-automation products in retail. Expect
// repeated mid-session challenges even with valid session cookies.
// Catalog and price are unbeatable but autonomous reliability will
// be the worst of the four supported providers. The strategy ships
// for completeness; we don't recommend daily use.

export default {
  id: 'walmart',
  name: 'Walmart',
  startUrl: 'https://www.walmart.com/account/login',
  authedStartUrl: 'https://www.walmart.com/grocery',

  agentBriefing: [
    "You are driving Walmart's web UI on behalf of the user.",
    "Goal: navigate to Walmart Grocery (the '/grocery' surface), confirm the user's delivery store, search for each ingredient, add one match per ingredient to the cart, navigate to the cart/checkout review page, and STOP — do not click 'Place Order' or any final-confirmation button.",
    "Walmart vocabulary: items go into a 'cart'. 'Add to cart' is the canonical button. Quantity steppers are common — leave at 1 unless the recipe needs more.",
    "Walmart's anti-bot system (Akamai) is aggressive. If you see a 'Robot or human?' challenge, a press-and-hold puzzle, a 'Please verify' interstitial, or anything captcha-like, halt IMMEDIATELY with status=needs_human. Do not attempt to solve it.",
    "Walmart will sometimes ask to 'select your store' — pick the one the user has used historically (visible from cookies/account if you can see it; otherwise the first available one).",
    "Prefer Great Value / Walmart store-brand items only when the recipe doesn't call for a specific brand, since they're typically the cheapest available match.",
    "Never proceed past the cart-review step. Do not enter payment, address, tip, or delivery-time information."
  ].join(' '),

  viewport: { width: 1280, height: 800 },

  cartUrlHints: ['/cart', '/checkout'],

  consentLanguage:
    "Walmart's ToS prohibits automated access, and their anti-bot system (Akamai) is aggressive — expect frequent CAPTCHA halts even with valid cookies. Running this agent could lead Walmart to suspend or ban your account. Use only if you accept that risk for personal convenience."
};
