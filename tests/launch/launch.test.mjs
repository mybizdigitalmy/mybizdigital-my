/* LAUNCH-01 release safety checks — run with Node.js 20+.
 * Does not contact Firebase, Netlify, GitHub or payment services. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../../', import.meta.url));
const dist = path.join(root, 'dist');
const read = async rel => readFile(path.join(root, rel), 'utf8');
const output = async rel => readFile(path.join(dist, rel), 'utf8');
const rootPages = [
  'index.html', 'about.html', 'business-apps.html', 'contact.html',
  'order-support.html', 'privacy-policy.html', 'product-support.html',
  'terms-and-conditions.html', 'web-development.html'
];
async function list(folder, prefix = '') {
  const entries = await readdir(folder, {withFileTypes:true});
  const all = [];
  for (const entry of entries) {
    const rel = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) all.push(...await list(path.join(folder,entry.name), rel));
    else all.push(rel);
  }
  return all.sort();
}
test('production release build creates allowlisted static files', async () => {
  execFileSync(process.execPath, ['scripts/build-launch.mjs'], {cwd:root,stdio:'pipe'});
  const files = await list(dist);
  assert.ok(files.includes('index.html') && files.includes('contact.html'));
  assert.ok(files.includes('robots.txt') && files.includes('sitemap.xml'));
  assert.ok(files.includes('demos/restaurant-01/index.html'));
  assert.ok(files.includes('apps/cafe-sales/index.html'));
  assert.ok(files.includes('assets/demos/design001-editorial-refinements.css'));
  assert.equal(files.filter(f=>f.endsWith('.html')).length, 40);
  for (const file of files) {
    assert.ok(!file.endsWith('.json') && !file.includes('netlify/') && !file.includes('docs/'));
    assert.ok(!file.startsWith('tests/') && !file.startsWith('scripts/'));
    assert.ok(!file.includes('MANIFEST') && !file.includes('.firebaserc'));
  }
});
test('original approved source stays untouched and product/demo assets are copied', async () => {
  for (const page of ['demos/barber-01/index.html','demos/restaurant-01/index.html','apps/cafe-sales/index.html']) {
    assert.deepEqual(await readFile(path.join(dist,page)),await readFile(path.join(root,page)));
  }
  assert.deepEqual(await readFile(path.join(dist,'assets/product-card-google-review.png')),
    await readFile(path.join(root,'assets/product-card-google-review.png')));
  assert.deepEqual(await readFile(path.join(dist,'assets/demos/barber-01/barber-chair.webp')),
    await readFile(path.join(root,'assets/demos/barber-01/barber-chair.webp')));
});
test('no active checkout, guest checkout or payment submission', async () => {
  const s = await output('index.html');
  assert.ok(s.includes('function openCheckout(){window.location.href="contact.html?enquiry=nfc";return;'));
  assert.ok(s.includes('Enquire before ordering →'));
  assert.ok(!s.includes('Continue to Checkout →'));
  assert.ok(!s.includes('href="#login"') && !s.includes('href="#signup"'));
  assert.ok(s.includes('href="contact.html">Contact us</a>'));
  assert.ok(s.includes('href="contact.html">Get a quote</a>'));
  assert.ok(s.includes('Live checkout is not available.'));
  assert.ok(!/createPaymentIntent|HitPay\.create|\/api\/checkout/i.test(s));
});
test('contact route uses explicit email handoff rather than nonfunctional form', async () => {
  const html = await output('contact.html'), js = await output('assets/contact.js');
  assert.ok(html.includes('mailto:support@mybizdigital.my?subject='));
  assert.ok(html.includes('No information is submitted by this website.'));
  assert.ok(!html.includes('id="mbd-contact-form"'));
  assert.ok(!html.includes('name="mybiz-enquiry"'));
  assert.ok(!html.includes('data-netlify="true"'));
  assert.ok(!html.includes('Complete the form below. Fields marked * are required.'));
  assert.ok(html.includes('Email us directly and our team will review your enquiry.'));
  assert.ok(!js.includes('fetch(') && !js.includes('FormData'));
  assert.ok((await read('contact.html')).includes('name="mybiz-enquiry"'), 'original remains unchanged');
});
test('SEO is enabled only for candidate production, demos stay excluded', async () => {
  const sitemap = await output('sitemap.xml'), robots = await output('robots.txt');
  const config = JSON.parse(await read('firebase.launch.json'));
  assert.equal(config.hosting.public, 'dist');
  assert.equal(config.hosting.target, undefined);
  const globalHeaders = config.hosting.headers.find(h => h.source === '**').headers;
  assert.ok(!globalHeaders.some(h => h.key === 'X-Robots-Tag'));
  assert.ok(config.hosting.headers.some(x=>x.source==='/demos/**'));
  assert.ok(config.hosting.headers.some(x=>x.source==='/apps/**'));
  assert.equal((sitemap.match(/<url>/g)||[]).length, rootPages.length);
  assert.ok(sitemap.includes('https://mybizdigital.my/'));
  assert.ok(!sitemap.includes('/demos/'));
  assert.ok(robots.includes('Sitemap: https://mybizdigital.my/sitemap.xml'));
  for (const page of rootPages) assert.ok((await output(page)).includes('rel="canonical"') || /rel=["']canonical["']/i.test(await output(page)));
});
