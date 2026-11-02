/* PR-002 — Node.js built-in tests, no emulator/cloud access or dependencies. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const policy = require('../../assets/auth-policy.js');
const root = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
test('staging-only host boundary blocks production and lookalikes', () => {
  for (const h of ['localhost', '127.0.0.1','mybizdigital-staging.web.app',
    'mybizdigital-staging.firebaseapp.com','mybizdigital-staging--design001-pilot-qvibulki.web.app']) assert.equal(policy.stagingHost(h),true,h);
  for (const h of ['mybizdigital.my','www.mybizdigital.my','deploy-preview-3--mybizdigital-my.netlify.app',
    'evilmybizdigital-staging.web.app','mybizdigital-staging.web.app.evil.test']) assert.equal(policy.stagingHost(h),false,h);
});
test('invalid, missing and cross-project Firebase configs cannot activate authentication', () => {
  const good={projectId:'mybizdigital-staging',authDomain:'mybizdigital-staging.firebaseapp.com',
    apiKey:'AIza'+'A'.repeat(34),appId:'1:123456:web:123abc'};
  assert.equal(policy.configValid(good),true);
  for (const x of [null,{}, {...good,apiKey:''},{...good,appId:''},{...good,projectId:'mybizdigital-prod'},
    {...good,authDomain:'malicious.example'},{...good,apiKey:'FAKE'}]) assert.equal(policy.configValid(x),false);
});
test('password quality and email format mirror enforced staging requirements', () => {
  assert.equal(policy.normalizeEmail(' Customer@Example.COM '),'customer@example.com');
  assert.equal(policy.normalizeEmail('invalid'), '');
  assert.equal(policy.normalizeEmail('a'.repeat(255)+'@example.com'), '');
  assert.equal(policy.strongPassword('Ten1111111'),false);
  assert.equal(policy.strongPassword('abcdefghijkl'),false);
  assert.equal(policy.strongPassword('123456789012'),false);
  // Firebase staging requires uppercase, lowercase, digits and an allowed special character.
  assert.equal(policy.strongPassword('Longer123456'),false); // missing special
  assert.equal(policy.strongPassword('longer123456!'),false); // missing uppercase
  assert.equal(policy.strongPassword('LONGER123456!'),false); // missing lowercase
  assert.equal(policy.strongPassword('LongerPassword!'),false); // missing digit
  assert.equal(policy.strongPassword('Aa1!'),false); // fewer than 12 characters
  assert.equal(policy.strongPassword('Aa1!'+'a'.repeat(125)),false); // over 128 characters
  assert.equal(policy.strongPassword('Longer123456+'),false); // + is not a Firebase policy special
  assert.equal(policy.strongPassword('Longer123456 '),false); // whitespace is not special
  assert.equal(policy.strongPassword('Longer123456!'),true);
  assert.equal(policy.strongPassword('Longer123456_'),true);
  assert.equal(policy.strongPassword('Longer123456\\\\'),true);
});
test('verified customer is required; client-side policy cannot replace backend authorization', () => {
  assert.equal(policy.verifiedCustomer(null),false);
  assert.equal(policy.verifiedCustomer({uid:'u',emailVerified:false}),false);
  assert.equal(policy.verifiedCustomer({uid:'u',emailVerified:true,isAnonymous:true}),false);
  assert.equal(policy.verifiedCustomer({uid:'u',emailVerified:true,isAnonymous:false}),true);
  assert.equal(policy.verifiedCustomer({uid:'',emailVerified:true}),false);
});
test('reset and login error messages do not disclose whether an email is registered', () => {
  assert.equal(policy.safeError('auth/user-not-found'),policy.safeError('auth/wrong-password'));
  assert.equal(policy.safeError('auth/email-already-in-use'),policy.safeError('auth/invalid-credential'));
  assert.equal(policy.safeError('auth/too-many-requests').includes('Too many'),true);
  assert.equal(policy.rateAllowed(1000,60000),false);
  assert.equal(policy.rateAllowed(1000,61000),true);
});
test('frontend integration is staging-scoped and no live checkout is enabled', () => {
  const index=read('index.html'), ui=read('assets/auth-staging.js'), cfg=read('assets/auth-staging-config.js');
  const build=read('scripts/build-static.mjs'), header=read('firebase.json');
  assert.ok(index.includes('assets/auth-staging.js'));
  assert.ok(index.includes('assets/auth-policy.js'));
  assert.ok(index.includes('assets/auth-staging.css'));
  assert.ok(ui.includes('if (!policy || !policy.stagingHost(location.hostname)) return;'));
  assert.ok(ui.includes('if (!configured) return;'));
  assert.ok(ui.includes('browserSessionPersistence'));
  assert.ok(ui.includes('sendEmailVerification'));
  assert.ok(ui.includes('sendPasswordResetEmail'));
  // Check for executable commerce/database SDK calls, not explanatory comments.
  assert.ok(!/\b(?:getFirestore|initializeFirestore|getFunctions|createPayment|connectFunctionsEmulator)\s*\(/.test(ui));
  assert.ok(!/https?:\/\/[^'"\u0060\s]*hitpay/i.test(ui));
  assert.ok(ui.includes('uppercase, lowercase, a number and a special character'));
  assert.ok(ui.includes('Use 12–128 characters with uppercase and lowercase letters, a number and a special character.'));
  // Valid in two safe states: blank placeholders before activation, or valid staging-only web config.
  // Evaluate in an isolated VM context: no network or Firebase SDK; never print API key or app ID.
  const sandbox = { window: {} };
  vm.runInNewContext(cfg, sandbox, { timeout: 1000, filename: 'auth-staging-config.js' });
  const publicConfig = sandbox.window.__MBD_FIREBASE_STAGING_CONFIG;
  assert.ok(publicConfig && typeof publicConfig === 'object');
  assert.equal(publicConfig.projectId, 'mybizdigital-staging');
  assert.equal(publicConfig.authDomain, 'mybizdigital-staging.firebaseapp.com');
  const isUnconfigured = publicConfig.apiKey === '' && publicConfig.appId === '';
  assert.ok(isUnconfigured || policy.configValid(publicConfig),
    'Public Firebase config must be entirely blank or valid for the staging project');
  assert.ok(build.includes("'contact.html'"));
  assert.ok(build.includes("'assets', 'demos', 'apps'"));
  assert.equal(JSON.parse(header).hosting.target,'staging-site');
});

test('login and signup passwords have independently labelled and keyboard-operable visibility controls', () => {
  const ui = read('assets/auth-staging.js'), css = read('assets/auth-staging.css');
  for (const id of ['mbd-auth-login-password', 'mbd-auth-signup-password']) {
    assert.ok(ui.includes('id="' + id + '"'));
    assert.ok(ui.includes("passwordEyeButton('" + id + "')"));
  }
  assert.ok(ui.includes('aria-label="Show password"'));
  assert.ok(ui.includes('aria-pressed="false"'));
  assert.ok(ui.includes("field.type = reveal ? 'text' : 'password'"));
  assert.ok(ui.includes("reveal ? 'Hide password' : 'Show password'"));
  assert.ok(ui.includes('function concealPasswords()'));
  assert.match(ui, /dialog\.addEventListener\('close', \(\) => \{\r?\n\s*concealPasswords\(\);/);
  assert.ok(ui.includes(':not([data-auth-toggle-password])'));
  assert.ok(css.includes('.mbd-auth-password-field'));
  assert.ok(css.includes('padding-right:57px'));
  assert.ok(css.includes('.mbd-auth-password-toggle'));
  // A hidden password shows a crossed-out eye; the open eye means text is visible.
  assert.ok(css.includes('.mbd-auth-password-toggle[aria-pressed="true"] .mbd-auth-eye-slash{display:none}'));
  assert.ok(!css.includes('.mbd-auth-password-toggle[aria-pressed="false"] .mbd-auth-eye-slash{display:none}'));
  assert.ok(ui.includes('autocomplete="current-password"'));
  assert.ok(ui.includes('autocomplete="new-password"'));
});

test('registration includes optional name and matching-password protection before Firebase requests', () => {
  const ui = read('assets/auth-staging.js');
  for (const [field, name] of [
    ['mbd-auth-signup-name','displayName'],
    ['mbd-auth-signup-confirm','confirmPassword']]) {
    assert.ok(ui.includes('id="' + field + '"'));
    assert.ok(ui.includes('name="' + name + '"'));
  }
  assert.ok(ui.includes("passwordEyeButton('mbd-auth-signup-confirm')"));
  assert.ok(ui.includes('autocomplete="name" maxlength="80"'));
  assert.ok(ui.includes('autocomplete="new-password" required minlength="12" maxlength="128"'));
  assert.ok(ui.includes('password !== form.elements.confirmPassword.value'));
  assert.ok(ui.indexOf('password !== form.elements.confirmPassword.value') < ui.indexOf('sdk.createUserWithEmailAndPassword(auth, email, password)'));
  assert.ok(ui.includes("form.elements.confirmPassword.value = ''"));
  assert.ok(ui.includes('sdk.updateProfile(user, { displayName })'));
  assert.ok(ui.includes('dialog.querySelector(\'[data-auth-identity]\').textContent ='));
  assert.ok(!/\b(?:getFirestore|initializeFirestore|getFunctions|createPayment)\s*\(/.test(ui));
});

test('premium Firebase action page validates one-time links with secure password reset', () => {
  const html = read('auth/action.html'), js = read('assets/auth-action.js'), css = read('assets/auth-action.css');
  const build = read('scripts/build-static.mjs');
  for (const needle of ['checkActionCode(auth, actionCode)', 'applyActionCode(auth, actionCode)',
    'verifyPasswordResetCode(auth, actionCode)', 'confirmPasswordReset(auth, actionCode, password)',
    'history.replaceState(null', 'password !== confirm', 'policy.strongPassword(password)',
    'policy.stagingHost(location.hostname)', 'policy.configValid(config)']) assert.ok(js.includes(needle), needle);
  assert.ok(js.indexOf('history.replaceState(null') < js.indexOf("import('https://www.gstatic.com/firebasejs/"));
  assert.ok(js.indexOf('password !== confirm') < js.indexOf('sdk.confirmPasswordReset(auth, actionCode, password)'));
  assert.ok(html.includes('<meta name="referrer" content="no-referrer">'));
  assert.ok(html.includes('<meta name="robots" content="noindex,nofollow,noarchive">'));
  for (const id of ['mbd-action-reset-form','mbd-action-verify-button','mbd-action-confirm-password']) assert.ok(html.includes('id="' + id + '"'));
  assert.ok(html.includes('../assets/brand-logo.svg'));
  assert.ok(html.includes('../assets/auth-policy.js'));
  assert.ok(!js.includes('window.open('));
  assert.ok(!/localStorage|sessionStorage|console\.(?:log|warn|error)|fetch\(/.test(js));
  assert.ok(!/\b(?:getFirestore|createPayment|hitpay)\b/i.test(js));
  assert.ok(css.includes('@media(max-width:720px)'));
  assert.ok(build.includes("'assets', 'demos', 'apps', 'auth'"));
});
test('premium handler does not change sign-up, verification email or password-reset requests', () => {
  const existing = read('assets/auth-staging.js');
  assert.ok(existing.includes('sdk.createUserWithEmailAndPassword(auth, email, password)'));
  assert.ok(existing.includes('sdk.sendEmailVerification(user,'));
  assert.ok(existing.includes('sdk.sendPasswordResetEmail(auth, email,'));
  assert.ok(existing.includes("password !== form.elements.confirmPassword.value"));
  const html = read('auth/action.html');
  assert.ok(!html.includes('data-netlify'));
  assert.ok(!html.includes('<form action='));
  assert.ok(html.includes('<form id="mbd-action-reset-form" novalidate>'));
});

test('premium design previews are restricted to localhost and never make auth requests', () => {
  const ui = read('assets/auth-action.js');
  assert.ok(ui.includes("const preview = qs.get('preview');"));
  assert.ok(ui.includes("(location.hostname === 'localhost' || location.hostname === '127.0.0.1')"));
  assert.ok(ui.includes("!mode && !actionCode && !requestedApiKey"));
  assert.ok(ui.includes("preview === 'verifyEmail' || preview === 'resetPassword'"));
  assert.ok(ui.includes('DESIGN PREVIEW ONLY'));
  assert.ok(ui.indexOf('DESIGN PREVIEW ONLY') < ui.indexOf("import('https://www.gstatic.com/firebasejs/"));
});

test('premium account action pages use one focused centered card without the editorial hero', () => {
  const html = read('auth/action.html'), css = read('assets/auth-action.css'), js = read('assets/auth-action.js');
  assert.ok(html.includes('class="mbd-action-layout"'));
  assert.ok(html.includes('class="mbd-action-content"'));
  assert.ok(!html.includes('class="mbd-action-editorial"'));
  assert.ok(!html.includes('Secure access.'));
  assert.ok(!html.includes('Simply done.'));
  assert.ok(!html.includes('PRIVATE BY DESIGN. BUILT FOR BUSINESS.'));
  assert.ok(!css.includes('.mbd-action-editorial'));
  assert.ok(css.includes('width:min(570px,100%)'));
  assert.ok(css.includes('display:block;background:#fff'));
  assert.ok(html.includes('>Verify email <span'));
  assert.ok(html.includes('id="mbd-action-reset-form"'));
  assert.ok(js.includes("render('Verify your email'"));
  assert.ok(js.includes("render('Reset your password'"));
  assert.ok(html.includes('data-password-toggle="mbd-action-new-password"'));
  assert.ok(html.includes('data-password-toggle="mbd-action-confirm-password"'));
});
