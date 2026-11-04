/**
 * PR-001 — Public-only staging build. Node.js 20+, no external dependencies.
 * No deployment, source file edits or framework conversions.
 */
import { copyFile, appendFile, lstat, mkdir, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist');
const rootPages = [
  'index.html', 'about.html', 'business-apps.html', 'contact.html',
  'order-support.html', 'privacy-policy.html', 'product-support.html',
  'terms-and-conditions.html', 'web-development.html'
];
const publicDirectories = ['assets', 'demos', 'apps'];
const publicExtensions = new Set([
  '.html', '.css', '.js', '.svg', '.webp', '.jpg', '.jpeg', '.png', '.mp4'
]);

let copied = 0;

async function copyPublicFile(relativePath) {
  const from = path.join(root, relativePath);
  const stat = await lstat(from);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error('Expected a regular public file: ' + relativePath);
  }
  if (!publicExtensions.has(path.extname(relativePath).toLowerCase())) {
    throw new Error('Unexpected file type inside the public allowlist: ' + relativePath);
  }
  const to = path.join(output, relativePath);
  await mkdir(path.dirname(to), { recursive: true });
  await copyFile(from, to);
  copied++;
}
async function copyPublicDirectory(relativeDirectory) {
  const source = path.join(root, relativeDirectory);
  const stat = await lstat(source);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error('Invalid directory: ' + relativeDirectory);
  }
  const entries = (await readdir(source, { withFileTypes: true }))
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    if (entry.name.startsWith('.') || entry.isSymbolicLink()) {
      throw new Error('Hidden file or symlink: ' + relativePath);
    }
    if (entry.isDirectory()) await copyPublicDirectory(relativePath);
    else if (entry.isFile()) await copyPublicFile(relativePath);
    else throw Error('Unsupported entry: ' + relativePath);
  }
}
async function main() {
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  try {
    for (const page of rootPages) await copyPublicFile(page);
    for (const dir of publicDirectories) await copyPublicDirectory(dir);
    // Default PR-001 guard remains active. Do not collect personal data until separately approved.
    if (process.env.PR003_ENABLE_ENQUIRIES === 'true') {
      const config = await readFile(path.join(output, 'assets/enquiry-public-config.js'),'utf8');
      if(process.env.PR003_BACKEND_APPROVED !== 'true' || !/turnstileSiteKey:\s*'[-_A-Za-z0-9]{20,100}'/.test(config))
        throw Error('PR-003 activation requires approved backend AND configured public Turnstile site key');
      console.log('PR-003 form guard omitted only under explicit approval.');
    } else {
      const originalContact = await readFile(path.join(output, 'contact.html'), 'utf8');
      const formOpen = /(<form\b[^>]*\bid="mbd-contact-form"[^>]*>)/i;
      const submitButton = '<button class="mbd-contact-submit" type="submit">';
      if (!formOpen.test(originalContact) || !originalContact.includes(submitButton)) {
        throw new Error('Contact form source changed; refusing unsafe staging build');
      }
      const safeContact = originalContact
        .replace(formOpen, '$1\n<p class="mbd-staging-contact-notice" role="status">STAGING PREVIEW — Enquiry submissions are disabled here. Do not enter personal information. For genuine enquiries, visit mybizdigital.my.</p>')
        .replace(submitButton, '<button class="mbd-contact-submit" type="submit" disabled aria-disabled="true">');
      await writeFile(path.join(output, 'contact.html'), safeContact);
      const guard = await readFile(path.join(root, 'scripts/staging-contact-guard.js'), 'utf8');
      await appendFile(path.join(output, 'assets/contact.js'), '\n' + guard);
      console.log('Staging contact remains disabled pending separately approved PR-003 activation.');
    }
    console.log('Created ' + copied + ' public files in dist/ (not deployed).');
  } catch (error) {
    await rm(output, { recursive: true, force: true });
    throw error;
  }
}
await main();