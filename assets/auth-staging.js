/* PR-002 — staging-only Firebase Authentication for the existing MyBizDigital nav.
 * Not a payment gate: protected commerce must validate tokens/verified email on a trusted server.
 * No Firestore, payment requests, cloud deployment or production access.
 */
(() => {
  'use strict';
  const policy = window.MBDAuthPolicy;
  if (!policy || !policy.stagingHost(location.hostname)) return;
  const config = window.__MBD_FIREBASE_STAGING_CONFIG;
  const configured = policy.configValid(config);
  const template = `
    <div class="mbd-auth-inner">
      <button type="button" class="mbd-auth-close" data-auth-action="close" aria-label="Close account dialog">×</button>
      <p class="mbd-auth-kicker">MYBIZDIGITAL · CUSTOMER ACCOUNT</p>
      <section class="mbd-auth-panel" data-auth-panel="login" aria-labelledby="mbd-auth-login-title">
        <h2 id="mbd-auth-login-title">Log in</h2>
        <p class="mbd-auth-text">Access your MyBizDigital customer account. This is a staging environment.</p>
        <form data-auth-form="login" novalidate>
          <label class="mbd-auth-label" for="mbd-auth-login-email">Email address</label>
          <input class="mbd-auth-input" id="mbd-auth-login-email" name="email" type="email" autocomplete="email" required maxlength="254">
          <label class="mbd-auth-label" for="mbd-auth-login-password">Password</label>
          <input class="mbd-auth-input" id="mbd-auth-login-password" name="password" type="password" autocomplete="current-password" required>
          <button class="mbd-auth-primary" type="submit">Log in</button>
        </form>
        <div class="mbd-auth-links"><button class="mbd-auth-link" type="button" data-auth-action="signup">Create an account</button><button class="mbd-auth-link" type="button" data-auth-action="reset">Forgot password?</button></div>
      </section>
      <section class="mbd-auth-panel" data-auth-panel="signup" aria-labelledby="mbd-auth-signup-title" hidden>
        <h2 id="mbd-auth-signup-title">Create an account</h2>
        <p class="mbd-auth-text">An email verification link is required before future purchases can be made.</p>
        <form data-auth-form="signup" novalidate>
          <label class="mbd-auth-label" for="mbd-auth-signup-email">Email address</label>
          <input class="mbd-auth-input" id="mbd-auth-signup-email" name="email" type="email" autocomplete="email" required maxlength="254">
          <label class="mbd-auth-label" for="mbd-auth-signup-password">Password (12–128 characters, include letters and numbers)</label>
          <input class="mbd-auth-input" id="mbd-auth-signup-password" name="password" type="password" autocomplete="new-password" required minlength="12" maxlength="128">
          <button class="mbd-auth-primary" type="submit">Create account</button>
        </form>
        <div class="mbd-auth-links"><button class="mbd-auth-link" type="button" data-auth-action="login">Already have an account? Log in</button></div>
      </section>
      <section class="mbd-auth-panel" data-auth-panel="reset" aria-labelledby="mbd-auth-reset-title" hidden>
        <h2 id="mbd-auth-reset-title">Reset password</h2>
        <p class="mbd-auth-text">Enter your email. If an account is eligible, password reset instructions will be sent.</p>
        <form data-auth-form="reset" novalidate>
          <label class="mbd-auth-label" for="mbd-auth-reset-email">Email address</label>
          <input class="mbd-auth-input" id="mbd-auth-reset-email" name="email" type="email" autocomplete="email" required maxlength="254">
          <button class="mbd-auth-primary" type="submit">Request reset link</button>
        </form>
        <div class="mbd-auth-links"><button class="mbd-auth-link" type="button" data-auth-action="login">Back to log in</button></div>
      </section>
      <section class="mbd-auth-panel" data-auth-panel="account" aria-labelledby="mbd-auth-account-title" hidden>
        <h2 id="mbd-auth-account-title">Your account</h2>
        <p class="mbd-auth-text">Signed in as <span class="mbd-auth-identity" data-auth-identity></span></p>
        <p class="mbd-auth-text" data-auth-verification></p>
        <div class="mbd-auth-links"><button class="mbd-auth-link" type="button" data-auth-action="refresh">I've verified my email</button><button class="mbd-auth-link" type="button" data-auth-action="resend">Resend verification email</button><button class="mbd-auth-link" type="button" data-auth-action="signout">Sign out</button></div>
        <p class="mbd-auth-text">Checkout is disabled on staging. Real purchase authorization must be enforced by a trusted backend, not this interface.</p>
      </section>
      <p class="mbd-auth-status" role="status" aria-live="polite" data-auth-status></p>
      <p class="mbd-auth-legal">Customer accounts are for the staging project only. Do not enter real customer information during testing. See the <a href="privacy-policy.html">Privacy Notice</a>.</p>
    </div>`;
  const dialog = document.createElement('dialog');
  dialog.className = 'mbd-auth-dialog';
  dialog.setAttribute('aria-label', 'MyBizDigital customer account');
  dialog.innerHTML = template; // Developer-controlled static markup only. Never interpolate user values.
  document.body.append(dialog);
  const status = dialog.querySelector('[data-auth-status]');
  const panels = [...dialog.querySelectorAll('[data-auth-panel]')];
  const actions = [...dialog.querySelectorAll('button:not([data-auth-action="close"])')];
  let mode = 'login', auth = null, sdk = null, user = null, busy = false, lastVerificationSent = NaN;
  function message(text, kind = 'info') {
    status.textContent = text; // No error/identity HTML injection.
    status.dataset.kind = kind;
  }
  function syncButtons() {
    const disabled = busy || !auth;
    for (const button of actions) {
      const action = button.dataset.authAction;
      button.disabled = disabled && !['login', 'signup', 'reset'].includes(action);
      if (button.type === 'submit') button.disabled = disabled;
    }
  }
  function render(next) {
    mode = next;
    for (const panel of panels) panel.hidden = panel.dataset.authPanel !== next;
    if (next === 'account') {
      dialog.querySelector('[data-auth-identity]').textContent = user && user.email ? user.email : 'your account';
      dialog.querySelector('[data-auth-verification]').textContent =
        user && policy.verifiedCustomer(user)
          ? 'Email verified. Future purchases will still require secure server-side authorization.'
          : 'Email not verified. You must verify your email before future purchases.';
      dialog.querySelector('[data-auth-action="refresh"]').hidden = !!user?.emailVerified;
      dialog.querySelector('[data-auth-action="resend"]').hidden = !!user?.emailVerified;
    }
    message(configured ? '' : 'Authentication is not configured for this staging preview. No account details can be submitted.', configured ? 'info' : 'error');
    syncButtons();
  }
  function open(next) {
    render(user ? 'account' : next);
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('.mbd-auth-panel:not([hidden]) input, .mbd-auth-panel:not([hidden]) button')?.focus();
  }
  function close() { if (dialog.open) dialog.close(); }
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href="#login"],a[href="#signup"]');
    if (!link) return;
    event.preventDefault();
    open(link.getAttribute('href') === '#signup' ? 'signup' : 'login');
  });
  dialog.addEventListener('click', async event => {
    const button = event.target.closest('[data-auth-action]');
    if (!button || busy) return;
    const action = button.dataset.authAction;
    if (action === 'close') return close();
    if (['login', 'signup', 'reset'].includes(action)) return render(action);
    if (!auth) return message('Staging authentication is not configured.', 'error');
    busy = true; syncButtons();
    try {
      if (action === 'signout') {
        await sdk.signOut(auth);
        user = null; render('login'); message('Signed out.');
      } else if (action === 'refresh' && auth.currentUser) {
        await auth.currentUser.reload();
        user = auth.currentUser;
        render('account');
        message(policy.verifiedCustomer(user) ? 'Email verification confirmed.' : 'Email not yet verified. Check your inbox and try again.');
      } else if (action === 'resend' && auth.currentUser) {
        await auth.currentUser.reload();
        user = auth.currentUser;
        if (policy.verifiedCustomer(user)) { render('account'); message('Email already verified.'); }
        else if (!policy.rateAllowed(lastVerificationSent, Date.now())) {
          message('A verification email was requested recently. Try again after one minute.', 'error');
        } else {
          await sdk.sendEmailVerification(user, { url: 'https://mybizdigital-staging.web.app/' });
          lastVerificationSent = Date.now();
          message('Verification email requested. Check your inbox and spam folder.');
        }
      }
    } catch (error) { message(policy.safeError(error && error.code), 'error'); }
    finally { busy = false; syncButtons(); }
  });
  dialog.addEventListener('submit', async event => {
    const form = event.target.closest('[data-auth-form]');
    if (!form) return;
    event.preventDefault();
    if (busy) return;
    if (!auth) return message('Staging authentication is not configured. No details were sent.', 'error');
    const email = policy.normalizeEmail(form.elements.email.value);
    if (!email) return message('Enter a valid email address.', 'error');
    const purpose = form.dataset.authForm;
    const password = purpose === 'reset' ? '' : form.elements.password.value;
    if (purpose === 'signup' && !policy.strongPassword(password)) {
      return message('Use a 12–128 character password containing letters and numbers.', 'error');
    }
    if (purpose === 'login' && !password) return message('Enter your password.', 'error');
    busy = true; syncButtons();
    try {
      if (purpose === 'signup') {
        const result = await sdk.createUserWithEmailAndPassword(auth, email, password);
        user = result.user;
        try {
          await sdk.sendEmailVerification(user, { url: 'https://mybizdigital-staging.web.app/' });
          lastVerificationSent = Date.now();
          render('account');
          message('Account created. Check your inbox to verify your email. Purchasing remains disabled.');
        } catch (verificationError) {
          render('account');
          message('Account created, but the verification email could not be sent. Use Resend verification email.', 'error');
        }
      } else if (purpose === 'login') {
        const result = await sdk.signInWithEmailAndPassword(auth, email, password);
        await result.user.reload();
        user = auth.currentUser || result.user;
        render('account');
        message(policy.verifiedCustomer(user) ? 'Signed in. Your email is verified.' : 'Signed in. Please verify your email before future purchases.');
      } else {
        await sdk.sendPasswordResetEmail(auth, email, { url: 'https://mybizdigital-staging.web.app/' });
        message('If your account is eligible, reset instructions will arrive by email.');
      }
    } catch (error) {
      message(purpose === 'reset' ? 'If your account is eligible, reset instructions will arrive by email.' : policy.safeError(error && error.code), purpose === 'reset' ? 'info' : 'error');
    } finally {
      if (form.elements.password) form.elements.password.value = '';
      busy = false; syncButtons();
    }
  });
  dialog.addEventListener('close', () => {
    dialog.querySelectorAll('input[type="password"]').forEach(input => { input.value = ''; });
  });
  render('login');
  if (location.hash === '#login' || location.hash === '#signup') open(location.hash.slice(1));
  if (!configured) return; // Fail closed: no Firebase requests when public web config is absent.
  (async () => {
    try {
      const [appModule, authModule] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js')
      ]);
      sdk = authModule;
      const app = appModule.initializeApp(config, 'mybizdigital-pr002-staging');
      auth = sdk.getAuth(app);
      await sdk.setPersistence(auth, sdk.browserSessionPersistence);
      sdk.onAuthStateChanged(auth, current => {
        user = current;
        if (dialog.open) render(current ? 'account' : 'login');
        syncButtons();
      }, () => { auth = null; message('Staging authentication is temporarily unavailable.', 'error'); syncButtons(); });
      syncButtons();
    } catch (_) {
      auth = null; message('Staging authentication could not be initialized.', 'error'); syncButtons();
    }
  })();
})();
