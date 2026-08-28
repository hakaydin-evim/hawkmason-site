/* Hawk & Mason Studios — portal transitions + page enhancements */
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const veil = document.querySelector('[data-veil]');
  const page = document.body.dataset.page;

  /* ---- 1. Worlds strip (sugar page) — real 64 world art ---- */
  const strip = document.querySelector('[data-worlds]');
  if (strip) {
    const worlds = [
      [1, 'world-01-sweet-shop-background.png', 'Sweet Shop'],
      [2, 'world-02-jelly-garden-background.png', 'Jelly Garden'],
      [3, 'world-03-chocolate-lane-background.png', 'Chocolate Lane'],
      [4, 'world-04-frosty-pops-background.png', 'Frosty Pops'],
      [5, 'world-05-macaron-market-background.png', 'Macaron Market'],
      [6, 'world-06-sugar-factory-background.png', 'Sugar Factory'],
      [7, 'world-07-caramel-carnival-background.png', 'Caramel Carnival'],
      [8, 'world-08-crystal-candy-castle-background.png', 'Crystal Candy Castle'],
      [9, 'world-09-honeycomb-harbor-background.png', 'Honeycomb Harbor'],
      [10, 'world-10-marshmallow-meadow-background.png', 'Marshmallow Meadow'],
      [11, 'world-11-licorice-library-background.png', 'Licorice Library'],
      [12, 'world-12-bubblegum-boardwalk-background.png', 'Bubblegum Boardwalk'],
      [13, 'world-13-toffee-tunnels-background.png', 'Toffee Tunnels'],
      [14, 'world-14-soda-pop-springs-background.png', 'Soda Pop Springs'],
      [15, 'world-15-peppermint-pier-background.png', 'Peppermint Pier'],
      [16, 'world-16-nougat-night-market-background.png', 'Nougat Night Market'],
      [17, 'world-17-lemonade-lagoon-background.png', 'Lemonade Lagoon'],
      [18, 'world-18-berry-biscuit-bay-background.png', 'Berry Biscuit Bay'],
      [19, 'world-19-waffle-workshop-background.png', 'Waffle Workshop'],
      [20, 'world-20-cotton-candy-clouds-background.png', 'Cotton Candy Clouds'],
      [21, 'world-21-taffy-trainyard-background.png', 'Taffy Trainyard'],
      [22, 'world-22-vanilla-velvet-valley-background.png', 'Vanilla Velvet Valley'],
      [23, 'world-23-gumdrop-greenhouse-background.png', 'Gumdrop Greenhouse'],
      [24, 'world-24-cocoa-clocktower-background.png', 'Cocoa Clocktower'],
      [25, 'world-25-sprinkle-skyline-background.png', 'Sprinkle Skyline'],
      [26, 'world-26-pudding-plaza-background.png', 'Pudding Plaza'],
      [27, 'world-27-bonbon-bazaar-background.png', 'Bonbon Bazaar'],
      [28, 'world-28-sherbet-summit-background.png', 'Sherbet Summit'],
      [29, 'world-29-caramel-quarry-background.png', 'Caramel Quarry'],
      [30, 'world-30-jellybean-jungle-background.png', 'Jellybean Jungle'],
      [31, 'world-31-biscuit-bakery-background.png', 'Biscuit Bakery'],
      [32, 'world-32-sugarplum-observatory-background.png', 'Sugarplum Observatory'],
      [33, 'world-33-fudge-foundry-background.png', 'Fudge Foundry'],
      [34, 'world-34-ribbon-candy-road-background.png', 'Ribbon Candy Road'],
      [35, 'world-35-sorbet-safari-background.png', 'Sorbet Safari'],
      [36, 'world-36-molasses-mill-background.png', 'Molasses Mill'],
      [37, 'world-37-praline-palace-background.png', 'Praline Palace'],
      [38, 'world-38-lemon-zest-lab-background.png', 'Lemon Zest Lab'],
      [39, 'world-39-churro-canyon-background.png', 'Churro Canyon'],
      [40, 'world-40-cherry-cream-circus-background.png', 'Cherry Cream Circus'],
      [41, 'world-41-mint-moon-docks-background.png', 'Mint Moon Docks'],
      [42, 'world-42-cocoa-comet-crossing-background.png', 'Cocoa Comet Crossing'],
      [43, 'world-43-pancake-parade-background.png', 'Pancake Parade'],
      [44, 'world-44-candy-corn-cove-background.png', 'Candy Corn Cove'],
      [45, 'world-45-truffle-terrace-background.png', 'Truffle Terrace'],
      [46, 'world-46-raspberry-reef-background.png', 'Raspberry Reef'],
      [47, 'world-47-gingerbread-gables-background.png', 'Gingerbread Gables'],
      [48, 'world-48-stardust-sugarworks-background.png', 'Stardust Sugarworks'],
      [49, 'world-49-almond-arcade-background.png', 'Almond Arcade'],
      [50, 'world-50-jelly-rocket-range-background.png', 'Jelly Rocket Range'],
      [51, 'world-51-maple-meringue-mesa-background.png', 'Maple Meringue Mesa'],
      [52, 'world-52-peach-pop-pavilion-background.png', 'Peach Pop Pavilion'],
      [53, 'world-53-cookie-compass-coast-background.png', 'Cookie Compass Coast'],
      [54, 'world-54-frosted-fireworks-fair-background.png', 'Frosted Fireworks Fair'],
      [55, 'world-55-blueberry-bungalow-background.png', 'Blueberry Bungalow'],
      [56, 'world-56-sundae-switchyard-background.png', 'Sundae Switchyard'],
      [57, 'world-57-pistachio-planetarium-background.png', 'Pistachio Planetarium'],
      [58, 'world-58-velvet-vanilla-vault-background.png', 'Velvet Vanilla Vault'],
      [59, 'world-59-lollipop-lighthouse-background.png', 'Lollipop Lighthouse'],
      [60, 'world-60-rainbow-rock-candy-ridge-background.png', 'Rainbow Rock Candy Ridge'],
      [61, 'world-61-mocha-meteor-mine-background.png', 'Mocha Meteor Mine'],
      [62, 'world-62-crystal-creme-citadel-background.png', 'Crystal Creme Citadel'],
      [63, 'world-63-sugar-star-station-background.png', 'Sugar Star Station'],
      [64, 'world-64-candy-cosmos-castle-background.png', 'Candy Cosmos Castle'],
    ];
    // Real 8 story chapters (8 worlds each) from world-theme-bible.md
    const chapters = ['Launch Journey', 'Coastal Candy Trail', 'Sky & Bakery Run', 'City Sweets',
      'Crafted Candy Route', 'Cosmic Candy Route', 'Arcade & Fair Route', 'Final Candy Cosmos'];
    worlds.forEach(([n, file, name], i) => {
      const fig = document.createElement('figure');
      fig.className = 'world-tile';
      fig.style.setProperty('--i', i);
      const chapter = chapters[Math.floor((n - 1) / 8)] || '';
      fig.innerHTML =
        `<img loading="lazy" src="assets/world-art/${file.replace('.png', '.webp')}" alt="${name}" />` +
        `<figcaption><span class="world-n">World ${n} · ${chapter}</span>${name}</figcaption>`;
      strip.appendChild(fig);
    });
  }

  /* ---- 2. Reveal on arrival (veil retracts in the product colour) ---- */
  if ((page === 'sugar' || page === 'eliteloop' || page === 'ittako' || page === 'aeropulse') && veil) {
    if (sessionStorage.getItem('hm-enter') === page && !reduce) {
      veil.classList.add('is-shown');
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          veil.classList.add('is-retracting');
          veil.addEventListener('transitionend', () => veil.classList.remove('is-shown', 'is-retracting'), { once: true });
        })
      );
    }
    sessionStorage.removeItem('hm-enter');
  }

  /* ---- 3. Portals: card colour expands to fill, then navigate ---- */
  document.querySelectorAll('[data-portal]').forEach((portal) => {
    portal.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || reduce || !veil) return;
      e.preventDefault();
      const r = portal.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const far = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy));
      veil.style.background = portal.dataset.veil || '#fdeece';
      veil.style.setProperty('--cx', cx + 'px');
      veil.style.setProperty('--cy', cy + 'px');
      veil.style.setProperty('--r', far + 'px');
      veil.classList.add('is-expanding');
      sessionStorage.setItem('hm-enter', portal.dataset.enter || 'sugar');
      const go = () => (location.href = portal.getAttribute('href'));
      veil.addEventListener('transitionend', go, { once: true });
      setTimeout(go, 650);
    });
  });

  /* ---- 4. Back links: veil closes, then navigate ---- */
  document.querySelectorAll('[data-back]').forEach((back) => {
    back.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || reduce || !veil) return;
      e.preventDefault();
      veil.style.background = back.dataset.veil || getComputedStyle(veil).backgroundColor;
      veil.classList.add('is-covering');
      const go = () => (location.href = back.getAttribute('href'));
      veil.addEventListener('transitionend', go, { once: true });
      setTimeout(go, 500);
    });
  });

  /* ---- 5. Mobile nav toggle ---- */
  const burger = document.querySelector('[data-burger]');
  const nav = document.querySelector('[data-nav]');
  if (burger && nav) {
    burger.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
    });
    nav.querySelectorAll('.nav-links a').forEach((a) =>
      a.addEventListener('click', () => {
        nav.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
      })
    );
  }

  /* ---- 6. Shrink nav on scroll ---- */
  if (nav) {
    const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }
})();
