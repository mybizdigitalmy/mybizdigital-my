/* Brevo DOI via protected same-origin server function. No popup or exposed API key. */
(() => {
  const forms = document.querySelectorAll('[data-mbd-newsletter-form]');
  if (!forms.length) return;
  const endpoint = '/.netlify/functions/newsletter-subscribe';
  const confirmed = new URLSearchParams(location.search).get('newsletter') === 'confirmed';
  let configPromise;
  let turnstileScriptPromise;

  const show = (form, message, success) => {
    const status = form.parentElement.querySelector('[data-mbd-newsletter-status]');
    if (!status) return;
    status.textContent = message;
    status.className = 'mbd-f-inline-status ' + (success ? 'is-success' : 'is-error');
    status.hidden = false;
  };

  const getConfig = () => {
    if (!configPromise) {
      configPromise = fetch(endpoint, {headers:{Accept:'application/json'},cache:'no-store'})
        .then(async r => {
          if (!r.ok) throw new Error('Service unavailable');
          return r.json();
        }).catch(err => { configPromise = null; throw err; });
    }
    return configPromise;
  };

  const loadTurnstile = () => {
    if (window.turnstile) return Promise.resolve();
    if (!turnstileScriptPromise) {
      turnstileScriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error('Security verification unavailable'));
        document.head.append(script);
      }).catch(err => { turnstileScriptPromise = null; throw err; });
    }
    return turnstileScriptPromise;
  };

  async function getChallenge(form, siteKey) {
    await loadTurnstile();
    const host = form.querySelector('[data-mbd-turnstile]');
    if (!window.turnstile || !host) throw new Error('Security verification unavailable');
    return new Promise((resolve, reject) => {
      let finished = false;
      let widgetId;
      const finish = (token, error) => {
        if (finished) return;
        finished = true;
        if (widgetId !== undefined) {
          try { window.turnstile.remove(widgetId); } catch (_) {}
        }
        if (error) reject(new Error('Security verification failed'));
        else resolve(token);
      };
      try {
        widgetId = window.turnstile.render(host, {
          sitekey: siteKey,
          execution:'execute',
          appearance:'interaction-only',
          action:'mbd_newsletter',
          callback: token => finish(token, false),
          'error-callback': () => finish(null, true),
          'expired-callback': () => finish(null, true)
        });
        window.turnstile.execute(widgetId);
      } catch (_) { finish(null, true); }
    });
  }

  forms.forEach(form => {
    if (confirmed) {
      show(form, "You're in. We'll email you when the next drop lands.", true);
      return;
    }
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const emailInput = form.querySelector('input[name="email"]');
      const button = form.querySelector('button[type="submit"]');
      if (!emailInput || !button) return;
      if (!emailInput.checkValidity()) {
        emailInput.reportValidity();
        return;
      }
      button.disabled = true;
      button.textContent = 'Sending…';
      try {
        const config = await getConfig();
        if (!config.ready || !config.siteKey) throw new Error('Newsletter setup is being finalized.');
        const challengeToken = await getChallenge(form, config.siteKey);
        const res = await fetch(endpoint, {
          method:'POST',
          headers:{'Content-Type':'application/json',Accept:'application/json'},
          body:JSON.stringify({
            email:emailInput.value.trim(),
            website:form.elements.website?.value || '',
            challengeToken,
            consent:true
          })
        });
        if (!res.ok) throw new Error(res.status===429 ? 'Please try again later.' : 'Subscription could not be sent. Please try again.');
        show(form, 'Almost there! Check your email to confirm your subscription.', true);
        emailInput.value = '';
      } catch (err) {
        show(form, err.message || 'Unable to subscribe right now. Please try again.', false);
      } finally {
        button.disabled = false;
        button.textContent = 'Notify me';
      }
    });
  });
})();
