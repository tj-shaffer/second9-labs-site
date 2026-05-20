// Provider-specific knowledge for driving Instacart via Computer Use.
//
// The pattern: each strategy file exports a strategy object that the
// orchestrator + Computer Use loop can consume. Adding Uber Eats /
// Walmart / DoorDash later is one more file in this directory.

export default {
  id: 'instacart',
  name: 'Instacart',
  // The URL the agent navigates to first.
  startUrl: 'https://www.instacart.com/login',

  // System prompt fragment appended to the Computer Use prompt so
  // Claude understands the per-provider context.
  agentBriefing: [
    'You are driving Instacart\'s web UI on behalf of the user.',
    'Goal: log in with the provided credentials, search the user\'s default store for each ingredient, add one match per ingredient to cart, navigate to the cart page, and STOP — do not click "Place Order" or any final-checkout button. The user reviews and confirms manually.',
    'Be precise. If a captcha or 2FA appears, take a screenshot and halt with status=needs_human.',
    'If an ingredient has multiple matches, prefer organic / fresh / store-brand variants when present, picking the first reasonable match.',
    'Never proceed past the cart-review step. Do not enter payment, address, or delivery-time information.'
  ].join(' '),

  // Reasonable defaults the orchestrator passes to the Computer Use
  // model when launching a session.
  viewport: { width: 1280, height: 800 },

  // Heuristic terminal-state detector. Computer Use calls the
  // "checkout_reached" tool when it believes it's at the cart review
  // page; we cross-check against this URL hint.
  cartUrlHints: ['/cart', '/store/cart', '/checkout?step=review'],

  // ToS surface for the consent screen.
  consentLanguage:
    'Instacart\'s ToS prohibits automated access. Running this agent could lead Instacart to ban your account. Use only if you accept that risk for personal convenience.'
};
