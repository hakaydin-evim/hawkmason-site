// Page behaviour for Crewops Insight. The engines live in crewops-insight.js
// (built by tools/insight/build.mjs); this file only reads files, calls them
// and draws the tables. No network calls except the fonts and pdf.js.
(() => {
  const $ = (id) => document.getElementById(id);
  const state = { planned: null, actual: null, licence: null, evaluation: false };

  // Access: a signed operator code (the Crewops Crew licence) opens the file
  // inputs; without it the page runs on the sample roster only.
  function setAccess(lic) {
    state.licence = lic;
    const unlocked = !!lic;
    document.querySelectorAll('#inputs input[type=file]').forEach((i) => { i.disabled = !unlocked; });
    document.querySelectorAll('#inputs .drop').forEach((d) => { d.style.opacity = unlocked ? '1' : '.45'; d.style.pointerEvents = unlocked ? 'auto' : 'none'; });
    $('accessNote').innerHTML = unlocked
      ? `Licensed to <b>${lic.name}</b> until ${lic.exp}. Files are read in this browser; nothing is uploaded.`
      : 'Crewops Insight is licensed per operator. The same code that unlocks Crewops Crew for your pilots opens this page. No code yet? Run it on the sample roster, or <a href="mailto:hello@hawkmason.com?subject=Crewops%20Insight%3A%20access%20request">ask for a trial on your own files</a>.';
  }
  $('codeBtn').addEventListener('click', () => {
    const r = CrewopsInsight.checkCode($('code').value);
    if (r.ok) { try { localStorage.setItem('crewops-insight-code', $('code').value.trim()); } catch (e) {} state.evaluation = false; setAccess(r); $('msg').textContent = ''; }
    else $('msg').textContent = r.reason === 'expired' ? 'This code has run out. Ask for a renewed one.' : r.reason === 'none' ? 'Paste the whole code.' : 'This code was not issued by Crewops.';
  });
  $('sampleBtn').addEventListener('click', async () => {
    try {
      const text = await (await fetch('/crewops-sample-roster.ics')).text();
      state.evaluation = true;
      state.planned = { duties: CrewopsInsight.parseIcsText(text, 'AYT', 'planned').duties, warnings: [], names: ['sample roster'], unread: [] };
      state.actual = null;
      $('base').value = 'AYT';
      $('run').disabled = false;
      $('run').click();
    } catch (e) { $('msg').textContent = 'Could not load the sample roster.'; }
  });
  try { const saved = localStorage.getItem('crewops-insight-code'); if (saved) { const r = CrewopsInsight.checkCode(saved); if (r.ok) { $('code').value = saved; setAccess(r); } else setAccess(null); } else setAccess(null); } catch (e) { setAccess(null); }

  async function pdfPages(file) {
    const pdfjs = window.__pdfjs;
    if (!pdfjs) throw new Error('pdf.js not loaded');
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      // Group items into lines by their baseline (y), left to right, the way
      // PDFKit's text layer hands lines to the app's reader.
      const rows = new Map();
      for (const it of content.items) {
        if (!('str' in it) || !it.str.trim()) continue;
        const y = Math.round(it.transform[5] / 2) * 2;
        const x = it.transform[4];
        (rows.get(y) || rows.set(y, []).get(y)).push({ x, s: it.str });
      }
      const lines = [...rows.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, items]) => items.sort((a, b) => a.x - b.x).map((i) => i.s).join(' ').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      pages.push({ page: p, lines });
    }
    return pages;
  }

  // A workbook: every sheet as rows of text, the first sheet a reader claims wins.
  async function sheetRows(file, base, versionId) {
    const XLSX = window.XLSX;
    if (!XLSX) throw new Error('spreadsheet reader not loaded');
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
    let first = null;
    for (const sheetName of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: false, defval: '' });
      const parsed = CrewopsInsight.parseRows(rows, base, versionId, file.name);
      if (parsed.duties.length) return parsed;
      first = first || parsed;
    }
    return first || { duties: [], warnings: [], vendor: null, kind: 'sheet' };
  }

  async function readFiles(files, versionId) {
    const base = $('base').value.trim().toUpperCase();
    const out = { duties: [], warnings: [], names: [], unread: [] };
    for (const f of files) {
      const name = f.name;
      let parsed;
      if (/\.(ics|ical|ifb|vcs)$/i.test(name) || /calendar/.test(f.type)) {
        parsed = CrewopsInsight.parseIcsText(await f.text(), base, versionId);
      } else if (/\.(xlsx|xlsm|xls|ods|numbers)$/i.test(name) || /spreadsheet|ms-excel/.test(f.type)) {
        parsed = await sheetRows(f, base, versionId);
      } else if (/\.pdf$/i.test(name) || /pdf/.test(f.type)) {
        parsed = CrewopsInsight.parsePdfPages(await pdfPages(f), base, versionId, name);
      } else if (/\.(html?|mhtml?)$/i.test(name) || /html/.test(f.type)) {
        const html = await f.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        parsed = CrewopsInsight.parseHtml(html, doc.body ? doc.body.innerText || doc.body.textContent || '' : '', base, versionId);
      } else {
        parsed = CrewopsInsight.parseText(await f.text(), base, versionId);
      }
      out.duties.push(...parsed.duties);
      out.warnings.push(...parsed.warnings);
      if (parsed.duties.length === 0) {
        const who = parsed.vendor ? `This looks like a ${parsed.vendor} export, which this page does not read yet.` : 'No reader recognised this file.';
        const subject = encodeURIComponent(`Crewops Insight: roster format (${name})`);
        const body = encodeURIComponent(`Hello,\n\nCrewops Insight could not read this roster export.\nFile: ${name}\nSystem: ${parsed.vendor || 'unknown'}\n\nPlease attach the file (anonymised if you prefer) and we will add a reader.\n`);
        out.unread.push(`${who} Send it to <a href="mailto:hello@hawkmason.com?subject=${subject}&body=${body}">hello@hawkmason.com</a> and we add the reader, usually within days.`);
      }
      out.names.push(`${name} · ${parsed.duties.length} duties${parsed.vendor ? ' · ' + parsed.vendor : ''}`);
    }
    return out;
  }

  function wireDrop(el, slot) {
    const input = el.querySelector('input');
    const nameEl = el.querySelector('.name');
    const take = async (files) => {
      if (!files || !files.length) return;
      $('msg').textContent = '';
      try {
        nameEl.textContent = 'reading…';
        state.evaluation = false;
        state[slot] = await readFiles([...files], slot);
        nameEl.textContent = state[slot].names.join(' · ');
        if (state[slot].unread.length) $('msg').innerHTML = state[slot].unread.join('<br>');
        else if (state[slot].warnings.length) $('msg').textContent = `Reader notes (${state[slot].warnings.length}): ${state[slot].warnings.slice(0, 3).join(' | ')}`;
        $('run').disabled = !(state.planned && state.planned.duties.length > 0);
      } catch (e) {
        nameEl.textContent = '';
        $('msg').textContent = `Could not read ${files[0].name}: ${e && e.message ? e.message : e}`;
      }
    };
    input.addEventListener('change', () => take(input.files));
    el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('over'); });
    el.addEventListener('dragleave', () => el.classList.remove('over'));
    el.addEventListener('drop', (e) => { e.preventDefault(); el.classList.remove('over'); take(e.dataTransfer.files); });
  }
  wireDrop($('dropPlanned'), 'planned');
  wireDrop($('dropActual'), 'actual');

  const fmtMin = (m) => (m === null || m === undefined ? '—' : `${Math.floor(Math.abs(m) / 60)}:${String(Math.abs(m) % 60).padStart(2, '0')}${m < 0 ? ' over' : ''}`);
  const pill = (cls, text) => `<span class="pill ${cls}">${text}</span>`;
  const levelPill = (l) => (l === 'compliant' ? pill('ok', 'within') : l === 'warning' ? pill('warn', 'near') : l === 'breach' ? pill('bad', 'over') : pill('mute', 'n/a'));
  const kssPill = (k) => (k === null ? pill('mute', '—') : k >= 8 ? pill('bad', k.toFixed(1)) : k >= 7 ? pill('warn', k.toFixed(1)) : pill('ok', k.toFixed(1)));
  const nightLabel = { none: '—', start_02_05: 'start 02–05', end_02_06: 'end 02–06', end_after_06: 'end ≥06' };

  function tile(n, l) { return `<div class="tile"><div class="n">${n}</div><div class="l">${l}</div></div>`; }

  function render(summary, cmp) {
    const c = summary.counts;
    const noRest = !!(state.planned && state.planned.warnings.some((w) => /augmented crew/i.test(w)));
    $('noRestNote').classList.toggle('hidden', !noRest);
    $('tiles').innerHTML = [
      tile(c.flights, 'flight duties'),
      tile(c.aboveThreshold, noRest ? 'KSS ≥ 7 at TOD (no-rest case)' : 'KSS ≥ 7 at TOD'),
      tile(c.flights ? Math.round((100 * c.aboveThreshold) / c.flights) + '%' : '—', noRest ? 'share above threshold (no-rest case)' : 'share above threshold'),
      tile(c.night, 'night duties (2023/023/R)'),
      tile(c.overMaxFdp, 'FDP over maximum'),
      tile(c.fdpUndetermined, 'FDP not assessable'),
    ].join('');
    const rows = summary.duties.map((d) => `<tr>
      <td>${d.date}</td><td>${d.type}</td><td>${d.route}</td><td>${d.reportLocal}</td><td class="r">${d.sectors}</td>
      <td class="r">${fmtMin(d.fdpMin)}</td><td class="r">${fmtMin(d.maxFdpMin)}</td><td class="r">${d.fdpMarginMin === null ? '—' : fmtMin(d.fdpMarginMin)}</td><td>${levelPill(d.fdpLevel)}</td>
      <td class="r">${d.indicator.score} ${d.indicator.band}</td>
      <td class="r">${d.kssAtReport.toFixed(1)}</td><td>${kssPill(d.kssTodMax)}</td><td class="r">${d.kssTodMax === null ? '—' : Math.max(1, Math.round(d.kssTodMax) - 2)}</td><td class="r">${d.kssPeak.toFixed(1)}</td>
      <td>${nightLabel[d.nightType]}</td><td class="r">${fmtMin(d.sleepPrior24Min)}</td><td class="r">${fmtMin(d.sleepPrior48Min)}</td><td class="r">${d.hoursAwakeAtReport.toFixed(1)}</td><td class="r">${d.pswmPoints}</td>
      <td>${d.indicator.factors.map((f) => f.label).join(', ')}</td></tr>`).join('');
    $('table').innerHTML = `<thead><tr><th>Date</th><th>Type</th><th>Route</th><th>Report</th><th class="r">Sect.</th><th class="r">FDP</th><th class="r">Max</th><th class="r">Margin</th><th>FDP</th><th class="r">Indicator</th><th class="r">KSS report</th><th>KSS TOD</th><th class="r">SP TOD</th><th class="r">KSS peak</th><th>Night</th><th class="r">Sleep 24h</th><th class="r">Sleep 48h</th><th class="r">Awake h</th><th class="r">PSWM</th><th>Factors</th></tr></thead><tbody>${rows}</tbody>`;
    const months = Object.entries(summary.byMonth).sort().map(([m, r]) => `<tr><td>${m}</td><td class="r">${r.flights}</td><td class="r">${r.aboveThreshold}</td><td class="r">${r.flights ? Math.round((100 * r.aboveThreshold) / r.flights) : 0}%</td><td class="r">${r.night}</td><td class="r">${r.meanKssTod === null ? '—' : r.meanKssTod.toFixed(1)}</td></tr>`).join('');
    $('months').innerHTML = `<thead><tr><th>Month</th><th class="r">Flights</th><th class="r">KSS ≥ 7</th><th class="r">Share</th><th class="r">Night</th><th class="r">Mean KSS TOD</th></tr></thead><tbody>${months}</tbody>`;
    if (cmp) {
      $('pva').classList.remove('hidden');
      $('pvaTiles').innerHTML = [
        tile(cmp.matched.length, 'duties matched'),
        tile(cmp.exceedanceShare === null ? '—' : Math.round(100 * cmp.exceedanceShare) + '%', 'flown over max FDP'),
        tile(cmp.exceeds33pct ? 'YES' : 'no', 'ORO.FTL.110(j) 33% trigger'),
        tile(cmp.onlyPlanned.length, 'planned, not flown'),
        tile(cmp.onlyActual.length, 'flown, not planned'),
      ].join('');
      const prow = cmp.matched.map((m) => `<tr><td>${m.date}</td><td>${m.route}</td><td class="r">${fmtMin(m.plannedFdpMin)}</td><td class="r">${fmtMin(m.actualFdpMin)}</td><td class="r">${m.deltaMin >= 0 ? '+' : '−'}${fmtMin(Math.abs(m.deltaMin))}</td><td class="r">${fmtMin(m.maxFdpMin)}</td><td>${m.actualOverMax ? pill('bad', 'over') : pill('ok', 'within')}</td></tr>`).join('');
      $('pvaTable').innerHTML = `<thead><tr><th>Date</th><th>Route</th><th class="r">Planned FDP</th><th class="r">Flown FDP</th><th class="r">Δ</th><th class="r">Max</th><th>Flown vs max</th></tr></thead><tbody>${prow}</tbody>`;
    } else $('pva').classList.add('hidden');
    $('evalTag').classList.toggle('hidden', !state.evaluation);
    $('results').classList.remove('hidden');
    $('csv').classList.toggle('hidden', state.evaluation);
    $('print').classList.remove('hidden');
  }

  let last = null;
  $('run').addEventListener('click', () => {
    $('msg').textContent = '';
    try {
      const opts = { ruleSetId: $('rules').value, homeBase: $('base').value.trim().toUpperCase(), todLeadMin: Number($('tod').value) };
      const planned = CrewopsInsight.analyse(state.planned.duties, opts);
      let cmp = null;
      if (state.actual) cmp = CrewopsInsight.compare(planned, CrewopsInsight.analyse(state.actual.duties, opts));
      last = planned;
      render(planned, cmp);
      $('results').scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
      $('msg').textContent = `Analysis failed: ${e && e.message ? e.message : e}`;
    }
  });
  $('csv').addEventListener('click', () => {
    if (!last) return;
    const blob = new Blob([CrewopsInsight.toCsv(last)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `crewops-insight-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  });
  $('print').addEventListener('click', () => window.print());
})();
