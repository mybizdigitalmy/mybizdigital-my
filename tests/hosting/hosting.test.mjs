/** Node.js 20+ built-in test runner. No Firebase access or external packages. */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const dist = path.join(root, 'dist');
const rootPages = [
  'index.html', 'about.html', 'business-apps.html', 'contact.html',
  'order-support.html', 'privacy-policy.html', 'product-support.html',
  'terms-and-conditions.html', 'web-development.html'
];
const publicDirectories = ['assets', 'demos', 'apps'];

async function listFiles(directory, prefix = '') {
  const out = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) out.push(...await listFiles(path.join(directory, entry.name), relative));
    else out.push(relative);
  }
  return out.sort();
}

before(() => {
  execFileSync(process.execPath, ['scripts/build-static.mjs'], { cwd: root, stdio: 'pipe' });
});

test('staging config binds only the verified staging Hosting site, never production', async () => {
  const config = JSON.parse(await readFile(path.join(root, 'firebase.json'), 'utf8'));
  const rc = JSON.parse(await readFile(path.join(root, '.firebaserc'), 'utf8'));
  assert.equal(config.hosting.target, 'staging-site');
  assert.equal(config.hosting.public, 'dist');
  assert.equal(config.hosting.rewrites, undefined);
  assert.equal(config.hosting.redirects, undefined);
  assert.deepEqual(rc.projects, { staging: 'mybizdigital-staging' });
  assert.deepEqual(rc.targets, {
    'mybizdigital-staging': {
      hosting: { 'staging-site': ['mybizdigital-staging'] }
    }
  });
  assert.deepEqual(Object.keys(rc.targets), ['mybizdigital-staging']);
  assert.ok(config.hosting.headers.some(rule =>
    rule.headers.some(header => header.key === 'X-Robots-Tag' && header.value.includes('noindex'))));
});

test('180 public files and all 40 HTML pages are copied byte-for-byte', async () => {
  const expected = rootPages.slice();
  for (const dir of publicDirectories) expected.push(...await listFiles(path.join(root, dir), dir));
  expected.sort();
  const actual = await listFiles(dist);
  assert.deepEqual(actual, expected);
  assert.equal(actual.filter(file => file.endsWith('.html')).length, 40);
  assert.equal(actual.length, 184, 'PR-002: pinned 180-file baseline plus four authentication assets');
  for (const file of actual) {
    const original = await readFile(path.join(root, file));
    const built = await readFile(path.join(dist, file));
    if (file === 'assets/contact.js') {
      const guard = await readFile(path.join(root, 'scripts/staging-contact-guard.js'));
      assert.deepEqual(built, Buffer.concat([original, Buffer.from('\n'), guard]), file);
    } else if (file === 'contact.html') {
      const expected = original.toString('utf8')
        .replace(/(<form\b[^>]*\bid="mbd-contact-form"[^>]*>)/i, '$1\n<p class="mbd-staging-contact-notice" role="status">STAGING PREVIEW — Enquiry submissions are disabled here. Do not enter personal information. For genuine enquiries, visit mybizdigital.my.</p>')
        .replace('<button class="mbd-contact-submit" type="submit">', '<button class="mbd-contact-submit" type="submit" disabled aria-disabled="true">');
      assert.equal(built.toString('utf8'), expected, file);
    } else {
      assert.deepEqual(built, original, file);
    }
  }
});

test('no private files, manifests, legacy Netlify functions or credentials in dist', async () => {
  const actual = await listFiles(dist);
  for (const forbidden of [
    'README.md', 'ASSET_MANIFEST.json', 'IMAGE_CHANGE_MANIFEST.json',
    '.env', '.firebaserc', '.gitignore', 'firebase.json', 'netlify.toml',
    'netlify/functions/contact-acknowledgement.mjs',
    'docs/VALIDATION_REPORT.json', 'tests/hosting/hosting.test.mjs',
    'scripts/staging-contact-guard.js'
  ]) assert.ok(!actual.includes(forbidden), forbidden);
  for (const file of actual) {
    assert.ok(!file.split('/').some(part => part.startsWith('.')), file);
    assert.ok(!/\.(?:map|md|mjs|json|pem|key|bak|zip|sql)$/i.test(file), file);
  }
});

test('all explicit internal HTML links and asset references resolve in dist', async () => {
  const actual = new Set(await listFiles(dist));
  let references = 0;
  for (const file of [...actual].filter(p => p.endsWith('.html'))) {
    const html = await readFile(path.join(dist, file), 'utf8');
    for (const [, raw] of html.matchAll(/\b(?:href|src|poster)\s*=\s*["']([^"']+)["']/gi)) {
      const url = raw.replaceAll('&amp;', '&').trim();
      if (!url || url.startsWith('#') || url.includes('$'+'{') || url.includes('{{') ||
          /^(?:[a-z][\w+.-]*:|\/\/)/i.test(url)) continue;
      let local = url.split(/[?#]/)[0];
      if (!local) continue;
      try { local = decodeURIComponent(local); }
      catch { assert.fail('Bad URI encoding in ' + file + ': ' + url); }
      local = local.startsWith('/') ? local.slice(1) : path.posix.join(path.posix.dirname(file), local);
      local = path.posix.normalize(local);
      assert.ok(!local.startsWith('../') && local !== '..', 'Escaping root in ' + file + ': ' + url);
      if (!path.posix.extname(local)) local += local.endsWith('/') ? 'index.html' : '/index.html';
      assert.ok(actual.has(local), 'Missing ' + local + ' referenced by ' + file);
      references++;
    }
  }
  assert.ok(references > 100, 'Expected substantial HTML reference coverage');
});

test('staging enquiry guard disables submissions in HTML and JavaScript', async () => {
  const original = await readFile(path.join(root, 'assets/contact.js'), 'utf8');
  const output = await readFile(path.join(dist, 'assets/contact.js'), 'utf8');
  const guard = await readFile(path.join(root, 'scripts/staging-contact-guard.js'), 'utf8');
  const html = await readFile(path.join(dist, 'contact.html'), 'utf8');
  assert.ok(original.includes('fetch('));
  assert.ok(output.endsWith('\n' + guard));
  assert.ok(guard.includes("document.addEventListener('submit'"));
  assert.ok(guard.includes('event.preventDefault()'));
  assert.ok(guard.includes('event.stopImmediatePropagation()'));
  assert.ok(guard.includes('button.disabled = true'));
  assert.ok(html.includes('disabled aria-disabled="true"'));
  assert.ok(html.includes('STAGING PREVIEW — Enquiry submissions are disabled here.'));
});
