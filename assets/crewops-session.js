// Crewops operator portal · the shared session (2026-10-14).
// Every portal page (the hub and each product's panel) loads this: it reads the
// operator code the browser keeps, checks it, draws the top bar, tells the page's
// scripts (the `crewops-code` event, or `crewops-nocode`), shows "not in your
// licence" on a panel the code does not hold, and counts the portal's use
// (opens, panels viewed, analyses, exports; counts only).
(() => {
  const ENDPOINT = (window.CREWOPS_PORTAL_ENDPOINT || 'https://updates.hawkmason.com/portal');
  const $ = (id) => document.getElementById(id);
  const PANEL = document.body.dataset.panel || 'hub';
  const NAMES = { insight: 'Crewops Insight', safety: 'Crewops Safety', academy: 'Crewops Academy', library: 'Crewops Library', tasks: 'Crewops Tasks' };
  // Tasks is not a product: every operator code opens it, whatever products the licence lists.
  const PAGE_OF = { insight: '/crewops/insight', safety: '/crewops/safety', academy: '/crewops/academy', library: '/crewops/library', tasks: '/crewops/portal/tasks' };
  const KEY = 'crewops-insight-code'; // the name FTL's browser already holds; never renamed
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} } };
  const check = (text) => (window.CrewopsLicence || window.CrewopsInsight).checkCode(text);
  let code = null;
  let licence = null;

  // ---- activity counting -----------------------------------------------------
  const send = (event, product) => {
    if (!code) return;
    fetch(`${ENDPOINT}/activity`, { method: 'POST', headers: { authorization: `Bearer ${code}`, 'content-type': 'application/json' }, body: JSON.stringify(product ? { event, product } : { event }), keepalive: true }).catch(() => undefined);
  };
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.id === 'run') send('analyse');
    else if (['csv', 'print', 'safetyCsv', 'safetyE5x', 'acCsv', 'sdE5x'].includes(b.id)) send('export');
  }, true);

  // ---- the top bar ------------------------------------------------------------
  function drawBar() {
    const bar = $('pbar');
    if (!bar) return;
    const held = licence ? licence.products || ['insight'] : null;
    bar.querySelectorAll('.pbar-nav a').forEach((a) => {
      const p = a.dataset.panel;
      if (p === PANEL) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      const product = ['insight', 'safety', 'academy', 'library'].includes(p);
      a.classList.toggle('gone', !!held && product && !held.includes(p) && p !== 'insight');
      a.classList.toggle('off', !!held && product && !held.includes(p));
      if (held && product && !held.includes(p)) a.title = `${NAMES[p]} is not in your licence`;
    });
    bar.classList.toggle('out', !licence);
    const brand = bar.querySelector('.pbar-brand');
    if (brand && PANEL === 'insight') brand.setAttribute('href', licence ? '/crewops/portal' : '/crewops/airlines');
    $('pbarAirline').textContent = licence ? `${licence.name} · until ${licence.exp}${licence.ops ? '' : ' · crew code'}` : '';
    $('signOut').hidden = !licence;
  }

  // Hub tiles: what the code holds opens, the rest leads to the product's page.
  function drawTiles() {
    const bar = $('modbar');
    if (!bar) return;
    const held = licence ? licence.products || ['insight'] : null;
    for (const a of bar.querySelectorAll('.mod')) {
      const mod = a.dataset.mod;
      const st = a.querySelector('[data-state]');
      a.classList.remove('on', 'off');
      if (!held) { st.textContent = 'Sign in to open'; continue; }
      const ops = mod === 'insight' || licence.ops;
      if (mod === 'tasks') {
        if (licence.ops) { a.classList.add('on'); st.textContent = 'Open'; } else { a.classList.add('off'); st.textContent = 'Needs the operator code'; }
        continue;
      }
      if (held.includes(mod) && ops) { a.classList.add('on'); st.textContent = 'Open'; }
      else if (held.includes(mod)) { a.classList.add('off'); st.textContent = 'Needs the operator code'; a.href = PAGE_OF[mod]; }
      else { a.classList.add('off'); st.textContent = 'Not in your licence · what it does'; a.href = PAGE_OF[mod]; }
    }
  }

  function noAccess() {
    const box = $('noAccess');
    if (!box || !licence || PANEL === 'hub') return;
    const held = licence.products || ['insight'];
    let text = '';
    if (['safety', 'academy', 'library'].includes(PANEL) && !held.includes(PANEL)) text = `Your airline's code does not include ${NAMES[PANEL]}. Read what it does on <a href="${PAGE_OF[PANEL]}">its page</a>, or <a href="mailto:hello@hawkmason.com?subject=${encodeURIComponent(`${NAMES[PANEL]} for our airline`)}">ask us</a>.`;
    else if (['safety', 'academy', 'library', 'tasks', 'connect'].includes(PANEL) && !licence.ops) text = 'This is the crew code. The operator code, held by your departments, opens this panel.';
    box.classList.toggle('hidden', !text);
    $('noAccessText').innerHTML = text;
  }

  function signedIn(text) {
    const r = check(text);
    if (!r.ok) return r;
    code = text.trim();
    licence = r;
    store.set(KEY, code);
    drawBar(); drawTiles(); noAccess();
    if ($('code')) $('code').value = code;
    if ($('accessNote') && PANEL !== 'insight') {
      const names = { insight: 'Insight', safety: 'Safety', academy: 'Academy', library: 'Library' };
      $('accessNote').innerHTML = `Signed in: <b>${r.name}</b>, until ${r.exp}. Products: ${(r.products || ['insight']).map((x) => names[x] || x).join(', ')}.`;
    }
    const access = $('access');
    if (access && PANEL !== 'insight') access.classList.add('hidden');
    window.dispatchEvent(new CustomEvent('crewops-code', { detail: { code, licence: r } }));
    // One "open" per browser session, one "view" per panel page.
    try { if (!sessionStorage.getItem('crewops-portal-open')) { sessionStorage.setItem('crewops-portal-open', '1'); send('open'); } } catch (e) {}
    send('view', PANEL === 'hub' ? 'today' : PANEL);
    return r;
  }

  const btn = $('codeBtn');
  if (btn) btn.addEventListener('click', () => {
    const r = signedIn($('code').value);
    if (!r.ok) $('msg').textContent = r.reason === 'expired' ? 'This code has run out. Ask for a renewed one.' : r.reason === 'none' ? 'Paste the whole code.' : 'This code was not issued by Crewops.';
    else if ($('msg')) $('msg').textContent = '';
  });
  if ($('code')) $('code').addEventListener('keydown', (e) => { if (e.key === 'Enter') btn.click(); });
  $('signOut').addEventListener('click', () => { store.set(KEY, null); try { sessionStorage.removeItem('crewops-portal-open'); } catch (e) {} location.href = '/crewops/portal'; });

  const saved = store.get(KEY);
  drawBar(); drawTiles();
  if (saved && check(saved).ok) signedIn(saved);
  else window.dispatchEvent(new CustomEvent('crewops-nocode'));
})();
