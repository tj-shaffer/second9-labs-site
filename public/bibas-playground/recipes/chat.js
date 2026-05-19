// ============================================================
// Biba's Playground — Recipes mini-app
// Phase 6 (Kitchen OS): Gemini drives chat, Claude Opus 4.7 authors
// every recipe, Imagen 3 generates the photo, four DBs cross-reference
// the result in the background. One recipe per turn (no list).
// Explicit reactions retired — implicit signals (send-to-cart) now.
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

  const GUIDED = {
    mood:   { prompt: "How are you feeling tonight?", chips: ['Cozy', 'Energized', 'Light & fresh', 'A little fancy'] },
    time:   { prompt: "How much time have you got?", chips: ['15 min', '30 min', '45 min', 'No rush'] },
    effort: { prompt: "How much cooking energy?", chips: ['Minimal', 'A little', "I'll commit"] }
  };

  // ---------- state ----------
  let state = {
    view: 'welcome',
    path: null,
    messages: [],
    guided: { step: null, answers: {} },
    recipesById: {},  // id -> full authored recipe (for cart hand-off + xref poll)
    cartProviders: { ...FALLBACK_PROVIDERS },
    preferences: loadPreferences(),
    auth: { email: null, historyCount: 0 },
    vaultProviders: {}  // Phase 10: which providers have stored creds
  };

  fetch('/api/cart/providers').then(r => r.ok ? r.json() : null).then(data => {
    if (data && Array.isArray(data.providers)) {
      const next = {};
      for (const p of data.providers) next[p.id] = p;
      state.cartProviders = next;
    }
  }).catch(() => { /* keep fallback */ });

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
      if (data.preferences && typeof data.preferences === 'object') {
        state.preferences = { ...DEFAULT_PREFS, ...state.preferences, ...data.preferences };
      }
      // Phase 10: load vault status so the Send button can switch into
      // "Run agent" mode when the user has stored creds for the
      // chosen provider.
      fetch('/api/vault/status')
        .then(r => r.ok ? r.json() : null)
        .then(v => { if (v?.vaults) state.vaultProviders = v.vaults; });
      renderAuthChrome();
    } catch (err) {
      console.warn('chat.js: /api/profile fetch failed', err);
    }
  }
  checkAuth();

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

  function renderAuthChrome() { render(); }

  function renderWelcome() {
    root.innerHTML = `
      ${chromeHtml()}
      <section class="welcome">
        <p class="eyebrow">Biba's Playground</p>
        <h1>What's <em>for dinner?</em></h1>
        <p class="lede">Tell me what you're craving, or let me ask a couple of questions and we'll figure it out together. An expert AI chef writes the recipe, I generate the photo, and I (eventually) drop the groceries into your Instacart cart.</p>

        <div class="doors">
          <button class="door" data-path="free">
            <span class="door-tag">Free chat</span>
            <h3>Tell me what you're craving</h3>
            <p>Just type — "something cozy", "Sichuan chicken with cumin oil", "no-cook summer dinner". I'll author one for you.</p>
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
      try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* fall through */ }
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
      const alt = e.target.closest('[data-alternatives]');
      if (alt) {
        handleUserText('Show me a different idea, please.');
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
    });
  }

  function autoGrow(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 128) + 'px';
  }

  function startPath(path) {
    state.view = 'chat';
    state.path = path;
    state.messages = [];
    state.guided = { step: null, answers: {} };

    if (path === 'free') {
      const greeting = "Hi! Tell me what you're in the mood for — vibe, time, a specific dish, anything goes. I'll write you one real recipe and generate a photo of it.";
      addAssistantHtml(`<p>${escapeHtml(greeting)}</p>`, greeting);
    } else {
      state.guided.step = 'mood';
      const intro = "Lovely. Three quick questions and I'll author something for you.";
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
    if (context === 'guided') handleGuidedAnswer(value);
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
      const a = state.guided.answers;
      const synthesized =
        `I'm feeling ${(a.mood || 'open').toLowerCase()}, ` +
        `I've got about ${(a.time || 'a moderate amount of time').toLowerCase()}, ` +
        `and I want ${(a.effort || 'a normal amount').toLowerCase()} of cooking energy. ` +
        `Author one recipe for me.`;
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

  // ---------- cart hand-off ----------
  async function sendToCart(buttonEl) {
    const recipeId = buttonEl.dataset.sendCart;
    const providerId = buttonEl.dataset.provider || state.preferences.cartProvider || 'instacart';

    const recipe = state.recipesById[String(recipeId)];
    const ingredients = recipe?.ingredients;
    if (!ingredients || ingredients.length === 0) {
      addAssistantHtml(
        `<p>I lost track of this recipe's ingredients — try asking for a new one.</p>`,
        "I lost track of this recipe's ingredients."
      );
      return;
    }

    // Phase 10: if the user is signed in AND has vaulted creds for the
    // chosen provider, kick off the autonomous agent instead of the
    // public-search hand-off.
    if (state.auth.email && state.vaultProviders[providerId]) {
      return runAgentForRecipe(buttonEl, recipeId, providerId);
    }

    const originalText = buttonEl.textContent;
    buttonEl.disabled = true;
    buttonEl.textContent = 'Opening…';

    try {
      const res = await fetch('/api/cart/build', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ingredients: ingredients.map(i => ({ name: i.name, qty: i.qty, unit: i.unit })),
          provider: providerId,
          recipeId,
          title: recipe.title
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data.url) throw new Error('No URL returned from /api/cart/build.');

      const opened = window.open(data.url, '_blank', 'noopener');
      if (!opened) {
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

  // ---------- Phase 10: autonomous agent runner ----------
  async function runAgentForRecipe(buttonEl, recipeId, providerId) {
    const originalText = buttonEl.textContent;
    buttonEl.disabled = true;
    buttonEl.textContent = 'Agent working…';

    const liveId = 'agent-live-' + Date.now();
    state.messages.push({
      role: 'assistant',
      id: liveId,
      text: 'Agent run starting…',
      html: `<div class="agent-live"><h5>Agent run · ${escapeHtml(providerId)}</h5><ul id="${liveId}-feed"></ul></div>`
    });
    drawMessages();

    const feed = () => document.getElementById(`${liveId}-feed`);
    const pushLine = (kind, text) => {
      const f = feed();
      if (!f) return;
      const li = document.createElement('li');
      li.className = `agent-line agent-${kind}`;
      li.innerHTML = `<strong>${escapeHtml(kind)}</strong> · ${escapeHtml(text)}`;
      f.appendChild(li);
      f.parentElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
    };

    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ recipeId, providerId })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split('\n\n');
        buf = events.pop();
        for (const block of events) {
          if (!block.startsWith('event:')) continue;
          const eventLine = block.split('\n').find(l => l.startsWith('event:')) || '';
          const dataLine = block.split('\n').find(l => l.startsWith('data:')) || '';
          const event = eventLine.slice('event:'.length).trim();
          const data = JSON.parse(dataLine.slice('data:'.length).trim() || 'null');
          if (event === 'start') pushLine('start', `Run ${data.runId} for ${data.recipeTitle}`);
          else if (event === 'screenshot') pushLine('screenshot', data.hint + (data.hasImage ? ' (image stored)' : ''));
          else if (event === 'decision') pushLine('decision', data.reasoning.slice(0, 200));
          else if (event === 'action') pushLine('action', `${data.action}${data.ok ? '' : ' (failed: ' + (data.error || '') + ')'}`);
          else if (event === 'note') pushLine('note', data.note);
          else if (event === 'error') pushLine('error', data.message);
          else if (event === 'done') {
            const r = data.result || {};
            pushLine('done', r.status === 'stopped_for_review'
              ? `Cart ready · ${r.ingredientCount || 0} items · ${r.dryRun ? '(DRY RUN — no real browser)' : 'open Instacart to review + checkout'}`
              : `status=${r.status}${r.reason ? ' · ' + r.reason : ''}`);
            if (r.cartUrl && !r.dryRun) {
              const f = feed();
              if (f) {
                const li = document.createElement('li');
                li.className = 'agent-line agent-done';
                const a = document.createElement('a');
                a.href = r.cartUrl;
                a.target = '_blank';
                a.rel = 'noopener';
                a.textContent = 'Open cart →';
                li.appendChild(a);
                f.appendChild(li);
              }
            }
          }
        }
      }
    } catch (err) {
      pushLine('error', err.message || String(err));
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

      const knownRecipes = Object.values(state.recipesById)
        .map(r => ({ id: r.id, title: r.title }));

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
    const recipe = json.recipe;

    if (recipe?.id) {
      state.recipesById[String(recipe.id)] = recipe;
      const html = (text ? `<p>${escapeHtml(text)}</p>` : '') + renderRecipeCard(recipe, { xrefPending: json.xrefPending });
      addAssistantHtml(html, text || `Here's a recipe for ${recipe.title}.`, { recipe });

      if (json.xrefPending) schedulePollXref(recipe.id);
    } else {
      addAssistantHtml(`<p>${escapeHtml(text || '(empty response)')}</p>`, text);
    }
  }

  // ---------- xref polling ----------
  function schedulePollXref(recipeId, attempt = 0) {
    if (attempt > 4) return;
    setTimeout(async () => {
      try {
        const res = await fetch(`/api/recipes/xref/${encodeURIComponent(recipeId)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data?.pending) {
          schedulePollXref(recipeId, attempt + 1);
          return;
        }
        if (data?.matchCount != null) {
          const node = document.querySelector(`[data-xref-for="${CSS.escape(String(recipeId))}"]`);
          if (node) {
            node.textContent = data.matchCount > 0
              ? `Cross-referenced against ~${data.matchCount} similar recipes across Spoonacular, Edamam, TheMealDB, and Tasty.`
              : `No close matches in public recipe DBs — this is a fresh take.`;
          }
        }
      } catch { /* silently give up */ }
    }, attempt === 0 ? 3000 : 2500);
  }

  // ---------- rendering ----------
  function renderRecipeCard(r, opts = {}) {
    const ing = (r.ingredients || []).map(i => `
      <li>${formatQtyHtml(i)}${escapeHtml(i.name || '')}</li>
    `).join('');
    const steps = (r.instructions || []).map(s => `<li>${escapeHtml(s)}</li>`).join('');

    const providerId = state.preferences.cartProvider || 'instacart';
    const provider = state.cartProviders[providerId] || FALLBACK_PROVIDERS[providerId] || FALLBACK_PROVIDERS.instacart;
    const modeNote = MODE_NOTES[provider.mode] || '';

    const totalMin = r.time?.total_min || 0;
    const servings = r.servings || 0;

    const imageHtml = r.imageUrl
      ? `<div class="approval-img"><img src="${escapeHtml(r.imageUrl)}" alt="" loading="lazy" /></div>`
      : '';

    const xrefInitial = opts.xrefPending
      ? 'Cross-referencing against Spoonacular, Edamam, TheMealDB, and Tasty…'
      : '';

    return `
      <div class="approval">
        <div class="approval-head">
          <h4>${escapeHtml(r.title)}</h4>
          <span class="ai-badge" title="Authored by an AI chef, photo generated by Imagen 3">AI-generated</span>
        </div>
        ${imageHtml}
        <div class="meta">
          ${totalMin ? escapeHtml(totalMin + ' min') : ''}
          ${servings ? ' · ' + escapeHtml('serves ' + servings) : ''}
          ${Array.isArray(r.cuisine_tags) && r.cuisine_tags.length ? ' · ' + r.cuisine_tags.map(t => escapeHtml(t)).join(' · ') : ''}
        </div>

        ${r.summary ? `<p class="approval-summary">${escapeHtml(r.summary)}</p>` : ''}

        <h5>What you'll need</h5>
        <ul class="ingredients">${ing || '<li>(no ingredients returned)</li>'}</ul>

        ${steps ? `<h5>Steps</h5><ol class="steps">${steps}</ol>` : ''}

        <button class="send" type="button" data-send-cart="${escapeHtml(r.id)}" data-provider="${escapeHtml(provider.id)}">
          Send to ${escapeHtml(provider.name)} →
        </button>
        <p class="demo-note">${escapeHtml(modeNote)}</p>

        <div class="approval-foot">
          <button class="chip alt" type="button" data-alternatives="1">Show me a different idea</button>
          <span class="xref-footer" data-xref-for="${escapeHtml(r.id)}">${escapeHtml(xrefInitial)}</span>
        </div>
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
      recipesById: {},
      cartProviders: state.cartProviders,
      preferences: loadPreferences(),
      auth: state.auth
    };
    render();
  }

  render();
})();
