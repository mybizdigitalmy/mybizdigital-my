/**
 * PR-001 — Public-only staging build. Node.js 20+, no external dependencies.
 * No deployment, source file edits or framework conversions.
 */
import { copyFile, lstat, mkdir, readdir, rm } from 'node:fs/promises';
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
    throw new Error('Expected a regular public directory: ' + relativeDirectory);
  }
  const entries = (await readdir(source, { withFileTypes: true }))
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    if (entry.name.startsWith('.') || entry.isSymbolicLink()) {
      throw new Error('Hidden file or symbolic link not permitted: ' + relativePath);
    }
    if (entry.isDirectory()) await copyPublicDirectory(relativePath);
    else if (entry.isFile()) await copyPublicFile(relativePath);
    else throw new Error('Unsupported public filesystem entry: ' + relativePath);
  }
}

async function main() {
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  try {
    for (const page of rootPages) await copyPublicFile(page);
    for (const dir of publicDirectories) await copyPublicDirectory(dir);
    console.log('Created ' + copied + ' public files in dist/ (not deployed).');
  } catch (error) {
    await rm(output, { recursive: true, force: true });
    throw error;
  }
}

await main();
