// Crewops Aviation Platform · operator portal: connections (webhooks).
// GET/PUT/DELETE /portal/webhook, POST /portal/webhook/test and /rotate.
// The secret is shown once, when the webhook is made or the secret renewed.
(() => {
  const ENDPOINT = (window.CREWOPS_PORTAL_ENDPOINT || 'https://updates.hawkmason.com/portal');
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  if (!$('connect')) return;
  const LABEL = {
    'safety.report.created': 'A safety report arrives', 'safety.report.updated': 'A safety report changes (status, classification, action, reply)',
    'academy.notice.acknowledged': 'A crew member signs a notice', 'academy.course.completed': 'A crew member completes a course',
    'library.revision.confirmed': 'A crew member confirms a revision',
  };
  const state = { code: null, hook: null };

  async function api(path, init) {
    const res = await fetch(`${ENDPOINT}${path}`, { ...init, headers: { authorization: `Bearer ${state.code}`, ...(init && init.body ? { 'content-type': 'application/json' } : {}) } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok && res.status !== 404) throw new Error(body.error || `HTTP ${res.status}`);
    return body;
  }
  function draw() {
    const h = state.hook;
    $('whUrl').value = h.url || '';
    $('whEvents').innerHTML = h.available.map((e) => `<label class="row" style="gap:8px;margin:4px 0;align-items:center"><input type="checkbox" value="${e}" ${!h.url || h.events.includes(e) ? 'checked' : ''} /> <span>${esc(LABEL[e] || e)} <code>${e}</code></span></label>`).join('') || '<p class="fine">No events for the products this code holds.</p>';
    ['whTest', 'whRotate', 'whDelete'].forEach((id) => { $(id).disabled = !h.url; });
    $('whLog').innerHTML = h.log.length ? `<thead><tr><th>When (UTC)</th><th>Event</th><th>Answer</th></tr></thead><tbody>${h.log.map((l) => `<tr><td>${esc(l.at.replace('T', ' ').slice(0, 19))}</td><td>${esc(l.event)}</td><td><span class="pill ${l.ok ? 'ok' : 'bad'}">${l.status || esc(l.error || 'no answer')}</span></td></tr>`).join('')}</tbody>` : '<tbody><tr><td class="fine">No deliveries yet.</td></tr></tbody>';
  }
  const showSecret = (s) => { if (!s) return; $('whSecret').classList.remove('hidden'); $('whSecret').innerHTML = `Your signing secret, shown only now. Keep it in your system: <code>${esc(s)}</code>`; };
  async function load() {
    try { state.hook = await api('/webhook'); draw(); } catch (e) { $('whMsg').textContent = e.message; }
  }
  $('whSave').addEventListener('click', async () => {
    const events = [...$('whEvents').querySelectorAll('input:checked')].map((x) => x.value);
    try {
      const r = await api('/webhook', { method: 'PUT', body: JSON.stringify({ url: $('whUrl').value.trim(), events }) });
      if (r.error) throw new Error(r.error);
      state.hook = r; draw(); showSecret(r.secret); $('whMsg').textContent = 'Saved.';
    } catch (e) { $('whMsg').textContent = e.message; }
  });
  $('whTest').addEventListener('click', async () => {
    try { const r = await api('/webhook/test', { method: 'POST' }); $('whMsg').textContent = r.ok ? `Test delivered (${r.status}).` : `Test not delivered: ${r.status || r.error}.`; load(); } catch (e) { $('whMsg').textContent = e.message; }
  });
  $('whRotate').addEventListener('click', async () => {
    if (!confirm('Make a new secret? Deliveries are signed with it at once; update your system.')) return;
    try { const r = await api('/webhook/rotate', { method: 'POST' }); state.hook = r; draw(); showSecret(r.secret); } catch (e) { $('whMsg').textContent = e.message; }
  });
  $('whDelete').addEventListener('click', async () => {
    if (!confirm('Remove the webhook? Your system stops hearing from Crewops.')) return;
    try { await api('/webhook', { method: 'DELETE' }); $('whSecret').classList.add('hidden'); $('whMsg').textContent = 'Removed.'; load(); } catch (e) { $('whMsg').textContent = e.message; }
  });

  // ---- API keys -------------------------------------------------------------
  async function loadKeys() {
    try {
      const r = await api('/keys');
      const keys = r.keys || [];
      $('kyList').innerHTML = keys.length
        ? `<thead><tr><th>Key</th><th>System</th><th>Made</th><th>Last used</th><th></th></tr></thead><tbody>${keys.map((k) => `<tr${k.revokedAt ? ' style="opacity:.45"' : ''}><td>${esc(k.id)}</td><td>${esc(k.name)}</td><td>${esc((k.createdAt || '').slice(0, 10))}</td><td>${esc(k.lastUsed || '—')}</td><td>${k.revokedAt ? 'revoked' : `<a href="#" data-revoke="${esc(k.id)}">revoke</a>`}</td></tr>`).join('')}</tbody>`
        : '<tbody><tr><td class="fine">No keys yet.</td></tr></tbody>';
      $('kyList').querySelectorAll('a[data-revoke]').forEach((a) => a.addEventListener('click', async (ev) => {
        ev.preventDefault();
        if (!confirm(`Revoke ${a.dataset.revoke}? The system using it stops at once.`)) return;
        try { await api(`/keys/${a.dataset.revoke}`, { method: 'DELETE' }); loadKeys(); } catch (e) { $('kyMsg').textContent = e.message; }
      }));
    } catch (e) { $('kyMsg').textContent = e.message; }
  }
  $('kyMake').addEventListener('click', async () => {
    try {
      const r = await api('/keys', { method: 'POST', body: JSON.stringify({ name: $('kyName').value.trim() }) });
      if (!r.key) throw new Error(r.error || 'The key was not made.');
      $('kySecret').classList.remove('hidden');
      $('kySecret').innerHTML = `Your key, shown only now. Put it in the system as <code>Authorization: Bearer …</code>: <code>${esc(r.key)}</code>`;
      $('kyName').value = '';
      loadKeys();
    } catch (e) { $('kyMsg').textContent = e.message; }
  });

  window.addEventListener('crewops-code', (ev) => {
    const { code, licence } = ev.detail;
    if (!licence || !licence.ops) { $('connect').classList.add('hidden'); return; }
    state.code = code;
    $('connect').classList.remove('hidden');
    load();
    loadKeys();
  });
})();
