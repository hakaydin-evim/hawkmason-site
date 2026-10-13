// Crewops Safety on the Insight page: the operator's safety office reads the
// reports its crews sent from the app, classifies, acts and replies. Opens
// only with the OPERATOR code (role "ops"); the crew code never reads reports.
// Talks to updates.hawkmason.com/safety/* with the code as a bearer token.
(() => {
  const $ = (id) => document.getElementById(id);
  const ENDPOINT = (window.CREWOPS_SAFETY_ENDPOINT || 'https://updates.hawkmason.com/safety');
  const state = { code: null, reports: [], open: null, detail: null };
  const TYPES = { flight: 'Flight', cabin: 'Cabin', fatigue: 'Fatigue', hazard: 'Hazard', ground: 'Ground', dg: 'Dangerous goods', security: 'Security', suggestion: 'Suggestion' };
  const STATUSES = ['new', 'triage', 'investigation', 'action', 'closed'];
  const CATEGORIES = [
    '1000000 ATM, aerodrome or aircraft system/component related event',
    '3000000 Consequential events',
    '99010158 Events of an operational nature',
    '99010159 Personnel events',
    '99010164 Organisational events',
    '99012035 Any other event',
  ];
  const MANDATORY = ['I · Operation of the aircraft', 'II · Technical condition, maintenance and repair', 'III · Air navigation services and facilities', 'IV · Aerodromes and ground services'];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const hm = (ms) => `${Math.floor(ms / 3600000)}:${String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0')}`;

  function clock(r) {
    if (!r.clockDue) return { text: r.reportable === false ? 'not reportable' : '—', cls: 'mute' };
    if (r.status !== 'new' && r.clockMetAt) return { text: 'met', cls: 'ok' };
    const left = Date.parse(r.clockDue) - Date.now();
    if (left < 0) return { text: `overdue ${hm(-left)}`, cls: 'bad' };
    return { text: `${hm(left)} left`, cls: left < 12 * 3600000 ? 'bad' : left < 36 * 3600000 ? 'warn' : 'ok' };
  }

  async function api(path, init) {
    const res = await fetch(`${ENDPOINT}${path}`, { ...init, headers: { authorization: `Bearer ${state.code}`, ...(init && init.body ? { 'content-type': 'application/json' } : {}), ...(init && init.headers) } });
    if (res.status === 401 || res.status === 403) throw new Error('This code does not open the safety workspace. The operator code (not the crew code) is needed.');
    if (!res.ok) throw new Error(`The safety service answered ${res.status}.`);
    return res;
  }

  async function load() {
    $('safetyMsg').textContent = 'Loading…';
    try {
      const body = await (await api('/reports')).json();
      state.reports = body.reports || [];
      drawTiles();
      drawTable();
      $('safetyMsg').textContent = state.reports.length ? '' : 'No reports yet. They appear here the moment a crew member sends one from the app.';
    } catch (e) {
      $('safetyMsg').textContent = e.message;
    }
  }

  function drawTiles() {
    const open = state.reports.filter((r) => r.status !== 'closed');
    const due = open.filter((r) => r.clockDue && !r.clockMetAt && Date.parse(r.clockDue) - Date.now() < 24 * 3600000);
    const fatigue = state.reports.filter((r) => r.type === 'fatigue');
    const anon = state.reports.filter((r) => r.anonymous).length;
    $('safetyTiles').innerHTML = [
      ['Open', open.length], ['72 h clock · due within 24 h', due.length], ['Fatigue reports', fatigue.length], ['Closed', state.reports.length - open.length], ['Anonymous', anon],
    ].map(([l, n]) => `<div class="tile"><div class="n">${n}</div><div class="l">${esc(l)}</div></div>`).join('');
  }

  function drawTable() {
    const rows = state.reports.map((r) => {
      const c = clock(r);
      return `<tr class="click${state.open === r.id ? ' sel' : ''}" data-id="${esc(r.id)}"><td>${esc(r.id)}</td><td>${r.urgent ? '<span class="pill bad">URGENT</span> ' : ''}${esc(TYPES[r.type] || r.type)}</td><td>${esc(r.date)}</td><td>${esc(r.flightNo || r.station || '')}${r.dep ? ` · ${esc(r.dep)}→${esc(r.arr || '')}` : ''}</td><td style="white-space:normal;min-width:260px">${esc(r.title)}</td><td>${r.anonymous ? '<span class="pill mute">anonymous</span>' : esc(r.crewCode || '—')}</td><td>${r.sp ? `SP ${r.sp}` : ''}</td><td><span class="pill ${c.cls}">${esc(c.text)}</span></td><td><span class="pill ${r.status === 'closed' ? 'ok' : r.status === 'new' ? 'warn' : 'mute'}">${esc(r.status)}</span></td></tr>`;
    });
    $('safetyTable').innerHTML = `<thead><tr><th>No</th><th>Type</th><th>Date</th><th>Flight</th><th>Title</th><th>Crew</th><th>Rating</th><th>72 h</th><th>Status</th></tr></thead><tbody>${rows.join('')}</tbody>`;
    $('safetyTable').querySelectorAll('tr.click').forEach((tr) => tr.addEventListener('click', () => open(tr.dataset.id)));
  }

  async function open(id) {
    state.open = id;
    drawTable();
    const box = $('safetyDetail');
    box.classList.remove('hidden');
    box.innerHTML = '<p class="fine">Loading…</p>';
    try {
      state.detail = await (await api(`/reports/${encodeURIComponent(id)}`)).json();
      drawDetail();
      box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      box.innerHTML = `<p class="msg">${esc(e.message)}</p>`;
    }
  }

  function drawDetail() {
    const r = state.detail;
    const f = r.flight;
    const g = r.fatigue;
    const cls = r.classification || {};
    const c = clock({ ...r, reportable: cls.reportable });
    const opt = (list, cur, none) => `<option value=""${!cur ? ' selected' : ''}>${none}</option>` + list.map((v) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(v)}</option>`).join('');
    const kindText = { submitted: 'Submitted', status: 'Status', classified: 'Classified', action: 'Action added', action_done: 'Action done', reply: 'Reply sent', more_requested: 'More information requested', more_given: 'Reporter added information', note: 'Internal note' };
    $('safetyDetail').innerHTML = `
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div>
          <h3>${esc(r.id)} · ${esc(TYPES[r.type] || r.type)}${r.urgent ? ' · <span class="pill bad">URGENT</span>' : ''}</h3>
          <div class="fine">${esc(r.occurredAt.replace('T', ' ').slice(0, 16))} UTC · ${r.anonymous ? 'anonymous' : `crew ${esc(r.crewCode || 'code not given')}`}${r.role ? ` · ${esc(r.role)}` : ''} · received ${esc(r.receivedAt.replace('T', ' ').slice(0, 16))} UTC · <span class="pill ${c.cls}">72 h: ${esc(c.text)}</span></div>
        </div>
        <button class="ghost" id="sdClose">CLOSE</button>
      </div>
      ${f ? `<p style="margin:12px 0 4px"><b>${esc(f.flightNo)}</b> · ${esc(f.date)} · ${esc((f.legs || []).map((l) => `${l.dep}→${l.arr}`).join(' · ') || `${f.dep || ''}→${f.arr || ''}`)}${f.reg ? ` · ${esc(f.reg)}` : ''}${f.acType ? ` · ${esc(f.acType)}` : ''}${f.std ? ` · ${esc(f.std.slice(11, 16))}–${esc((f.sta || '').slice(11, 16))} UTC` : ''}${f.diverted ? ` · diverted ${esc(f.diverted)}` : ''}</p>` : r.station ? `<p style="margin:12px 0 4px">Station ${esc(r.station)}</p>` : ''}
      ${g ? `<div class="tiles" style="margin:8px 0"><div class="tile"><div class="n">${g.sp}</div><div class="l">Samn-Perelli · crew</div></div>${g.fdpMin ? `<div class="tile"><div class="n">${hm(g.fdpMin * 60000)}</div><div class="l">FDP${g.maxFdpMin ? ` · max ${hm(g.maxFdpMin * 60000)}` : ''}</div></div>` : ''}${g.sectors ? `<div class="tile"><div class="n">${g.sectors}</div><div class="l">Sectors</div></div>` : ''}${g.sleep48Min ? `<div class="tile"><div class="n">${hm(g.sleep48Min * 60000)}</div><div class="l">Sleep 48 h · shared</div></div>` : ''}</div><p class="fine">Reasons: ${esc((g.reasons || []).join(', ') || '—')}</p>` : ''}
      <h3 style="margin-top:14px">WHAT THE REPORTER WROTE</h3>
      <p style="white-space:pre-wrap">${esc(r.text)}</p>
      ${r.suggestion ? `<p class="fine"><b>Suggestion:</b> ${esc(r.suggestion)}</p>` : ''}
      ${(r.more || []).map((m) => `<p class="fine"><b>Added ${esc(m.at.slice(0, 16).replace('T', ' '))}:</b> ${esc(m.text)}</p>`).join('')}
      <h3 style="margin-top:14px">CLASSIFY · REG. (EU) 376/2014 ANNEX I</h3>
      <div class="row">
        <label class="f">Status<select id="sdStatus">${STATUSES.map((s) => `<option value="${s}"${s === r.status ? ' selected' : ''}>${s}</option>`).join('')}</select></label>
        <label class="f">Occurrence category (ADREP)<select id="sdCategory">${opt(CATEGORIES, cls.category, '— not yet classified —')}</select></label>
        <label class="f">Mandatory reportable (Reg. 2015/1018)<select id="sdMandatory"><option value=""${cls.reportable === undefined ? ' selected' : ''}>— undecided —</option><option value="no"${cls.reportable === false ? ' selected' : ''}>no · voluntary, clock stops</option>${MANDATORY.map((m) => `<option value="${esc(m)}"${cls.reportable && cls.mandatoryClass === m ? ' selected' : ''}>yes · ${esc(m)}</option>`).join('')}</select></label>
        <label class="f">Risk (ERCS)<select id="sdRisk">${opt(['A', 'B', 'C', 'D', 'E'], cls.risk, '—')}</select></label>
        <label class="f">Event type · free text<input type="text" id="sdEvent" value="${esc(cls.eventType || '')}" placeholder="e.g. Fire/smoke in cabin" /></label>
      </div>
      <h3 style="margin-top:14px">ACTIONS</h3>
      <ul class="tl">${(r.actions || []).map((a, i) => `<li><b>${esc(a.text)}</b> · ${esc(a.owner || '')} · due ${esc(a.due || '—')} · ${a.done ? 'done' : `open <a href="#" data-done="${i}">mark done</a>`}</li>`).join('') || '<li class="fine">No action yet.</li>'}</ul>
      <div class="row" style="margin-top:8px"><label class="f" style="flex:2;min-width:240px">New action<input type="text" id="sdAction" placeholder="What is to be done" /></label><label class="f">Owner<input type="text" id="sdOwner" placeholder="Department or person" /></label><label class="f">Due<input type="text" id="sdDue" placeholder="YYYY-MM-DD" /></label></div>
      <h3 style="margin-top:14px">REPLY TO THE REPORTER · GOES TO THEIR PHONE</h3>
      <textarea id="sdReply">${esc(r.reply ? r.reply.text : '')}</textarea>
      <div class="row" style="margin-top:8px"><label class="f" style="flex:1;min-width:240px">Ask for more information<input type="text" id="sdMore" placeholder="What you need from the reporter" /></label><label class="f" style="flex:1;min-width:240px">Internal note · never shown to the reporter<input type="text" id="sdNote" placeholder="For the file" /></label><label class="f">Signed by<input type="text" id="sdBy" value="${esc(localStorage.getItem('crewops-safety-by') || '')}" placeholder="Your name or unit" /></label></div>
      <div class="row" style="margin-top:14px"><button id="sdSave">SAVE</button><span class="fine" id="sdMsg"></span></div>
      <h3 style="margin-top:18px">TIMELINE</h3>
      <ul class="tl">${(r.timeline || []).map((e) => `<li><b>${esc(kindText[e.kind] || e.kind)}${e.status ? ` → ${esc(e.status)}` : ''}</b> · ${esc(e.at.slice(0, 16).replace('T', ' '))} UTC${e.by ? ` · ${esc(e.by)}` : ''}${e.text ? `<br />${esc(e.text)}` : ''}</li>`).join('')}</ul>`;
    $('sdClose').addEventListener('click', () => { state.open = null; $('safetyDetail').classList.add('hidden'); drawTable(); });
    $('sdSave').addEventListener('click', save);
    $('safetyDetail').querySelectorAll('a[data-done]').forEach((a) => a.addEventListener('click', (ev) => { ev.preventDefault(); patch({ actionDone: Number(a.dataset.done), by: $('sdBy').value.trim() || undefined }); }));
  }

  async function patch(body) {
    $('sdMsg').textContent = 'Saving…';
    try {
      state.detail = await (await api(`/reports/${encodeURIComponent(state.detail.id)}`, { method: 'PATCH', body: JSON.stringify(body) })).json();
      $('sdMsg').textContent = 'Saved.';
      await load();
      drawDetail();
      $('sdMsg').textContent = 'Saved.';
    } catch (e) {
      $('sdMsg').textContent = e.message;
    }
  }

  function save() {
    const r = state.detail;
    const body = {};
    const by = $('sdBy').value.trim();
    if (by) { body.by = by; try { localStorage.setItem('crewops-safety-by', by); } catch (e) {} }
    const status = $('sdStatus').value;
    if (status !== r.status) body.status = status;
    const mand = $('sdMandatory').value;
    const cls = {
      category: $('sdCategory').value || undefined,
      eventType: $('sdEvent').value.trim() || undefined,
      risk: $('sdRisk').value || undefined,
      reportable: mand === '' ? undefined : mand !== 'no',
      mandatoryClass: mand && mand !== 'no' ? mand : undefined,
    };
    const prev = r.classification || {};
    if (JSON.stringify(cls) !== JSON.stringify({ category: prev.category, eventType: prev.eventType, risk: prev.risk, reportable: prev.reportable, mandatoryClass: prev.mandatoryClass })) body.classification = cls;
    const action = $('sdAction').value.trim();
    if (action) body.action = { text: action, owner: $('sdOwner').value.trim() || undefined, due: $('sdDue').value.trim() || undefined };
    const reply = $('sdReply').value.trim();
    if (reply && reply !== (r.reply ? r.reply.text : '')) body.reply = reply;
    const more = $('sdMore').value.trim();
    if (more) body.askMore = more;
    const note = $('sdNote').value.trim();
    if (note) body.note = note;
    if (Object.keys(body).filter((k) => k !== 'by').length === 0) { $('sdMsg').textContent = 'Nothing changed.'; return; }
    patch(body);
  }

  $('safetyRefresh').addEventListener('click', load);
  $('safetyCsv').addEventListener('click', async () => {
    try {
      const csv = await (await api('/export.csv')).text();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = `crewops-safety-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    } catch (e) { $('safetyMsg').textContent = e.message; }
  });

  window.addEventListener('crewops-code', (ev) => {
    const { code, licence } = ev.detail;
    if (!licence.ops || !(licence.products || []).includes('safety')) { $('safety').classList.add('hidden'); return; }
    state.code = code;
    $('safety').classList.remove('hidden');
    load();
  });
})();
