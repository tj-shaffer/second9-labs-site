// Provider-specific knowledge for driving DoorDash (DashMart + partner
// grocery stores) via Computer Use. DashMart is DoorDash's own
// convenience-store format; partner grocery includes Safeway,
// Albertsons, Wegmans, and others depending on market.

export default {
  id: 'doordash',
  name: 'DoorDash',
  startUrl: 'https://www.doordash.com/consumer/login',
  authedStartUrl: 'https://www.doordash.com/convenience-and-grocery',

  agentBriefing: [
    "You are driving DoorDash's web UI on behalf of the user.",
    "Goal: from the convenience-and-grocery surface, pick a real grocery store (DashMart for convenience items, or a full-catalog partner like Safeway / Albertsons / Wegmans / Sprouts / Smart & Final), search the store for each ingredient, add one match per ingredient to the cart, navigate to the cart/checkout review page, and STOP — do not click 'Place Order' or any final-confirmation button.",
    "DoorDash vocabulary: items go in a 'cart' (one cart per store; multi-store carts are not generally supported on the same delivery). Add via a '+' button on each product tile.",
    "If a captcha appears (DoorDash uses HUMAN, formerly PerimeterX) or 2FA challenges, halt with status=needs_human.",
    "DashMart's convenience-store catalog won't cover every grocery ingredient — for produce / meat / dairy, prefer a partner grocery store like Safeway over DashMart when one is available.",
    "Never proceed past the cart-review step. Do not enter payment, address, tip, or delivery-time information."
  ].join(' '),

  viewport: { width: 1280, height: 800 },

  cartUrlHints: ['/cart', '/checkout'],

  consentLanguage:
    "DoorDash's ToS prohibits automated access. Running this agent could lead DoorDash to restrict or ban your account. Use only if you accept that risk for personal convenience."
};
