/* PR-002 — Node.js built-in tests, no emulator/cloud access or dependencies. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
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
test('password quality and email format enforce client-side minimums', () => {
  assert.equal(policy.normalizeEmail(' Customer@Example.COM '),'customer@example.com');
  assert.equal(policy.normalizeEmail('invalid'), '');
  assert.equal(policy.normalizeEmail('a'.repeat(255)+'@example.com'), '');
  assert.equal(policy.strongPassword('Ten1111111'),false);
  assert.equal(policy.strongPassword('abcdefghijkl'),false);
  assert.equal(policy.strongPassword('123456789012'),false);
  assert.equal(policy.strongPassword('Longer123456'),true);
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
  assert.ok(!/hitpay|createPayment|Firestore|\.env\b/i.test(ui));
  assert.ok(cfg.includes("apiKey: ''"));
  assert.ok(build.includes("'contact.html'"));
  assert.ok(build.includes("'assets', 'demos', 'apps'"));
  assert.equal(JSON.parse(header).hosting.target,'staging-site');
});
