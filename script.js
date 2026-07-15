const header = document.querySelector("[data-site-header]");
const revealItems = document.querySelectorAll(".reveal");
const showcaseImage = document.querySelector("[data-showcase-image]");
const modeButtons = document.querySelectorAll("[data-mode]");

document.body.classList.add("reveal-ready");

const showcaseSources = {
  classic: {
    src: "assets/sugar-classic.png",
    alt: "Sugar Tiles classic gameplay preview"
  },
  journey: {
    src: "assets/sugar-journey.png",
    alt: "Sugar Tiles journey map preview"
  },
  daily: {
    src: "assets/sugar-daily.png",
    alt: "Sugar Tiles daily puzzle preview"
  }
};

const updateHeader = () => {
  if (!header) return;
  header.classList.toggle("is-scrolled", window.scrollY > 12);
};

window.addEventListener("scroll", updateHeader, { passive: true });
updateHeader();

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const mode = button.dataset.mode;
    const next = showcaseSources[mode];
    if (!next || !showcaseImage) return;

    modeButtons.forEach((item) => item.classList.toggle("is-active", item === button));
    showcaseImage.src = next.src;
    showcaseImage.alt = next.alt;
  });
});
