// Crewops Safety on the Insight page: the operator's safety office reads the
// reports its crews sent from the app, classifies, acts and replies. Opens
// only with the OPERATOR code (role "ops"); the crew code never reads reports.
// Talks to updates.hawkmason.com/safety/* with the code as a bearer token.
(() => {
  const $ = (id) => document.getElementById(id);
  const ENDPOINT = (window.CREWOPS_SAFETY_ENDPOINT || 'https://updates.hawkmason.com/safety');
  const state = { code: null, reports: [], open: null, detail: null, family: 'all' };
  const TYPES = {
    flight: 'Flight operations', cabin: 'Cabin', ground: 'Ground / cargo', security: 'Security', dg: 'Dangerous goods', hazard: 'Hazard',
    engineering: 'Technical', ohs: 'Health & safety at work', fatigue: 'Fatigue', wildlife: 'Bird / wildlife', discretion: "Commander's discretion", suggestion: 'Suggestion',
    irregularity: 'Irregularity', environment: 'Environment', quality: 'Quality', occ: 'Operations control',
  };
  // The report taxonomy, generated from the app (tools/safety/export-taxonomy.mjs): labels for each report's own answers.
  const TAX = window.CrewopsSafetyTaxonomy || null;
  const familyOf = (type) => (TAX && TAX.typeDef(type) ? TAX.typeDef(type).family : 'safety');
  const STATUSES = ['new', 'triage', 'investigation', 'action', 'closed'];
  const ROOT = {
    human_skill: 'Human · skill or technique', human_decision: 'Human · decision', human_perception: 'Human · perception or attention', human_violation: 'Human · routine or exceptional violation',
    communication_crm: 'Communication / CRM', procedure: 'Procedure missing or unclear', training: 'Training', organisation: 'Organisation · planning, staffing, pressure',
    equipment_technical: 'Equipment / technical', environment: 'Environment · weather, airport', external: 'External party', undetermined: 'Undetermined',
  };
  // The office script asks for these after it links a report to a risk.
  window.addEventListener('crewops-report-linked', async (ev) => {
    if (!state.detail || state.detail.id !== ev.detail.reportId) return;
    await load();
    open(ev.detail.reportId);
  });
  window.crewopsSafety = { api: (path, init) => api(path, init), reports: () => state.reports, openReport: (id) => open(id) };
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
    const operational = state.reports.filter((r) => familyOf(r.type) === 'operational').length;
    $('safetyTiles').innerHTML = [
      ['Open', open.length], ['72 h clock · due within 24 h', due.length], ['Fatigue reports', fatigue.length], ['Operational reports', operational], ['Closed', state.reports.length - open.length], ['Anonymous', anon],
    ].map(([l, n]) => `<div class="tile"><div class="n">${n}</div><div class="l">${esc(l)}</div></div>`).join('');
  }

  function drawTable() {
    if (!$('safetyFamily')) {
      const bar = document.createElement('div');
      bar.className = 'row';
      bar.style.margin = '10px 0';
      bar.innerHTML = '<label class="f">Show<select id="safetyFamily"><option value="all">All reports</option><option value="safety">Safety reports</option><option value="operational">Operational reports</option></select></label>';
      $('safetyTable').closest('.tablewrap').before(bar);
      $('safetyFamily').addEventListener('change', (ev) => { state.family = ev.target.value; drawTable(); });
    }
    const shown = state.reports.filter((r) => state.family === 'all' || familyOf(r.type) === state.family);
    const rows = shown.map((r) => {
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
    const inv = r.investigation || {};
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
      ${detailsHtml(r)}
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
      ${(r.photos || []).length ? `<h3 style="margin-top:14px">PHOTOS FROM THE REPORTER</h3><div class="thumbs" id="sdPhotos">${r.photos.map((p) => `<img data-file="${esc(p.file)}" alt="Photo attached to ${esc(r.id)}" />`).join('')}</div>` : ''}
      <h3 style="margin-top:14px">INVESTIGATION · NEVER SHOWN TO THE REPORTER</h3>
      <div class="row">
        <label class="f">Root cause<select id="sdRoot">${opt(Object.keys(ROOT), inv.rootCause, '— not yet —').replace(/>([a-z_]+)<\/option>/g, (m, k) => `>${esc(ROOT[k] || k)}</option>`)}</select></label>
        <label class="f" style="flex:1;min-width:240px">Contributing factors<textarea id="sdFactors">${esc(inv.factors || '')}</textarea></label>
      </div>
      <div class="row">
        <label class="f" style="flex:1;min-width:240px">Five whys<textarea id="sdWhys" placeholder="Why? → Why? → …">${esc(inv.whys || '')}</textarea></label>
        <label class="f" style="flex:1;min-width:240px">Findings and conclusion<textarea id="sdFindings">${esc(inv.findings || '')}</textarea></label>
      </div>
      <div class="row" style="margin:6px 0 0"><button class="ghost" id="sdToRisk">${inv.riskId ? `IN THE RISK REGISTER · ${esc(inv.riskId)}` : 'ADD TO RISK REGISTER'}</button></div>
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
    // Photos are served only with the operator code: fetched with it, shown from memory.
    document.querySelectorAll('#sdPhotos img').forEach(async (img) => {
      try {
        const blob = await (await api(`/photo/${encodeURIComponent(r.airline)}/${encodeURIComponent(r.id)}/${encodeURIComponent(img.dataset.file)}`)).blob();
        img.src = URL.createObjectURL(blob);
        img.addEventListener('click', () => window.open(img.src, '_blank'));
      } catch (e) { img.alt = 'Photo could not be loaded'; }
    });
    $('sdToRisk').addEventListener('click', () => {
      if (inv.riskId) { window.dispatchEvent(new CustomEvent('crewops-open-risk', { detail: { id: inv.riskId } })); return; }
      window.dispatchEvent(new CustomEvent('crewops-risk-from-report', { detail: { report: r, by: $('sdBy').value.trim() || undefined } }));
    });
    $('safetyDetail').querySelectorAll('a[data-done]').forEach((a) => a.addEventListener('click', (ev) => { ev.preventDefault(); patch({ actionDone: Number(a.dataset.done), by: $('sdBy').value.trim() || undefined }); }));
  }

  /** The report type's own answers, labelled from the taxonomy; discretion reports get their FDP tiles. */
  function detailsHtml(r) {
    const d = r.details;
    if (!d || !TAX) return '';
    const def = TAX.typeDef(r.type);
    const label = (k) => (def && def.fields.find((f) => f.id === k) ? def.fields.find((f) => f.id === k).label.en : k);
    const fdp = ['planned_fdp_min', 'max_fdp_min', 'actual_fdp_min'];
    let tiles = '';
    if (r.type === 'discretion') {
      const used = d.actual_fdp_min !== undefined && d.max_fdp_min !== undefined ? Math.max(0, d.actual_fdp_min - d.max_fdp_min) : undefined;
      const t = (n, l) => (n === undefined ? '' : `<div class="tile"><div class="n">${hm(n * 60000)}</div><div class="l">${esc(l)}</div></div>`);
      tiles = `<div class="tiles" style="margin:8px 0">${t(d.planned_fdp_min, 'FDP planned')}${t(d.max_fdp_min, 'FDP maximum')}${t(d.actual_fdp_min, 'FDP actual')}${t(used, 'Discretion used')}</div>`;
    }
    const rows = Object.keys(d).filter((k) => !(r.type === 'discretion' && fdp.includes(k))).map((k) => `<li><b>${esc(label(k))}:</b> ${esc(TAX.answerText(r.type, k, d[k], 'en'))}</li>`).join('');
    return `<h3 style="margin-top:14px">DETAILS FROM THE REPORTER</h3>${tiles}${rows ? `<ul class="tl">${rows}</ul>` : ''}`;
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
    const invNow = { rootCause: $('sdRoot').value || undefined, factors: $('sdFactors').value.trim() || undefined, whys: $('sdWhys').value.trim() || undefined, findings: $('sdFindings').value.trim() || undefined };
    const invPrev = r.investigation || {};
    if (['rootCause', 'factors', 'whys', 'findings'].some((k) => (invNow[k] || '') !== (invPrev[k] || ''))) body.investigation = { ...invNow, riskId: invPrev.riskId };
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
