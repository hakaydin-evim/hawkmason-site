// Crewops Crew on the web (/crewops/crew): the crew member's notices, courses,
// documents, tasks and qualifications on a computer. Sign-in is a one-time code
// from the paired phone (Me → MY AIRLINE → Open on a computer); the Worker keeps
// the phone's identity and gives this page a session token (crewweb.js), sent
// as the x-crew-web header, or as a /cw/<token> path prefix for files the
// browser loads itself (video, PDF). Talks to updates.hawkmason.com.
(() => {
  const $ = (id) => document.getElementById(id);
  const BASE = window.CREWOPS_UPDATES_ENDPOINT || 'https://updates.hawkmason.com';
  const LIVE = 'https://updates.hawkmason.com';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} } };
  const KEY = 'crewops-crew-web';

  const WORDS = {
    en: {
      title: 'Your airline, on a computer', lead: 'Notices, training, documents and tasks from your airline, the same as in the app. What you confirm here counts as confirmed on your phone.',
      how1: 'Open Crewops Crew on your phone.', how2: 'Me → MY AIRLINE → Open on a computer.', how3: 'Type the 8-character code here. It works once, for ten minutes.',
      signIn: 'Sign in', signOut: 'SIGN OUT', privacy: 'You stay signed in on this browser for 30 days, or until you sign out or end web sessions from your phone. On a shared computer, sign out when you are done.',
      hello: 'Up next', tabNotices: 'Notices', tabCourses: 'Training', tabDocs: 'Library', tabTasks: 'Tasks', tabQuals: 'Qualifications',
      badCode: 'The code has 8 characters.', ended: 'Your web session ended. Sign in again with a new code from your phone.', offline: 'Could not reach Crewops. Check the connection and try again.',
      nothing: 'Nothing here yet.', pending: 'To do', confirmed: 'Confirmed', cancelled: 'Cancelled', cancelledTag: 'Cancelled', new: 'New', opened: 'Opened', no: 'No {n}', due: 'Due {d}', overdue: 'Overdue', today: 'Today', days: '{n} days',
      read: 'Read', close: 'Close', ack: 'Read and understood', comment: 'Comment or question (optional, the training department sees it)', acked: 'Confirmed {d}', yourComment: 'Your comment: {t}',
      cancelledBody: 'Withdrawn on {d}; you do not need to read or confirm it.', openLink: 'Open the document', openPdf: 'Open PDF',
      required: 'Required', self: 'Self-study', done: 'Completed {d}', score: 'score {s}%', lessons: '{n} lessons', exam: 'exam, {n} questions', minutes: '{n} min', openCourse: 'Open',
      back: '← Back', lessonSeen: 'seen', video: 'Video', pdf: 'Document', link: 'Link', scorm: 'Interactive module', scormPhone: 'Open this module in the app on your phone.',
      startExam: 'Start the exam', examLocked: 'The exam opens when you have opened every lesson.', submit: 'Submit answers', answerAll: 'Answer every question.', passed: 'Passed: {s}%. The course is completed.', failed: 'Not passed: {s}% (pass mark {p}%). Go through the lessons and try again.', iDone: 'I have completed this course', iDoneAsk: 'Mark this course as completed? The training department sees it as not yet verified.', awaiting: 'awaiting the training department',
      rev: 'Rev {r}', confirm: 'Confirm I have read this revision', confirmBy: 'Confirm by {d}', approved: 'Approved by the authority',
      taskDone: 'Mark as done', note: 'Note (optional)', doneAt: 'Done {d}', taskOpen: 'Open', inProgress: 'In progress',
      quals: 'Qualifications', expired: 'Expired', valid: 'Valid', issued: 'Issued {d}', noQuals: 'Your airline has not published qualification records yet.', noProduct: 'Your airline does not use this.',
    },
    tr: {
      title: 'Havayolun, bilgisayarda', lead: 'Havayolunun duyuruları, eğitimlerin, dokümanlar ve görevlerin; uygulamadakiyle aynı. Burada onayladığın, telefonunda da onaylanmış sayılır.',
      how1: 'Telefonunda Crewops Crew\'u aç.', how2: 'Ben → ŞİRKETİM → Bilgisayarda aç.', how3: '8 karakterli kodu buraya yaz. Bir kez ve on dakika geçerlidir.',
      signIn: 'Giriş yap', signOut: 'ÇIKIŞ', privacy: 'Bu tarayıcıda 30 gün açık kalırsın; çıkış yapınca ya da telefondan web oturumlarını kapatınca biter. Ortak bilgisayarda işin bitince çıkış yap.',
      hello: 'Sırada', tabNotices: 'Duyurular', tabCourses: 'Eğitim', tabDocs: 'Kütüphane', tabTasks: 'Görevler', tabQuals: 'Yeterlilikler',
      badCode: 'Kod 8 karakterdir.', ended: 'Web oturumun bitti. Telefondan yeni bir kodla tekrar giriş yap.', offline: 'Crewops\'a ulaşılamadı. Bağlantını kontrol edip tekrar dene.',
      nothing: 'Burada henüz bir şey yok.', pending: 'Yapılacak', confirmed: 'Onaylanan', cancelled: 'İptal edilen', cancelledTag: 'İptal edildi', new: 'Yeni', opened: 'Açıldı', no: 'No {n}', due: 'Son {d}', overdue: 'Gecikti', today: 'Bugün', days: '{n} gün',
      read: 'Oku', close: 'Kapat', ack: 'Okudum, anladım', comment: 'Yorum ya da soru (isteğe bağlı, eğitim birimi görür)', acked: 'Onaylandı {d}', yourComment: 'Yorumun: {t}',
      cancelledBody: '{d} tarihinde geri çekildi; okuyup onaylaman gerekmiyor.', openLink: 'Dokümanı aç', openPdf: 'PDF\'i aç',
      required: 'Zorunlu', self: 'Kendi kendine', done: 'Tamamlandı {d}', score: 'puan %{s}', lessons: '{n} ders', exam: 'sınav, {n} soru', minutes: '{n} dk', openCourse: 'Aç',
      back: '← Geri', lessonSeen: 'görüldü', video: 'Video', pdf: 'Belge', link: 'Bağlantı', scorm: 'Etkileşimli modül', scormPhone: 'Bu modülü telefondaki uygulamada aç.',
      startExam: 'Sınava başla', examLocked: 'Sınav, bütün dersleri açınca açılır.', submit: 'Cevapları gönder', answerAll: 'Her soruyu cevapla.', passed: 'Geçtin: %{s}. Kurs tamamlandı.', failed: 'Geçemedin: %{s} (geçme notu %{p}). Derslere dönüp tekrar dene.', iDone: 'Bu kursu tamamladım', iDoneAsk: 'Kurs tamamlandı olarak işaretlensin mi? Eğitim birimi bunu henüz doğrulanmamış görür.', awaiting: 'eğitim birimi onayı bekliyor',
      rev: 'Rev {r}', confirm: 'Bu revizyonu okudum, onaylıyorum', confirmBy: 'Son onay {d}', approved: 'Otorite onaylı',
      taskDone: 'Yapıldı olarak işaretle', note: 'Not (isteğe bağlı)', doneAt: 'Yapıldı {d}', taskOpen: 'Açık', inProgress: 'Sürüyor',
      quals: 'Yeterlilikler', expired: 'Süresi doldu', valid: 'Geçerli', issued: 'Veriliş {d}', noQuals: 'Havayolun henüz yeterlilik kaydı yayınlamadı.', noProduct: 'Havayolun bunu kullanmıyor.',
    },
  };
  const NTYPES = { crew_notice: ['Crew notice', 'Ekip notu'], safety_bulletin: ['Safety bulletin', 'Emniyet bülteni'], safety_memo: ['Safety memo', 'Emniyet notu'], coordination_sheet: ['Coordination sheet', 'Koordinasyon formu'], security_notice: ['Security notice', 'Güvenlik bildirimi'], information: ['Information', 'Bilgilendirme'], training_document: ['Training document', 'Eğitim belgesi'], revision: ['Revision', 'Revizyon'] };
  const QUALS = { opc: 'OPC', lpc: 'LPC', line_check: ['Line check', 'Hat kontrolü'], sep: 'SEP', dg: ['Dangerous goods', 'Tehlikeli madde'], crm: 'CRM', first_aid: ['First aid', 'İlk yardım'], route_competence: ['Route competence', 'Hat yeterliliği'], aerodrome_competence: ['Aerodrome competence', 'Meydan yeterliliği'], recurrent_cabin: ['Cabin recurrent', 'Kabin tazeleme'], triennial_cabin: ['Cabin triennial', 'Kabin üç yıllık'], medical: ['Medical', 'Sağlık'], licence: ['Licence', 'Lisans'], other: ['Other', 'Diğer'] };

  const st = { lang: (store.get('crewops-crew-lang') || navigator.language || 'en').slice(0, 2) === 'tr' ? 'tr' : 'en', session: null, tab: 'notices', academy: null, library: null, tasks: null, open: null, course: null, exam: false, answers: [], result: null };
  try { st.session = JSON.parse(store.get(KEY) || 'null'); } catch (e) { st.session = null; }
  const w = (k, p = {}) => String(WORDS[st.lang][k] ?? WORDS.en[k] ?? k).replace(/\{(\w+)\}/g, (_, x) => p[x] ?? '');
  const pick = (v) => (Array.isArray(v) ? v[st.lang === 'tr' ? 1 : 0] : v);
  const day = (iso) => (iso ? String(iso).slice(0, 10) : '');
  const todayIso = () => new Date().toISOString().slice(0, 10);
  const daysTo = (d) => (d ? Math.round((Date.parse(d) - Date.parse(todayIso())) / 86400000) : null);

  function applyWords() {
    document.documentElement.lang = st.lang;
    document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = w(el.dataset.t); });
    document.querySelectorAll('.lang button').forEach((b) => b.classList.toggle('on', b.dataset.lang === st.lang));
  }
  document.querySelector('.lang').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (!b) return; st.lang = b.dataset.lang; store.set('crewops-crew-lang', st.lang); applyWords(); if (st.session) render(); });

  // ---- server ----------------------------------------------------------------
  async function api(path, init) {
    let res;
    try {
      res = await fetch(`${BASE}${path}`, { ...init, headers: { 'x-crew-web': st.session.token, ...(init && init.body ? { 'content-type': 'application/json' } : {}) } });
    } catch (e) { throw new Error(w('offline')); }
    if (res.status === 401) { signedOut(w('ended')); throw new Error(w('ended')); }
    return res;
  }
  const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) });
  /** A file of the airline's store (video, PDF): the session goes in the path, a <video> cannot send a header. */
  const fileUrl = (u) => {
    if (!u) return u;
    for (const host of [LIVE, BASE]) if (u.startsWith(`${host}/academy/file/`) || u.startsWith(`${host}/library/file/`)) return `${BASE}/cw/${st.session.token}${u.slice(host.length)}`;
    return u;
  };

  // ---- sign in -----------------------------------------------------------------
  $('code').addEventListener('input', () => {
    const v = $('code').value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    $('code').value = v.length > 4 ? `${v.slice(0, 4)}-${v.slice(4)}` : v;
  });
  $('code').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') $('go').click(); });
  $('go').addEventListener('click', async () => {
    const code = $('code').value.replace(/[^A-Z0-9]/gi, '');
    if (code.length !== 8) { $('signMsg').textContent = w('badCode'); return; }
    $('go').disabled = true;
    $('signMsg').textContent = '';
    try {
      const res = await fetch(`${BASE}/crewweb/session`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || res.status);
      st.session = { token: out.token, airline: out.airline, crewCode: out.crewCode };
      store.set(KEY, JSON.stringify(st.session));
      $('code').value = '';
      await start();
    } catch (e) {
      $('signMsg').textContent = e.message === 'Failed to fetch' ? w('offline') : e.message;
    } finally { $('go').disabled = false; }
  });
  $('out').addEventListener('click', async () => {
    try { await api('/crewweb/logout', { method: 'POST', body: '{}' }); } catch (e) {}
    signedOut('');
  });
  function signedOut(msg) {
    st.session = null;
    store.set(KEY, null);
    $('app').classList.add('hidden');
    $('out').classList.add('hidden');
    $('who').textContent = '';
    $('signin').classList.remove('hidden');
    $('signMsg').textContent = msg || '';
  }

  // ---- data --------------------------------------------------------------------
  async function load() {
    $('appMsg').textContent = '';
    const get = async (path) => {
      try {
        const res = await api(path);
        if (res.status === 403) return { none: true };
        if (!res.ok) return { error: (await res.json().catch(() => ({}))).error || res.status };
        return res.json();
      } catch (e) { return { error: e.message }; }
    };
    const [a, l, t] = await Promise.all([get('/academy/feed'), get('/library/feed'), get('/tasks/feed')]);
    st.academy = a; st.library = l; st.tasks = t;
    const err = [a, l, t].find((x) => x.error);
    if (err && st.session) $('appMsg').textContent = String(err.error);
  }
  async function start() {
    $('signin').classList.add('hidden');
    $('app').classList.remove('hidden');
    $('out').classList.remove('hidden');
    $('who').textContent = `${st.session.airline} · ${st.session.crewCode}`;
    await load();
    if (!st.session) return;
    render();
  }

  // ---- views -------------------------------------------------------------------
  const notices = () => (st.academy && st.academy.notices) || [];
  const courses = () => (st.academy && st.academy.courses) || [];
  const docs = () => (st.library && st.library.documents) || [];
  const tasks = () => (st.tasks && st.tasks.tasks) || [];
  const pendingNotices = () => notices().filter((n) => !n.ack && !n.withdrawn);
  const pendingCourses = () => courses().filter((c) => !c.done && (c.mode || 'required') === 'required');
  const pendingDocs = () => docs().filter((d) => d.requiresAck && !d.ack);
  const activeTasks = () => tasks().filter((x) => x.status === 'open' || x.status === 'in_progress');

  function dueTag(d, done) {
    if (done) return `<span class="tag ok">✓</span>`;
    const n = daysTo(d);
    if (n === null) return '';
    const cls = n < 0 ? 'bad' : n <= 7 ? 'warn' : '';
    return `<span class="tag ${cls}">${n < 0 ? w('overdue') : n === 0 ? w('today') : w('days', { n })}</span>`;
  }
  const tone = (d, done) => { if (done) return 'okc'; const n = daysTo(d); return n === null ? 'new' : n < 0 ? 'late' : n <= 7 ? 'due' : 'new'; };
  const count = (id, n) => { $(id).textContent = n; $(id).classList.toggle('hidden', !n); };

  function render() {
    count('nNotices', pendingNotices().length);
    count('nCourses', pendingCourses().length);
    count('nDocs', pendingDocs().length);
    count('nTasks', activeTasks().length);
    document.querySelectorAll('.tabs button').forEach((b) => {
      const off = (b.dataset.tab === 'docs' && st.library && st.library.none) || (b.dataset.tab === 'tasks' && st.tasks && st.tasks.none) || (['notices', 'courses', 'quals'].includes(b.dataset.tab) && st.academy && st.academy.none);
      b.classList.toggle('hidden', !!off);
      b.classList.toggle('on', b.dataset.tab === st.tab);
      b.setAttribute('aria-selected', String(b.dataset.tab === st.tab));
    });
    const v = $('view');
    if (st.tab === 'courses' && st.course) return renderCourse(v);
    v.innerHTML = { notices: viewNotices, courses: viewCourses, docs: viewDocs, tasks: viewTasks, quals: viewQuals }[st.tab]();
  }
  document.querySelector('.tabs').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (!b) return; st.tab = b.dataset.tab; st.course = null; st.open = null; render(); });

  function viewNotices() {
    if (st.academy && st.academy.none) return `<p class="sub">${w('noProduct')}</p>`;
    const list = notices();
    if (!list.length) return `<p class="sub">${w('nothing')}</p>`;
    const sec = (title, items) => (items.length ? `<h2>${esc(title)}</h2>${items.map(noticeCard).join('')}` : '');
    return sec(w('pending'), pendingNotices().sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999')))
      + sec(w('confirmed'), list.filter((n) => n.ack && !n.withdrawn))
      + sec(w('cancelled'), list.filter((n) => n.withdrawn));
  }
  function noticeCard(n) {
    const open = st.open === n.id;
    const state = n.withdrawn ? `<span class="tag bad">${w('cancelledTag')}</span>` : n.ack ? dueTag(null, true) : `<span><span class="tag ${n.opened ? '' : 'cy'}">${n.opened ? w('opened') : w('new')}</span> ${dueTag(n.dueDate)}</span>`;
    const meta = [n.by, day(n.issuedAt), n.dueDate && !n.ack ? w('due', { d: n.dueDate }) : ''].filter(Boolean).map(esc).join(' · ');
    let inner = '';
    if (open) {
      inner = `${n.body ? `<div class="body">${esc(n.body)}</div>` : ''}${(n.files || []).map((f) => `<p><a href="${esc(fileUrl(f.url))}" target="_blank" rel="noopener">📄 ${esc(f.name)} ↗</a></p>`).join('')}${n.url ? `<p><a href="${esc(fileUrl(n.url))}" target="_blank" rel="noopener">${w('openLink')} ↗</a></p>` : ''}`;
      if (n.withdrawn) inner += `<p class="sub">${esc(w('cancelledBody', { d: day(n.withdrawn) }))}</p>`;
      else if (n.ack) inner += `<p class="tag ok">${esc(w('acked', { d: day(n.ack.at) }))}</p>${n.ack.comment ? `<p class="sub">${esc(w('yourComment', { t: n.ack.comment }))}</p>` : ''}`;
      else inner += `<textarea id="cm-${esc(n.id)}" maxlength="500" placeholder="${esc(w('comment'))}" aria-label="${esc(w('comment'))}"></textarea><div class="row"><button class="go" data-ack="${esc(n.id)}">${w('ack')}</button></div>`;
    }
    return `<div class="card ${n.withdrawn ? '' : tone(n.dueDate, !!n.ack)}" style="${n.withdrawn ? 'opacity:.7' : ''}"><div class="meta"><span>${esc(pick(NTYPES[n.type]) || n.type)} · ${n.no ? esc(w('no', { n: n.no })) : esc(n.id)}</span>${state}</div><h3 style="${n.withdrawn ? 'text-decoration:line-through' : ''}">${esc(n.title)}</h3><p class="sub">${meta}</p>${inner}<div class="row"><button class="ghost" data-read="${esc(n.id)}">${open ? w('close') : w('read')}</button></div></div>`;
  }

  function viewCourses() {
    if (st.academy && st.academy.none) return `<p class="sub">${w('noProduct')}</p>`;
    const list = courses();
    if (!list.length) return `<p class="sub">${w('nothing')}</p>`;
    const self = list.filter((c) => !c.done && c.mode === 'self');
    const done = list.filter((c) => c.done);
    const sec = (title, items) => (items.length ? `<h2>${esc(title)}</h2>${items.map(courseCard).join('')}` : '');
    return sec(w('required'), pendingCourses().sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))) + sec(w('self'), self) + sec(w('confirmed'), done);
  }
  function courseCard(c) {
    const parts = [c.lessons && c.lessons.length ? w('lessons', { n: c.lessons.length }) : '', c.quiz ? w('exam', { n: c.quiz.questions.length }) : '', c.minutes ? w('minutes', { n: c.minutes }) : '', c.dueDate && !c.done ? w('due', { d: c.dueDate }) : ''].filter(Boolean);
    const doneLine = c.done ? `<p class="tag ok">${esc(w('done', { d: day(c.done.at) }))}${c.done.score !== undefined ? ` · ${esc(w('score', { s: c.done.score }))}` : ''}${c.done.verified === false ? ` · ${esc(w('awaiting'))}` : ''}</p>` : '';
    return `<div class="card ${tone(c.dueDate, !!c.done)}"><div class="meta"><span>${esc(c.mode === 'self' ? w('self') : w('required'))}</span>${dueTag(c.dueDate, !!c.done)}</div><h3>${esc(c.title)}</h3><p class="sub">${esc(parts.join(' · '))}</p>${doneLine}<div class="row"><button class="ghost" data-course="${esc(c.id)}">${w('openCourse')} →</button></div></div>`;
  }
  const seenKey = (c) => `crewops-crew-seen:${st.session.airline}:${st.session.crewCode}:${c}`;
  const seenOf = (c) => { try { return new Set(JSON.parse(store.get(seenKey(c)) || '[]')); } catch (e) { return new Set(); } };
  const markSeen = (c, l) => { const s = seenOf(c); s.add(l); store.set(seenKey(c), JSON.stringify([...s])); };

  function renderCourse(v) {
    const c = courses().find((x) => x.id === st.course);
    if (!c) { st.course = null; return render(); }
    const seen = seenOf(c.id);
    const lessons = c.lessons || [];
    const allSeen = lessons.every((l) => seen.has(l.id));
    const kindWord = { video: w('video'), pdf: w('pdf'), link: w('link'), scorm: w('scorm') };
    let html = `<div class="row"><button class="ghost" id="cBack">${w('back')}</button></div><div class="card ${tone(c.dueDate, !!c.done)}"><div class="meta"><span>${esc(c.mode === 'self' ? w('self') : w('required'))}</span>${dueTag(c.dueDate, !!c.done)}</div><h3>${esc(c.title)}</h3>`;
    html += lessons.map((l) => {
      const open = st.open === l.id;
      let body = '';
      if (open && l.kind === 'video') body = `<video controls playsinline preload="metadata" src="${esc(fileUrl(l.url))}"></video>`;
      if (open && l.kind === 'scorm') body = `<p class="sub">${w('scormPhone')}</p>`;
      const action = l.kind === 'pdf' || l.kind === 'link' ? `<a class="ghost" style="text-decoration:none" href="${esc(fileUrl(l.url))}" target="_blank" rel="noopener" data-seen="${esc(l.id)}">${l.kind === 'pdf' ? w('openPdf') : w('openLink')} ↗</a>` : `<button class="ghost" data-lesson="${esc(l.id)}">${open ? w('close') : w('openCourse')}</button>`;
      return `<div class="lesson"><div><b>${esc(l.title)}</b><div class="sub">${esc(kindWord[l.kind] || l.kind)}${l.minutes ? ` · ${esc(w('minutes', { n: l.minutes }))}` : ''}${seen.has(l.id) ? ` · <span class="tag ok">${w('lessonSeen')}</span>` : ''}</div></div>${action}</div>${body}`;
    }).join('');
    if (c.done) html += `<p class="tag ok" style="margin-top:12px">${esc(w('done', { d: day(c.done.at) }))}${c.done.score !== undefined ? ` · ${esc(w('score', { s: c.done.score }))}` : ''}</p>`;
    else if (c.quiz) {
      if (st.result) html += `<p class="tag ${st.result.passed ? 'ok' : 'bad'}" style="margin-top:12px">${esc(st.result.passed ? w('passed', { s: st.result.score }) : w('failed', { s: st.result.score, p: c.quiz.passMark }))}</p>`;
      if (!st.exam) html += allSeen ? `<div class="row"><button class="go" id="startExam">${w('startExam')}</button></div>` : `<p class="sub" style="margin-top:12px">${w('examLocked')}</p>`;
      else html += c.quiz.questions.map((q, i) => `<div class="q">${i + 1}. ${esc(q.q)}</div>${q.options.map((o, j) => `<label class="opt"><input type="radio" name="q${i}" value="${j}"${st.answers[i] === j ? ' checked' : ''} /> <span>${esc(o)}</span></label>`).join('')}`).join('') + `<div class="row"><button class="go" id="submitExam">${w('submit')}</button></div><div class="msg" id="examMsg"></div>`;
    } else if (!lessons.some((l) => l.kind === 'scorm')) html += `<div class="row"><button class="go" id="iDone"${allSeen ? '' : ' disabled'}>${w('iDone')}</button></div>`;
    v.innerHTML = html + '</div>';
  }

  function viewDocs() {
    if (st.library && st.library.none) return `<p class="sub">${w('noProduct')}</p>`;
    const list = docs();
    if (!list.length) return `<p class="sub">${w('nothing')}</p>`;
    const card = (d) => `<div class="card ${d.requiresAck ? tone(d.ackDue, !!d.ack) : ''}"><div class="meta"><span>${esc(d.code)} · ${esc(w('rev', { r: d.revision }))}${d.approved ? ` · ${esc(w('approved'))}` : ''}</span>${d.requiresAck ? dueTag(d.ackDue, !!d.ack) : ''}</div><h3>${esc(d.title)}</h3><p class="sub">${esc([d.revisionDate, d.requiresAck && !d.ack && d.ackDue ? w('confirmBy', { d: d.ackDue }) : ''].filter(Boolean).join(' · '))}</p>${d.changeLog ? `<div class="body sub">${esc(d.changeLog)}</div>` : ''}<div class="row">${d.fileUrl ? `<a class="ghost" style="text-decoration:none" href="${esc(fileUrl(d.fileUrl))}" target="_blank" rel="noopener">${w('openPdf')} ↗</a>` : ''}${d.requiresAck && !d.ack ? `<button class="go" data-doc="${esc(d.code)}" data-rev="${esc(d.revision)}">${w('confirm')}</button>` : d.ack ? `<span class="tag ok">${esc(w('acked', { d: day(d.ack.at) }))}</span>` : ''}</div></div>`;
    const pend = pendingDocs();
    const rest = list.filter((d) => !pend.includes(d));
    return (pend.length ? `<h2>${w('pending')}</h2>${pend.map(card).join('')}${rest.length ? `<h2>${w('tabDocs')}</h2>` : ''}` : '') + rest.map(card).join('');
  }

  function viewTasks() {
    if (st.tasks && st.tasks.none) return `<p class="sub">${w('noProduct')}</p>`;
    const list = tasks();
    if (!list.length) return `<p class="sub">${w('nothing')}</p>`;
    const card = (t) => {
      const active = t.status === 'open' || t.status === 'in_progress';
      return `<div class="card ${active ? tone(t.due) : 'okc'}"><div class="meta"><span>${esc(active ? (t.status === 'in_progress' ? w('inProgress') : w('taskOpen')) : w('doneAt', { d: day(t.doneAt) }))}</span>${active ? dueTag(t.due) : dueTag(null, true)}</div><h3>${esc(t.title)}</h3>${t.detail ? `<div class="body sub">${esc(t.detail)}</div>` : ''}${t.due && active ? `<p class="sub">${esc(w('due', { d: t.due }))}</p>` : ''}${active ? `<input type="text" id="tn-${esc(t.id)}" maxlength="500" placeholder="${esc(w('note'))}" aria-label="${esc(w('note'))}" /><div class="row"><button class="go" data-task="${esc(t.id)}">${w('taskDone')}</button></div>` : ''}</div>`;
    };
    return list.map(card).join('');
  }

  function viewQuals() {
    const q = (st.academy && st.academy.qualifications) || [];
    if (!q.length) return `<p class="sub">${w('noQuals')}</p>`;
    return `<div class="card">${[...q].sort((a, b) => (a.expires || '9999').localeCompare(b.expires || '9999')).map((x) => { const n = daysTo(x.expires); const cls = n === null ? '' : n < 0 ? 'bad' : n <= 30 ? 'warn' : 'ok'; return `<div class="qual"><div><b>${esc(x.label || pick(QUALS[x.kind]) || x.kind)}</b><div class="sub">${esc([x.issued ? w('issued', { d: x.issued }) : '', x.note].filter(Boolean).join(' · '))}</div></div><span class="tag ${cls}">${esc(x.expires ? (n < 0 ? w('expired') : x.expires) : w('valid'))}</span></div>`; }).join('')}</div>`;
  }

  // ---- actions -----------------------------------------------------------------
  $('view').addEventListener('click', async (ev) => {
    const t = ev.target.closest('[data-read],[data-ack],[data-course],[data-lesson],[data-seen],[data-doc],[data-task],#cBack,#startExam,#submitExam,#iDone');
    if (!t) return;
    try {
      if (t.dataset.read) {
        const n = notices().find((x) => x.id === t.dataset.read);
        st.open = st.open === n.id ? null : n.id;
        if (st.open && !n.opened && !n.ack && !n.withdrawn) { n.opened = new Date().toISOString(); post('/academy/open', { noticeId: n.id }).catch(() => {}); }
        return render();
      }
      if (t.dataset.ack) {
        t.disabled = true;
        const comment = ($(`cm-${t.dataset.ack}`) || {}).value || '';
        const res = await post('/academy/ack', { noticeId: t.dataset.ack, ...(comment.trim() ? { comment: comment.trim() } : {}) });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(out.error || res.status);
        await load(); return render();
      }
      if (t.dataset.course) { st.course = t.dataset.course; st.open = null; st.exam = false; st.answers = []; st.result = null; return render(); }
      if (t.id === 'cBack') { st.course = null; st.open = null; return render(); }
      if (t.dataset.lesson) { st.open = st.open === t.dataset.lesson ? null : t.dataset.lesson; if (st.open) markSeen(st.course, st.open); return render(); }
      if (t.dataset.seen) { markSeen(st.course, t.dataset.seen); setTimeout(render, 0); return; }
      if (t.id === 'startExam') { st.exam = true; st.result = null; st.answers = []; return render(); }
      if (t.id === 'submitExam') {
        const c = courses().find((x) => x.id === st.course);
        const answers = c.quiz.questions.map((_, i) => { const r = document.querySelector(`input[name=q${i}]:checked`); return r ? Number(r.value) : null; });
        if (answers.some((a) => a === null)) { st.answers = answers; $('examMsg').textContent = w('answerAll'); return; }
        t.disabled = true;
        const res = await post('/academy/complete', { courseId: c.id, answers });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(out.error || res.status);
        st.result = { passed: !!out.passed, score: out.attempt ? out.attempt.score : (out.done && out.done.score) };
        st.exam = false; st.answers = [];
        await load(); return render();
      }
      if (t.id === 'iDone') {
        if (!confirm(w('iDoneAsk'))) return;
        const res = await post('/academy/complete', { courseId: st.course });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.status);
        await load(); return render();
      }
      if (t.dataset.doc) {
        t.disabled = true;
        const res = await post('/library/ack', { code: t.dataset.doc, revision: t.dataset.rev });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.status);
        await load(); return render();
      }
      if (t.dataset.task) {
        t.disabled = true;
        const note = ($(`tn-${t.dataset.task}`) || {}).value || '';
        const res = await post('/tasks/done', { taskId: t.dataset.task, ...(note.trim() ? { note: note.trim() } : {}) });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.status);
        await load(); return render();
      }
    } catch (e) { $('appMsg').textContent = e.message; t.disabled = false; }
  });
  // A radio choice survives a re-render (the language switch redraws the exam).
  $('view').addEventListener('change', (ev) => { const m = /^q(\d+)$/.exec(ev.target.name || ''); if (m) st.answers[Number(m[1])] = Number(ev.target.value); });

  applyWords();
  if (st.session && st.session.token) start(); else signedOut('');
})();
