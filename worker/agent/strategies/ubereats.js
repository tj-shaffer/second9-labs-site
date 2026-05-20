// Provider-specific knowledge for driving Uber Eats (grocery + restaurant)
// via Computer Use. Uber Eats grocery availability varies by market —
// expect Whole Foods, Albertsons, 7-Eleven, and regional chains.

export default {
  id: 'ubereats',
  name: 'Uber Eats',
  startUrl: 'https://www.ubereats.com/login',
  authedStartUrl: 'https://www.ubereats.com/feed?diningMode=DELIVERY',

  agentBriefing: [
    "You are driving Uber Eats' web UI on behalf of the user.",
    "Goal: navigate to grocery (look for a 'Grocery' or 'Convenience' category, or filter the feed by Grocery), find a grocery store that delivers to the user's address, search the store for each ingredient, add one match per ingredient to the cart, navigate to the cart/checkout review, and STOP — do not click 'Place Order' or any final-confirmation button.",
    "Uber Eats vocabulary: items go into your 'order' or 'cart' (both terms appear). Add via a green '+' button on each product card or an 'Add to order' button.",
    "If asked for a delivery address you can't fulfill, take a screenshot and halt with status=needs_human.",
    "If a captcha or 2FA (Uber sometimes uses SMS OTP) appears, halt with status=needs_human.",
    "Grocery selection can vary wildly by market. If you can't find one of the ingredients in the store the user is browsing, search a second store or skip that item with a brief note — don't get stuck.",
    "Never proceed past the cart-review step. Do not enter payment, address, or delivery-time information."
  ].join(' '),

  viewport: { width: 1280, height: 800 },

  cartUrlHints: ['/checkout', '/cart', '/order-tracking'],

  consentLanguage:
    "Uber Eats' ToS prohibits automated access. Running this agent could lead Uber to restrict or ban your account. Use only if you accept that risk for personal convenience."
};
