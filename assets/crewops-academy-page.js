// Crewops Academy on the Insight page: the training department publishes
// read-and-sign notices, uploads qualification records (CSV), assigns courses,
// and sees who has confirmed what and whose qualification expires when. Opens
// only with the OPERATOR code; talks to updates.hawkmason.com/academy/*.
(() => {
  const $ = (id) => document.getElementById(id);
  const ENDPOINT = (window.CREWOPS_ACADEMY_ENDPOINT || 'https://updates.hawkmason.com/academy');
  const state = { code: null, overview: null, notices: [], courses: [], records: [] };
  const NTYPES = { crew_notice: 'Crew notice', safety_bulletin: 'Safety bulletin', safety_memo: 'Safety memo', coordination_sheet: 'Coordination sheet', security_notice: 'Security notice', information: 'Information', training_document: 'Training document', revision: 'Revision' };
  const KINDS = ['opc', 'lpc', 'line_check', 'sep', 'dg', 'crm', 'first_aid', 'route_competence', 'aerodrome_competence', 'recurrent_cabin', 'triennial_cabin', 'medical', 'licence', 'other'];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  async function api(path, init) {
    const res = await fetch(`${ENDPOINT}${path}`, { ...init, headers: { authorization: `Bearer ${state.code}`, ...(init && init.body ? { 'content-type': 'application/json' } : {}) } });
    if (res.status === 401 || res.status === 403) throw new Error('This code does not open the training workspace. The operator code is needed.');
    if (!res.ok) { let m = `The academy service answered ${res.status}.`; try { m = (await res.json()).error || m; } catch (e) {} throw new Error(m); }
    return res;
  }

  async function load() {
    $('acMsg').textContent = 'Loading…';
    try {
      const [o, n, c, r] = await Promise.all([api('/overview'), api('/notices'), api('/courses'), api('/records')]);
      state.overview = await o.json();
      state.notices = (await n.json()).notices;
      state.courses = (await c.json()).courses;
      state.records = (await r.json()).records;
      draw();
      $('acMsg').textContent = '';
    } catch (e) { $('acMsg').textContent = e.message; }
  }

  function draw() {
    const o = state.overview;
    $('acTiles').innerHTML = [
      ['Crew on record', o.crew], ['Expired', o.expired.length], ['Expiring · 30 days', o.expiring.length], ['Notices overdue', o.overdueNotices.length], ['Notices live', o.notices],
    ].map(([l, v]) => `<div class="tile"><div class="n">${v}</div><div class="l">${esc(l)}</div></div>`).join('');

    const exp = [...o.expired.map((e) => ({ ...e, state: 'expired' })), ...o.expiring.map((e) => ({ ...e, state: 'expiring' }))];
    $('acExpiry').innerHTML = `<thead><tr><th>Crew</th><th>Role</th><th>Item</th><th>Expires</th><th>State</th></tr></thead><tbody>${exp.map((e) => `<tr><td>${esc(e.crewCode)}</td><td>${esc(e.role || '')}</td><td>${esc(e.label || e.kind)}</td><td>${esc(e.expires)}</td><td><span class="pill ${e.state === 'expired' ? 'bad' : 'warn'}">${e.state}</span></td></tr>`).join('') || '<tr><td colspan="5" class="fine">Nothing expired or expiring within 30 days.</td></tr>'}</tbody>`;

    $('acNotices').innerHTML = `<thead><tr><th>Id</th><th>Type</th><th>Title</th><th>Issued</th><th>Due</th><th>Confirmed</th><th></th></tr></thead><tbody>${state.notices.map((n) => `<tr${n.withdrawn ? ' style="opacity:.45"' : ''}><td>${esc(n.id)}</td><td>${esc(NTYPES[n.type] || n.type)}</td><td style="white-space:normal;min-width:240px">${esc(n.title)}</td><td>${esc(n.issuedAt.slice(0, 10))}</td><td>${esc(n.dueDate || '—')}</td><td>${n.acks} / ${o.crew}</td><td>${n.withdrawn ? 'withdrawn' : `<a href="#" data-acks="${esc(n.id)}">who</a> · <a href="#" data-withdraw="${esc(n.id)}">withdraw</a>`}</td></tr>`).join('') || '<tr><td colspan="7" class="fine">No notice yet.</td></tr>'}</tbody>`;
    $('acNotices').querySelectorAll('a[data-acks]').forEach((a) => a.addEventListener('click', async (ev) => { ev.preventDefault(); try { const d = await (await api(`/notices/${a.dataset.acks}/acks`)).json(); $('acMsg').textContent = `${d.notice.title}: confirmed by ${d.acks.map((x) => `${x.crewCode} (${x.at.slice(0, 10)})`).join(', ') || 'nobody yet'}.`; } catch (e) { $('acMsg').textContent = e.message; } }));
    $('acNotices').querySelectorAll('a[data-withdraw]').forEach((a) => a.addEventListener('click', async (ev) => { ev.preventDefault(); if (!confirm('Withdraw this notice from every phone?')) return; try { await api(`/notices/${a.dataset.withdraw}`, { method: 'DELETE' }); await load(); } catch (e) { $('acMsg').textContent = e.message; } }));

    $('acCourses').innerHTML = `<thead><tr><th>Id</th><th>Title</th><th>Due</th><th>Minutes</th><th>Completed</th><th></th></tr></thead><tbody>${state.courses.map((c) => `<tr${c.withdrawn ? ' style="opacity:.45"' : ''}><td>${esc(c.id)}</td><td style="white-space:normal;min-width:240px">${esc(c.title)}</td><td>${esc(c.dueDate || '—')}</td><td>${esc(c.minutes || '')}</td><td>${c.completions} / ${o.crew}</td><td>${c.withdrawn ? 'withdrawn' : `<a href="#" data-done="${esc(c.id)}">who</a> · <a href="#" data-cwithdraw="${esc(c.id)}">withdraw</a>`}</td></tr>`).join('') || '<tr><td colspan="6" class="fine">No course yet.</td></tr>'}</tbody>`;
    $('acCourses').querySelectorAll('a[data-done]').forEach((a) => a.addEventListener('click', async (ev) => { ev.preventDefault(); try { const d = await (await api(`/courses/${a.dataset.done}/done`)).json(); $('acMsg').textContent = `${d.course.title}: completed by ${d.done.map((x) => `${x.crewCode} (${x.at.slice(0, 10)}${x.score !== undefined ? ', ' + x.score + '%' : ''})`).join(', ') || 'nobody yet'}.`; } catch (e) { $('acMsg').textContent = e.message; } }));
    $('acCourses').querySelectorAll('a[data-cwithdraw]').forEach((a) => a.addEventListener('click', async (ev) => { ev.preventDefault(); if (!confirm('Withdraw this course?')) return; try { await api(`/courses/${a.dataset.cwithdraw}`, { method: 'DELETE' }); await load(); } catch (e) { $('acMsg').textContent = e.message; } }));

    $('acRecords').innerHTML = `<thead><tr><th>Crew</th><th>Role</th><th>Items</th><th>Nearest expiry</th><th>Phone</th><th></th></tr></thead><tbody>${state.records.map((r) => { const exps = (r.items || []).map((i) => i.expires).filter(Boolean).sort(); return `<tr><td>${esc(r.crewCode)}</td><td>${esc(r.role || '')}</td><td>${(r.items || []).length}</td><td>${esc(exps[0] || '—')}</td><td>${r.paired ? 'paired' : '—'}</td><td>${r.paired ? `<a href="#" data-unbind="${esc(r.crewCode)}">reset pairing</a>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="6" class="fine">No records yet. Upload a CSV below.</td></tr>'}</tbody>`;
    $('acRecords').querySelectorAll('a[data-unbind]').forEach((a) => a.addEventListener('click', async (ev) => { ev.preventDefault(); if (!confirm(`Reset the phone pairing of ${a.dataset.unbind}? The next phone that reads the code will be paired.`)) return; try { await api('/unbind', { method: 'POST', body: JSON.stringify({ crewCode: a.dataset.unbind }) }); await load(); } catch (e) { $('acMsg').textContent = e.message; } }));
  }

  // Publishing
  $('acNoticeBtn').addEventListener('click', async () => {
    const body = { type: $('acNType').value, title: $('acNTitle').value.trim(), body: $('acNBody').value.trim(), url: $('acNUrl').value.trim(), dueDate: $('acNDue').value.trim(), minutes: parseInt($('acNMin').value, 10) || undefined, audience: audienceOf($('acNAud').value), by: $('acBy').value.trim() || undefined };
    if (!body.title) { $('acMsg').textContent = 'A title is needed.'; return; }
    try { await api('/notices', { method: 'POST', body: JSON.stringify(body) }); $('acNTitle').value = ''; $('acNBody').value = ''; $('acNUrl').value = ''; await load(); $('acMsg').textContent = 'Published. It is on every crew phone the next time the app opens.'; } catch (e) { $('acMsg').textContent = e.message; }
  });
  $('acCourseBtn').addEventListener('click', async () => {
    const body = { title: $('acCTitle').value.trim(), kind: $('acCKind').value || undefined, dueDate: $('acCDue').value.trim(), url: $('acCUrl').value.trim(), minutes: parseInt($('acCMin').value, 10) || undefined, audience: audienceOf($('acCAud').value), by: $('acBy').value.trim() || undefined };
    if (!body.title) { $('acMsg').textContent = 'A title is needed.'; return; }
    try { await api('/courses', { method: 'POST', body: JSON.stringify(body) }); $('acCTitle').value = ''; $('acCUrl').value = ''; await load(); $('acMsg').textContent = 'Assigned.'; } catch (e) { $('acMsg').textContent = e.message; }
  });
  function audienceOf(v) {
    v = (v || '').trim();
    if (!v || v === 'all') return 'all';
    if (v === 'cockpit' || v === 'cabin') return { roles: [v] };
    return { codes: v.toUpperCase().split(/[\s,;]+/).filter(Boolean) };
  }

  // Records CSV: crew_code,role,name,kind,label,issued,expires,note — one row per item; a crew code's rows replace its record.
  $('acCsvFile').addEventListener('change', async (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    const lines = (await f.text()).split(/\r?\n/).filter((l) => l.trim());
    const head = lines.shift().split(',').map((h) => h.trim().toLowerCase());
    const col = (row, name) => { const i = head.indexOf(name); return i >= 0 ? (row[i] || '').trim() : ''; };
    const byCode = new Map();
    for (const line of lines) {
      const row = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"'));
      const code = col(row, 'crew_code').toUpperCase();
      if (!code) continue;
      const rec = byCode.get(code) || { crewCode: code, role: col(row, 'role') || undefined, name: col(row, 'name') || undefined, items: [] };
      const kind = col(row, 'kind');
      if (kind) rec.items.push({ kind: KINDS.includes(kind) ? kind : 'other', label: col(row, 'label') || (KINDS.includes(kind) ? undefined : kind), issued: col(row, 'issued') || undefined, expires: col(row, 'expires') || undefined, note: col(row, 'note') || undefined });
      byCode.set(code, rec);
    }
    const records = [...byCode.values()];
    if (!records.length) { $('acMsg').textContent = 'No rows read. Columns: crew_code, role, name, kind, label, issued, expires, note.'; return; }
    try {
      for (let i = 0; i < records.length; i += 400) await api('/records', { method: 'POST', body: JSON.stringify({ records: records.slice(i, i + 400) }) });
      ev.target.value = '';
      await load();
      $('acMsg').textContent = `${records.length} crew records written.`;
    } catch (e) { $('acMsg').textContent = e.message; }
  });
  $('acRefresh').addEventListener('click', load);
  $('acCsv').addEventListener('click', async () => { try { const csv = await (await api('/export.csv')).text(); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `crewops-academy-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); } catch (e) { $('acMsg').textContent = e.message; } });

  window.addEventListener('crewops-code', (ev) => {
    const { code, licence } = ev.detail;
    if (!licence.ops) { $('academy').classList.add('hidden'); return; }
    state.code = code;
    $('academy').classList.remove('hidden');
    load();
  });
})();
