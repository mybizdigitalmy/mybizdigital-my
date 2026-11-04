import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join,relative} from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));
const rootPages=['index.html','about.html','business-apps.html','contact.html','order-support.html','privacy-policy.html','product-support.html','terms-and-conditions.html','web-development.html'];
async function list(d){let out=[];for(const e of await readdir(d,{withFileTypes:true})){const p=join(d,e.name);if(e.isDirectory())out.push(...await list(p));else out.push(relative(join(root,'dist'),p).replaceAll('\\','/'));}return out;}
test('default local build preserves 40 pages and blocks contact data collection',async()=>{
  execFileSync(process.execPath,['scripts/build-static.mjs'],{cwd:root});
  const files=await list(join(root,'dist'));
  assert.equal(files.length,181);
  assert.equal(files.filter(x=>x.endsWith('.html')).length,40);
  const contact=await readFile(join(root,'dist/contact.html'),'utf8');
  const code=await readFile(join(root,'dist/assets/contact.js'),'utf8');
  assert.match(contact,/disabled aria-disabled="true"/);
  assert.match(code,/stopImmediatePropagation/);
});
test('only the exact staging enquiry rewrite is present, with deny-all rules',async()=>{
  const c=JSON.parse(await readFile(join(root,'firebase.json'),'utf8'));
  assert.equal(c.hosting.target,'staging-site');
  assert.deepEqual(c.hosting.rewrites,[{source:'/api/enquiry',function:{functionId:'submitEnquiry',region:'asia-southeast1'}}]);
  for(const f of ['firestore.pr003.rules','storage.pr003.rules'])assert.match(await readFile(join(root,f),'utf8'),/allow read, write: if false;/);
});
test('public staging output never includes server code, Firebase rules or credentials',async()=>{
  const files=await list(join(root,'dist'));
  assert.ok(files.includes('assets/enquiry-public-config.js'));
  assert.ok(files.every(x=>!x.startsWith('functions/')&&!x.includes('secret')&&!x.endsWith('.json')&&!x.endsWith('.mjs')));
  for(const page of rootPages)assert.ok(files.includes(page));
});
test('activation guard fails closed without approved backend/site key',async()=>{
  const result=await import('node:child_process').then(({spawnSync})=>spawnSync(process.execPath,['scripts/build-static.mjs'],{cwd:root,env:{...process.env,PR003_ENABLE_ENQUIRIES:'true',PR003_BACKEND_APPROVED:'false'},encoding:'utf8'}));
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/approved backend/);
  // Restore safe default artifact for subsequent checks.
  execFileSync(process.execPath,['scripts/build-static.mjs'],{cwd:root});
});