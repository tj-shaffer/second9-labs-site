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
    '- `computer` for click/type/screenshot — drives the browser. Start by taking a screenshot to see the page.',
    '- `checkout_reached` (custom) when you arrive at the cart-review page. ARGS: { cart_url }. After calling this, STOP.',
    '- `needs_human` (custom) for captcha / 2FA / unexpected blocks. ARGS: { reason }.',
    '',
    'When typing credentials, you can use the literal macros `${USERNAME}` and `${PASSWORD}` — the worker substitutes them before keystrokes so you never see the plaintext.'
  ].join('\n');

  // Bootstrap with a single user-text turn. Claude's first response
  // will request a screenshot via the computer tool; from there it's
  // a normal tool_use ↔ tool_result loop, one user turn per assistant
  // turn, each tool_result carrying a fresh screenshot.
  const messages = [{
    role: 'user',
    content: [{ type: 'text', text: 'Begin. Take a screenshot to see the page, then work through the task.' }]
  }];

  const tools = [
    {
      type: 'computer_20250124',
      name: 'computer',
      display_width_px: strategy.viewport.width,
      display_height_px: strategy.viewport.height,
      display_number: 1
    },
    {
      name: 'checkout_reached',
      description: 'Call when at the cart review page.',
      input_schema: { type: 'object', properties: { cart_url: { type: 'string' } }, required: ['cart_url'] }
    },
    {
      name: 'needs_human',
      description: 'Call when you hit a captcha or 2FA.',
      input_schema: { type: 'object', properties: { reason: { type: 'string' } }, required: ['reason'] }
    }
  ];

  for (let i = 0; i < MAX_LOOP_ITERATIONS; i++) {
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
        tools,
        messages
      })
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 400);
      throw new Error(`Anthropic Computer Use ${res.status}: ${detail}`);
    }
    const data = await res.json();
    const blocks = data?.content || [];

    // Always append the assistant turn to the conversation, even
    // before processing tool calls — this is what makes subsequent
    // tool_results legal.
    messages.push({ role: 'assistant', content: blocks });

    // Process every block, building the next user turn's content
    // (one tool_result per tool_use).
    const nextUserContent = [];
    let terminalResult = null;

    for (const block of blocks) {
      if (block.type === 'text' && block.text) {
        await emit('decision', { reasoning: block.text, nextAction: null });
      }
      if (block.type !== 'tool_use') continue;

      const { id: toolUseId, name, input } = block;

      if (name === 'checkout_reached') {
        terminalResult = { status: 'stopped_for_review', cartUrl: input?.cart_url, ingredientCount: ingredients.length };
        break;
      }
      if (name === 'needs_human') {
        terminalResult = { status: 'needs_human', reason: input?.reason };
        break;
      }
      if (name !== 'computer') {
        nextUserContent.push({ type: 'tool_result', tool_use_id: toolUseId, content: `Unknown tool: ${name}`, is_error: true });
        continue;
      }

      // Execute the computer action, capture a fresh screenshot, and
      // return the screenshot as the tool_result. Anthropic's docs
      // recommend always returning a post-action screenshot so Claude
      // can verify the page state.
      const actionResult = await executeComputerAction(session, input, emit, credentials);
      let screenshotB64;
      try {
        screenshotB64 = await session.screenshot();
        await emit('screenshot', { hint: `iter ${i} after ${input?.action}`, base64: screenshotB64 });
      } catch (err) {
        nextUserContent.push({
          type: 'tool_result',
          tool_use_id: toolUseId,
          content: `Screenshot failed: ${err?.message || err}`,
          is_error: true
        });
        continue;
      }

      const resultContent = [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: screenshotB64 } }
      ];
      if (actionResult.error) {
        resultContent.push({ type: 'text', text: `Action error: ${actionResult.error}` });
      }
      nextUserContent.push({
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: resultContent,
        is_error: !!actionResult.error
      });
    }

    if (terminalResult) return terminalResult;

    if (nextUserContent.length === 0) {
      // No tool calls. If the model is done, exit cleanly; otherwise
      // nudge with a minimal user turn so the loop can continue.
      if (data?.stop_reason === 'end_turn') break;
      messages.push({ role: 'user', content: [{ type: 'text', text: 'Continue.' }] });
      continue;
    }

    messages.push({ role: 'user', content: nextUserContent });
  }

  return { status: 'retries_exhausted' };
}

async function executeComputerAction(session, input, emit, credentials) {
  const action = input?.action;
  try {
    if (action === 'screenshot') {
      // Screenshot itself is harmless — the loop always takes one
      // after every action regardless.
    } else if (action === 'left_click' && Array.isArray(input.coordinate)) {
      await session.click(input.coordinate[0], input.coordinate[1]);
    } else if (action === 'type' && typeof input.text === 'string') {
      const text = input.text
        .replace(/\$\{USERNAME\}/g, credentials?.username || '')
        .replace(/\$\{PASSWORD\}/g, credentials?.password || '');
      await session.type(text);
    } else if (action === 'key' && typeof input.text === 'string') {
      await session.key(input.text);
    }
    // mouse_move / cursor_position / etc. fall through as no-ops
    await emit('action', { action, args: redactCreds(input), ok: true });
    return { ok: true };
  } catch (err) {
    const errMsg = String(err?.message || err);
    await emit('action', { action, args: redactCreds(input), ok: false, error: errMsg });
    return { ok: false, error: errMsg };
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
