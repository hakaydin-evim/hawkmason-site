// Crewops Safety, the safety office's records in the operator portal
// (2026-10-13): the risk register (ICAO 5×5), audits and findings, management
// of change, and indicators. Talks to /safety/office/* with the operator code
// through the reports script's api (window.crewopsSafety).
(() => {
  const $ = (id) => document.getElementById(id);
  if (!$('sfTabs')) return;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const api = (path, init) => window.crewopsSafety.api(path, init);
  const by = () => (($('sdBy') && $('sdBy').value.trim()) || (() => { try { return localStorage.getItem('crewops-safety-by') || ''; } catch (e) { return ''; } })()) || undefined;
  const state = { risks: [], audits: [], changes: [], openRisk: null, openAudit: null, openChange: null };
  const PROB = { 5: 'frequent', 4: 'occasional', 3: 'remote', 2: 'improbable', 1: 'extremely improbable' };
  const SEV = { A: 'catastrophic', B: 'hazardous', C: 'major', D: 'minor', E: 'negligible' };
  const TOL = { intolerable: 'bad', tolerable: 'warn', acceptable: 'ok' };
  const today = () => new Date().toISOString().slice(0, 10);
  const post = async (kind, body) => (await api(`/office/${kind}`, { method: 'POST', body: JSON.stringify({ ...body, by: by() }) })).json();
  const patch = async (kind, id, body) => (await api(`/office/${kind}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ ...body, by: by() }) })).json();

  // ---- tabs ----------------------------------------------------------------
  const TABS = ['sfReports', 'sfRisks', 'sfAudits', 'sfChanges', 'sfKpi'];
  function show(tab) {
    TABS.forEach((t) => $(t).classList.toggle('hidden', t !== tab));
    $('sfTabs').querySelectorAll('.subtab').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    if (tab === 'sfKpi') drawKpi();
  }
  $('sfTabs').addEventListener('click', (ev) => { const b = ev.target.closest('.subtab'); if (b) { show(b.dataset.tab); go(b.dataset.tab === 'sfReports' ? location.pathname : `#tab/${b.dataset.tab}`); } });
  // The address names the office record or tab (#risk/<id>, #audit/<id>, #change/<id>, #tab/<tab>).
  function officeFromHash() {
    const m = /^#(risk|audit|change|tab)\/([A-Za-z0-9-]+)$/.exec(location.hash);
    if (!m) return;
    if (m[1] === 'tab' && TABS.includes(m[2])) show(m[2]);
    else if (m[1] === 'risk') { show('sfRisks'); state.openRisk = m[2]; drawRisk(); $('rkDetail').scrollIntoView({ block: 'start' }); }
    else if (m[1] === 'audit') { show('sfAudits'); state.openAudit = m[2]; drawAudit(); $('auDetail').scrollIntoView({ block: 'start' }); }
    else if (m[1] === 'change') { show('sfChanges'); state.openChange = m[2]; drawChange(); }
  }
  window.addEventListener('popstate', officeFromHash);

  async function loadAll() {
    try {
      const [r, a, c] = await Promise.all(['risks', 'audits', 'changes'].map(async (k) => (await (await api(`/office/${k}`)).json())[k] || []));
      state.risks = r; state.audits = a; state.changes = c;
      drawRisks(); drawAudits(); drawChanges();
      officeFromHash();
    } catch (e) { $('rkMsg').textContent = e.message; }
  }
  window.addEventListener('crewops-code', (ev) => {
    const lic = ev.detail.licence || {};
    if (lic.ops && (lic.products || []).includes('safety')) loadAll();
  });

  // ---- risk register -------------------------------------------------------
  function matrix() {
    const count = {};
    state.risks.filter((r) => r.status !== 'closed').forEach((r) => { const i = r.residualIndex || r.index; if (i) count[i] = (count[i] || 0) + 1; });
    const tol = (p, s) => (['5A', '5B', '5C', '4A', '4B', '3A'].includes(`${p}${s}`) ? 'in' : ['5D', '5E', '4C', '4D', '4E', '3B', '3C', '3D', '2A', '2B', '2C', '1A'].includes(`${p}${s}`) ? 'to' : 'ac');
    return `<table class="mx" aria-label="Open risks on the 5×5 matrix (residual where assessed)"><tr><th></th>${'ABCDE'.split('').map((s) => `<th>${s}</th>`).join('')}</tr>${[5, 4, 3, 2, 1].map((p) => `<tr><th>${p}</th>${'ABCDE'.split('').map((s) => `<td class="${tol(p, s)}">${count[`${p}${s}`] || ''}</td>`).join('')}</tr>`).join('')}</table><p class="fine" style="margin:4px 0 0">probability ↓ · severity →</p>`;
  }
  function drawRisks() {
    const open = state.risks.filter((r) => r.status !== 'closed');
    const overdue = open.filter((r) => r.reviewDate && r.reviewDate < today());
    const mitig = open.flatMap((r) => r.mitigations || []).filter((m) => !m.done);
    $('rkMatrix').innerHTML = matrix();
    $('rkTiles').innerHTML = [['Open risks', open.length], ['Intolerable', open.filter((r) => (r.residualTolerability || r.tolerability) === 'intolerable').length], ['Mitigations open', mitig.length], ['Review overdue', overdue.length]]
      .map(([l, n]) => `<div class="tile"><div class="n">${n}</div><div class="l">${esc(l)}</div></div>`).join('');
    $('rkTable').innerHTML = `<thead><tr><th>No</th><th>Risk</th><th>Area</th><th>Initial</th><th>Residual</th><th>Mitigations</th><th>Review</th><th>Status</th></tr></thead><tbody>${state.risks.map((r) => `<tr class="click" data-id="${esc(r.id)}"><td>${esc(r.id)}</td><td style="white-space:normal;min-width:220px">${esc(r.title)}</td><td>${esc(r.area || '')}</td><td><span class="pill ${TOL[r.tolerability] || 'mute'}">${esc(r.index || '—')}</span></td><td>${r.residualIndex ? `<span class="pill ${TOL[r.residualTolerability] || 'mute'}">${esc(r.residualIndex)}</span>` : '—'}</td><td>${(r.mitigations || []).filter((m) => m.done).length}/${(r.mitigations || []).length}</td><td>${esc(r.reviewDate || '—')}</td><td>${esc(r.status)}</td></tr>`).join('') || '<tr><td colspan="8" class="fine">No risk yet.</td></tr>'}</tbody>`;
    $('rkTable').querySelectorAll('tr.click').forEach((tr) => tr.addEventListener('click', () => openRisk(tr.dataset.id)));
    if (state.openRisk) drawRisk();
  }
  const go = (h) => { if (location.hash !== h) history.pushState(null, '', h); };
  function openRisk(id) { state.openRisk = id; drawRisk(); go(`#risk/${id}`); $('rkDetail').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  function drawRisk() {
    const r = state.risks.find((x) => x.id === state.openRisk);
    if (!r) { $('rkDetail').classList.add('hidden'); return; }
    const sel = (id, map, cur) => `<select id="${id}"><option value="">—</option>${Object.entries(map).map(([k, v]) => `<option value="${k}"${String(cur) === k ? ' selected' : ''}>${k} · ${v}</option>`).join('')}</select>`;
    $('rkDetail').classList.remove('hidden');
    $('rkDetail').innerHTML = `
      <h3>${esc(r.id)} · ${esc(r.title)} <span class="pill ${TOL[r.tolerability] || 'mute'}">${esc(r.index)} ${esc(r.tolerability || '')}</span></h3>
      <p style="white-space:pre-wrap">${esc(r.hazard || '')}</p>
      <p class="fine">Owner ${esc(r.owner || '—')} · area ${esc(r.area || '—')} · from reports: ${(r.sources || []).map((s) => `<a href="#" data-report="${esc(s)}">${esc(s)}</a>`).join(', ') || '—'}</p>
      <h3 style="margin-top:12px">MITIGATIONS</h3>
      <ul class="tl">${(r.mitigations || []).map((m, i) => `<li><b>${esc(m.text)}</b> · ${esc(m.owner || '')} · due ${esc(m.due || '—')} · ${m.done ? 'done' : `open <a href="#" data-mdone="${i}">mark done</a>`}</li>`).join('') || '<li class="fine">No mitigation yet.</li>'}</ul>
      <div class="row" style="margin-top:8px"><label class="f" style="flex:2;min-width:240px">New mitigation<input type="text" id="rmText" /></label><label class="f">Owner<input type="text" id="rmOwner" /></label><label class="f">Due<input type="text" id="rmDue" placeholder="YYYY-MM-DD" /></label><button class="ghost" id="rmAdd">ADD</button></div>
      <h3 style="margin-top:12px">RESIDUAL RISK · REVIEW · STATUS</h3>
      <div class="row"><label class="f">Residual probability${sel('rrP', PROB, r.residualLikelihood)}</label><label class="f">Residual severity${sel('rrS', SEV, r.residualSeverity)}</label><label class="f">Review date<input type="text" id="rrReview" value="${esc(r.reviewDate || '')}" placeholder="YYYY-MM-DD" /></label><label class="f">Status<select id="rrStatus">${['open', 'mitigating', 'monitoring', 'closed'].map((s) => `<option${s === r.status ? ' selected' : ''}>${s}</option>`).join('')}</select></label><button id="rrSave">SAVE</button></div>
      <p class="fine" id="rkDMsg"></p>
      <ul class="tl">${(r.history || []).slice(-8).reverse().map((h) => `<li>${esc(h.kind)}${h.text ? ` · ${esc(h.text)}` : ''} · ${esc(h.at.slice(0, 16).replace('T', ' '))}${h.by ? ` · ${esc(h.by)}` : ''}</li>`).join('')}</ul>`;
    const done = (u) => { const i = state.risks.findIndex((x) => x.id === u.id); state.risks[i] = u; drawRisks(); };
    $('rmAdd').addEventListener('click', async () => { try { done(await patch('risks', r.id, { addMitigation: { text: $('rmText').value, owner: $('rmOwner').value || undefined, due: $('rmDue').value || undefined } })); } catch (e) { $('rkDMsg').textContent = e.message; } });
    $('rrSave').addEventListener('click', async () => { try { done(await patch('risks', r.id, { residualLikelihood: Number($('rrP').value) || undefined, residualSeverity: $('rrS').value || undefined, reviewDate: $('rrReview').value || undefined, status: $('rrStatus').value })); $('rkDMsg').textContent = 'Saved.'; } catch (e) { $('rkDMsg').textContent = e.message; } });
    $('rkDetail').querySelectorAll('a[data-mdone]').forEach((a) => a.addEventListener('click', async (ev) => { ev.preventDefault(); done(await patch('risks', r.id, { mitigationDone: Number(a.dataset.mdone) })); }));
    $('rkDetail').querySelectorAll('a[data-report]').forEach((a) => a.addEventListener('click', (ev) => { ev.preventDefault(); show('sfReports'); window.crewopsSafety.openReport(a.dataset.report); }));
  }
  $('rkCreate').addEventListener('click', async () => {
    try {
      const src = $('rkSource').value.trim().toUpperCase();
      const r = await post('risks', { title: $('rkTitle').value, hazard: $('rkHazard').value || undefined, area: $('rkArea').value || undefined, owner: $('rkOwner').value || undefined, likelihood: Number($('rkP').value), severity: $('rkS').value, reviewDate: $('rkReview').value || undefined, sources: src ? [src] : undefined });
      if (src) { await api(`/reports/${encodeURIComponent(src)}`, { method: 'PATCH', body: JSON.stringify({ investigation: { riskId: r.id }, by: by() }) }).catch(() => undefined); window.dispatchEvent(new CustomEvent('crewops-report-linked', { detail: { reportId: src, riskId: r.id } })); }
      ['rkTitle', 'rkHazard', 'rkArea', 'rkOwner', 'rkReview', 'rkSource'].forEach((id) => { $(id).value = ''; });
      state.risks.unshift(r); drawRisks(); openRisk(r.id); $('rkMsg').textContent = `Added ${r.id}.`;
    } catch (e) { $('rkMsg').textContent = e.message; }
  });
  // From a report: the risk form, filled in.
  window.addEventListener('crewops-risk-from-report', (ev) => {
    const r = ev.detail.report;
    show('sfRisks');
    $('rkTitle').value = r.title || '';
    $('rkHazard').value = r.text || '';
    $('rkSource').value = r.id;
    $('rkMsg').textContent = `From report ${r.id}: set probability and severity, then ADD RISK.`;
    $('rkTitle').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  window.addEventListener('crewops-open-risk', (ev) => { show('sfRisks'); openRisk(ev.detail.id); });
  window.addEventListener('crewops-open-audit', (ev) => { show('sfAudits'); state.openAudit = ev.detail.id; drawAudit(); $('auDetail').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  window.addEventListener('crewops-open-change', (ev) => { show('sfChanges'); state.openChange = ev.detail.id; drawChange(); $('chDetail').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  window.addEventListener('crewops-safety-tab', (ev) => show(ev.detail.tab));

  // ---- audits and findings -------------------------------------------------
  const LEVEL = { level1: 'Level 1', level2: 'Level 2', observation: 'Observation' };
  function drawAudits() {
    const findings = state.audits.flatMap((a) => (a.findings || []).map((f) => ({ ...f, audit: a.id })));
    const open = findings.filter((f) => f.status !== 'closed');
    $('auTiles').innerHTML = [['Audits', state.audits.length], ['Findings open', open.length], ['Level 1 open', open.filter((f) => f.level === 'level1').length], ['Overdue', open.filter((f) => f.due && f.due < today()).length]]
      .map(([l, n]) => `<div class="tile"><div class="n">${n}</div><div class="l">${esc(l)}</div></div>`).join('');
    $('auTable').innerHTML = `<thead><tr><th>No</th><th>Audit</th><th>Kind</th><th>Area</th><th>Date</th><th>Findings open</th><th>Overdue</th><th>Status</th></tr></thead><tbody>${state.audits.map((a) => `<tr class="click" data-id="${esc(a.id)}"><td>${esc(a.id)}</td><td style="white-space:normal;min-width:220px">${esc(a.title)}</td><td>${esc(a.kind || '')}</td><td>${esc(a.area || '')}</td><td>${esc(a.date || '')}</td><td>${a.openFindings || 0}</td><td>${a.overdueFindings ? `<span class="pill bad">${a.overdueFindings}</span>` : '0'}</td><td>${esc(a.status)}</td></tr>`).join('') || '<tr><td colspan="8" class="fine">No audit yet.</td></tr>'}</tbody>`;
    $('auTable').querySelectorAll('tr.click').forEach((tr) => tr.addEventListener('click', () => { state.openAudit = tr.dataset.id; drawAudit(); go(`#audit/${tr.dataset.id}`); $('auDetail').scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
    if (state.openAudit) drawAudit();
  }
  function drawAudit() {
    const a = state.audits.find((x) => x.id === state.openAudit);
    if (!a) { $('auDetail').classList.add('hidden'); return; }
    $('auDetail').classList.remove('hidden');
    $('auDetail').innerHTML = `
      <h3>${esc(a.id)} · ${esc(a.title)}</h3>
      <p class="fine">${esc(a.kind || '')} · ${esc(a.area || '')} · ${esc(a.date || '')} · auditor ${esc(a.auditor || '—')} · status ${esc(a.status)}</p>
      ${a.scope ? `<p style="white-space:pre-wrap">${esc(a.scope)}</p>` : ''}
      <h3 style="margin-top:12px">FINDINGS</h3>
      ${(a.findings || []).map((f, i) => `<div class="card" style="margin:8px 0;padding:12px">
        <b>${esc(f.ref)} · ${esc(LEVEL[f.level])}</b> <span class="pill ${f.status === 'closed' ? 'ok' : f.due && f.due < today() ? 'bad' : 'warn'}">${esc(f.status)}</span> <span class="fine">${esc(f.requirement || '')}</span>
        <p style="white-space:pre-wrap;margin:6px 0">${esc(f.text)}</p>
        <div class="row"><label class="f" style="flex:1;min-width:200px">Root cause<input type="text" data-f="${i}" data-k="rootCause" value="${esc(f.rootCause || '')}" /></label><label class="f" style="flex:2;min-width:240px">Corrective action plan<input type="text" data-f="${i}" data-k="cap" value="${esc(f.cap || '')}" /></label></div>
        <div class="row"><label class="f">Owner<input type="text" data-f="${i}" data-k="owner" value="${esc(f.owner || '')}" /></label><label class="f">Due<input type="text" data-f="${i}" data-k="due" value="${esc(f.due || '')}" placeholder="YYYY-MM-DD" /></label><label class="f" style="flex:1;min-width:200px">Evidence of closure<input type="text" data-f="${i}" data-k="evidence" value="${esc(f.evidence || '')}" /></label><label class="f">Status<select data-f="${i}" data-k="status">${['open', 'cap_submitted', 'closed'].map((s) => `<option${s === f.status ? ' selected' : ''}>${s}</option>`).join('')}</select></label><button class="ghost" data-save="${i}">SAVE</button></div>
      </div>`).join('') || '<p class="fine">No finding yet.</p>'}
      <div class="row" style="margin-top:8px"><label class="f">Level<select id="afLevel"><option value="level1">Level 1</option><option value="level2" selected>Level 2</option><option value="observation">Observation</option></select></label><label class="f" style="flex:2;min-width:240px">Finding<input type="text" id="afText" /></label><label class="f">Requirement<input type="text" id="afReq" placeholder="e.g. ORO.GEN.200(a)(3)" /></label><label class="f">Owner<input type="text" id="afOwner" /></label><label class="f">Due<input type="text" id="afDue" placeholder="YYYY-MM-DD" /></label><button class="ghost" id="afAdd">ADD FINDING</button></div>
      <div class="row"><label class="f">Audit status<select id="auStatus">${['planned', 'in_progress', 'closed'].map((s) => `<option${s === a.status ? ' selected' : ''}>${s}</option>`).join('')}</select></label><button class="ghost" id="auSave">SAVE STATUS</button></div>
      <p class="fine" id="auDMsg"></p>`;
    const done = (u) => { const i = state.audits.findIndex((x) => x.id === u.id); state.audits[i] = u; drawAudits(); };
    $('afAdd').addEventListener('click', async () => { try { done(await patch('audits', a.id, { addFinding: { level: $('afLevel').value, text: $('afText').value, requirement: $('afReq').value || undefined, owner: $('afOwner').value || undefined, due: $('afDue').value || undefined } })); } catch (e) { $('auDMsg').textContent = e.message; } });
    $('auSave').addEventListener('click', async () => { try { done(await patch('audits', a.id, { status: $('auStatus').value })); } catch (e) { $('auDMsg').textContent = e.message; } });
    $('auDetail').querySelectorAll('button[data-save]').forEach((b) => b.addEventListener('click', async () => {
      const i = Number(b.dataset.save), u = { index: i };
      $('auDetail').querySelectorAll(`[data-f="${i}"]`).forEach((el) => { if (el.value.trim()) u[el.dataset.k] = el.value.trim(); });
      try { done(await patch('audits', a.id, { updateFinding: u })); } catch (e) { $('auDMsg').textContent = e.message; }
    }));
  }
  $('auCreate').addEventListener('click', async () => {
    try {
      const a = await post('audits', { title: $('auTitle').value, kind: $('auKind').value, area: $('auArea').value || undefined, date: $('auDate').value || undefined, auditor: $('auAuditor').value || undefined, scope: $('auScope').value || undefined });
      ['auTitle', 'auArea', 'auDate', 'auAuditor', 'auScope'].forEach((id) => { $(id).value = ''; });
      state.audits.unshift(a); state.openAudit = a.id; drawAudits(); $('auMsg').textContent = `Added ${a.id}.`;
    } catch (e) { $('auMsg').textContent = e.message; }
  });

  // ---- management of change -------------------------------------------------
  function drawChanges() {
    $('chTable').innerHTML = `<thead><tr><th>No</th><th>Change</th><th>Kind</th><th>Owner</th><th>Planned</th><th>Linked risks</th><th>Status</th></tr></thead><tbody>${state.changes.map((c) => `<tr class="click" data-id="${esc(c.id)}"><td>${esc(c.id)}</td><td style="white-space:normal;min-width:220px">${esc(c.title)}</td><td>${esc(c.kind || '')}</td><td>${esc(c.owner || '')}</td><td>${esc(c.plannedDate || '')}</td><td>${(c.risks || []).length}</td><td><span class="pill ${c.status === 'approved' || c.status === 'implemented' || c.status === 'reviewed' ? 'ok' : c.status === 'rejected' ? 'bad' : 'warn'}">${esc(c.status)}</span></td></tr>`).join('') || '<tr><td colspan="7" class="fine">No change yet.</td></tr>'}</tbody>`;
    $('chTable').querySelectorAll('tr.click').forEach((tr) => tr.addEventListener('click', () => { state.openChange = tr.dataset.id; drawChange(); go(`#change/${tr.dataset.id}`); }));
    if (state.openChange) drawChange();
  }
  function drawChange() {
    const c = state.changes.find((x) => x.id === state.openChange);
    if (!c) { $('chDetail').classList.add('hidden'); return; }
    $('chDetail').classList.remove('hidden');
    $('chDetail').innerHTML = `
      <h3>${esc(c.id)} · ${esc(c.title)} <span class="pill mute">${esc(c.status)}</span></h3>
      <p style="white-space:pre-wrap">${esc(c.description || '')}</p>
      <p class="fine"><b>Hazards:</b> ${esc(c.hazards || '—')}</p>
      <div class="row"><label class="f" style="flex:1;min-width:240px">Linked risks (numbers, comma-separated)<input type="text" id="cdRisks" value="${esc((c.risks || []).join(', '))}" placeholder="${esc(state.risks.slice(0, 2).map((r) => r.id).join(', '))}" /></label><label class="f">Status<select id="cdStatus">${['proposed', 'assessed', 'approved', 'implemented', 'reviewed', 'rejected'].map((s) => `<option${s === c.status ? ' selected' : ''}>${s}</option>`).join('')}</select></label><label class="f">Review date<input type="text" id="cdReview" value="${esc(c.reviewDate || '')}" placeholder="YYYY-MM-DD" /></label><button class="ghost" id="cdSave">SAVE</button></div>
      <div class="row"><label class="f" style="flex:1;min-width:240px">Decision note<input type="text" id="cdNote" /></label><button class="ghost" id="cdApprove">APPROVE</button><button class="ghost" id="cdReject">REJECT</button></div>
      <ul class="tl">${(c.approvals || []).map((a) => `<li><b>${esc(a.decision)}</b> · ${esc(a.by || '')} · ${esc(a.at.slice(0, 10))}${a.note ? ` · ${esc(a.note)}` : ''}</li>`).join('')}</ul>
      <p class="fine" id="chDMsg"></p>`;
    const done = (u) => { const i = state.changes.findIndex((x) => x.id === u.id); state.changes[i] = u; drawChanges(); };
    $('cdSave').addEventListener('click', async () => { try { done(await patch('changes', c.id, { risks: $('cdRisks').value.toUpperCase().split(/[\s,;]+/).filter(Boolean), status: $('cdStatus').value, reviewDate: $('cdReview').value || undefined })); $('chDMsg').textContent = 'Saved.'; } catch (e) { $('chDMsg').textContent = e.message; } });
    ['Approve', 'Reject'].forEach((k) => $(`cd${k}`).addEventListener('click', async () => { try { done(await patch('changes', c.id, { decision: k === 'Approve' ? 'approved' : 'rejected', note: $('cdNote').value || undefined })); } catch (e) { $('chDMsg').textContent = e.message; } }));
  }
  $('chCreate').addEventListener('click', async () => {
    try {
      const c = await post('changes', { title: $('chTitle').value, kind: $('chKind').value, owner: $('chOwner').value || undefined, plannedDate: $('chDate').value || undefined, description: $('chDesc').value || undefined, hazards: $('chHaz').value || undefined });
      ['chTitle', 'chOwner', 'chDate', 'chDesc', 'chHaz'].forEach((id) => { $(id).value = ''; });
      state.changes.unshift(c); state.openChange = c.id; drawChanges(); $('chMsg').textContent = `Added ${c.id}.`;
    } catch (e) { $('chMsg').textContent = e.message; }
  });

  // ---- indicators ------------------------------------------------------------
  function drawKpi() {
    const reps = (window.crewopsSafety && window.crewopsSafety.reports()) || [];
    const closed = reps.filter((r) => r.status === 'closed');
    const months = {};
    const since = new Date(); since.setMonth(since.getMonth() - 11, 1);
    for (let i = 0; i < 12; i++) { const d = new Date(since); d.setMonth(since.getMonth() + i); months[d.toISOString().slice(0, 7)] = 0; }
    reps.forEach((r) => { const m = (r.receivedAt || '').slice(0, 7); if (m in months) months[m]++; });
    const max = Math.max(1, ...Object.values(months));
    $('kpiTiles').innerHTML = [
      ['Reports · 12 months', Object.values(months).reduce((a, b) => a + b, 0)],
      ['Open', reps.length - closed.length],
      ['Closed', closed.length],
      ['Anonymous', reps.filter((r) => r.anonymous).length],
      ['Open risks', state.risks.filter((r) => r.status !== 'closed').length],
      ['Intolerable risks', state.risks.filter((r) => r.status !== 'closed' && (r.residualTolerability || r.tolerability) === 'intolerable').length],
      ['Findings open', state.audits.reduce((n, a) => n + (a.openFindings || 0), 0)],
      ['Changes pending', state.changes.filter((c) => ['proposed', 'assessed'].includes(c.status)).length],
    ].map(([l, n]) => `<div class="tile"><div class="n">${n}</div><div class="l">${esc(l)}</div></div>`).join('');
    $('kpiMonths').innerHTML = `<div style="display:flex;align-items:flex-end;gap:6px;height:120px" aria-label="Reports per month, last 12 months">${Object.entries(months).map(([m, n]) => `<div style="flex:1;text-align:center"><div style="height:${Math.round((n / max) * 96)}px;background:var(--cy);border-radius:4px 4px 0 0;opacity:${n ? 1 : 0.2}" title="${m}: ${n}"></div><div class="fine" style="font-size:10px">${m.slice(5)}</div></div>`).join('')}</div>`;
    const kinds = {};
    reps.forEach((r) => { kinds[r.type] = (kinds[r.type] || 0) + 1; });
    $('kpiKinds').innerHTML = `<thead><tr><th>Kind</th><th>Reports</th></tr></thead><tbody>${Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<tr><td>${esc(k)}</td><td>${n}</td></tr>`).join('') || '<tr><td colspan="2" class="fine">No reports yet.</td></tr>'}</tbody>`;
  }
})();
