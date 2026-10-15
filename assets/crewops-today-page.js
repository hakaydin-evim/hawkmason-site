// Crewops Aviation Platform · operator portal: the Today board.
// One list, across the products the operator code holds, of what needs action
// now (GET /portal/today). A line opens the record in its product's section.
(() => {
  const ENDPOINT = (window.CREWOPS_PORTAL_ENDPOINT || 'https://updates.hawkmason.com/portal');
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const NAMES = { insight: 'Fatigue', safety: 'Safety', academy: 'Training', library: 'Documents', tasks: 'Tasks' };
  const PILL = { bad: ['bad', 'NOW'], warn: ['warn', 'SOON'], info: ['mute', 'NOTE'] };
  const FIRST = 12;
  const TASKS = (window.CREWOPS_TASKS_ENDPOINT || 'https://updates.hawkmason.com/tasks');
  const state = { code: null, items: [], all: false };
  if (!$('today')) return;

  const due = (d) => (d ? (d.length > 10 ? `${d.slice(0, 10)} ${d.slice(11, 16)}Z` : d) : '');
  function draw() {
    const list = state.all ? state.items : state.items.slice(0, FIRST);
    $('todayList').innerHTML = list.length
      ? list.map((it, i) => `<button class="tdi" data-i="${i}"><span class="pill ${PILL[it.level][0]}">${PILL[it.level][1]}</span><span class="p">${NAMES[it.product] || it.product}</span><span class="t"><b>${esc(it.title)}</b><span>${esc(it.detail)}</span></span><span class="d">${esc(due(it.due))}</span></button>`).join('')
      : '<p class="fine">Nothing needs action today.</p>';
    $('todayMore').hidden = state.all || state.items.length <= FIRST;
    $('todayMore').textContent = `SHOW ALL ${state.items.length}`;
  }

  async function load() {
    $('todayList').innerHTML = '<p class="fine">Loading…</p>';
    try {
      const res = await fetch(`${ENDPOINT}/today`, { headers: { authorization: `Bearer ${state.code}` } });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      state.items = body.items;
      const c = body.counts;
      $('todayCounts').innerHTML = [['bad', 'now'], ['warn', 'soon'], ['info', 'note']].filter(([k]) => c[k]).map(([k, l]) => `<span class="pill ${PILL[k][0]}">${c[k]} ${l}</span>`).join('') || '<span class="pill ok">all clear</span>';
      draw();
    } catch (e) {
      $('todayList').innerHTML = `<p class="msg">${esc(e.message)}</p>`;
    }
  }

  // The Tasks tile says how many tasks are open; silent when the service does not answer.
  async function taskTile() {
    const st = document.querySelector('#modbar [data-mod="tasks"] [data-state]');
    if (!st) return;
    try {
      const res = await fetch(`${TASKS}?status=open`, { headers: { authorization: `Bearer ${state.code}` } });
      const c = res.ok ? (await res.json()).counts : null;
      if (c && typeof c.open === 'number') st.textContent = `${c.open + (c.in_progress || 0)} open${c.overdue ? ` · ${c.overdue} overdue` : ''}`;
    } catch (e) { /* the tile keeps "Open" */ }
  }

  // A line opens its record in the product's own panel (each record has an address there).
  const PANEL = { insight: '/crewops/insight', safety: '/crewops/portal/safety', academy: '/crewops/portal/academy', library: '/crewops/portal/library', tasks: '/crewops/portal/tasks' };
  const HASH = { report: 'r', risk: 'risk', audit: 'audit', change: 'change', course: 'course', notice: 'notice', doc: 'doc', crew: 'crew', task: 't' };
  $('todayList').addEventListener('click', (ev) => {
    const b = ev.target.closest('.tdi');
    if (!b) return;
    const it = (state.all ? state.items : state.items.slice(0, FIRST))[Number(b.dataset.i)];
    const ref = it.ref || {};
    const kind = Object.keys(ref).find((k) => HASH[k]);
    location.href = `${PANEL[it.product] || '/crewops/portal'}${kind ? `#${HASH[kind]}/${encodeURIComponent(ref[kind])}` : ''}`;
  });
  $('todayMore').addEventListener('click', () => { state.all = true; draw(); });
  $('todayRefresh').addEventListener('click', load);

  window.addEventListener('crewops-code', (ev) => {
    const { code, licence } = ev.detail;
    if (!licence || !licence.ops) { $('today').classList.add('hidden'); return; }
    state.code = code;
    $('today').classList.remove('hidden');
    load();
    taskTile();
  });
})();
