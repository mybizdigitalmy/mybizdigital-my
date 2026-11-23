(() => {
  const dialog = document.getElementById('mbd-newsletter-dialog');
  const frame = dialog?.querySelector('.mbd-newsletter-frame');
  const close = dialog?.querySelector('.mbd-newsletter-dialog-close');
  if (!dialog || !frame || !close) return;
  const openForm = () => {
    if (typeof dialog.showModal !== 'function') {
      window.open(frame.dataset.src, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!frame.hasAttribute('src')) frame.setAttribute('src', frame.dataset.src);
    if (!dialog.open) dialog.showModal();
  };
  document.querySelectorAll('[data-mbd-newsletter-open]').forEach(button => button.addEventListener('click', openForm));
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
})();
