// Crewops Tasks on the operator panel: one structure for corrective actions,
// training gaps, document confirmations and report follow-ups. A department
// assigns a task to a crew member, a role or an office; the crew see it on the
// phone and complete it there; the result shows here (and reaches the airline's
// own system as the task.completed webhook event). Office tasks are completed
// here. Opens with any operator code, whatever products it lists.
//   GET /tasks?status=all   POST /tasks   GET /tasks/<id>   PATCH /tasks/<id>
(() => {
  const $ = (id) => document.getElementById(id);
  if (!$('tasks')) return;
  const ENDPOINT = (window.CREWOPS_TASKS_ENDPOINT || 'https://updates.hawkmason.com/tasks');
  const state = { code: null, tasks: [], counts: null, open: null, detail: null };
  const KIND = { action: 'Corrective action', training: 'Training', document: 'Document', report: 'Report follow-up', other: 'Other' };
  const STATUS = { open: ['warn', 'open'], in_progress: ['prog', 'in progress'], done: ['ok', 'done'], cancelled: ['mute', 'cancelled'] };
  const ROLES = [['cockpit', 'All cockpit crew'], ['cabin', 'All cabin crew'], ['all', 'All crew']];
  const OFFICES = [['safety', 'Safety office'], ['training', 'Training office'], ['documentation', 'Documentation office'], ['operations', 'Operations']];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const label = (list, v) => (list.find(([k]) => k === v) || [v, v])[1];
  const asgLabel = (a) => (!a ? '—' : a.type === 'crew' ? `Crew ${a.crewCode}` : a.type === 'role' ? label(ROLES, a.role) : label(OFFICES, a.office));
  const utc = (at) => String(at || '').replace('T', ' ').slice(0, 16);
  const today = () => new Date().toISOString().slice(0, 10);
  const isLive = (t) => t.status === 'open' || t.status === 'in_progress';
  const isLate = (t) => !!t.due && isLive(t) && t.due < today();
  const validDate = (s) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false; const d = new Date(`${s}T00:00:00Z`); return !isNaN(d) && d.toISOString().slice(0, 10) === s; };
  const doneBy = (s) => (!s ? '' : s === 'operator' ? 'the operator' : s.startsWith('crew:') ? `crew ${s.slice(5)}` : s.startsWith('office:') ? s.slice(7) : s);
  const pill = (status) => { const [c, l] = STATUS[status] || ['mute', status]; return `<span class="pill ${c}">${esc(l)}</span>`; };

  // ---- the signed-by label, remembered in this browser -------------------------
  const BYKEY = 'crewops-tasks-by';
  const store = { get: (k) => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  $('tkBy').value = store.get(BYKEY);
  const byValue = () => { const v = $('tkBy').value.trim(); if (v) store.set(BYKEY, v); return v; };

  // ---- the assignee controls: a crew code is typed, a role or an office is picked ----
  function syncAsg(type, text, sel, box, withAny) {
    const t = type.value;
    const list = t === 'role' ? ROLES : t === 'office' ? OFFICES : null;
    if (box) box.style.display = t === 'any' ? 'none' : '';
    const name = text.parentElement.querySelector('span');
    if (name) name.textContent = t === 'role' ? 'Role' : t === 'office' ? 'Office' : 'Crew code';
    text.style.display = list ? 'none' : '';
    sel.style.display = list ? '' : 'none';
    if (list && sel.dataset.kind !== t) {
      sel.innerHTML = (withAny ? '<option value="">Any</option>' : '') + list.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
      sel.dataset.kind = t;
    }
  }
  function readAsg(type, text, sel) {
    if (type === 'role') return { assignee: { type: 'role', role: sel.value } };
    if (type === 'office') return { assignee: { type: 'office', office: sel.value } };
    const c = text.value.trim().toUpperCase();
    if (!c) return { error: 'Enter the crew code.' };
    if (!/^[A-Z0-9]{2,12}$/.test(c)) return { error: 'A crew code is 2 to 12 letters or digits, for example ZZ042.' };
    return { assignee: { type: 'crew', crewCode: c } };
  }

  async function api(path, init) {
    let res;
    try {
      res = await fetch(`${ENDPOINT}${path}`, { ...init, headers: { authorization: `Bearer ${state.code}`, ...(init && init.body ? { 'content-type': 'application/json' } : {}) } });
    } catch (e) {
      throw new Error('The tasks service did not answer. Check the connection and try again.');
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = new Error(res.status === 403 ? 'This code does not open the tasks panel. The operator code, held by your departments, opens it; the crew code does not.' : body.error || `The tasks service answered ${res.status}.`);
      e.status = res.status;
      throw e;
    }
    return body;
  }

  // ---- the list ---------------------------------------------------------------
  async function load(quiet) {
    if (!quiet) $('tkMsg').textContent = 'Loading…';
    try {
      const body = await api('?status=all');
      state.tasks = body.tasks || [];
      state.counts = body.counts || null;
      drawTiles();
      drawTable();
      $('tkMsg').textContent = state.tasks.length >= 500 ? 'Showing the newest 500 tasks.' : '';
    } catch (e) {
      $('tkMsg').textContent = e.message;
    }
  }

  function drawTiles() {
    const n = (f) => state.tasks.filter(f).length;
    const c = state.counts || {};
    const v = (k, f) => (typeof c[k] === 'number' ? c[k] : n(f));
    const bad = v('overdue', isLate);
    $('tkTiles').innerHTML = [
      ['Open', v('open', (t) => t.status === 'open'), ''], ['In progress', v('in_progress', (t) => t.status === 'in_progress'), ''],
      ['Overdue', bad, bad ? 'color:var(--bad)' : ''], ['Done', v('done', (t) => t.status === 'done'), ''],
    ].map(([l, x, st]) => `<div class="tile"><div class="n"${st ? ` style="${st}"` : ''}>${x}</div><div class="l">${esc(l)}</div></div>`).join('');
  }

  function shown() {
    const s = $('tkFStatus').value;
    const type = $('tkFType').value;
    const late = $('tkFLate').checked;
    const want = type === 'crew' ? $('tkFText').value.trim().toUpperCase() : $('tkFSel').value;
    return state.tasks.filter((t) => {
      if (s === 'active' ? !isLive(t) : s !== 'all' && t.status !== s) return false;
      if (type !== 'any') {
        const a = t.assignee || {};
        if (a.type !== type) return false;
        const have = type === 'crew' ? a.crewCode : type === 'role' ? a.role : a.office;
        if (want && (type === 'crew' ? !String(have || '').includes(want) : have !== want)) return false;
      }
      return !late || isLate(t);
    });
  }

  function drawTable() {
    const rows = shown();
    const empty = state.tasks.length
      ? 'No task matches these filters.'
      : 'No task yet. Create the first one below. Crew see it on their phone the next time the app opens.';
    $('tkTable').innerHTML = `<thead><tr><th>No</th><th>Task</th><th>Kind</th><th>Assigned to</th><th>Due</th><th>Status</th><th>Created</th></tr></thead><tbody>${rows.map((t) => `<tr class="click${state.open === t.id ? ' sel' : ''}" data-id="${esc(t.id)}"${t.status === 'cancelled' ? ' style="opacity:.55"' : ''}><td>${esc(t.id)}</td><td style="white-space:normal;min-width:260px">${esc(t.title)}</td><td>${esc(KIND[t.kind] || t.kind)}</td><td>${esc(asgLabel(t.assignee))}</td><td>${t.due ? esc(t.due) : '—'}${isLate(t) ? ' <span class="pill bad">overdue</span>' : ''}</td><td>${pill(t.status)}</td><td>${t.createdBy ? `${esc(t.createdBy)} · ` : ''}<span class="fine">${esc((t.createdAt || '').slice(0, 10))}</span></td></tr>`).join('') || `<tr><td colspan="7" class="fine">${esc(empty)}</td></tr>`}</tbody>`;
    $('tkTable').querySelectorAll('tr.click').forEach((tr) => tr.addEventListener('click', () => openTask(tr.dataset.id)));
  }

  // ---- one task ---------------------------------------------------------------
  async function openTask(id, push = true) {
    state.open = id;
    if (push && location.hash !== `#t/${id}`) history.pushState(null, '', `#t/${id}`);
    drawTable();
    const box = $('tkDetail');
    box.classList.remove('hidden');
    box.innerHTML = '<p class="fine">Loading…</p>';
    try {
      state.detail = await api(`/${encodeURIComponent(id)}`);
      drawDetail();
      box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      state.detail = null;
      box.innerHTML = `<div class="row" style="justify-content:space-between"><p class="msg" style="margin:0">${esc(e.status === 404 ? `No task with the number ${id}.` : e.message)}</p><button class="ghost" id="tkdClose">CLOSE</button></div>`;
      $('tkdClose').addEventListener('click', () => closeTask());
    }
  }

  function closeTask(push = true) {
    state.open = null;
    state.detail = null;
    $('tkDetail').classList.add('hidden');
    if (push && /^#t\//.test(location.hash)) history.pushState(null, '', location.pathname + location.search);
    drawTable();
  }

  function refHtml(ref) {
    const PAGES = { safety: ['Safety', '/crewops/portal/safety'], academy: ['Academy', '/crewops/portal/academy'], library: ['Library', '/crewops/portal/library'], insight: ['Insight', '/crewops/insight'] };
    const p = PAGES[ref.product];
    if (!p) return '';
    let href = p[1];
    if (ref.product === 'safety' && /^[A-Z0-9]{2,4}-\d{6}-[A-Z0-9]{5}$/.test(ref.id)) href += `#r/${encodeURIComponent(ref.id)}`;
    else if (ref.product === 'library' && /^[A-Z0-9][A-Z0-9.\-]{1,39}$/.test(ref.id)) href += `#doc/${encodeURIComponent(ref.id)}`;
    return `<p class="fine" style="margin:8px 0 0">Linked to <a href="${esc(href)}">${esc(p[0])} · ${esc(ref.id)}</a></p>`;
  }

  function drawDetail() {
    const t = state.detail;
    const live = isLive(t);
    const a = t.assignee || {};
    const btn = (id, text, ghost) => `<button${ghost ? ' class="ghost"' : ''} id="${id}">${text}</button>`;
    const actions = t.status === 'open' ? btn('tkdDone', 'DONE') + btn('tkdStart', 'IN PROGRESS', true) + btn('tkdCancel', 'CANCEL TASK', true)
      : t.status === 'in_progress' ? btn('tkdDone', 'DONE') + btn('tkdCancel', 'CANCEL TASK', true)
        : btn('tkdReopen', 'REOPEN');
    $('tkDetail').innerHTML = `
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div>
          <h3>${esc(t.id)} · ${esc(KIND[t.kind] || t.kind)}</h3>
          <div class="fine">${pill(t.status)} · ${esc(asgLabel(a))} · due ${t.due ? esc(t.due) : 'not set'}${isLate(t) ? ' <span class="pill bad">overdue</span>' : ''} · created ${esc(utc(t.createdAt))} UTC${t.createdBy ? ` by ${esc(t.createdBy)}` : ''}${t.doneAt ? ` · ${t.status === 'done' ? 'done' : 'closed'} ${esc(utc(t.doneAt))} UTC${t.doneBy ? ` by ${esc(doneBy(t.doneBy))}` : ''}` : ''}</div>
        </div>
        <button class="ghost" id="tkdClose">CLOSE</button>
      </div>
      <p style="margin:12px 0 4px"><b>${esc(t.title)}</b></p>
      ${t.detail ? `<p style="white-space:pre-wrap;margin:4px 0">${esc(t.detail)}</p>` : ''}
      ${t.ref ? refHtml(t.ref) : ''}
      <div class="row" style="margin-top:14px"><label class="f" style="flex:1;min-width:240px">Note for the history · optional<input type="text" id="tkdNote" placeholder="What was done, or why" /></label>${actions}</div>
      ${live ? `<div class="row" style="margin-top:10px">
        <label class="f">Due<input type="text" id="tkdDue" value="${esc(t.due || '')}" placeholder="YYYY-MM-DD" style="width:130px" /></label><button class="ghost" id="tkdSetDue">SET DUE</button>
        <label class="f">Reassign to<select id="tkdType"><option value="crew">A crew member</option><option value="role">A role</option><option value="office">An office</option></select></label>
        <label class="f" id="tkdValueBox"><span>Crew code</span><input type="text" id="tkdText" placeholder="ZZ042" style="width:130px;text-transform:uppercase" /><select id="tkdSel"></select></label><button class="ghost" id="tkdReassign">REASSIGN</button>
      </div>` : ''}
      <p class="msg" id="tkdMsg"></p>
      <h3 style="margin-top:6px">HISTORY · NEWEST FIRST</h3>
      <ul class="tl">${[...(t.history || [])].reverse().map((h) => `<li><b>${esc(utc(h.at))}</b> · ${esc(doneBy(h.by))} · ${esc(h.text)}</li>`).join('') || '<li>No entries.</li>'}</ul>`;
    $('tkdClose').addEventListener('click', () => closeTask());
    const on = (id, fn) => { if ($(id)) $(id).addEventListener('click', fn); };
    on('tkdStart', () => change({ status: 'in_progress' }));
    on('tkdDone', () => change({ status: 'done' }));
    on('tkdReopen', () => change({ status: 'open' }));
    on('tkdCancel', () => { if (confirm(`Cancel ${t.id}? It leaves the crew's phones and stays in the history.`)) change({ status: 'cancelled' }); });
    if (live) {
      const type = $('tkdType');
      type.value = a.type || 'crew';
      const sync = () => syncAsg(type, $('tkdText'), $('tkdSel'), null, false);
      sync();
      if (a.type === 'crew') $('tkdText').value = a.crewCode || '';
      else if (a.type === 'role') $('tkdSel').value = a.role;
      else if (a.type === 'office') $('tkdSel').value = a.office;
      type.addEventListener('change', sync);
      on('tkdSetDue', () => {
        const due = $('tkdDue').value.trim();
        if (!validDate(due)) return detailMsg('Write the due date as YYYY-MM-DD, for example 2026-11-30.');
        change({ due });
      });
      on('tkdReassign', () => {
        const r = readAsg(type.value, $('tkdText'), $('tkdSel'));
        if (r.error) return detailMsg(r.error);
        change({ assignee: r.assignee });
      });
    }
  }
  const detailMsg = (text, ok) => { const m = $('tkdMsg'); if (m) { m.textContent = text; m.style.color = ok ? 'var(--ok)' : ''; } };

  async function change(patch) {
    const id = state.detail && state.detail.id;
    if (!id) return;
    const note = $('tkdNote') ? $('tkdNote').value.trim() : '';
    if (note.length > 300) return detailMsg(`The note is 300 characters at most (now ${note.length}).`);
    const by = byValue();
    if (by.length > 60) return detailMsg('Signed by: 60 characters at most.');
    detailMsg('Saving…', true);
    try {
      state.detail = await api(`/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ ...patch, ...(note ? { note } : {}), ...(by ? { by } : {}) }) });
      await load(true);
      drawDetail();
      detailMsg('Saved.', true);
    } catch (e) {
      detailMsg(e.message);
    }
  }

  // ---- a new task -------------------------------------------------------------
  const newMsg = (html, ok) => { $('tkNMsg').innerHTML = html; $('tkNMsg').style.color = ok ? 'var(--ok)' : ''; };
  $('tkCreate').addEventListener('click', async () => {
    const title = $('tkNTitle').value.trim();
    const detail = $('tkNDetail').value.trim();
    const due = $('tkNDue').value.trim();
    if (!title) return newMsg('Write what has to be done.');
    if (title.length > 120) return newMsg(`The task line is 120 characters at most (now ${title.length}). Put the rest in the details.`);
    if (detail.length > 1000) return newMsg(`The details are 1000 characters at most (now ${detail.length}).`);
    const r = readAsg($('tkNType').value, $('tkNText'), $('tkNSel'));
    if (r.error) return newMsg(esc(r.error));
    if (due && !validDate(due)) return newMsg('Write the due date as YYYY-MM-DD, for example 2026-11-30.');
    const by = byValue();
    if (by.length > 60) return newMsg('Signed by: 60 characters at most.');
    $('tkCreate').disabled = true;
    newMsg('Creating…', true);
    try {
      const t = await api('', { method: 'POST', body: JSON.stringify({ title, kind: $('tkNKind').value, assignee: r.assignee, ...(detail ? { detail } : {}), ...(due ? { due } : {}), ...(by ? { by } : {}) }) });
      ['tkNTitle', 'tkNDetail', 'tkNDue'].forEach((id) => { $(id).value = ''; });
      await load(true);
      newMsg(`Created <a href="#t/${esc(t.id)}">${esc(t.id)}</a>. ${r.assignee.type === 'office' ? 'The office completes it here.' : 'It shows on the crew phone the next time the app opens.'}`, true);
    } catch (e) {
      newMsg(esc(e.message));
    } finally {
      $('tkCreate').disabled = false;
    }
  });

  // ---- wiring -----------------------------------------------------------------
  $('tkNType').addEventListener('change', () => syncAsg($('tkNType'), $('tkNText'), $('tkNSel'), $('tkNValueBox'), false));
  syncAsg($('tkNType'), $('tkNText'), $('tkNSel'), $('tkNValueBox'), false);
  const filterSync = () => { syncAsg($('tkFType'), $('tkFText'), $('tkFSel'), $('tkFValueBox'), true); drawTable(); };
  $('tkFType').addEventListener('change', filterSync);
  ['tkFStatus', 'tkFSel', 'tkFLate'].forEach((id) => $(id).addEventListener('change', drawTable));
  $('tkFText').addEventListener('input', drawTable);
  $('tkRefresh').addEventListener('click', () => load());
  $('tkBy').addEventListener('change', byValue);
  $('tkNewBtn').addEventListener('click', () => { $('tkNew').scrollIntoView({ behavior: 'smooth', block: 'start' }); $('tkNTitle').focus({ preventScroll: true }); });

  // The address names a task (#t/<id>): its detail opens.
  function fromHash() {
    const m = /^#t\/([A-Za-z0-9\-]{3,40})$/.exec(location.hash);
    if (m) openTask(m[1], false); else if (state.open) closeTask(false);
  }
  window.addEventListener('popstate', fromHash);
  window.addEventListener('crewops-code', (ev) => {
    const { code, licence } = ev.detail;
    if (!licence || !licence.ops) { $('tasks').classList.add('hidden'); return; }
    state.code = code;
    $('tasks').classList.remove('hidden');
    load().then(fromHash);
  });
})();
