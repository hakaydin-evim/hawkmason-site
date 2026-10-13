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
