// JS leggero: toggle menù e reveal animazioni
(function(){
  const toggle = document.querySelector('.nav-toggle');
  const list = document.getElementById('nav-list');
  if (toggle && list) {
    toggle.addEventListener('click', () => {
      const open = list.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  // Intersection Observer per fade-in
  const els = document.querySelectorAll('.reveal');
  const anim = document.querySelectorAll('[data-animate-on-view]');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          if (e.target.hasAttribute('data-animate-on-view')) {
            e.target.classList.add('is-live');
          }
          io.unobserve(e.target);
        }
      }
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
    els.forEach(el => io.observe(el));
    anim.forEach(el => io.observe(el));
  } else {
    els.forEach(el => el.classList.add('is-visible'));
    anim.forEach(el => el.classList.add('is-live'));
  }

  // Fake submit per "Richiedi invito"
  const form = document.querySelector('.join-form');
  if (form) {
    form.addEventListener('submit', () => {
      const email = form.querySelector('input[type="email"]').value.trim();
      alert(email ? `Grazie! Ti contatteremo all'indirizzo: ${email}` : 'Grazie! Ti contatteremo presto.');
    });
  }
})();
