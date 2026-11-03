// Marks the current section in the navigation, and shows the still image if the island cannot load.
const nav = document.querySelector('.nav-links');
const links = [...nav.querySelectorAll('a')];
const sections = links.map((a) => document.querySelector(a.getAttribute('href')));

const inBand = new Set();
const spy = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) inBand.add(e.target);
    else inBand.delete(e.target);
  }
  const current = sections.find((s) => inBand.has(s));
  links.forEach((a, j) => {
    if (sections[j] === current) {
      a.setAttribute('aria-current', 'true');
      nav.scrollLeft = a.offsetLeft - nav.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2;
    } else {
      a.removeAttribute('aria-current');
    }
  });
}, { rootMargin: '-30% 0px -65% 0px' });
sections.forEach((s) => s && spy.observe(s));

// A background tab does not draw, so only count the wait while the page is visible.
const world = document.getElementById('world');
const armFallback = () => setTimeout(() => {
  if (!world || world.dataset.ready) return;
  if (document.hidden) document.addEventListener('visibilitychange', armFallback, { once: true });
  else document.documentElement.classList.add('world-fallback');
}, 6000);
armFallback();
