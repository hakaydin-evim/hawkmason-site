// Crewops Aviation Platform · operator portal: the Today board.
// One list, across the products the operator code holds, of what needs action
// now (GET /portal/today). A line opens the record in its product's section.
(() => {
  const ENDPOINT = (window.CREWOPS_PORTAL_ENDPOINT || 'https://updates.hawkmason.com/portal');
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const NAMES = { insight: 'Fatigue', safety: 'Safety', academy: 'Training', library: 'Documents' };
  const PILL = { bad: ['bad', 'NOW'], warn: ['warn', 'SOON'], info: ['mute', 'NOTE'] };
  const FIRST = 12;
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

  // A line → its product's section, and the record itself where that section can open one.
  const OPEN = { report: 'crewops-open-report', risk: 'crewops-open-risk', audit: 'crewops-open-audit', change: 'crewops-open-change' };
  $('todayList').addEventListener('click', (ev) => {
    const b = ev.target.closest('.tdi');
    if (!b) return;
    const it = (state.all ? state.items : state.items.slice(0, FIRST))[Number(b.dataset.i)];
    const ref = it.ref || {};
    const kind = Object.keys(ref).find((k) => OPEN[k]);
    if (kind) { window.dispatchEvent(new CustomEvent(OPEN[kind], { detail: { id: ref[kind] } })); return; }
    const section = $(it.product === 'insight' ? 'insight' : it.product);
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('todayMore').addEventListener('click', () => { state.all = true; draw(); });
  $('todayRefresh').addEventListener('click', load);

  window.addEventListener('crewops-code', (ev) => {
    const { code, licence } = ev.detail;
    if (!licence || !licence.ops) { $('today').classList.add('hidden'); return; }
    state.code = code;
    $('today').classList.remove('hidden');
    load();
  });
})();
