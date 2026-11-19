import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const dist=path.join(root,'dist');
const read=async relative=>readFile(path.join(dist,relative),'utf8');
async function walk(dir,prefix=''){
 const out=[];
 for(const e of await readdir(dir,{withFileTypes:true})){
  const rel=path.posix.join(prefix,e.name);
  if(e.isDirectory())out.push(...await walk(path.join(dir,e.name),rel));
  else out.push(rel);
 }
 return out;
}
const dig=b=>createHash('sha256').update(b).digest('hex');
test('staging build applies noindex to every page, preserves source, and production build remains indexable',async()=>{
 const protectedFiles=['index.html','contact.html','assets/site-shell.css','ASSET_MANIFEST.json','IMAGE_CHANGE_MANIFEST.json','firebase.launch.json','scripts/build-phase1.mjs'];
 const before=Object.fromEntries(await Promise.all(protectedFiles.map(async p=>[p,dig(await readFile(path.join(root,p)))])));
 execFileSync(process.execPath,['scripts/build-phase1-staging.mjs'],{cwd:root,stdio:'pipe'});
 const pages=(await walk(dist)).filter(p=>p.endsWith('.html'));
 assert.equal(pages.length,40);
 for(const page of pages)assert.match(await read(page),/<meta name="robots" content="noindex,nofollow,noarchive">/i,page);
 assert.equal(await read('robots.txt'),'User-agent: *\nDisallow: /\n');
 assert.ok(!(await walk(dist)).includes('sitemap.xml'));
 for(const p of protectedFiles)assert.equal(dig(await readFile(path.join(root,p))),before[p],`modified source: ${p}`);
 execFileSync(process.execPath,['scripts/build-phase1.mjs'],{cwd:root,stdio:'pipe'});
 assert.match(await read('robots.txt'),/Allow: \//);
 assert.doesNotMatch(await read('index.html'),/<meta name="robots" content="noindex,nofollow,noarchive">/i);
 assert.ok((await walk(dist)).includes('sitemap.xml'));
});
