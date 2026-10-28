(() => {
  const toggle = document.getElementById('timeline-toggle');
  const content = document.getElementById('timeline-content');
  if (!toggle || !content) return;
  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') !== 'true';
    content.hidden = !expanded;
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.textContent = expanded ? '연표 접기 ▴' : '연표 펼치기 ▾';
  });
})();
