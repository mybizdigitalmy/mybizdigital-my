/* PR-001 staging-only safety: protect visitors from nonfunctional Netlify contact forms. */
(() => {
  'use strict';
  const selector = 'form[name="mybiz-enquiry"], form#mbd-contact-form-modal';
  const notice = 'STAGING PREVIEW — Enquiry submissions are disabled here. Do not enter personal information. For genuine enquiries, visit mybizdigital.my.';
  function disable(form) {
    if (form.dataset.mbdStagingDisabled === 'true') return;
    form.dataset.mbdStagingDisabled = 'true';
    form.setAttribute('aria-disabled', 'true');
    if (!form.querySelector('.mbd-staging-contact-notice')) {
      const message = document.createElement('p');
      message.className = 'mbd-staging-contact-notice';
      message.setAttribute('role', 'status');
      message.textContent = notice;
      message.style.cssText = 'padding:12px 16px;border:1px solid currentColor;border-radius:8px;font-size:14px;line-height:1.5;';
      form.prepend(message);
    }
    form.querySelectorAll('button[type="submit"],input[type="submit"]').forEach(button => {
      button.disabled = true;
      button.setAttribute('aria-disabled', 'true');
    });
  }
  function scan(node) {
    if (node.nodeType !== 1) return;
    if (node.matches?.(selector)) disable(node);
    node.querySelectorAll?.(selector).forEach(disable);
  }
  document.addEventListener('submit', event => {
    if (event.target?.matches?.(selector)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      disable(event.target);
    }
  }, true);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scan(document.documentElement), { once: true });
  } else {
    scan(document.documentElement);
  }
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) scan(node);
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
