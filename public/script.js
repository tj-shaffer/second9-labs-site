// Second 9 Labs — tiny JS for reveal animations and nav polish

// Intersection-based reveal
const revealEls = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('on');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
  revealEls.forEach((el) => io.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add('on'));
}

// Calendar placeholder — replace with your real booking link (Cal.com, Calendly, etc.)
const calLink = document.querySelector('[data-calendar]');
if (calLink) {
  calLink.addEventListener('click', (e) => {
    e.preventDefault();
    alert("Swap this placeholder in script.js for your Cal.com or Calendly link when you're ready.");
  });
}

// Smooth-scroll nav offset compensation for sticky header
document.querySelectorAll('nav.site a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - 60;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});
