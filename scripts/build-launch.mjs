/**
 * LAUNCH-01 — PREPARATION ONLY. Node.js 20+, no external dependencies.
 * PUBLIC Firebase Hosting candidate. This does not deploy, create cloud projects,
 * change DNS, update customer accounts, accept payment or submit enquiries.
 *
 * Keep the approved DESIGN-001 files byte-for-byte intact in the repository.
 * The only intentional release-output changes are:
 *  - index.html: remove checkout path (enquiry instead), retain original page design;
 *  - contact.html: static business email instead of unsupported Netlify form;
 *  - assets/contact.js: no modal/form interception while backend is absent;
 *  - SEO canonical elements only when absent, robots.txt, sitemap.xml.
 */
import { copyFile, lstat, mkdir, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist');
const domain = 'https://mybizdigital.my';
const rootPages = [
  'index.html', 'about.html', 'business-apps.html', 'contact.html',
  'order-support.html', 'privacy-policy.html', 'product-support.html',
  'terms-and-conditions.html', 'web-development.html'
];
const publicDirectories = ['assets', 'demos', 'apps'];
const publicExtensions = new Set(['.html', '.css', '.js', '.svg', '.webp', '.jpg', '.jpeg', '.png', '.mp4']);
let copied = 0;

function assert(condition, message) {
  if (!condition) throw Error('LAUNCH-01 build halted: ' + message);
}
async function copyPublicFile(rel) {
  const from = path.join(root, rel);
  const stat = await lstat(from);
  assert(stat.isFile() && !stat.isSymbolicLink(), 'expected regular file: ' + rel);
  assert(publicExtensions.has(path.extname(rel).toLowerCase()), 'unexpected file type: ' + rel);
  const to = path.join(output, rel);
  await mkdir(path.dirname(to), { recursive: true });
  await copyFile(from, to);
  copied++;
}
async function copyDir(dir) {
  const stat = await lstat(path.join(root, dir));
  assert(stat.isDirectory() && !stat.isSymbolicLink(), 'invalid directory: ' + dir);
  const entries = (await readdir(path.join(root, dir), { withFileTypes: true }))
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const rel = path.posix.join(dir, entry.name);
    assert(!entry.name.startsWith('.') && !entry.isSymbolicLink(), 'hidden/symlink content: ' + rel);
    if (entry.isDirectory()) await copyDir(rel);
    else if (entry.isFile()) await copyPublicFile(rel);
    else throw Error('Unsupported public entry: ' + rel);
  }
}
function addCanonical(html, url) {
  if (/<link\b[^>]*\brel=["']canonical["']/i.test(html)) return html;
  assert(/<head(?:\s[^>]*)?>/i.test(html), 'missing document head for ' + url);
  return html.replace(/<head(?:\s[^>]*)?>/i, match => match + '\n<link rel="canonical" href="' + url + '">');
}
async function prepareIndex() {
  const file = path.join(output, 'index.html');
  let html = await readFile(file, 'utf8');
  assert(html.includes('function openCheckout(){'), 'checkout entry point changed; audit before release');
  assert(html.includes('Continue to Checkout →'), 'checkout CTA changed; audit before release');
  assert(html.includes('Live checkout is not available.'), 'missing explicit checkout notice');
  // Old preview fields must never become an active contact, delivery or payment flow.
  html = html.replace('function openCheckout(){',
    'function openCheckout(){window.location.href="contact.html?enquiry=nfc";return;');
  html = html.replace('Continue to Checkout →', 'Enquire before ordering →');
  // This release does not include customer login: replace four misleading placeholders.
  const loginLinks = html.match(/href="#login">Log in<\/a>/g) || [];
  const signupLinks = html.match(/href="#signup">Sign up<\/a>/g) || [];
  assert(loginLinks.length === 2 && signupLinks.length === 2,
    'expected two desktop/mobile account placeholders each');
  html = html.replace(/href="#login">Log in<\/a>/g, 'href="contact.html">Contact us</a>');
  html = html.replace(/href="#signup">Sign up<\/a>/g, 'href="contact.html">Get a quote</a>');
  html = addCanonical(html, domain + '/');
  await writeFile(file, html, 'utf8');
}
async function prepareContact() {
  const file = path.join(output, 'contact.html');
  let html = await readFile(file, 'utf8');
  const form = /<form\b[^>]*\bid="mbd-contact-form"[^>]*>[\s\S]*?<\/form>/gi;
  const matches = html.match(form);
  assert(matches && matches.length === 1, 'expected exactly one legacy enquiry form');
  // The approved contact page shell, navigation and footer remain untouched.
  // No fake submit success, file upload or sensitive input without a backend.
  const replacement = '<section class="mbd-launch-enquiry" role="region" aria-label="Email MyBizDigital">' +
    '<h3>Contact our team by email</h3>' +
    '<p>Online form submissions are not yet enabled. For NFC products, website design or business software, email your requirements directly to our support team.</p>' +
    '<a class="mbd-contact-submit mbd-launch-mailto" href="mailto:support@mybizdigital.my?subject=MyBizDigital%20Business%20Enquiry">Email support@mybizdigital.my <span aria-hidden="true">↗</span></a>' +
    '<p class="mbd-launch-contact-note">Your email application will open. No information is submitted by this website.</p>' +
    '</section>';
  html = html.replace(form, replacement);
  assert(!html.includes('data-netlify="true"'), 'legacy Netlify processing remains in output');
  html = addCanonical(html, domain + '/contact.html');
  await writeFile(file, html, 'utf8');
  // Remove the original Netlify form submit/popup implementation from the built
  // output only; the approved source assets/contact.js remains unchanged.
  await writeFile(path.join(output, 'assets/contact.js'),
    '/* LAUNCH-01: no enquiry form backend; native Contact page links remain functional. */\n');
  // Keep the contact panel geometry and approved footer. Style only the replacement.
  const cssFile = path.join(output, 'assets/contact.css');
  const extra = '\n/* LAUNCH-01 enquiry email fallback (release output only). */\n' +
    '.mbd-launch-enquiry{display:grid;gap:17px;align-content:start}\n' +
    '.mbd-launch-enquiry h3{font:inherit;font-weight:750;font-size:clamp(20px,2.2vw,27px);letter-spacing:-.035em;margin:0}\n' +
    '.mbd-launch-enquiry p{margin:0;line-height:1.7}\n' +
    '.mbd-launch-enquiry .mbd-launch-mailto{display:inline-flex;align-items:center;justify-content:center;gap:9px;max-width:100%;width:fit-content;text-decoration:none}\n' +
    '.mbd-launch-contact-note{font-size:12px;color:#667070}\n';
  await writeFile(cssFile, await readFile(cssFile, 'utf8') + extra);
}
async function prepareOtherPages() {
  for (const page of rootPages) {
    if (page === 'index.html' || page === 'contact.html') continue;
    const file = path.join(output, page);
    const html = await readFile(file, 'utf8');
    await writeFile(file, addCanonical(html, domain + '/' + page), 'utf8');
  }
}
async function writeSEO() {
  const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    rootPages.map(page => '  <url><loc>' + domain + '/' + (page === 'index.html' ? '' : page) + '</loc></url>').join('\n') +
    '\n</urlset>\n';
  await writeFile(path.join(output, 'robots.txt'), 'User-agent: *\nAllow: /\nSitemap: ' + domain + '/sitemap.xml\n');
  await writeFile(path.join(output, 'sitemap.xml'), sitemap);
}
async function main() {
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  try {
    for (const page of rootPages) await copyPublicFile(page);
    for (const dir of publicDirectories) await copyDir(dir);
    await prepareIndex();
    await prepareContact();
    await prepareOtherPages();
    await writeSEO();
    console.log('LAUNCH-01: prepared ' + copied + ' public source files + robots.txt + sitemap.xml in dist/ (NOT DEPLOYED).');
    console.log('No live checkout, signup, Netlify enquiry submission, Firebase Auth or payments are activated.');
  } catch (error) {
    await rm(output, { recursive: true, force: true });
    throw error;
  }
}
await main();
