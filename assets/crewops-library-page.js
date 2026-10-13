// Crewops Library on the operator panel: the documentation office publishes
// controlled documents and their revisions (code, revision, dates, change log,
// file link, authority approval, read-and-confirm) and sees who confirmed the
// current revision. Opens only with an operator code that bought Library.
(() => {
  const $ = (id) => document.getElementById(id);
  const ENDPOINT = (window.CREWOPS_LIBRARY_ENDPOINT || 'https://updates.hawkmason.com/library');
  const state = { code: null, docs: [], crew: 0 };
  const TYPES = { manual: 'Manual', procedure: 'Procedure', policy: 'Policy', bulletin: 'Bulletin', form: 'Form', checklist: 'Checklist', regulation: 'Regulation', certificate: 'Certificate', other: 'Other' };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  async function api(path, init) {
    const res = await fetch(`${ENDPOINT}${path}`, { ...init, headers: { authorization: `Bearer ${state.code}`, ...(init && init.body ? { 'content-type': 'application/json' } : {}) } });
    if (!res.ok) { let m = `The library service answered ${res.status}.`; try { m = (await res.json()).error || m; } catch (e) {} throw new Error(m); }
    return res;
  }

  async function load() {
    $('lbMsg').textContent = 'Loading…';
    try {
      const body = await (await api('/docs')).json();
      state.docs = body.documents;
      state.crew = body.crew;
      draw();
      $('lbMsg').textContent = state.docs.length ? '' : 'No document yet. Publish the first one below.';
    } catch (e) { $('lbMsg').textContent = e.message; }
  }

  function draw() {
    const live = state.docs.filter((d) => !d.withdrawn);
    const toConfirm = live.filter((d) => d.requiresAck);
    const recent = live.filter((d) => Date.parse(d.publishedAt) > Date.now() - 30 * 86400000);
    $('lbTiles').innerHTML = [['Documents', live.length], ['Revisions · 30 days', recent.length], ['Awaiting confirmation', toConfirm.filter((d) => d.acks < state.crew).length], ['Crew on record', state.crew]]
      .map(([l, n]) => `<div class="tile"><div class="n">${n}</div><div class="l">${esc(l)}</div></div>`).join('');
    $('lbTable').innerHTML = `<thead><tr><th>Code</th><th>Title</th><th>Type</th><th>Rev.</th><th>Rev. date</th><th>Effective</th><th>Approved</th><th>Confirmed</th><th></th></tr></thead><tbody>${state.docs.map((d) => `<tr${d.withdrawn ? ' style="opacity:.45"' : ''}><td>${esc(d.code)}</td><td style="white-space:normal;min-width:220px">${esc(d.title)}</td><td>${esc(TYPES[d.type] || d.type)}</td><td>${esc(d.revision)} <span class="fine">(${d.revisions})</span></td><td>${esc(d.revisionDate)}</td><td>${esc(d.effectiveDate || '—')}</td><td>${d.approved ? '<span class="pill ok">yes</span>' : '—'}</td><td>${d.requiresAck ? `${d.acks} / ${state.crew}` : '—'}</td><td>${d.withdrawn ? 'withdrawn' : `<a href="#" data-rev="${esc(d.code)}">new revision</a> · ${d.requiresAck ? `<a href="#" data-who="${esc(d.code)}">who</a> · ` : ''}<a href="#" data-wd="${esc(d.code)}">withdraw</a>`}</td></tr>`).join('') || '<tr><td colspan="9" class="fine">No document yet.</td></tr>'}</tbody>`;
    $('lbTable').querySelectorAll('a[data-rev]').forEach((a) => a.addEventListener('click', (ev) => { ev.preventDefault(); const d = state.docs.find((x) => x.code === a.dataset.rev); $('lbCode').value = d.code; $('lbTitle').value = d.title; $('lbType').value = d.type; $('lbCat').value = d.category; $('lbRev').value = ''; $('lbRev').focus(); $('lbMsg').textContent = `New revision of ${d.code}: fill revision, dates, change log and file link.`; }));
    $('lbTable').querySelectorAll('a[data-who]').forEach((a) => a.addEventListener('click', async (ev) => { ev.preventDefault(); try { const d = await (await api(`/docs/${encodeURIComponent(a.dataset.who)}/acks`)).json(); $('lbMsg').textContent = `${d.code} rev. ${d.revision}: confirmed by ${d.acks.map((x) => `${x.crewCode} (${(x.at || '').slice(0, 10)})`).join(', ') || 'nobody yet'}.`; } catch (e) { $('lbMsg').textContent = e.message; } }));
    $('lbTable').querySelectorAll('a[data-wd]').forEach((a) => a.addEventListener('click', async (ev) => { ev.preventDefault(); if (!confirm(`Withdraw ${a.dataset.wd} from every phone? It stays in the history.`)) return; try { await api(`/docs/${encodeURIComponent(a.dataset.wd)}`, { method: 'DELETE' }); await load(); } catch (e) { $('lbMsg').textContent = e.message; } }));
  }

  $('lbPublish').addEventListener('click', async () => {
    const aud = ($('lbAud').value || '').trim();
    const body = {
      code: $('lbCode').value.trim().toUpperCase(), title: $('lbTitle').value.trim(), type: $('lbType').value, category: $('lbCat').value, owner: $('lbOwner').value.trim() || undefined,
      revision: $('lbRev').value.trim(), revisionDate: $('lbRevDate').value.trim(), effectiveDate: $('lbEff').value.trim(), fileUrl: $('lbUrl').value.trim(), pages: parseInt($('lbPages').value, 10) || undefined,
      changeLog: $('lbLog').value.trim(), approved: $('lbApproved').checked, requiresAck: $('lbAck').checked, ackDue: $('lbAckDue').value.trim() || undefined,
      audience: !aud || aud === 'all' ? 'all' : aud === 'cockpit' || aud === 'cabin' ? { roles: [aud] } : { codes: aud.toUpperCase().split(/[\s,;]+/).filter(Boolean) },
      by: $('lbBy').value.trim() || undefined,
    };
    try {
      await api('/docs', { method: 'POST', body: JSON.stringify(body) });
      ['lbRev', 'lbLog', 'lbUrl', 'lbPages', 'lbEff', 'lbAckDue'].forEach((id) => { $(id).value = ''; });
      await load();
      $('lbMsg').textContent = `Published ${body.code} rev. ${body.revision}. Phones pick it up the next time the app opens; an older offline copy is removed.`;
    } catch (e) { $('lbMsg').textContent = e.message; }
  });
  $('lbRefresh').addEventListener('click', load);

  window.addEventListener('crewops-code', (ev) => {
    const { code, licence } = ev.detail;
    if (!licence.ops || !(licence.products || []).includes('library')) { $('library').classList.add('hidden'); return; }
    state.code = code;
    $('library').classList.remove('hidden');
    load();
  });
})();
