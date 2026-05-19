// ============================================================
// Biba's Playground — Recipes mini-app
// Phase 3: real chat backed by Gemini + Spoonacular via /api/recipes/chat.
// Phase 4 wires the "Send to Instacart" button to /api/cart/build.
// ============================================================

(function () {
  const root = document.getElementById('recipes-app');
  if (!root) return;

  const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  // ---------- preferences (read from localStorage; set on the settings page) ----------
  const PREFS_KEY = 'bp.recipes.prefs';
  const DEFAULT_PREFS = {
    organic: true,
    householdSize: 2,
    diet: [],
    intolerances: [],
    dislikes: '',
    cartProvider: 'instacart'
  };

  // Fallback provider catalog if /api/cart/providers can't be reached.
  const FALLBACK_PROVIDERS = {
    instacart: { id: 'instacart', name: 'Instacart', mode: 'search' },
    ubereats: { id: 'ubereats', name: 'Uber Eats', mode: 'search' }
  };

  const MODE_NOTES = {
    cart: 'Cart pre-loaded — pick a store and check out.',
    search: "We've pre-searched these ingredients for you — tap each to add it.",
    browse: "Opens the grocery section. You'll need to search manually."
  };

  function loadPreferences() {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (!raw) return { ...DEFAULT_PREFS };
      return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
    } catch (err) {
      console.warn('chat.js: could not parse stored preferences, using defaults', err);
      return { ...DEFAULT_PREFS };
    }
  }

  // ---------- guided-wizard config ----------
  const GUIDED = {
    mood:   { prompt: "How are you feeling tonight?", chips: ['Cozy', 'Energized', 'Light & fresh', 'A little fancy'] },
    time:   { prompt: "How much time have you got?", chips: ['15 min', '30 min', '45 min', 'No rush'] },
    effort: { prompt: "How much cooking energy?", chips: ['Minimal', 'A little', "I'll commit"] }
  };

  // ---------- state ----------
  // Each message: { role: 'user'|'assistant', text, html,
  //                 recipes?, recipeDetail?, typing?, hidden?, id? }
  let state = {
    view: 'welcome',     // 'welcome' | 'chat'
    path: null,          // 'free' | 'guided'
    messages: [],
    guided: { step: null, answers: {} },
    lastRecipes: null,   // most recent search result
    recipeDetailsById: {}, // recipeId -> full detail (for cart hand-off)
    cartProviders: { ...FALLBACK_PROVIDERS }, // refreshed from /api/cart/providers at boot
    preferences: loadPreferences(),
    auth: { email: null, historyCount: 0 } // populated by checkAuth()
  };

  // Fire-and-forget refresh of the provider catalog.
  fetch('/api/cart/providers').then(r => r.ok ? r.json() : null).then(data => {
    if (data && Array.isArray(data.providers)) {
      const next = {};
      for (const p of data.providers) next[p.id] = p;
      state.cartProviders = next;
    }
  }).catch(() => { /* keep fallback */ });

  // Fire-and-forget auth check; updates state + chrome when it resolves.
  async function checkAuth() {
    try {
      const res = await fetch('/api/profile');
      if (res.status === 401) {
        state.auth = { email: null, historyCount: 0 };
        renderAuthChrome();
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      state.auth = { email: data.email, historyCount: data.historyCount || 0 };
      // Server preferences win over localStorage when authed; keep localStorage as fallback only.
      if (data.preferences && typeof data.preferences === 'object') {
        state.preferences = { ...DEFAULT_PREFS, ...state.preferences, ...data.preferences };
      }
      renderAuthChrome();
    } catch (err) {
      console.warn('chat.js: /api/profile fetch failed', err);
    }
  }
  checkAuth();

  // ---------- render ----------
  function render() {
    if (state.view === 'welcome') return renderWelcome();
    renderChat();
  }

  function chromeHtml() {
    if (state.auth.email) {
      const initials = state.auth.email.slice(0, 1).toUpperCase();
      return `
        <div class="auth-chrome signed-in">
          <span class="auth-pill"><span class="avatar" aria-hidden="true">${escapeHtml(initials)}</span> Signed in as <strong>${escapeHtml(state.auth.email)}</strong></span>
          <button class="auth-link" type="button" data-action="signout">Sign out</button>
        </div>
      `;
    }
    return `
      <div class="auth-chrome signed-out">
        <span class="auth-pill"><span class="auth-dot" aria-hidden="true"></span> Anonymous mode — preferences saved per browser only</span>
        <a class="auth-link" href="login.html">Sign in →</a>
      </div>
    `;
  }

  function renderAuthChrome() {
    // Called after the async /api/profile fetch resolves. Cheap re-render.
    render();
  }

  function renderWelcome() {
    root.innerHTML = `
      ${chromeHtml()}
      <section class="welcome">
        <p class="eyebrow">Biba's Playground</p>
        <h1>What's <em>for dinner?</em></h1>
        <p class="lede">Tell me what you're craving, or let me ask a couple of questions and we'll figure it out together. I'll pull together a real recipe and (eventually) drop the groceries into your Instacart cart.</p>

        <div class="doors">
          <button class="door" data-path="free">
            <span class="door-tag">Free chat</span>
            <h3>Tell me what you're craving</h3>
            <p>Just type — "something cozy", "easy weeknight", "fish but not fishy". I'll riff.</p>
          </button>
          <button class="door" data-path="guided">
            <span class="door-tag">Three questions</span>
            <h3>Help me decide</h3>
            <p>A short little wizard for when nothing sounds good. We'll narrow it down together.</p>
          </button>
        </div>
      </section>
    `;
    root.querySelectorAll('.door').forEach(btn => {
      btn.addEventListener('click', () => startPath(btn.dataset.path));
    });
    bindChromeHandlers();
  }

  function renderChat() {
    root.innerHTML = `
      ${chromeHtml()}
      <div class="chat-head">
        <h2>${state.path === 'guided' ? 'A few quick questions' : "Let's cook something"}</h2>
        <button class="reset" type="button">↺ Start over</button>
      </div>

      <div class="messages" id="messages"></div>

      <form class="composer" id="composer" autocomplete="off">
        <textarea
          id="composer-input"
          placeholder="${state.path === 'guided' && state.guided.step ? 'Tap a chip above, or type your own…' : "Tell me what you're in the mood for…"}"
          rows="1"
        ></textarea>
        <button type="submit" id="composer-send">Send</button>
      </form>
    `;
    drawMessages();
    bindChatHandlers();
    bindChromeHandlers();
    autoGrow(document.getElementById('composer-input'));
  }

  function bindChromeHandlers() {
    const signoutBtn = root.querySelector('[data-action="signout"]');
    if (!signoutBtn) return;
    signoutBtn.addEventListener('click', async () => {
      signoutBtn.disabled = true;
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch { /* fall through */ }
      // Hard reload so all client state resets cleanly.
      location.reload();
    });
  }

  function drawMessages() {
    const mount = document.getElementById('messages');
    if (!mount) return;
    mount.innerHTML = state.messages
      .filter(m => !m.hidden)
      .map(m => `<div class="msg ${m.role}${m.typing ? ' typing' : ''}">${m.html}</div>`)
      .join('');
    requestAnimationFrame(() => {
      const last = mount.lastElementChild;
      if (last) last.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  // ---------- handlers ----------
  function bindChatHandlers() {
    document.querySelector('.reset').addEventListener('click', resetAll);

    const form = document.getElementById('composer');
    const input = document.getElementById('composer-input');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      autoGrow(input);
      handleUserText(text);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit();
      }
    });
    input.addEventListener('input', () => autoGrow(input));

    document.getElementById('messages').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip[data-chip]');
      if (chip) {
        handleChip(chip.dataset.chip, chip.dataset.context);
        return;
      }
      const pick = e.target.closest('[data-pick]');
      if (pick) {
        pickRecipe(pick.dataset.pick, pick.dataset.pickTitle || '');
        return;
      }
      const more = e.target.closest('[data-more]');
      if (more) {
        handleUserText('Show me a few different ideas, please.');
        return;
      }
      const send = e.target.closest('[data-send-cart]');
      if (send) {
        sendToCart(send);
        return;
      }
      const retry = e.target.closest('[data-retry]');
      if (retry) {
        const lastUserIndex = state.messages.map(m => m.role).lastIndexOf('user');
        if (lastUserIndex >= 0) {
          const lastUserMsg = state.messages[lastUserIndex];
          state.messages = state.messages.slice(0, lastUserIndex);
          drawMessages();
          handleUserText(lastUserMsg.text);
        }
      }

      const reaction = e.target.closest('.reaction[data-reaction]');
      if (reaction && !reaction.disabled) {
        recordReaction(reaction);
      }
    });
  }

  // ---------- reactions ----------
  async function recordReaction(buttonEl) {
    const wrap = buttonEl.closest('.reactions');
    if (!wrap) return;
    const recipeId = wrap.dataset.recipeId;
    const title = wrap.dataset.recipeTitle;
    const reaction = buttonEl.dataset.reaction;
    if (!recipeId || !title || !reaction) return;

    // Disable all reaction buttons in this group + highlight the chosen one.
    wrap.querySelectorAll('.reaction').forEach(b => { b.disabled = true; });
    buttonEl.classList.add('chosen');

    try {
      const res = await fetch('/api/recipes/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ recipeId, title, reaction })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Replace the buttons with a quiet confirmation.
      wrap.innerHTML = `<span class="reactions-label">✓ Saved · I'll remember.</span>`;
    } catch (err) {
      console.warn('reaction save failed:', err);
      wrap.innerHTML = `<span class="reactions-label" style="color:#D42A1F;">Couldn't save that reaction — try again later.</span>`;
    }
  }

  function autoGrow(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 128) + 'px';
  }

  // ---------- conversation flow ----------
  function startPath(path) {
    state.view = 'chat';
    state.path = path;
    state.messages = [];
    state.guided = { step: null, answers: {} };

    if (path === 'free') {
      const greeting = "Hi! Tell me what you're in the mood for — vibe, time, ingredients on hand, anything goes. I'll suggest a couple of options.";
      addAssistantHtml(`<p>${escapeHtml(greeting)}</p>`, greeting);
    } else {
      state.guided.step = 'mood';
      const intro = "Lovely. Three quick questions and I'll put a couple of ideas in front of you.";
      addAssistantHtml(`<p>${escapeHtml(intro)}</p>` + askGuided('mood'), intro);
    }
    render();
  }

  async function handleUserText(text) {
    addUser(text);
    if (state.path === 'guided' && state.guided.step) {
      return handleGuidedAnswer(text);
    }
    await callChatAndRender();
  }

  function handleChip(value, context) {
    addUser(value);
    if (context === 'guided') {
      handleGuidedAnswer(value);
    }
  }

  function handleGuidedAnswer(value) {
    const step = state.guided.step;
    if (!step) return;
    state.guided.answers[step] = value;

    const order = ['mood', 'time', 'effort'];
    const next = order[order.indexOf(step) + 1];

    if (next) {
      state.guided.step = next;
      const q = GUIDED[next];
      addAssistantHtml(`<p>${escapeHtml(q.prompt)}</p>` + askGuided(next), q.prompt);
    } else {
      state.guided.step = null;
      // Synthesize a single coherent user statement from the wizard answers,
      // sent (hidden from the UI) as the prompt to the LLM.
      const a = state.guided.answers;
      const synthesized =
        `I'm feeling ${(a.mood || 'open').toLowerCase()}, ` +
        `I've got about ${(a.time || 'a moderate amount of time').toLowerCase()}, ` +
        `and I want ${(a.effort || 'a normal amount').toLowerCase()} of cooking energy. ` +
        `Suggest a few options.`;
      addUser(synthesized, /*hidden=*/ true);
      callChatAndRender();
    }
  }

  function askGuided(step) {
    const q = GUIDED[step];
    const chipsHtml = q.chips.map(c =>
      `<button class="chip" type="button" data-chip="${escapeHtml(c)}" data-context="guided">${escapeHtml(c)}</button>`
    ).join('');
    return `<div class="chips">${chipsHtml}</div>`;
  }

  function pickRecipe(id, title) {
    handleUserText(`Let's go with ${title || 'that one'}. Can you pull up the full recipe?`);
  }

  // ---------- cart hand-off ----------
  async function sendToCart(buttonEl) {
    const recipeId = buttonEl.dataset.sendCart;
    const providerId = buttonEl.dataset.provider || state.preferences.cartProvider || 'instacart';

    const detail = state.recipeDetailsById[String(recipeId)];
    const ingredients = detail?.ingredients;
    if (!ingredients || ingredients.length === 0) {
      addAssistantHtml(
        `<p>I lost track of this recipe's ingredients — try picking it again from the list above.</p>`,
        "I lost track of this recipe's ingredients."
      );
      return;
    }

    // Disable + show loading state on the button.
    const originalText = buttonEl.textContent;
    buttonEl.disabled = true;
    buttonEl.textContent = 'Opening…';

    try {
      const res = await fetch('/api/cart/build', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ingredients: ingredients.map(i => ({ name: i.name, qty: i.qty, unit: i.unit })),
          provider: providerId
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data.url) throw new Error('No URL returned from /api/cart/build.');

      // Open in a new tab. window.open with _blank is allowed inside a user-initiated handler.
      const opened = window.open(data.url, '_blank', 'noopener');
      if (!opened) {
        // Popup blocked — show the link inline so the user can open it manually.
        addAssistantHtml(
          `<p>Your browser blocked the new tab. Open it manually: ` +
          `<a href="${escapeHtml(data.url)}" target="_blank" rel="noopener">${escapeHtml(state.cartProviders[providerId]?.name || 'Open cart')} →</a></p>`,
          'New tab was blocked.'
        );
      }
    } catch (err) {
      console.error('cart build failed:', err);
      addAssistantHtml(
        `<p>Couldn't hand off to ${escapeHtml(state.cartProviders[providerId]?.name || providerId)}: ` +
        `<em>${escapeHtml(err.message || 'unknown error')}</em>. Try again in a moment.</p>`,
        "Couldn't hand off to cart provider."
      );
    } finally {
      buttonEl.disabled = false;
      buttonEl.textContent = originalText;
    }
  }

  // ---------- API call ----------
  async function callChatAndRender() {
    const typingId = addTyping();
    let json;
    try {
      const apiMessages = state.messages
        .filter(m => !m.typing && m.text)
        .map(m => ({ role: m.role, text: m.text }));

      const knownRecipes = (state.lastRecipes || []).map(r => ({ id: r.id, title: r.title }));

      const res = await fetch('/api/recipes/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          preferences: state.preferences,
          knownRecipes
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }
      json = await res.json();
    } catch (err) {
      console.error('chat API failed:', err);
      removeMessage(typingId);
      addAssistantHtml(
        `<p>Something went wrong on my side: <em>${escapeHtml(err.message || 'unknown error')}</em>.</p>` +
        `<div class="chips"><button class="chip" type="button" data-retry="1">↻ Try again</button></div>`,
        'Something went wrong.'
      );
      return;
    }

    removeMessage(typingId);

    const text = json.message?.text || '';
    const recipes = Array.isArray(json.recipes) ? json.recipes : null;
    const recipeDetail = json.recipeDetail || null;

    if (recipeDetail) {
      // Stash detail so the Send-to-cart click handler can look up ingredients by ID later,
      // even if the user scrolls back through older approval cards.
      if (recipeDetail.id != null) {
        state.recipeDetailsById[String(recipeDetail.id)] = recipeDetail;
      }
      const html = (text ? `<p>${escapeHtml(text)}</p>` : '') + renderApproval(recipeDetail);
      addAssistantHtml(html, text || `Here's the recipe for ${recipeDetail.title}.`, { recipeDetail });
    } else if (recipes && recipes.length) {
      state.lastRecipes = recipes;
      const html = (text ? `<p>${escapeHtml(text)}</p>` : '') + renderRecipeOptions(recipes);
      addAssistantHtml(html, text, { recipes });
    } else {
      addAssistantHtml(`<p>${escapeHtml(text || '(empty response)')}</p>`, text);
    }
  }

  // ---------- rendering helpers ----------
  function renderRecipeOptions(recipes) {
    return recipes.map(r => `
      <div class="recipe-card">
        <div class="recipe-img" aria-hidden="true">
          ${r.image
            ? `<img src="${escapeHtml(r.image)}" alt="" loading="lazy" />`
            : escapeRecipeEmoji(r)}
        </div>
        <div>
          <h4>${escapeHtml(r.title)}</h4>
          <div class="meta">
            ${r.readyInMinutes ? escapeHtml(r.readyInMinutes + ' min') : ''}
            ${r.servings ? ' · ' + escapeHtml('serves ' + r.servings) : ''}
          </div>
          ${r.summary ? `<p>${escapeHtml(trimSummary(r.summary))}</p>` : ''}
          <div class="actions">
            <button class="chip" type="button" data-pick="${escapeHtml(r.id)}" data-pick-title="${escapeHtml(r.title)}">Let's do this one →</button>
          </div>
        </div>
      </div>
    `).join('') + `
      <div class="chips">
        <button class="chip" type="button" data-more="1">Show me something else</button>
      </div>
    `;
  }

  function renderApproval(r) {
    const ing = (r.ingredients || []).map(i => `
      <li>${formatQtyHtml(i)}${escapeHtml(i.name || i.original || '')}</li>
    `).join('');
    const steps = (r.instructions || []).map(s => `<li>${escapeHtml(s)}</li>`).join('');

    // Resolve the user's preferred provider for the Send button label + mode note.
    const providerId = state.preferences.cartProvider || 'instacart';
    const provider = state.cartProviders[providerId] || FALLBACK_PROVIDERS[providerId] || FALLBACK_PROVIDERS.instacart;
    const modeNote = MODE_NOTES[provider.mode] || '';

    const isAuthed = !!state.auth.email;
    const reactionTitle = isAuthed
      ? "Help me learn what you love"
      : "Sign in to record your reaction";

    return `
      <div class="approval">
        <h4>${escapeHtml(r.title)}</h4>
        ${r.image ? `<div class="approval-img"><img src="${escapeHtml(r.image)}" alt="" loading="lazy" /></div>` : ''}
        <div class="meta" style="font-family:'JetBrains Mono',monospace; font-size:0.7rem; color:#1F4E8C; text-transform:uppercase; letter-spacing:0.06em; margin:0.5rem 0;">
          ${r.readyInMinutes ? escapeHtml(r.readyInMinutes + ' min') : ''}
          ${r.servings ? ' · ' + escapeHtml('serves ' + r.servings) : ''}
        </div>

        <h5 style="font-family:'Fraunces',serif; margin:1rem 0 0.25rem;">What you'll need</h5>
        <ul class="ingredients">${ing || '<li>(no ingredients returned)</li>'}</ul>

        ${steps
          ? `<h5 style="font-family:'Fraunces',serif; margin:1rem 0 0.25rem;">Steps</h5><ol class="steps">${steps}</ol>`
          : (r.sourceUrl ? `<p><a href="${escapeHtml(r.sourceUrl)}" target="_blank" rel="noopener">Open the original recipe →</a></p>` : '')}

        <div class="reactions" data-recipe-id="${escapeHtml(r.id)}" data-recipe-title="${escapeHtml(r.title)}" title="${escapeHtml(reactionTitle)}">
          <span class="reactions-label">${isAuthed ? 'How was it?' : 'Sign in to react:'}</span>
          <button class="reaction" type="button" data-reaction="loved" ${isAuthed ? '' : 'disabled'}>❤️ Loved</button>
          <button class="reaction" type="button" data-reaction="liked" ${isAuthed ? '' : 'disabled'}>👍 Liked</button>
          <button class="reaction" type="button" data-reaction="skipped" ${isAuthed ? '' : 'disabled'}>👎 Skip next time</button>
        </div>

        <button class="send" type="button" data-send-cart="${escapeHtml(r.id)}" data-provider="${escapeHtml(provider.id)}">
          Send to ${escapeHtml(provider.name)} →
        </button>
        <p class="demo-note">${escapeHtml(modeNote)}</p>
      </div>
    `;
  }

  function formatQtyHtml(i) {
    if (i.qty == null && !i.unit) return '';
    const qty = i.qty != null ? niceNumber(i.qty) : '';
    const unit = i.unit || '';
    const txt = [qty, unit].filter(Boolean).join(' ');
    return txt ? `<strong>${escapeHtml(txt)}</strong> — ` : '';
  }

  function niceNumber(n) {
    n = Number(n);
    if (!Number.isFinite(n)) return '';
    if (Math.abs(n - Math.round(n)) < 0.05) return String(Math.round(n));
    return n.toFixed(2).replace(/\.?0+$/, '');
  }

  function trimSummary(s) {
    s = String(s).replace(/<[^>]+>/g, '');
    return s.length > 220 ? s.slice(0, 217).trimEnd() + '…' : s;
  }

  function escapeRecipeEmoji(r) {
    const t = (r.title || '').toLowerCase();
    if (/pasta|noodle|spaghetti|linguine|fettuccine|penne|farfalle/.test(t)) return '🍝';
    if (/salmon|fish|tuna|cod/.test(t)) return '🐟';
    if (/salad|bowl/.test(t)) return '🥗';
    if (/soup|broth|stew/.test(t)) return '🍲';
    if (/chicken/.test(t)) return '🍗';
    if (/burger|sandwich/.test(t)) return '🥪';
    if (/pizza/.test(t)) return '🍕';
    return '🍽️';
  }

  // ---------- message helpers ----------
  function addAssistantHtml(html, textForLLM, extra = {}) {
    state.messages.push({
      role: 'assistant',
      html,
      text: textForLLM ?? stripHtml(html),
      ...extra
    });
    drawMessages();
  }
  function addUser(text, hidden = false) {
    state.messages.push({
      role: 'user',
      text,
      html: `<p>${escapeHtml(text)}</p>`,
      hidden
    });
    drawMessages();
  }
  function addTyping() {
    const id = 'typing-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    state.messages.push({
      id,
      role: 'assistant',
      text: '',
      html: '<span class="typing-dots"><span></span><span></span><span></span></span>',
      typing: true
    });
    drawMessages();
    return id;
  }
  function removeMessage(id) {
    state.messages = state.messages.filter(m => m.id !== id);
    drawMessages();
  }
  function stripHtml(s) {
    return String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  }

  function resetAll() {
    state = {
      view: 'welcome',
      path: null,
      messages: [],
      guided: { step: null, answers: {} },
      lastRecipes: null,
      preferences: loadPreferences()
    };
    render();
  }

  render();
})();
