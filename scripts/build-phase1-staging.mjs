/** PHASE1-002B: local staging-only output overlay. NEVER deploys or changes source files. */
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const expectedProject = 'mybizdigital-staging';
const expectedTarget = 'staging-site';
const check = (ok, message) => { if (!ok) throw Error('STAGING-ONLY build aborted: ' + message); };

const rc = JSON.parse(await readFile(path.join(root, '.firebaserc'), 'utf8'));
const config = JSON.parse(await readFile(path.join(root, 'firebase.staging.phase1.json'), 'utf8'));
check(JSON.stringify(rc.projects) === JSON.stringify({staging:expectedProject}), 'unexpected Firebase projects');
check(JSON.stringify(rc.targets) === JSON.stringify({
  [expectedProject]: {hosting:{[expectedTarget]:[expectedProject]}}
}), 'unexpected Firebase Hosting target mapping');
check(Object.keys(config).length === 1 && !!config.hosting, 'non-Hosting services in staging config');
check(config.hosting.target === expectedTarget && config.hosting.public === 'dist', 'Hosting target/public directory mismatch');
check(!config.hosting.rewrites && !config.hosting.redirects, 'dynamic rewrites/redirects are not approved');
check(config.hosting.headers?.some(rule => rule.source === '**' && rule.headers?.some(h =>
  h.key === 'X-Robots-Tag' && h.value.includes('noindex'))), 'missing sitewide staging noindex');

// The production candidate is rebuilt in dist/, then modified ONLY in dist/ for staging.
execFileSync(process.execPath, ['scripts/build-phase1.mjs'], {cwd:root, stdio:'inherit'});
async function htmlFiles(directory, prefix='') {
  const output=[];
  for (const entry of await readdir(directory, {withFileTypes:true})) {
    const rel=path.posix.join(prefix,entry.name);
    if (entry.isDirectory()) output.push(...await htmlFiles(path.join(directory,entry.name),rel));
    else if (entry.isFile() && rel.endsWith('.html')) output.push(rel);
  }
  return output;
}
const pages=await htmlFiles(dist);
check(pages.length===40, `expected 40 HTML routes, got ${pages.length}`);
const noindex='<meta name="robots" content="noindex,nofollow,noarchive">';
for (const rel of pages) {
  const file=path.join(dist,rel);
  let html=await readFile(file,'utf8');
  check(/<head(?:\s[^>]*)?>/i.test(html), `${rel} missing head`);
  if (!html.includes(noindex)) {
    html=html.replace(/<head(?:\s[^>]*)?>/i,match=>match+'\n'+noindex);
    await writeFile(file,html,'utf8');
  }
}
await writeFile(path.join(dist,'robots.txt'), 'User-agent: *\nDisallow: /\n', 'utf8');
await rm(path.join(dist,'sitemap.xml'), {force:true});
check((await readFile(path.join(dist,'robots.txt'),'utf8')).includes('Disallow: /'), 'robots guard missing');
console.log(`PHASE1-002B: staging-only noindex prepared for ${pages.length} HTML files; no deployment.`);
