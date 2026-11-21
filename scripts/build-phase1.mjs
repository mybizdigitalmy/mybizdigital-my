/**
 * PHASE1-001: strictly local, static, enquiry-only release builder.
 * Runs the existing LAUNCH-01 builder first; never edits source HTML/assets or deploys.
 * DESIGN-001 assets from the containing branch are copied unchanged by LAUNCH-01.
 */
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, copyFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const rootPages = [
  'index.html', 'about.html', 'business-apps.html', 'contact.html',
  'order-support.html', 'privacy-policy.html', 'product-support.html',
  'terms-and-conditions.html', 'web-development.html'
];
const WHATSAPP = 'https://wa.me/601128194900';
const quoteMessage = 'Hello MyBizDigital, I would like to request a business quotation for your digital solutions. Please share the next steps.';
function assert(ok, message) { if (!ok) throw Error('PHASE1-001 release halted: ' + message); }
function replaceOnce(haystack, expression, replacement, reason) {
  const matches = haystack.match(expression);
  assert(matches?.length === 1, `${reason} must appear exactly once (found ${matches?.length || 0})`);
  return haystack.replace(expression, replacement);
}
function preserveNavigationWithoutCommerce(html) {
  // Remove the source elements, not just their CSS visibility. Do not alter the five approved nav items.
  html = html.replace(/<a\b[^>]*class="cart-button"[^>]*>[\s\S]*?<\/a>/g, '');
  html = html.replace(/<a\b[^>]*class="nav-login"[^>]*>[\s\S]*?<\/a>/g, '');
  html = html.replace(/<a\b[^>]*class="btn btn-primary nav-signup"[^>]*>[\s\S]*?<\/a>/g, '');
  html = html.replace(/<div class="mobile-actions">[\s\S]*?<\/div>/g, '');
  // Other pages load a read-only localStorage cart badge, which has no Phase 1 purpose.
  html = html.replace(/<script\s+src="assets\/cart-nav-count\.js"\s+defer><\/script>/g, '');
  assert(!/class="(?:cart-button|nav-login|[^"]*\bnav-signup\b|mobile-actions)"/.test(html), 'commerce/account navigation remains');
  assert(!/href="(?:index\.html)?#(?:login|signup|cart|checkout)"/.test(html), 'account or cart navigation route remains');
  return html;
}
function addPhase1Assets(html) {
  assert(html.includes('</head>') && html.includes('</body>'), 'missing standard HTML head/body');
  html = html.replace('</head>', '<link rel="stylesheet" href="assets/phase1-site.css"></head>');
  html = html.replace('</body>', '<script src="assets/phase1-site.js" defer></script></body>');
  return html;
}
function fixProductSchema(html) {
  return html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (full, raw) => {
    let data;
    try { data = JSON.parse(raw); } catch { return full; }
    // Not offering online purchasing or asserting stock availability in Phase 1.
    if (data['@type'] === 'Product') {
      delete data.offers;
      return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`;
    }
    return full;
  });
}
function phase1Home(html) {
  html = replaceOnce(html, /<script id="mbd-purchase-js-v193">[\s\S]*?<\/script>/, '', 'legacy transactional script');
  html = replaceOnce(html,
    /<a class="btn btn-secondary" href="contact\.html" data-mbd-enquiry="general" id="quote">Request Business Quote<\/a>/,
    `<a class="btn btn-secondary" href="${WHATSAPP}?text=${encodeURIComponent(quoteMessage)}" target="_blank" rel="noopener noreferrer" id="quote">Request Business Quote</a>`,
    'business quote CTA');
  // Preserve the existing Shop NFC Stands CTA, #products destination, all card HTML and media.
  assert(html.includes('href="#products" id="shop">Shop NFC Stands</a>'), 'Shop NFC destination changed');
  assert((html.match(/data-product-card=""/g) || []).length === 5, 'five NFC product cards expected');
  html = fixProductSchema(html);
  return phase1005Home(html);
}
function phase1005Home(html) {
  const before = ['RM100', 'RM100', 'RM100', 'RM100', 'RM800 / 10 tables'];
  const promo = ['RM100', 'RM100', 'RM100', 'RM100', 'RM800'];
  const regular = ['RM111', 'RM111', 'RM111', 'RM111', 'RM1,111'];
  let i = 0;
  html = html.replace(/<span class="product-price">([^<]+)<\/span>/g, (_, current) => {
    assert(i < 5 && current === before[i], `unexpected NFC card price at ${i + 1}: ${current}`);
    const pair = `<span class="mbd-phase1-price-pair"><span class="product-price">${promo[i]}</span><del class="mbd-phase1-regular-price">${regular[i]}</del></span>`;
    return pair + (i++ === 4 ? '<span class="mbd-phase1-bundle-note">10 NFC stands per bundle</span>' : '');
  });
  assert(i === 5, `expected 5 NFC price presentations, found ${i}`);
  html = replaceOnce(html, 'Rated 5.0 by First-Time Buyers', 'NFC Experiences in Everyday Business', 'review heading');
  html = replaceOnce(html,
    'How MyBizDigital NFC Smart Stands support reviews, social engagement and digital menus. Illustrative feedback for preview only.',
    'Sample business feedback scenarios only. The comments and business names shown are fictional, not verified customer reviews.', 'review disclosure');
  const labels = (html.match(/ · Illustrative<\/span>/g) || []).length;
  assert(labels === 60, `expected 60 sample industry labels across two sets, found ${labels}`);
  html = html.replace(/ · Illustrative<\/span>/g, '</span>');
  html = html.replace(/aria-label="Illustrative ([^"]+) feedback"/g, 'aria-label="Sample $1 feedback"');
  html = html.replace(/aria-label="Five stars, illustrative"/g, 'aria-hidden="true"');
  html = html.replace('aria-label="Scrolling illustrative feedback in Bahasa Malaysia and Malaysian English"',
    'aria-label="Sample business feedback scenarios. Scroll horizontally or use the left and right arrow keys."');
  return html;
}
async function newsletterSettings() {
  const settings = JSON.parse(await readFile(path.join(root, 'scripts/phase1-newsletter-config.json'), 'utf8'));
  assert(settings.provider === 'buttondown' && typeof settings.enabled === 'boolean' &&
    typeof settings.username === 'string', 'unexpected newsletter configuration');
  assert(!settings.enabled || /^[A-Za-z0-9][A-Za-z0-9_-]{1,60}$/.test(settings.username),
    'Newsletter activation requires a verified public Buttondown username');
  return settings;
}
function phase1005Newsletter(html, settings) {
  const privacy = '<a href="privacy-policy.html">Privacy Policy</a>';
  const enabled = settings.enabled;
  const nativeForm = enabled
    ? `<form id="mbd-newsletter-form" class="mbd-f-subscribe-box" data-mbd-newsletter-ready method="post" action="https://buttondown.com/api/emails/embed-subscribe/${settings.username}" target="_blank" rel="noopener noreferrer" aria-label="Subscribe to MyBizDigital updates"><input type="hidden" name="embed" value="1"><input type="email" name="email" aria-label="Newsletter email address" placeholder="you@email.com" autocomplete="email" maxlength="254" required><button type="submit">Notify me</button></form>`
    : '<div class="mbd-f-subscribe-box" aria-label="Newsletter registration not yet enabled"><input type="email" aria-label="Email address (newsletter not available yet)" placeholder="you@email.com" disabled><button type="button" disabled title="Newsletter sign-ups coming soon">Notify me</button></div>';
  const consent = enabled
    ? `<label class="mbd-phase1-newsletter-consent"><input type="checkbox" form="mbd-newsletter-form" required> <span>I agree to receive product and business updates by email. I can unsubscribe at any time. See our ${privacy}.</span></label>`
    : `<p class="mbd-phase1-newsletter-consent mbd-phase1-newsletter-unavailable">Marketing emails require explicit consent. See our ${privacy}.</p>`;
  const note = enabled
    ? 'Your email is sent directly to Buttondown for confirmation. Check the provider page and confirm by email; this site does not claim completion.'
    : 'Newsletter sign-ups are not enabled until our provider is verified.';
  const pattern = /<div\b(?=[^>]*class="mbd-f-subscribe-box")[^>]*>[\s\S]*?<\/div>\s*<span class="mbd-f-subscribe-note">[^<]*<\/span>/g;
  const hits = html.match(pattern) || [];
  assert(hits.length === 1, `expected one original newsletter footer, got ${hits.length}`);
  return html.replace(pattern, nativeForm + '\n' + consent + '\n<span class="mbd-f-subscribe-note" role="status">' + note + '</span>');
}
function phase1Contact(html) {
  const message = 'Hello MyBizDigital, I would like to enquire about your NFC products, website design or business software services.';
  const section = `<section class="mbd-launch-enquiry mbd-phase1-contact" role="region" aria-label="Contact MyBizDigital">
<h3>Chat with our team</h3>
<p>Ask about NFC Smart Stands, website development or custom software. Your message opens in WhatsApp for you to review and send.</p>
<a class="mbd-contact-submit mbd-launch-mailto" href="${WHATSAPP}?text=${encodeURIComponent(message)}" target="_blank" rel="noopener noreferrer" aria-label="Chat with MyBizDigital on WhatsApp">Chat on WhatsApp <span aria-hidden="true">↗</span></a>
<p class="mbd-phase1-email-label">Prefer email? <a href="mailto:support@mybizdigital.my?subject=MyBizDigital%20Business%20Enquiry">support@mybizdigital.my</a></p>
<p class="mbd-launch-contact-note">No information is submitted by this website. WhatsApp opens a conversation; you choose whether to send your message.</p>
</section>`;
  html = replaceOnce(html, /<section class="mbd-launch-enquiry"[\s\S]*?<\/section>/, section, 'LAUNCH-01 email fallback');
  html = html.replace('Send an enquiry</h2>', 'Get in touch</h2>');
  html = html.replace('Email us directly and our team will review your enquiry.', 'WhatsApp is the quickest way to reach our team. Email is also available.');
  assert(!/\b<form\b/i.test(html), 'contact form remains in public build');
  return html;
}
function assertStaticReleaseSafety(distFiles) {
  const forbidden = /^(?:\.env(?:\..*)?|\.git\/|\.firebaserc$|firebase\.json$|firebase\.launch\.json$|functions\/|node_modules\/|scripts\/|tests\/|docs\/|ASSET_MANIFEST\.json$|IMAGE_CHANGE_MANIFEST\.json$|netlify\/|netlify\.toml$)/;
  for (const file of distFiles) assert(!forbidden.test(file), 'private/operational file leaked: '+file);
}
async function allFiles(dir, prefix = '') {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const rel = path.posix.join(prefix, e.name);
    if (e.isDirectory()) out.push(...await allFiles(path.join(dir, e.name), rel));
    else out.push(rel);
  }
  return out;
}
async function main() {
  // Reuse the exact LAUNCH-01 release builder from this branch. No Firebase CLI or cloud calls.
  execFileSync(process.execPath, ['scripts/build-launch.mjs'], { cwd: root, stdio: 'inherit' });
  await copyFile(path.join(root, 'scripts/phase1-site.js'), path.join(dist, 'assets/phase1-site.js'));
  await copyFile(path.join(root, 'scripts/phase1-site.css'), path.join(dist, 'assets/phase1-site.css'));
  const newsletter = await newsletterSettings();
  for (const page of rootPages) {
    const file = path.join(dist, page);
    let html = await readFile(file, 'utf8');
    html = preserveNavigationWithoutCommerce(html);
    if (page === 'index.html') html = phase1Home(html);
    if (page === 'contact.html') html = phase1Contact(html);
    html = phase1005Newsletter(html, newsletter);
    html = addPhase1Assets(html);
    await writeFile(file, html, 'utf8');
  }
  // A retired page script must not remain reachable in the public output if not referenced.
  // (The source and both manifests remain entirely untouched.)
  const { rm } = await import('node:fs/promises');
  await rm(path.join(dist, 'assets/cart-nav-count.js'), { force: true });
  const files = await allFiles(dist);
  assertStaticReleaseSafety(files);
  assert(files.filter(f => f.endsWith('.html')).length === 40, '40 original HTML routes not preserved');
  assert(files.filter(f => f.startsWith('demos/') && f.endsWith('/index.html')).length === 15, '15 website demos not preserved');
  assert(files.filter(f => f.startsWith('apps/') && f.endsWith('/index.html')).length === 16, '16 business demos not preserved');
  console.log(`PHASE1-001: ${files.length} public files, 40 HTML routes, 31 demos. Non-transactional, no deployment.`);
}
await main();
