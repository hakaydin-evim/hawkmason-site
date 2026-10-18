// Page behaviour for Crewops Insight. The engines live in crewops-insight.js
// (built by tools/insight/build.mjs); this file only reads files, calls them
// and draws the tables. Roster files never leave the browser. Network: the
// pdf.js / SheetJS / font files the page loads, the licence-gated usage counts
// (crewops-session.js) and the crew-ratings request below.
(() => {
  const $ = (id) => document.getElementById(id);
  const state = { planned: null, actual: null, licence: null, evaluation: false, code: null, ratings: null };
  const RATINGS_ENDPOINT = 'https://updates.hawkmason.com/insight/ratings';

  // Access: a signed operator code (the Crewops Crew licence) opens the file
  // inputs; without it the page runs on the sample roster only.
  function setAccess(lic) {
    state.licence = lic;
    // The roster analysis is Crewops Insight; a code that bought only Safety,
    // Academy or Library opens those sections, not the analysis.
    const unlocked = !!lic && (lic.products || ['insight']).includes('insight');
    document.querySelectorAll('#inputs input[type=file]').forEach((i) => { i.disabled = !unlocked; });
    document.querySelectorAll('#inputs .drop').forEach((d) => { d.style.opacity = unlocked ? '1' : '.45'; d.style.pointerEvents = unlocked ? 'auto' : 'none'; });
    const names = { insight: 'Insight', safety: 'Safety', academy: 'Academy', library: 'Library' };
    $('accessNote').innerHTML = lic
      ? `Signed in: <b>${lic.name}</b>, until ${lic.exp}. Products: ${(lic.products || ['insight']).map((x) => names[x] || x).join(', ')}.${unlocked ? ' Roster files are read in this browser and are not uploaded (see Where the data goes).' : ''}${lic.ops ? '' : ' This is a crew code: it opens the analysis only; crew-reported ratings, reports, training and documents need the operator code.'}`
      : 'One operator code per airline opens the products it holds. No code yet? <a href="mailto:hello@hawkmason.com?subject=Crewops%20Aviation%20Platform%3A%20operator%20access">Write to us</a>.';
  }
  // Sign-in lives in crewops-session.js (shared by every portal page); this page only reacts.
  window.addEventListener('crewops-code', (ev) => { state.evaluation = false; state.code = ev.detail.code; setAccess(ev.detail.licence); });
  window.addEventListener('crewops-nocode', () => setAccess(null));
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

  async function pdfPages(file) {
    const pdfjs = window.__pdfjs;
    if (!pdfjs) throw new Error('pdf.js not loaded');
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      if (page.rotate % 360 !== 0) {
        // A rotated page (the portal prints NetLine's landscape plan as a portrait
        // page with /Rotate 270): item transforms are in the unrotated page space, so
        // grouping by their y reads columns as rows. And the NetLine reader is written
        // for the line order of the PDF's own text layer (what PDFKit hands the app):
        // the two printed halves are two runs of lines, a duty's rows sit together,
        // annotation blocks come where the file puts them; re-sorting by y interleaves
        // the halves and moves legs to the wrong duty. So keep the stream order, end a
        // line at pdf.js's end-of-line marker or where the baseline moves in the
        // displayed page, and read each line left to right as displayed.
        const vt = page.getViewport({ scale: 1 }).transform;
        const lines = [];
        let line = [];
        let lineY = 0;
        const flush = () => {
          const text = line.sort((a, b) => a.x - b.x).map((i) => i.s).join(' ').replace(/\s+/g, ' ').trim();
          if (text) lines.push(text);
          line = [];
        };
        for (const it of content.items) {
          if (!('str' in it)) continue;
          if (it.str.trim()) {
            const x = vt[0] * it.transform[4] + vt[2] * it.transform[5] + vt[4];
            const y = vt[1] * it.transform[4] + vt[3] * it.transform[5] + vt[5];
            if (line.length && Math.abs(y - lineY) > 2) flush();
            if (!line.length) lineY = y;
            line.push({ x, s: it.str });
          }
          if (it.hasEOL) flush();
        }
        flush();
        pages.push({ page: p, lines });
        continue;
      }
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
        const body = encodeURIComponent(`Hello,\n\nCrewops Insight could not read this roster export.\nFile: ${name}\nSystem: ${parsed.vendor || 'unknown'}\n\nPlease attach the file (anonymised if you prefer) and tell us whether and when a reader can be added.\n`);
        out.unread.push(`${who} Send a sample file, anonymised if you prefer, to <a href="mailto:hello@hawkmason.com?subject=${subject}&body=${body}">hello@hawkmason.com</a>. We look at it and tell you whether and when a reader can be added.`);
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
    const aug = c.augmented > 0;
    const noRest = summary.inFlightRest === 'none';
    $('noRestNote').classList.toggle('hidden', !aug);
    if (aug) {
      const cls = summary.restFacilityClass;
      $('noRestNote').innerHTML = noRest
        ? `<b>Augmented crew, in-flight rest NOT credited.</b> ${c.augmented} of ${c.flights} flight duties list three or more pilots. Duties of this kind rely on in-flight rest (CS FTL.1.205(c): at least 90 consecutive minutes for each crew member, 2 hours for the pilots at the controls for landing), so this run is a counterfactual: it shows where in each duty the body clock is lowest and how duties rank, not how sleepy any pilot is. Switch "In-flight rest" to credited for the planning view.`
        : `<b>Augmented crew, in-flight rest credited.</b> ${c.augmented} of ${c.flights} flight duties list three or more pilots. Each pilot is credited an equal share of the cruise on every leg long enough (never under the 90-minute minimum), taken as sleep (all of the slot by default, the favourable bound, or the fraction set under study assumptions). By default the slot is the landing pilot's and ends two hours before on-blocks (the relief slot starts one hour after departure); the operator's own allocation is not in the file. The facility class does not change this credit. "EASA max (aug.)" is the CS FTL.1.205(c) standard value for that crew and the class ${cls} facility you selected, including the extra hour for a sector over 9 h block time with at most 2 sectors. It is shown for comparison and does not replace the ceiling behind the within / over label. Where the file lists three or four pilots but prints no ceiling, that label compares the FDP with the two-pilot table, so a duty inside this value can read over; it then also counts in "FDP over the maximum in use" and in the planned-versus-flown share. Where the file's ceiling is above this value, an approved scheme or a pilot not listed in the file may explain it, and the file's figure is used as given.` + (c.operatorMaxAboveEasa ? ` <b>${c.operatorMaxAboveEasa} duties have an operator maximum above the standard value: verify the scheme.</b>` : '');
    }
    const a = summary.assumptions || {};
    const assumptionsLine = `Assumptions of this run: in-flight rest ${a.inFlightRest === 'none' ? 'not credited' : 'credited'} · facility class ${a.restFacilityClass} · modelled pilot takes the ${a.restSlot === 'relief' ? 'relief' : 'landing'} slot · ${Math.round((a.restQuality || 1) * 100)}% of the slot credited as sleep · sleep before each rotation ${a.priorSleepHours ? a.priorSleepHours + ' h, ending 2 h before report' : 'predicted by the model'} · time-zone adaptation ${Math.round((a.adaptRate || 0) * 100)}% per day · top-of-descent stand-in ${a.todLeadMin} min before on-blocks.`;
    const an = $('assumptions');
    if (an) an.textContent = assumptionsLine;
    $('tiles').innerHTML = [
      tile(c.flights, 'flight duties'),
      tile(c.aboveThreshold, aug ? (noRest ? 'KSS ≥ 7 at TOD (rest not credited)' : 'KSS ≥ 7 at TOD (rest credited)') : 'KSS ≥ 7 at TOD'),
      tile(c.flights ? Math.round((100 * c.aboveThreshold) / c.flights) + '%' : '—', 'share above threshold'),
      tile(c.night, 'night duties (2023/023/R)'),
      tile(c.overMaxFdp, 'FDP over the maximum in use'),
      tile(c.fdpUndetermined, 'FDP not assessable'),
      ...(aug ? [tile(c.augmented, 'augmented-crew duties'), tile(c.operatorMaxAboveEasa, 'operator max above CS FTL.1.205(c)')] : []),
    ].join('');
    const rows = summary.duties.map((d) => `<tr>
      <td>${d.date}</td><td>${d.type}</td><td>${d.route}</td><td>${d.reportLocal}</td><td class="r">${d.sectors}</td><td class="r">${d.pilots === null ? '—' : d.pilots}</td>
      <td class="r">${fmtMin(d.fdpMin)}</td><td class="r">${fmtMin(d.maxFdpMin)}</td><td class="r">${d.fdpMarginMin === null ? '—' : fmtMin(d.fdpMarginMin)}</td><td>${levelPill(d.fdpLevel)}</td>
      <td>${d.easaAugmentedMaxFdpMin === null ? '<span class="pill mute">—</span>' : d.operatorMaxAboveEasa ? pill('warn', fmtMin(d.easaAugmentedMaxFdpMin) + ' · op. above') : pill('ok', fmtMin(d.easaAugmentedMaxFdpMin))}</td><td class="r">${d.restCreditedMin ? fmtMin(d.restCreditedMin) : '—'}</td>
      <td class="r">${d.indicator.score} ${d.indicator.band}</td>
      <td class="r">${d.kssAtReport.toFixed(1)}</td><td>${kssPill(d.kssTodMax)}</td><td class="r">${d.kssTodMax === null ? '—' : Math.max(1, Math.round(d.kssTodMax) - 2)}</td><td class="r">${d.crewReported ? `<b>${d.crewReported.meanSp.toFixed(1)}</b>${d.crewReported.n > 1 ? ` <span class="fine">×${d.crewReported.n}</span>` : ''}` : '—'}</td><td class="r">${d.kssPeak.toFixed(1)}</td>
      <td>${nightLabel[d.nightType]}</td><td class="r">${fmtMin(d.sleepPrior24Min)}</td><td class="r">${fmtMin(d.sleepPrior48Min)}</td><td class="r">${d.hoursAwakeAtReport.toFixed(1)}</td><td class="r">${d.pswmPoints}</td>
      <td>${d.indicator.factors.map((f) => f.label).join(', ')}</td></tr>`).join('');
    $('table').innerHTML = `<thead><tr><th>Date</th><th>Type</th><th>Route</th><th>Report</th><th class="r">Sect.</th><th class="r">Pilots</th><th class="r">FDP</th><th class="r">Max FDP</th><th class="r">Margin</th><th>FDP vs max</th><th>EASA max (aug.)</th><th class="r">Rest</th><th class="r">Indicator</th><th class="r">KSS report</th><th>KSS TOD</th><th class="r">SP equiv. TOD</th><th class="r">Crew SP</th><th class="r">KSS peak</th><th>Night</th><th class="r">Sleep 24h</th><th class="r">Sleep 48h</th><th class="r">Awake h</th><th class="r">Sleep/wake score</th><th>Factors</th></tr></thead><tbody>${rows}</tbody>`;
    const months = Object.entries(summary.byMonth).sort().map(([m, r]) => `<tr><td>${m}</td><td class="r">${r.flights}</td><td class="r">${r.aboveThreshold}</td><td class="r">${r.flights ? Math.round((100 * r.aboveThreshold) / r.flights) : 0}%</td><td class="r">${r.night}</td><td class="r">${r.meanKssTod === null ? '—' : r.meanKssTod.toFixed(1)}</td></tr>`).join('');
    // Crew-reported beside predicted: per matched duty and per destination.
    const matched = summary.duties.filter((d) => d.crewReported);
    if (matched.length) {
      const err = matched.map((d) => d.crewReported.meanSp - (d.kssTodMax === null ? 0 : Math.max(1, Math.round(d.kssTodMax) - 2)));
      const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
      $('crewNote').textContent = `Crew-reported ratings: ${state.ratingsCount} received, ${matched.length} duties matched. Mean reported SP ${mean(matched.map((d) => d.crewReported.meanSp)).toFixed(1)} against the predicted equivalent ${mean(matched.map((d) => d.kssTodMax === null ? 0 : Math.max(1, Math.round(d.kssTodMax) - 2))).toFixed(1)}; mean difference (reported − predicted) ${mean(err) >= 0 ? '+' : ''}${mean(err).toFixed(2)}, mean absolute ${mean(err.map(Math.abs)).toFixed(2)}. Indicative only: the prediction has not been validated against these ratings.`;
      const byDest = {};
      for (const d of matched) { const k = d.legs.length ? d.legs[d.legs.length - 1].arr : '—'; (byDest[k] ??= []).push(d); }
      $('crewDest').innerHTML = `<thead><tr><th>Destination</th><th class="r">Duties rated</th><th class="r">Ratings</th><th class="r">Mean reported SP</th><th class="r">Mean predicted SP equiv.</th><th class="r">Difference</th></tr></thead><tbody>${Object.entries(byDest).sort().map(([k, ds]) => { const rep = mean(ds.map((d) => d.crewReported.meanSp)); const pre = mean(ds.map((d) => d.kssTodMax === null ? 0 : Math.max(1, Math.round(d.kssTodMax) - 2))); return `<tr><td>${k}</td><td class="r">${ds.length}</td><td class="r">${ds.reduce((n, d) => n + d.crewReported.n, 0)}</td><td class="r">${rep.toFixed(1)}</td><td class="r">${pre.toFixed(1)}</td><td class="r">${rep - pre >= 0 ? '+' : ''}${(rep - pre).toFixed(1)}</td></tr>`; }).join('')}</tbody>`;
      $('crew').classList.remove('hidden');
    } else {
      $('crew').classList.add('hidden');
      if (state.code && $('includeCrew').checked && state.ratingsCount !== undefined && !state.matched) $('crewNote').textContent = state.ratingsCount ? `Crew-reported ratings: ${state.ratingsCount} received, none matched these duties (date and flight number must agree).` : 'Crew-reported ratings: none received yet for this period.';
    }
    $('months').innerHTML = `<thead><tr><th>Month</th><th class="r">Flights</th><th class="r">KSS ≥ 7</th><th class="r">Share</th><th class="r">Night</th><th class="r">Mean KSS TOD</th></tr></thead><tbody>${months}</tbody>`;
    if (cmp) {
      $('pva').classList.remove('hidden');
      $('pvaTiles').innerHTML = [
        tile(cmp.matched.length, 'duties matched (flight duties, FDP only)'),
        tile(cmp.exceedanceShare === null ? '—' : Math.round(100 * cmp.exceedanceShare) + '%', 'flown over max FDP'),
        tile(cmp.exceeds33pct ? 'YES' : 'no', 'above one third in these files · ORO.FTL.110(j) counts a season'),
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
      const opts = { ruleSetId: $('rules').value, homeBase: $('base').value.trim().toUpperCase(), todLeadMin: Number($('tod').value), inFlightRest: $('rest').value, restFacilityClass: Number($('restClass').value), restSlot: $('restSlot').value, restQuality: Number($('restQuality').value), priorSleepHours: Number($('priorSleep').value), adaptRate: Number($('adapt').value) };
      const planned = CrewopsInsight.analyse(state.planned.duties, opts);
      let cmp = null;
      if (state.actual) cmp = CrewopsInsight.compare(planned, CrewopsInsight.analyse(state.actual.duties, opts));
      last = planned;
      state.matched = 0;
      render(planned, cmp);
      $('results').scrollIntoView({ behavior: 'smooth' });
      // Crew-reported ratings: what the operator's pilots gave after the
      // flight, from the Crewops app, read with the licence code and set
      // beside the prediction. Fetched after the first render so a slow or
      // offline server never holds the analysis.
      if (state.code && $('includeCrew').checked && !state.evaluation) {
        const dates = planned.duties.map((d) => d.date).sort();
        fetchRatings(dates[0], dates[dates.length - 1]).then((ratings) => {
          if (!ratings || last !== planned) return;
          state.matched = CrewopsInsight.attachCrewRatings(planned, ratings);
          state.ratingsCount = ratings.length;
          render(planned, cmp);
        });
      }
    } catch (e) {
      $('msg').textContent = `Analysis failed: ${e && e.message ? e.message : e}`;
    }
  });
  async function fetchRatings(from, to) {
    try {
      const res = await fetch(`${RATINGS_ENDPOINT}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { headers: { authorization: `Bearer ${state.code}` } });
      if (!res.ok) { $('crewNote').textContent = res.status === 401 ? 'Crew ratings: the code was not accepted by the ratings service (reading ratings needs the operator code that includes Insight).' : res.status === 403 ? 'Crew ratings: this code cannot read ratings; they need the operator code that includes Insight.' : `Crew ratings: service answered ${res.status}.`; return null; }
      const body = await res.json();
      return Array.isArray(body.ratings) ? body.ratings : [];
    } catch (e) {
      $('crewNote').textContent = 'Crew ratings: could not reach the ratings service.';
      return null;
    }
  }
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
