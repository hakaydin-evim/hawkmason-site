// Crewops Safety · the web report form (2026-10-14), for crews without the app.
// The link the safety office shares carries the airline and its form key in
// the fragment (#ZZZ.<key>), so neither reaches a server log. After sending,
// the address changes to #status=<id>.<token>: that page shows what the office
// does with the report and lets the reporter add information.
(() => {
  const ENDPOINT = (window.CREWOPS_SAFETY_ENDPOINT || 'https://updates.hawkmason.com/safety');
  const T = window.CrewopsSafetyTaxonomy;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

  const WORDS = {
    en: {
      title: 'Safety report', lead: "Goes straight to your airline's safety office. Report what happened, or what could happen: a just culture runs on honest reports.",
      badLink: 'This link is not valid any more. Ask your safety office for the current one.', whatKind: 'What is it about?', safetyFam: 'Safety', opsFam: 'Operational',
      when: 'When and where', occurred: 'Date and time (your local time)', station: 'Airport (IATA, optional)', flightNo: 'Flight number', dep: 'From (IATA)', arr: 'To (IATA)', reg: 'Registration', acType: 'Aircraft type',
      spTitle: 'How you felt at the end · Samn-Perelli', reasons: 'Why · pick any', tell: 'What happened', headline: 'Short title (optional)', narrative: 'Describe it: what, how, what you did',
      suggestion: 'What would prevent it? (optional)', photos: 'Photos (up to 4)', you: 'About you', anon: 'Send anonymously (the office cannot ask you questions)',
      crewCode: 'Your crew code (optional, so the office can reply)', urgent: 'Urgent · the safety office should see it today', send: 'Send report', sending: 'Sending…',
      note: 'Not an emergency channel. If something is unsafe right now, tell your commander, operations control or the authority.',
      sentTitle: 'Report received', sentNo: 'Your report number', sentBody: "Keep this page's address: it shows what the safety office does with your report and its reply.", follow: 'Follow my report',
      reportNo: 'Report', statusIs: 'Status', more: 'Add information', moreSend: 'Send to the safety office', reply: 'Reply from the safety office',
      needKind: 'Choose what the report is about.', needText: 'Describe what happened.', needWhen: 'Give the date and time.', needSp: 'Choose how tired you were.',
      photosSent: (n) => `${n} photo${n === 1 ? '' : 's'} attached.`, photosFailed: 'The photos could not be sent; the report itself arrived.',
      cockpit: 'Flight crew', cabin: 'Cabin crew', other: 'Other staff', yes: 'Yes', no: 'No',
      status: { new: 'Received', triage: 'Being reviewed', investigation: 'Under investigation', action: 'Action being taken', closed: 'Closed' },
      kind: { submitted: 'Sent', status: 'Status changed', reply: 'Reply', more_requested: 'The office asks', more_given: 'You added information', action: 'Action planned', action_done: 'Action completed', photo: 'Photo added' },
    },
    tr: {
      title: 'Emniyet raporu', lead: 'Doğrudan havayolunun emniyet ofisine gider. Olanı ya da olabilecek olanı bildir: adil kültür dürüst raporla yaşar.',
      badLink: 'Bu bağlantı artık geçerli değil. Güncelini emniyet ofisinden iste.', whatKind: 'Konu ne?', safetyFam: 'Emniyet', opsFam: 'Operasyonel',
      when: 'Ne zaman, nerede', occurred: 'Tarih ve saat (yerel saatin)', station: 'Meydan (IATA, isteğe bağlı)', flightNo: 'Uçuş numarası', dep: 'Nereden (IATA)', arr: 'Nereye (IATA)', reg: 'Tescil', acType: 'Uçak tipi',
      spTitle: 'Görev biterken nasıldın · Samn-Perelli', reasons: 'Neden · birden fazla seçebilirsin', tell: 'Ne oldu', headline: 'Kısa başlık (isteğe bağlı)', narrative: 'Anlat: ne oldu, nasıl oldu, ne yaptın',
      suggestion: 'Ne önlerdi? (isteğe bağlı)', photos: 'Fotoğraf (en çok 4)', you: 'Senin hakkında', anon: 'Anonim gönder (ofis sana soru soramaz)',
      crewCode: 'Ekip kodun (isteğe bağlı, ofis cevap verebilsin diye)', urgent: 'Acil · emniyet ofisi bugün görsün', send: 'Raporu gönder', sending: 'Gönderiliyor…',
      note: 'Acil durum kanalı değildir. Şu an emniyetsiz bir durum varsa kaptana, operasyon kontrole ya da otoriteye bildir.',
      sentTitle: 'Rapor alındı', sentNo: 'Rapor numaran', sentBody: 'Bu sayfanın adresini sakla: emniyet ofisinin raporla ne yaptığını ve cevabını gösterir.', follow: 'Raporumu takip et',
      reportNo: 'Rapor', statusIs: 'Durum', more: 'Bilgi ekle', moreSend: 'Emniyet ofisine gönder', reply: 'Emniyet ofisinin cevabı',
      needKind: 'Raporun konusunu seç.', needText: 'Ne olduğunu anlat.', needWhen: 'Tarih ve saati gir.', needSp: 'Ne kadar yorgun olduğunu seç.',
      photosSent: (n) => `${n} fotoğraf eklendi.`, photosFailed: 'Fotoğraflar gönderilemedi; raporun kendisi ulaştı.',
      cockpit: 'Uçuş ekibi', cabin: 'Kabin ekibi', other: 'Diğer personel', yes: 'Evet', no: 'Hayır',
      status: { new: 'Alındı', triage: 'İnceleniyor', investigation: 'Soruşturma', action: 'Önlem alınıyor', closed: 'Kapandı' },
      kind: { submitted: 'Gönderildi', status: 'Durum değişti', reply: 'Cevap', more_requested: 'Ofis soruyor', more_given: 'Bilgi ekledin', action: 'Önlem planlandı', action_done: 'Önlem tamamlandı', photo: 'Fotoğraf eklendi' },
    },
  };
  const NAMES = {
    flight: ['Flight', 'Operations, technical, ATC', 'Uçuş', 'Operasyon, teknik, ATC'], cabin: ['Cabin', 'Passengers, service, equipment', 'Kabin', 'Yolcu, servis, ekipman'],
    fatigue: ['Fatigue', 'Tired on or before a duty', 'Yorgunluk', 'Görevde ya da öncesinde yorgunluk'], hazard: ['Hazard', 'Report it before it happens', 'Tehlike', 'Olmadan önce bildir'],
    ground: ['Ground', 'Apron, ramp, cargo', 'Yer', 'Apron, ramp, kargo'], dg: ['Dangerous goods', 'Batteries, spills, declarations', 'Tehlikeli madde', 'Pil, sızıntı, beyan'],
    security: ['Security', 'Cabin and airport security', 'Güvenlik', 'Kabin ve meydan güvenliği'], suggestion: ['Suggestion', 'An idea, an improvement', 'Öneri', 'Bir fikir, bir iyileştirme'],
    engineering: ['Technical', 'Defect, maintenance, tech log', 'Teknik', 'Arıza, bakım, tech log'], ohs: ['Health & safety at work', 'Injury, near miss', 'İş sağlığı', 'Yaralanma, ramak kala'],
    wildlife: ['Bird / wildlife', 'Strike or near miss', 'Kuş / yaban hayatı', 'Çarpma veya ramak kala'], irregularity: ['Irregularity', 'Hotel, transport, delay, passengers', 'Aksaklık', 'Otel, servis, rötar, yolcu'],
    environment: ['Environment', 'Spill, waste, noise', 'Çevre', 'Dökülme, atık, gürültü'], quality: ['Quality', 'Documents, procedures, suppliers', 'Kalite', 'Doküman, prosedür, tedarikçi'],
    occ: ['Operations control', 'Planning, dispatch, OCC', 'Operasyon kontrol', 'Planlama, dispeç, OCC'],
  };
  const SP = [
    ['Fully alert, wide awake', 'Tamamen uyanık, dinç'], ['Very lively, responsive, but not at peak', 'Canlı, tepkili ama zirvede değil'], ['Okay, somewhat fresh', 'İyi, biraz dinç'],
    ['A little tired, less than fresh', 'Biraz yorgun'], ['Moderately tired, let down', 'Orta derecede yorgun'], ['Extremely tired, very difficult to concentrate', 'Çok yorgun, odaklanmak çok zor'], ['Completely exhausted, unable to function effectively', 'Tükenmiş, etkin çalışamıyor'],
  ];
  const REASONS = { short_rest: ['Short rest', 'Dinlenme yetersiz'], night: ['Night duty', 'Gece görevi'], long_fdp: ['Long FDP', 'Uzun FDP'], early_start: ['Early start', 'Erken başlangıç'], multi_sector: ['Many sectors', 'Çok sektör'], standby: ['Standby', 'Yedek görev'], cumulative: ['Cumulative duty', 'Biriken görev'], hotel_sleep: ['Poor hotel sleep', 'Otelde kötü uyku'], delay: ['Delay', 'Gecikme'], time_zones: ['Time zones', 'Saat dilimi'], workload: ['Workload', 'İş yükü'], personal: ['Personal', 'Kişisel'], other: ['Other', 'Diğer'] };
  // The commander's discretion report needs the FDP from the roster: it stays in the app.
  const WEB_TYPES = T.SAFETY_TYPES.filter((t) => t.id !== 'discretion');

  const st = { lang: (store.get('crewops-report-lang') || (navigator.language || 'en')).slice(0, 2) === 'tr' ? 'tr' : 'en', airline: null, key: null, type: null, details: {}, sp: null, reasons: [], role: null, photos: [] };
  const w = (k) => WORDS[st.lang][k];
  const lab = (l) => l[st.lang] || l.en;

  function applyWords() {
    document.documentElement.lang = st.lang;
    document.querySelectorAll('[data-t]').forEach((el) => { const v = w(el.dataset.t); if (typeof v === 'string') el.textContent = v; });
    document.querySelectorAll('.lang button').forEach((b) => b.classList.toggle('on', b.dataset.lang === st.lang));
    document.title = `${w('title')} · Crewops Safety`;
    drawKinds(); drawType(); drawRole();
  }
  document.querySelector('.lang').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (!b) return; st.lang = b.dataset.lang; store.set('crewops-report-lang', st.lang); applyWords(); if (st.statusView) loadStatus(); });

  function drawKinds() {
    const fam = (f, title) => `<div class="fam">${title}</div><div class="kinds">${WEB_TYPES.filter((t) => t.family === f).map((t) => { const n = NAMES[t.id] || [t.id, '', t.id, '']; const i = st.lang === 'tr' ? 2 : 0; return `<button type="button" class="kind${st.type === t.id ? ' on' : ''}" data-id="${t.id}" aria-pressed="${st.type === t.id}"><b>${esc(n[i])}</b><span>${esc(n[i + 1])}</span></button>`; }).join('')}</div>`;
    $('kinds').innerHTML = fam('safety', w('safetyFam')) + fam('operational', w('opsFam'));
  }
  $('kinds').addEventListener('click', (ev) => {
    const b = ev.target.closest('.kind');
    if (!b) return;
    if (st.type !== b.dataset.id) { st.type = b.dataset.id; st.details = {}; }
    drawKinds(); drawType();
    $('rest').classList.remove('hidden');
  });

  function fieldHtml(f) {
    if (!T.fieldShown(f, st.details)) return '';
    const v = st.details[f.id];
    const chip = (id, label, on) => `<button type="button" class="chip${on ? ' on' : ''}" data-f="${f.id}" data-v="${esc(id)}" aria-pressed="${on}">${esc(label)}</button>`;
    if (f.kind === 'multi') return `<p class="q">${esc(lab(f.label))}</p>${f.groups.map((g) => `${f.groups.length > 1 ? `<div class="group">${esc(lab(g.label))}</div>` : ''}<div class="chips">${g.options.map((o) => chip(o.id, lab(o.label), (v || []).includes(o.id))).join('')}</div>`).join('')}`;
    if (f.kind === 'one') return `<p class="q">${esc(lab(f.label))}</p><div class="chips">${f.options.map((o) => chip(o.id, lab(o.label), v === o.id)).join('')}</div>`;
    if (f.kind === 'yesno') return `<p class="q">${esc(lab(f.label))}</p><div class="chips">${chip('yes', w('yes'), v === true)}${chip('no', w('no'), v === false)}</div>`;
    if (f.kind === 'num') return `<label class="f"><span>${esc(lab(f.label))}${f.unit ? ` (${esc(lab(f.unit))})` : ''}</span><input type="number" inputmode="numeric" data-f="${f.id}" min="${f.min}" max="${f.max}" value="${v ?? ''}" /></label>`;
    return `<label class="f"><span>${esc(lab(f.label))}</span><input type="text" data-f="${f.id}" maxlength="${f.max}" value="${esc(v ?? '')}"${f.upper ? ' autocapitalize="characters"' : ''} /></label>`;
  }
  function drawType() {
    const t = WEB_TYPES.find((x) => x.id === st.type);
    if (!t) return;
    $('flightBox').classList.toggle('hidden', t.flight === 'none');
    $('fatigueBox').classList.toggle('hidden', t.special !== 'fatigue');
    $('details').innerHTML = t.fields.length ? `<h2>${st.lang === 'tr' ? 'Ayrıntılar' : 'Details'}</h2>${t.fields.map(fieldHtml).join('')}` : '';
    $('sp').innerHTML = SP.map((s, i) => `<button type="button" class="chip${st.sp === i + 1 ? ' on' : ''}" data-sp="${i + 1}" aria-pressed="${st.sp === i + 1}"><b>${i + 1}</b> · ${esc(s[st.lang === 'tr' ? 1 : 0])}</button>`).join('');
    $('reasons').innerHTML = Object.entries(REASONS).map(([id, l]) => `<button type="button" class="chip${st.reasons.includes(id) ? ' on' : ''}" data-reason="${id}" aria-pressed="${st.reasons.includes(id)}">${esc(l[st.lang === 'tr' ? 1 : 0])}</button>`).join('');
  }
  $('details').addEventListener('click', (ev) => {
    const b = ev.target.closest('.chip');
    if (!b) return;
    const f = WEB_TYPES.find((x) => x.id === st.type).fields.find((x) => x.id === b.dataset.f);
    const v = b.dataset.v;
    if (f.kind === 'multi') { const cur = st.details[f.id] || []; st.details[f.id] = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]; }
    else if (f.kind === 'one') st.details[f.id] = st.details[f.id] === v ? undefined : v;
    else if (f.kind === 'yesno') { const val = v === 'yes'; st.details[f.id] = st.details[f.id] === val ? undefined : val; }
    drawType();
  });
  $('details').addEventListener('input', (ev) => {
    const el = ev.target.closest('input[data-f]');
    if (!el) return;
    const f = WEB_TYPES.find((x) => x.id === st.type).fields.find((x) => x.id === el.dataset.f);
    st.details[f.id] = f.kind === 'num' ? (el.value === '' ? undefined : Number(el.value)) : el.value;
  });
  $('sp').addEventListener('click', (ev) => { const b = ev.target.closest('[data-sp]'); if (b) { st.sp = Number(b.dataset.sp); drawType(); } });
  $('reasons').addEventListener('click', (ev) => { const b = ev.target.closest('[data-reason]'); if (!b) return; const id = b.dataset.reason; st.reasons = st.reasons.includes(id) ? st.reasons.filter((x) => x !== id) : [...st.reasons, id]; drawType(); });

  function drawRole() {
    $('role').innerHTML = ['cockpit', 'cabin', 'other'].map((r) => `<button type="button" class="chip${st.role === r ? ' on' : ''}" data-role="${r}" aria-pressed="${st.role === r}">${esc(w(r))}</button>`).join('');
  }
  $('role').addEventListener('click', (ev) => { const b = ev.target.closest('[data-role]'); if (b) { st.role = st.role === b.dataset.role ? null : b.dataset.role; drawRole(); } });
  $('anon').addEventListener('change', () => $('codeBox').classList.toggle('hidden', $('anon').checked));

  // Photos are shrunk in the browser (longest side 2000 px, JPEG): evidence, not originals.
  async function shrink(file) {
    if (file.type === 'image/heic') return file;
    const img = await createImageBitmap(file);
    const k = Math.min(1, 2000 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return new Promise((res) => c.toBlob((b) => res(b || file), 'image/jpeg', 0.7));
  }
  $('photos').addEventListener('change', async () => {
    const files = [...$('photos').files].slice(0, 4);
    st.photos = [];
    for (const f of files) { try { st.photos.push(await shrink(f)); } catch (e) { st.photos.push(f); } }
    $('thumbs').innerHTML = st.photos.map((b) => `<img alt="" src="${URL.createObjectURL(b)}" />`).join('');
  });

  const crewId = () => {
    let id = store.get('crewops-report-device');
    if (!id || !/^[a-f0-9]{16}$/.test(id)) { id = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join(''); store.set('crewops-report-device', id); }
    return id;
  };
  const up = (id) => $(id).value.trim().toUpperCase();

  $('form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const t = WEB_TYPES.find((x) => x.id === st.type);
    if (!t) { $('msg').textContent = w('needKind'); return; }
    if (!$('occurred').value) { $('msg').textContent = w('needWhen'); $('occurred').focus(); return; }
    if (t.special === 'fatigue' && !st.sp) { $('msg').textContent = w('needSp'); return; }
    const text = $('text').value.trim() || (t.special === 'fatigue' && st.sp ? `Fatigue report: Samn-Perelli ${st.sp}.` : '');
    if (!text) { $('msg').textContent = w('needText'); $('text').focus(); return; }
    const occurredAt = new Date($('occurred').value).toISOString();
    const body = { source: 'web', formKey: st.key, airline: st.airline, crewId: crewId(), type: t.id, occurredAt, text, lang: st.lang, anonymous: $('anon').checked, urgent: $('urgent').checked };
    if ($('headline').value.trim()) body.title = $('headline').value.trim();
    if ($('suggestion').value.trim()) body.suggestion = $('suggestion').value.trim();
    if (st.role === 'cockpit' || st.role === 'cabin') body.role = st.role;
    if (!body.anonymous && /^[A-Z0-9]{2,12}$/.test(up('crewCode'))) body.crewCode = up('crewCode');
    if (/^[A-Z]{3}$/.test(up('station'))) body.station = up('station');
    if (t.flight !== 'none' && /^[A-Z0-9 -]{2,12}$/.test(up('flightNo'))) {
      body.flight = { date: occurredAt.slice(0, 10), flightNo: up('flightNo') };
      for (const k of ['dep', 'arr']) if (/^[A-Z]{3}$/.test(up(k))) body.flight[k] = up(k);
      if (/^[A-Z0-9-]{3,8}$/.test(up('reg'))) body.flight.reg = up('reg');
      if (/^[A-Z0-9]{2,5}$/.test(up('acType'))) body.flight.acType = up('acType');
    }
    if (t.special === 'fatigue') body.fatigue = { sp: st.sp, reasons: st.reasons };
    const details = T.cleanDetails(t.id, st.details);
    if (details && Object.keys(details).length) body.details = details;
    $('send').disabled = true; $('send').textContent = w('sending'); $('msg').textContent = '';
    try {
      const res = await fetch(`${ENDPOINT}/reports`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || `HTTP ${res.status}`);
      let sent = 0;
      for (const p of st.photos) {
        const r = await fetch(`${ENDPOINT}/reports/${out.id}/photos?t=${out.token}`, { method: 'POST', headers: { 'content-type': p.type || 'image/jpeg' }, body: p }).catch(() => null);
        if (r && r.ok) sent++;
      }
      $('form').classList.add('hidden');
      $('done').classList.remove('hidden');
      $('doneId').textContent = out.id;
      $('donePhotos').textContent = st.photos.length ? (sent === st.photos.length ? w('photosSent')(sent) : w('photosFailed')) : '';
      const mine = JSON.parse(store.get('crewops-report-mine') || '[]');
      store.set('crewops-report-mine', JSON.stringify([{ id: out.id, token: out.token, at: out.receivedAt }, ...mine].slice(0, 20)));
      $('followBtn').onclick = () => { location.hash = `status=${out.id}.${out.token}`; };
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      $('msg').textContent = e.message;
    } finally {
      $('send').disabled = false; $('send').textContent = w('send');
    }
  });

  // ---- following a report -------------------------------------------------
  async function loadStatus() {
    const [id, token] = st.statusView;
    try {
      const res = await fetch(`${ENDPOINT}/reports/${encodeURIComponent(id)}?t=${encodeURIComponent(token)}`);
      if (!res.ok) throw new Error(w('badLink'));
      const r = await res.json();
      $('stId').textContent = r.id;
      $('stStatus').textContent = w('status')[r.status] || r.status;
      $('stReply').innerHTML = r.reply ? `<div class="card"><b>${esc(w('reply'))}</b><p style="white-space:pre-wrap;margin:6px 0 0">${esc(r.reply.text)}</p></div>` : '';
      $('stTimeline').innerHTML = r.timeline.slice().reverse().map((e) => `<li>${esc(e.kind === 'status' ? `${w('kind').status}: ${w('status')[e.status] || e.status}` : w('kind')[e.kind] || e.kind)}${e.text ? `<br />${esc(e.text)}` : ''}<small>${esc(new Date(e.at).toLocaleString(st.lang))}</small></li>`).join('');
    } catch (e) { $('stMsg').textContent = e.message; }
  }
  $('moreBtn').addEventListener('click', async () => {
    const text = $('moreText').value.trim();
    if (!text) return;
    const [id, token] = st.statusView;
    $('moreBtn').disabled = true;
    try {
      const res = await fetch(`${ENDPOINT}/reports/${encodeURIComponent(id)}/more?t=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      $('moreText').value = '';
      loadStatus();
    } catch (e) { $('stMsg').textContent = e.message; } finally { $('moreBtn').disabled = false; }
  });

  async function route() {
    const h = decodeURIComponent(location.hash.slice(1));
    ['form', 'done', 'status', 'bad'].forEach((id) => $(id).classList.add('hidden'));
    const s = /^status=([A-Z0-9]{2,4}-\d{6}-[A-Z0-9]{5})\.([a-f0-9]{48})$/.exec(h);
    if (s) { st.statusView = [s[1], s[2]]; $('status').classList.remove('hidden'); loadStatus(); return; }
    st.statusView = null;
    const m = /^([A-Z0-9]{2,4})\.([a-f0-9]{24})$/.exec(h);
    if (!m) { $('bad').classList.remove('hidden'); return; }
    const ok = await fetch(`${ENDPOINT}/form?a=${m[1]}&k=${m[2]}`).then((r) => r.ok).catch(() => false);
    if (!ok) { $('bad').classList.remove('hidden'); return; }
    st.airline = m[1]; st.key = m[2];
    $('form').classList.remove('hidden');
  }
  window.addEventListener('hashchange', route);
  applyWords();
  route();
})();
