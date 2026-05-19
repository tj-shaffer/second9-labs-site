// Claude Computer Use loop.
//
// Two modes:
//   "live" — requires ANTHROPIC_API_KEY with credits + a real browser
//            session (CloudflareSession). Runs the real perception →
//            action loop against the provider UI.
//   "dry"  — no Anthropic calls, no real browser. Emits scripted decisions
//            and ends with status=stopped_for_review so the rest of the
//            stack (audit log, SSE stream, frontend wiring) can be tested
//            without paid services.
//
// Either mode emits the same event shapes to the orchestrator via the
// provided `emit` callback, so the UI doesn't care which is running.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const ANTHROPIC_BETA = 'computer-use-2025-01-24';
const MODEL = 'claude-sonnet-4-5';
const MAX_LOOP_ITERATIONS = 25;

export async function runComputerUseLoop({ session, strategy, ingredients, credentials, env, emit }) {
  const dry = session?.isDry || !env?.ANTHROPIC_API_KEY;
  if (dry) return runDryLoop({ session, strategy, ingredients, emit });
  return runLiveLoop({ session, strategy, ingredients, credentials, env, emit });
}

// ---------- dry mode ----------

async function runDryLoop({ session, strategy, ingredients, emit }) {
  await emit('note', { note: `Dry-run mode — no Anthropic / Browser Rendering. Simulating ${strategy.name} cart build.` });
  await session.open(strategy.startUrl);
  await emit('screenshot', { hint: 'opened ' + strategy.startUrl });

  await emit('decision', { reasoning: 'Detected login form (simulated)', nextAction: 'fill_login' });
  await session.click(640, 380);
  await session.type('***username***');
  await session.key('Tab');
  await session.type('***password***');
  await session.click(640, 460);
  await emit('action', { action: 'submit_login', args: {}, ok: true });

  for (const ing of ingredients) {
    await emit('decision', {
      reasoning: `Search for "${ing.name}" and add the top match to cart.`,
      nextAction: 'add_ingredient'
    });
    await session.navigate(`${strategy.startUrl.replace('/login', '')}/store/s?k=${encodeURIComponent(ing.name)}`);
    await session.click(300, 400);
    await emit('action', { action: 'add_to_cart', args: { ingredient: ing.name }, ok: true });
  }

  await session.navigate(`${strategy.startUrl.replace('/login', '')}/store/cart`);
  await emit('screenshot', { hint: 'cart page reached (simulated)' });

  return {
    status: 'stopped_for_review',
    cartUrl: await session.currentUrl(),
    ingredientCount: ingredients.length,
    dryRun: true
  };
}

// ---------- live mode ----------

async function runLiveLoop({ session, strategy, ingredients, credentials, env, emit }) {
  await session.open(strategy.startUrl);
  await emit('note', { note: `Live run via ${MODEL} + Cloudflare Browser Rendering.` });

  const ingredientList = ingredients.map(i => `- ${i.name}`).join('\n');
  const systemPrompt = [
    strategy.agentBriefing,
    '',
    'Ingredients to add to the cart (one match per item):',
    ingredientList,
    '',
    'Tools you can call:',
    '- `computer` for click/type/screenshot — drives the browser.',
    '- `checkout_reached` (custom) when you arrive at the cart-review page. ARGS: { cart_url }. After calling this, STOP.',
    '- `needs_human` (custom) for captcha / 2FA / unexpected blocks. ARGS: { reason, screenshot_url? }.'
  ].join('\n');

  const messages = [{
    role: 'user',
    content: [{ type: 'text', text: 'Begin. The browser is already open at the login page.' }]
  }];

  for (let i = 0; i < MAX_LOOP_ITERATIONS; i++) {
    const screenshotB64 = await session.screenshot();
    await emit('screenshot', { hint: `iter ${i}`, base64: screenshotB64 });

    messages[messages.length - 1].content.push({
      type: 'tool_result',
      tool_use_id: `screenshot-${i}`,
      content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: screenshotB64 } }]
    });

    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-beta': ANTHROPIC_BETA
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        system: systemPrompt,
        tools: [
          { type: 'computer_20250124', name: 'computer', display_width_px: strategy.viewport.width, display_height_px: strategy.viewport.height, display_number: 1 },
          { name: 'checkout_reached', description: 'Call when at the cart review page.', input_schema: { type: 'object', properties: { cart_url: { type: 'string' } }, required: ['cart_url'] } },
          { name: 'needs_human', description: 'Call when you hit a captcha or 2FA.', input_schema: { type: 'object', properties: { reason: { type: 'string' } }, required: ['reason'] } }
        ],
        messages
      })
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 400);
      throw new Error(`Anthropic Computer Use ${res.status}: ${detail}`);
    }
    const data = await res.json();
    const blocks = data?.content || [];

    for (const block of blocks) {
      if (block.type === 'text' && block.text) {
        await emit('decision', { reasoning: block.text, nextAction: null });
      }
      if (block.type === 'tool_use') {
        const { name, input } = block;
        if (name === 'computer') {
          await dispatchComputerAction(session, input, emit, credentials);
        } else if (name === 'checkout_reached') {
          return { status: 'stopped_for_review', cartUrl: input.cart_url, ingredientCount: ingredients.length };
        } else if (name === 'needs_human') {
          return { status: 'needs_human', reason: input.reason };
        }
      }
    }

    messages.push({ role: 'assistant', content: blocks });
    if (data?.stop_reason === 'end_turn') break;
    messages.push({ role: 'user', content: [] });
  }

  return { status: 'retries_exhausted' };
}

async function dispatchComputerAction(session, input, emit, credentials) {
  const action = input?.action;
  try {
    if (action === 'screenshot') {
      // no-op — the next iteration starts with a fresh screenshot
    } else if (action === 'mouse_move') {
      // pass — Cloudflare Puppeteer doesn't expose mouse move w/o click in this wrapper
    } else if (action === 'left_click' && Array.isArray(input.coordinate)) {
      await session.click(input.coordinate[0], input.coordinate[1]);
    } else if (action === 'type' && typeof input.text === 'string') {
      // Replace credential macros so the LLM never sees the cleartext.
      const text = input.text
        .replace('${USERNAME}', credentials?.username || '')
        .replace('${PASSWORD}', credentials?.password || '');
      await session.type(text);
    } else if (action === 'key' && typeof input.text === 'string') {
      await session.key(input.text);
    }
    await emit('action', { action, args: redactCreds(input), ok: true });
  } catch (err) {
    await emit('action', { action, args: redactCreds(input), ok: false, error: String(err?.message || err) });
  }
}

function redactCreds(input) {
  const clone = { ...input };
  if (typeof clone.text === 'string') {
    clone.text = clone.text
      .replace(/\${PASSWORD}/g, '***')
      .replace(/\${USERNAME}/g, '<user>');
  }
  return clone;
}
