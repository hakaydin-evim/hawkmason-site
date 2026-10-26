// Crewops Academy on the Insight page: the training department publishes
// read-and-sign notices, uploads qualification records (CSV), assigns courses,
// and sees who has confirmed what and whose qualification expires when. Opens
// only with the OPERATOR code; talks to updates.hawkmason.com/academy/*.
(() => {
  const $ = (id) => document.getElementById(id);
  const ENDPOINT = (window.CREWOPS_ACADEMY_ENDPOINT || 'https://updates.hawkmason.com/academy');
  const state = { code: null, overview: null, notices: [], courses: [], records: [], req: null, qmRole: '' };
  const KLABEL = { opc: 'OPC', lpc: 'LPC', line_check: 'Line check', sep: 'SEP', dg: 'DG', crm: 'CRM', first_aid: 'First aid', route_competence: 'Route', aerodrome_competence: 'Aerodrome', recurrent_cabin: 'Cabin recurrent', triennial_cabin: 'Cabin triennial', medical: 'Medical', licence: 'Licence', other: 'Other' };
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
      const [o, n, c, r, q] = await Promise.all([api('/overview'), api('/notices'), api('/courses'), api('/records'), api('/requirements')]);
      state.req = await q.json();
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

    drawMatrix();

    $('acNotices').innerHTML = `<thead><tr><th>No</th><th>Type</th><th>Title</th><th>Issued</th><th>Due</th><th>Opened</th><th>Confirmed</th><th></th></tr></thead><tbody>${state.notices.map((n) => `<tr${n.withdrawn ? ' style="opacity:.45"' : ''}><td title="${esc(n.id)}">${n.no ? esc(n.no) : esc(n.id)}</td><td>${esc(NTYPES[n.type] || n.type)}</td><td style="white-space:normal;min-width:240px">${esc(n.title)}</td><td>${esc(n.issuedAt.slice(0, 10))}</td><td>${esc(n.dueDate || '—')}</td><td>${n.opened ?? 0} / ${n.of ?? o.crew}</td><td>${n.acks} / ${n.of ?? o.crew}</td><td>${n.withdrawn ? `cancelled ${esc(n.withdrawn.slice(0, 10))} · <a href="#" data-acks="${esc(n.id)}">who</a>` : `<a href="#" data-acks="${esc(n.id)}">who</a> · <a href="#" data-withdraw="${esc(n.id)}">withdraw</a>`}</td></tr>`).join('') || '<tr><td colspan="8" class="fine">No notice yet.</td></tr>'}</tbody>`;
    $('acNotices').querySelectorAll('a[data-acks]').forEach((a) => a.addEventListener('click', async (ev) => { ev.preventDefault(); history.pushState(null, '', `#notice/${a.dataset.acks}`); try { showReceipt(await (await api(`/notices/${a.dataset.acks}/acks`)).json()); } catch (e) { $('acMsg').textContent = e.message; } }));
    $('acNotices').querySelectorAll('a[data-withdraw]').forEach((a) => a.addEventListener('click', async (ev) => { ev.preventDefault(); if (!confirm('Withdraw this notice from every phone?')) return; try { await api(`/notices/${a.dataset.withdraw}`, { method: 'DELETE' }); await load(); } catch (e) { $('acMsg').textContent = e.message; } }));

    $('acCourses').innerHTML = `<thead><tr><th>Id</th><th>Title</th><th>Type</th><th>Lessons</th><th>Exam</th><th>Due</th><th>Completed</th><th></th></tr></thead><tbody>${state.courses.map((c) => `<tr${c.withdrawn ? ' style="opacity:.45"' : ''}><td>${esc(c.id)}</td><td style="white-space:normal;min-width:240px">${esc(c.title)}</td><td>${esc(c.mode || 'required')}</td><td>${c.lessons || 0}</td><td>${c.quiz ? `${c.quiz.questions} q · ${c.quiz.passMark}%` : '—'}</td><td>${esc(c.dueDate || '—')}</td><td>${c.completions} / ${o.crew}</td><td>${c.withdrawn ? 'withdrawn' : `<a href="#" data-done="${esc(c.id)}">who</a> · <a href="#" data-cwithdraw="${esc(c.id)}">withdraw</a>`}</td></tr>`).join('') || '<tr><td colspan="8" class="fine">No course yet.</td></tr>'}</tbody>`;
    $('acCourses').querySelectorAll('a[data-done]').forEach((a) => a.addEventListener('click', async (ev) => { ev.preventDefault(); history.pushState(null, '', `#course/${a.dataset.done}`); try { const d = await (await api(`/courses/${a.dataset.done}/done`)).json(); $('acMsg').textContent = `${d.course.title}: completed by ${d.done.map((x) => `${x.crewCode} (${x.at.slice(0, 10)}${x.score !== undefined ? ', ' + x.score + '%' : ''}${x.verified ? ', verified' : ''})`).join(', ') || 'nobody yet'}.${(d.attempts || []).filter((a) => !a.passed).length ? ` Not passed yet: ${(d.attempts || []).filter((a) => !a.passed).map((a) => `${a.crewCode} (${a.score}%, attempt ${a.count || 1})`).join(', ')}.` : ''}`; } catch (e) { $('acMsg').textContent = e.message; } }));
    $('acCourses').querySelectorAll('a[data-cwithdraw]').forEach((a) => a.addEventListener('click', async (ev) => { ev.preventDefault(); if (!confirm('Withdraw this course?')) return; try { await api(`/courses/${a.dataset.cwithdraw}`, { method: 'DELETE' }); await load(); } catch (e) { $('acMsg').textContent = e.message; } }));

    $('acRecords').innerHTML = `<thead><tr><th>Crew</th><th>Role</th><th>Items</th><th>Nearest expiry</th><th>Phone</th><th></th></tr></thead><tbody>${state.records.map((r) => { const exps = (r.items || []).map((i) => i.expires).filter(Boolean).sort(); return `<tr><td>${esc(r.crewCode)}</td><td>${esc(r.role || '')}</td><td>${(r.items || []).length}</td><td>${esc(exps[0] || '—')}</td><td>${r.paired ? 'paired' : '—'}</td><td>${r.paired ? `<a href="#" data-unbind="${esc(r.crewCode)}">reset pairing</a>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="6" class="fine">No records yet. Upload a CSV below.</td></tr>'}</tbody>`;
    $('acRecords').querySelectorAll('a[data-unbind]').forEach((a) => a.addEventListener('click', async (ev) => { ev.preventDefault(); if (!confirm(`Reset the phone pairing of ${a.dataset.unbind}? The next phone that reads the code will be paired.`)) return; try { await api('/unbind', { method: 'POST', body: JSON.stringify({ crewCode: a.dataset.unbind }) }); await load(); } catch (e) { $('acMsg').textContent = e.message; } }));
  }

  // Read receipts of one notice: everyone it is for, unread first, with the time each opened and confirmed it.
  const STATE = { unread: ['bad', 'unread'], opened: ['warn', 'opened'], confirmed: ['ok', 'confirmed'] };
  const when = (iso) => (iso ? `${iso.slice(0, 10)} ${iso.slice(11, 16)}Z` : '—');
  function showReceipt(d) {
    const n = d.notice;
    const people = d.people || d.acks.map((x) => ({ crewCode: x.crewCode, ackAt: x.at, openedAt: x.at, state: 'confirmed' }));
    const count = (k) => people.filter((p) => p.state === k).length;
    const box = $('acReceipt');
    box.classList.remove('hidden');
    box.innerHTML = `<div class="row" style="justify-content:space-between;align-items:baseline"><h3 style="margin:0">${n.no ? `NO ${esc(n.no)} · ` : ''}${esc(n.title)}</h3><span><button class="ghost" id="acRcCsv">CSV</button> <button class="ghost" id="acRcClose">CLOSE</button></span></div>
      <p class="fine">${esc(NTYPES[n.type] || n.type)} · issued ${esc(n.issuedAt.slice(0, 10))}${n.dueDate ? ` · due ${esc(n.dueDate)}` : ''}${n.withdrawn ? ` · <b>cancelled ${esc(n.withdrawn.slice(0, 10))}</b>` : ''}${(n.files || []).length ? ` · ${n.files.length} attachment${n.files.length > 1 ? 's' : ''}: ${n.files.map((f) => esc(f.name)).join(', ')}` : ''} · ${count('confirmed')} confirmed, ${count('opened')} opened but not confirmed, ${count('unread')} not opened</p>
      <div class="tablewrap"><table><thead><tr><th>Crew</th><th>Name</th><th>Role</th><th>State</th><th>Opened (UTC)</th><th>Confirmed (UTC)</th><th>Comment</th></tr></thead><tbody>${people.map((p) => `<tr><td>${esc(p.crewCode)}</td><td>${esc(p.name || '')}</td><td>${esc(p.role || '')}</td><td><span class="pill ${STATE[p.state][0]}">${STATE[p.state][1]}</span></td><td>${when(p.openedAt)}</td><td>${when(p.ackAt)}</td><td style="white-space:normal;min-width:200px">${esc(p.comment || '')}</td></tr>`).join('') || '<tr><td colspan="7" class="fine">Nobody on record for this notice yet.</td></tr>'}</tbody></table></div>`;
    $('acRcClose').addEventListener('click', () => { box.classList.add('hidden'); history.pushState(null, '', location.pathname); });
    $('acRcCsv').addEventListener('click', () => {
      const cell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
      const rows = [['notice_no', 'notice_id', 'title', 'crew_code', 'name', 'role', 'state', 'opened_utc', 'confirmed_utc', 'comment'], ...people.map((p) => [n.no, n.id, n.title, p.crewCode, p.name, p.role, p.state, p.openedAt, p.ackAt, p.comment])];
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([rows.map((r) => r.map(cell).join(',')).join('\n') + '\n'], { type: 'text/csv' }));
      a.download = `crewops-notice-${n.no || n.id}-receipts.csv`;
      a.click();
    });
    box.scrollIntoView({ block: 'nearest' });
  }

  // The qualification matrix: one row per crew member, one column per qualification kind
  // that any role requires (plus any other kind on record). A required kind not on record is "missing".
  function drawMatrix() {
    const req = state.req.requirements;
    const today = new Date().toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const rows = state.records.filter((r) => !state.qmRole || r.role === state.qmRole);
    const used = new Set([...(state.qmRole ? req[state.qmRole] || [] : [...req.cockpit, ...req.cabin])]);
    rows.forEach((r) => (r.items || []).forEach((i) => used.add(i.kind)));
    const cols = KINDS.filter((k) => used.has(k));
    const cell = (r, k) => {
      const it = (r.items || []).filter((i) => i.kind === k).sort((a, b) => (b.expires || '9999').localeCompare(a.expires || '9999'))[0];
      const need = r.role && (req[r.role] || []).includes(k);
      if (!it) return need ? '<td><span class="pill bad">missing</span></td>' : '<td></td>';
      if (!it.expires) return '<td><span class="pill ok">held</span></td>';
      const cls = it.expires < today ? 'bad' : it.expires <= in30 ? 'warn' : 'ok';
      return `<td><span class="pill ${cls}" title="${esc(it.label || KLABEL[k])} · expires ${esc(it.expires)}">${esc(it.expires)}</span></td>`;
    };
    const gaps = (r) => (r.role ? (req[r.role] || []).filter((k) => { const it = (r.items || []).find((i) => i.kind === k && (!i.expires || i.expires >= today)); return !it; }).length : 0);
    $('acMatrix').innerHTML = rows.length
      ? `<thead><tr><th>Crew</th><th>Role</th><th class="r">Gaps</th>${cols.map((k) => `<th>${esc(KLABEL[k] || k)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.crewCode)}${r.name ? ` · ${esc(r.name)}` : ''}</td><td>${esc(r.role || '—')}</td><td class="r">${gaps(r) ? `<span class="pill bad">${gaps(r)}</span>` : '<span class="pill ok">0</span>'}</td>${cols.map((k) => cell(r, k)).join('')}</tr>`).join('')}</tbody>`
      : '<tbody><tr><td class="fine">No crew records yet. Upload the qualification CSV below.</td></tr></tbody>';
    $('qmReq').innerHTML = ['cockpit', 'cabin'].map((role) => `<div style="margin:6px 0"><b style="font-size:13px">${role === 'cockpit' ? 'Flight crew' : 'Cabin crew'}${state.req.isDefault ? ' <span class="pill mute">default</span>' : ''}</b><div class="row" style="gap:10px;margin-top:4px">${KINDS.filter((k) => k !== 'other').map((k) => `<label class="fine" style="display:flex;gap:4px;align-items:center"><input type="checkbox" data-role="${role}" value="${k}" ${(req[role] || []).includes(k) ? 'checked' : ''} />${esc(KLABEL[k])}</label>`).join('')}</div></div>`).join('');
  }
  $('qmRole').addEventListener('click', (ev) => { const b = ev.target.closest('.subtab'); if (!b) return; state.qmRole = b.dataset.role; $('qmRole').querySelectorAll('.subtab').forEach((x) => x.classList.toggle('on', x === b)); drawMatrix(); });
  $('qmSave').addEventListener('click', async () => {
    const pick = (role) => [...$('qmReq').querySelectorAll(`input[data-role="${role}"]:checked`)].map((x) => x.value);
    try { state.req = await (await api('/requirements', { method: 'PUT', body: JSON.stringify({ cockpit: pick('cockpit'), cabin: pick('cabin') }) })).json(); drawMatrix(); $('qmMsg').textContent = 'Saved.'; } catch (e) { $('qmMsg').textContent = e.message; }
  });

  // Publishing
  $('acNoticeBtn').addEventListener('click', async () => {
    const body = { type: $('acNType').value, title: $('acNTitle').value.trim(), body: $('acNBody').value.trim(), url: $('acNUrl').value.trim(), dueDate: $('acNDue').value.trim(), minutes: parseInt($('acNMin').value, 10) || undefined, audience: audienceOf($('acNAud').value), by: $('acBy').value.trim() || undefined };
    if (!body.title) { $('acMsg').textContent = 'A title is needed.'; return; }
    const pdfs = [...$('acNFiles').files];
    if (pdfs.length > 5) { $('acMsg').textContent = 'Up to five attachments.'; return; }
    if (pdfs.some((f) => f.type !== 'application/pdf')) { $('acMsg').textContent = 'Attachments must be PDF files.'; return; }
    try {
      // The PDFs go to the airline's store first; the notice carries their addresses.
      body.files = [];
      for (const [i, f] of pdfs.entries()) {
        $('acMsg').textContent = `Uploading ${i + 1} of ${pdfs.length}: ${f.name}…`;
        const res = await fetch(`${ENDPOINT}/files?name=${encodeURIComponent(f.name)}`, { method: 'POST', headers: { authorization: `Bearer ${state.code}`, 'content-type': f.type }, body: f });
        if (!res.ok) throw new Error(`${f.name}: ${(await res.json().catch(() => ({}))).error || res.status}`);
        body.files.push({ url: (await res.json()).fileUrl, name: f.name });
      }
      await api('/notices', { method: 'POST', body: JSON.stringify(body) });
      $('acNTitle').value = ''; $('acNBody').value = ''; $('acNUrl').value = ''; $('acNFiles').value = '';
      await load();
      $('acMsg').textContent = 'Published. It is on every crew phone the next time the app opens.';
    } catch (e) { $('acMsg').textContent = e.message; }
  });
  // The course being built: lessons (uploaded to the airline's store, or links) and an optional exam.
  const draft = { lessons: [], questions: [] };
  const drawDraft = () => {
    $('acLessons').innerHTML = draft.lessons.map((l, i) => `<li><b>${i + 1}. ${esc(l.title)}</b> · ${esc(l.kind)}${l.minutes ? ` · ${l.minutes} min` : ''} · <a href="#" data-lrm="${i}">remove</a></li>`).join('') || '<li class="fine">No lesson yet.</li>';
    $('acQuestions').innerHTML = draft.questions.map((q, i) => `<li><b>${i + 1}. ${esc(q.q)}</b> · ${q.options.map((o, j) => (j === q.answer ? `<u>${esc(o)}</u>` : esc(o))).join(' / ')} · <a href="#" data-qrm="${i}">remove</a></li>`).join('') || '<li class="fine">No question: the crew member confirms completion and you verify it.</li>';
    $('acLessons').querySelectorAll('a[data-lrm]').forEach((a) => a.addEventListener('click', (ev) => { ev.preventDefault(); draft.lessons.splice(Number(a.dataset.lrm), 1); drawDraft(); }));
    $('acQuestions').querySelectorAll('a[data-qrm]').forEach((a) => a.addEventListener('click', (ev) => { ev.preventDefault(); draft.questions.splice(Number(a.dataset.qrm), 1); drawDraft(); }));
  };
  // ---- SCORM packages: unzipped here in the browser, each file stored in the airline's store,
  // the launch file read from imsmanifest.xml. The phone keeps the package offline and plays it.
  async function unzip(file) {
    const buf = new Uint8Array(await file.arrayBuffer());
    const dv = new DataView(buf.buffer);
    let eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('This is not a zip file.');
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const out = [];
    const dec = new TextDecoder();
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('The zip directory is damaged.');
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), local = dv.getUint32(p + 42, true);
      const name = dec.decode(buf.subarray(p + 46, p + 46 + nlen));
      p += 46 + nlen + xlen + clen;
      if (name.endsWith('/') || name.startsWith('__MACOSX/') || /(^|\/)\.DS_Store$/.test(name)) continue;
      const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
      const raw = buf.subarray(start, start + csize);
      if (method !== 0 && method !== 8) throw new Error(`${name}: compression method ${method} is not supported.`);
      out.push({ name, read: async () => (method === 0 ? raw : new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer())) });
    }
    return out;
  }
  async function importScorm(f, title, minutes) {
    const entries = await unzip(f);
    const manifest = entries.find((e) => e.name === 'imsmanifest.xml');
    if (!manifest) throw new Error('No imsmanifest.xml at the top of the zip: this is not a SCORM package.');
    const doc = new DOMParser().parseFromString(new TextDecoder().decode(await manifest.read()), 'application/xml');
    const byTag = (el, tag) => [...el.getElementsByTagName('*')].filter((x) => x.localName === tag);
    const ver = (byTag(doc, 'schemaversion')[0]?.textContent || '').trim();
    const version = /2004|CAM 1\.3/i.test(ver) ? '2004' : '1.2';
    const orgs = byTag(doc, 'organizations')[0];
    const org = byTag(doc, 'organization').find((o) => o.getAttribute('identifier') === orgs?.getAttribute('default')) || byTag(doc, 'organization')[0];
    const item = org && byTag(org, 'item').find((i) => i.getAttribute('identifierref'));
    const res = item && byTag(doc, 'resource').find((r) => r.getAttribute('identifier') === item.getAttribute('identifierref'));
    const href = res && res.getAttribute('href');
    if (!href) throw new Error('The manifest names no launch file.');
    const base = (byTag(doc, 'resources')[0]?.getAttribute('xml:base') || '') + (res.getAttribute('xml:base') || '');
    const launch = (base + href).replace(/^\.\//, '');
    const name = title || (byTag(org, 'title')[0]?.textContent || '').trim() || f.name.replace(/\.zip$/i, '');
    const { pkg } = await (await api('/scorm', { method: 'POST' })).json();
    const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
    let done = 0;
    const queue = [...entries];
    const work = async () => {
      for (let e = queue.shift(); e; e = queue.shift()) {
        const data = await e.read();
        const r = await fetch(`${ENDPOINT}/scorm/${pkg}/${enc(e.name)}`, { method: 'PUT', headers: { authorization: `Bearer ${state.code}` }, body: data });
        if (!r.ok) throw new Error(`${e.name}: the academy service answered ${r.status}.`);
        done++;
        $('acCMsg').textContent = `Uploading the package… ${done}/${entries.length}`;
      }
    };
    await Promise.all([work(), work(), work(), work()]);
    const root = ENDPOINT.replace(/\/academy$/, '').replace(/^http:\/\/localhost:\d+/, 'https://updates.hawkmason.com');
    return { title: name, kind: 'scorm', url: `${root}/academy/sco/${state.airline}/${pkg}/${enc(launch.split('?')[0])}`, files: entries.map((e) => e.name), version, minutes };
  }

  $('acLAdd').addEventListener('click', async () => {
    const title = $('acLTitle').value.trim();
    const minutes = parseInt($('acLMin').value, 10) || undefined;
    const f = $('acLFile').files && $('acLFile').files[0];
    const isZip = f && (/\.zip$/i.test(f.name) || /zip/.test(f.type));
    if (!title && !isZip) { $('acCMsg').textContent = 'A lesson title is needed.'; return; }
    try {
      if (isZip) {
        if (f.size > 300 * 1024 * 1024) throw new Error('Up to 300 MB per package.');
        $('acCMsg').textContent = 'Reading the package…';
        draft.lessons.push(await importScorm(f, title, minutes));
      } else if (f) {
        if (!['video/mp4', 'application/pdf'].includes(f.type)) throw new Error('MP4 video or PDF only.');
        if (f.size > 95 * 1024 * 1024) throw new Error('Up to 95 MB per file.');
        $('acCMsg').textContent = `Uploading ${f.name}…`;
        const res = await fetch(`${ENDPOINT}/files?name=${encodeURIComponent(f.name)}`, { method: 'POST', headers: { authorization: `Bearer ${state.code}`, 'content-type': f.type }, body: f });
        const b = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(b.error || `The academy service answered ${res.status}.`);
        draft.lessons.push({ title, kind: b.kind, url: b.fileUrl, minutes });
      } else {
        const url = $('acLUrl').value.trim();
        if (!/^https:\/\//.test(url)) throw new Error('Upload a file or give an https link.');
        draft.lessons.push({ title, kind: /\.pdf(\?|$)/i.test(url) ? 'pdf' : /\.mp4(\?|$)/i.test(url) ? 'video' : 'link', url, minutes });
      }
      ['acLTitle', 'acLMin', 'acLUrl'].forEach((id) => { $(id).value = ''; });
      $('acLFile').value = '';
      $('acCMsg').textContent = 'Lesson added.';
      drawDraft();
    } catch (e) { $('acCMsg').textContent = e.message; }
  });
  $('acQAdd').addEventListener('click', () => {
    const q = $('acQText').value.trim();
    const lines = $('acQOpts').value.split('\n').map((x) => x.trim()).filter(Boolean);
    const answer = lines.findIndex((x) => x.startsWith('*'));
    const options = lines.map((x) => x.replace(/^\*\s*/, ''));
    if (!q || options.length < 2 || answer < 0) { $('acCMsg').textContent = 'A question, at least two options, and the right one marked with *.'; return; }
    draft.questions.push({ q, options, answer });
    $('acQText').value = ''; $('acQOpts').value = '';
    drawDraft();
  });
  $('acCourseBtn').addEventListener('click', async () => {
    const body = {
      title: $('acCTitle').value.trim(), mode: $('acCMode').value, kind: $('acCKind').value || undefined, renewMonths: $('acCKind').value && $('acCRenew').value ? Number($('acCRenew').value) : undefined, dueDate: $('acCDue').value.trim(), url: $('acCUrl').value.trim(),
      minutes: parseInt($('acCMin').value, 10) || undefined, audience: audienceOf($('acCAud').value), by: $('acBy').value.trim() || undefined,
      lessons: draft.lessons, quiz: draft.questions.length ? { passMark: parseInt($('acQPass').value, 10) || 75, questions: draft.questions } : undefined,
    };
    if (!body.title) { $('acCMsg').textContent = 'A title is needed.'; return; }
    try {
      await api('/courses', { method: 'POST', body: JSON.stringify(body) });
      $('acCTitle').value = ''; $('acCUrl').value = ''; draft.lessons = []; draft.questions = []; drawDraft();
      await load();
      $('acCMsg').textContent = 'Published. It is on every crew phone in the audience the next time the app opens.';
    } catch (e) { $('acCMsg').textContent = e.message; }
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

  // The address names a course or notice (#course/<id>, #notice/<id>): its "who" list opens.
  function fromHash() {
    const m = /^#(course|notice)\/([A-Z0-9-]{6,40})$/.exec(location.hash);
    if (!m) return;
    const a = document.querySelector(m[1] === 'course' ? `a[data-done="${m[2]}"]` : `a[data-acks="${m[2]}"]`);
    if (a) { a.click(); a.closest('tr').scrollIntoView({ block: 'center' }); }
  }
  window.addEventListener('popstate', fromHash);
  window.addEventListener('crewops-code', (ev) => {
    const { code, licence } = ev.detail;
    if (!licence.ops || !(licence.products || []).includes('academy')) { $('academy').classList.add('hidden'); return; }
    state.code = code;
    state.airline = licence.airline;
    $('academy').classList.remove('hidden');
    load().then(fromHash);
  });
})();
