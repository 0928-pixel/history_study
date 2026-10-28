(() => {
  const open = document.getElementById('timeline-open');
  const dialog = document.getElementById('timeline-dialog');
  const close = document.getElementById('timeline-close');
  if (!open || !dialog || !close) return;
  open.addEventListener('click', () => { if (!dialog.open) dialog.showModal(); });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const box = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
  });
  dialog.querySelectorAll('[data-history-era]').forEach(button => {
    // Existing navigation selects the era first; then release focus from the modal.
    button.addEventListener('click', () => {
      dialog.close();
      document.querySelector('.tab-content.active .era-card[data-era="' + button.dataset.historyEra + '"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
})();
