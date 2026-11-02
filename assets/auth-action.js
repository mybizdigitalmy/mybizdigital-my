/* PR-002: staging-only MyBizDigital email-action handler.
 * User-supplied action codes are treated as secrets: no logs, persistence, analytics,
 * dynamic HTML, or arbitrary redirects. Live Firebase API calls require a valid
 * existing MyBizDigital staging Web App configuration and a valid action code.
 */
(() => {
  'use strict';
  const qs = new URLSearchParams(location.search);
  const mode = qs.get('mode');
  const actionCode = qs.get('oobCode');
  const requestedApiKey = qs.get('apiKey');
  // Remove one-time tokens from browser history before loading any external resources.
  if (location.search) {
    try { history.replaceState(null, '', location.pathname); } catch (_) { /* private mode */ }
  }

  const policy = window.MBDAuthPolicy;
  const config = window.__MBD_FIREBASE_STAGING_CONFIG;
  const heading = document.getElementById('mbd-action-heading');
  const detail = document.getElementById('mbd-action-description');
  const eyebrow = document.getElementById('mbd-action-eyebrow');
  const status = document.getElementById('mbd-action-status');
  const verifyArea = document.getElementById('mbd-action-verify');
  const verifyButton = document.getElementById('mbd-action-verify-button');
  const resetArea = document.getElementById('mbd-action-reset');
  const resetForm = document.getElementById('mbd-action-reset-form');
  const resetButton = document.getElementById('mbd-action-reset-button');
  const loginLink = document.getElementById('mbd-action-login-link');
  const accountLabel = document.getElementById('mbd-action-account');
  let busy = false, sdk = null, auth = null, valid = false;

  // A fixed, local SVG, never derived from a code, query string or user value.
  const eyeIcon = `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2.5 12s3.6-6 9.5-6 9.5 6 9.5 6-3.6 6-9.5 6-9.5-6-9.5-6Z"/>
    <circle cx="12" cy="12" r="2.8"/>
    <path class="mbd-action-eye-slash" d="M3 3 21 21"/>
  </svg>`;
  for (const button of document.querySelectorAll('[data-password-toggle]')) {
    button.innerHTML = eyeIcon;
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.passwordToggle);
      if (!input) return;
      const reveal = input.type === 'password';
      input.type = reveal ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(reveal));
      button.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
      input.focus({ preventScroll: true });
    });
  }

  function render(title, description, label) {
    heading.textContent = title;
    detail.textContent = description;
    eyebrow.textContent = label;
  }
  function note(value, kind = 'info') {
    status.hidden = false;
    status.textContent = value;
    status.dataset.kind = kind;
  }
  function fail(message) {
    busy = false;
    valid = false;
    verifyArea.hidden = true;
    resetArea.hidden = true;
    loginLink.hidden = false;
    render('This link cannot be used', message, 'LINK UNAVAILABLE');
    note('Request a fresh email through your MyBizDigital account.', 'error');
  }
  function busyButton(button, value) {
    button.disabled = value;
    button.setAttribute('aria-busy', String(value));
  }
  function revealSuccess(title, description) {
    verifyArea.hidden = true;
    resetArea.hidden = true;
    loginLink.hidden = false;
    status.hidden = true;
    render(title, description, 'REQUEST COMPLETED');
  }
  function clearPasswords() {
    for (const input of resetForm.querySelectorAll('input')) {
      input.value = '';
      input.type = 'password';
    }
    for (const button of resetForm.querySelectorAll('[data-password-toggle]')) {
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', 'Show password');
    }
  }
  const safeRequest = (mode === 'verifyEmail' || mode === 'resetPassword') &&
    typeof actionCode === 'string' && actionCode.length > 5 && actionCode.length <= 4096 &&
    /^[A-Za-z0-9_-]+$/.test(actionCode);
  if (!policy || !policy.stagingHost(location.hostname) || !policy.configValid(config)) {
    fail('The staging account service is not available on this page.');
    return;
  }
  if (!safeRequest || (requestedApiKey && requestedApiKey !== config.apiKey)) {
    fail('The email link is missing, invalid, expired or belongs to another project.');
    return;
  }

  if (mode === 'verifyEmail') {
    render('Verify your email address', 'We are validating your one-time email confirmation link.', 'EMAIL VERIFICATION');
  } else {
    render('Set a new password', 'We are validating your one-time password reset link.', 'PASSWORD RECOVERY');
  }

  (async () => {
    try {
      const [appModule, authModule] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js')
      ]);
      sdk = authModule;
      const app = appModule.initializeApp(config, 'mybizdigital-pr002-actions');
      auth = sdk.getAuth(app);
      if (mode === 'verifyEmail') {
        const info = await sdk.checkActionCode(auth, actionCode);
        if (info.operation !== sdk.ActionCodeOperation.VERIFY_EMAIL) {
          fail('This email link is not a verification request.');
          return;
        }
        valid = true;
        render('One step from verified', 'Your email confirmation link is valid. Select the button below to complete verification.', 'VERIFY YOUR ACCOUNT');
        verifyArea.hidden = false;
        verifyButton.disabled = false;
      } else {
        const email = await sdk.verifyPasswordResetCode(auth, actionCode);
        accountLabel.textContent = 'Resetting the password for ' + email;
        valid = true;
        render('Create a new password', 'Choose a strong password for your MyBizDigital account.', 'PASSWORD RECOVERY');
        resetArea.hidden = false;
        resetButton.disabled = false;
      }
    } catch (_) {
      fail('The one-time link may have expired or already been used.');
    }
  })();

  verifyButton.addEventListener('click', async () => {
    if (!valid || busy || !auth || !sdk) return;
    busy = true;
    busyButton(verifyButton, true);
    try {
      await sdk.applyActionCode(auth, actionCode);
      valid = false;
      revealSuccess('Email successfully verified', 'Your email is confirmed. You can now return to your MyBizDigital account.');
    } catch (_) {
      fail('The verification link could not be completed. It may have expired or already been used.');
    } finally {
      busy = false;
      busyButton(verifyButton, false);
    }
  });

  resetForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!valid || busy || !auth || !sdk) return;
    const password = resetForm.elements.newPassword.value;
    const confirm = resetForm.elements.confirmPassword.value;
    if (!policy.strongPassword(password)) {
      note('Use 12–128 characters with uppercase, lowercase, a number and a supported special character.', 'error');
      return;
    }
    if (password !== confirm) {
      note('The passwords do not match. Please re-enter them.', 'error');
      return;
    }
    busy = true;
    busyButton(resetButton, true);
    status.hidden = true;
    try {
      await sdk.confirmPasswordReset(auth, actionCode, password);
      clearPasswords();
      valid = false;
      revealSuccess('Your password has been updated', 'Your new password is ready. Return to MyBizDigital and sign in securely.');
    } catch (error) {
      if (error && (error.code === 'auth/weak-password' || error.code === 'auth/password-does-not-meet-requirements')) {
        note('This password does not meet Firebase security requirements. Choose a stronger password.', 'error');
      } else {
        fail('The password reset link could not be completed. It may have expired or already been used.');
      }
    } finally {
      busy = false;
      busyButton(resetButton, false);
    }
  });
})();
