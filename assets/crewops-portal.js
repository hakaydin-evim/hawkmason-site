// Crewops Aviation Platform · operator portal: the product bar at the top.
// One operator code per airline; the products it holds open, the others say
// so. Each product's own script (insight, safety, academy, library) opens its
// section on the same `crewops-code` event; this only labels the bar.
(() => {
  const NAMES = { insight: 'Crewops Insight', safety: 'Crewops Safety', academy: 'Crewops Academy', library: 'Crewops Library' };
  const bar = document.getElementById('modbar');
  if (!bar) return;
  const set = (mod, cls, text) => {
    const a = bar.querySelector(`[data-mod="${mod}"]`);
    a.classList.remove('on', 'off');
    if (cls) a.classList.add(cls);
    a.querySelector('[data-state]').textContent = text;
  };
  window.addEventListener('crewops-code', (ev) => {
    const lic = ev.detail.licence || {};
    // A code without a product list is an Insight-only code (issued before products were sold separately).
    const held = lic.products || ['insight'];
    for (const mod of Object.keys(NAMES)) {
      const ops = mod === 'insight' || lic.ops;
      if (held.includes(mod) && ops) set(mod, 'on', 'Open');
      else if (held.includes(mod)) set(mod, 'off', 'Needs the operator code');
      else set(mod, 'off', 'Not in your licence · ask us');
    }
  });
  bar.addEventListener('click', (ev) => {
    const a = ev.target.closest('.mod');
    if (!a) return;
    const mod = a.dataset.mod;
    const section = document.getElementById(mod);
    if (a.classList.contains('off')) {
      ev.preventDefault();
      window.location.href = `mailto:hello@hawkmason.com?subject=${encodeURIComponent(`${NAMES[mod]} for our airline`)}`;
      return;
    }
    if (!section || section.classList.contains('hidden')) {
      ev.preventDefault();
      if (mod === 'insight') section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else { const c = document.getElementById('code'); c.focus(); c.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    }
  });
})();

// Portal activity (2026-10-14): counts, per airline, that the portal was opened, which
// product sections were looked at, and how many Insight analyses and exports were run, so
// we can support a team on trial. Counts only: no roster, file or crew data leaves the page.
(() => {
  const ENDPOINT = (window.CREWOPS_PORTAL_ENDPOINT || 'https://updates.hawkmason.com/portal');
  let code = null;
  const seen = new Set();
  const send = (event, product) => {
    if (!code) return;
    fetch(`${ENDPOINT}/activity`, { method: 'POST', headers: { authorization: `Bearer ${code}`, 'content-type': 'application/json' }, body: JSON.stringify(product ? { event, product } : { event }), keepalive: true }).catch(() => undefined);
  };
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    for (const e of entries) {
      const id = e.target.id;
      // A section counts as viewed once a real part of it is on screen (sections are taller than the window).
      if (!e.isIntersecting || e.intersectionRect.height < Math.min(200, window.innerHeight * 0.4) || e.target.classList.contains('hidden') || seen.has(id)) continue;
      seen.add(id);
      send('view', id);
    }
  }, { threshold: Array.from({ length: 101 }, (_, i) => i / 100) }) : null;
  window.addEventListener('crewops-code', (ev) => {
    const first = !code;
    code = ev.detail.code;
    if (first) send('open');
    if (observer) ['today', 'insight', 'safety', 'academy', 'library', 'connect'].forEach((id) => { const el = document.getElementById(id); if (el) observer.observe(el); });
  });
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.id === 'run') send('analyse');
    else if (['csv', 'print', 'safetyCsv', 'safetyE5x', 'acCsv', 'sdE5x'].includes(b.id)) send('export');
  }, true);
})();

