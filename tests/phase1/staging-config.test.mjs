import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../', import.meta.url));
const read=async f=>JSON.parse(await readFile(path.join(root,f),'utf8'));

test('staging mapping is exclusively mybizdigital-staging with no implicit production default',async()=>{
 const rc=await read('.firebaserc');
 assert.deepEqual(rc.projects,{staging:'mybizdigital-staging'});
 assert.deepEqual(rc.targets,{'mybizdigital-staging':{hosting:{'staging-site':['mybizdigital-staging']}}});
});
test('staging config publishes dist on explicit staging-site target, only Hosting',async()=>{
 const c=await read('firebase.staging.phase1.json');
 assert.deepEqual(Object.keys(c),['hosting']);
 assert.equal(c.hosting.target,'staging-site');
 assert.equal(c.hosting.public,'dist');
 assert.deepEqual(c.hosting.predeploy,['node scripts/build-phase1-staging.mjs']);
 assert.equal(c.hosting.rewrites,undefined);
 assert.equal(c.hosting.redirects,undefined);
});
test('all staging responses explicitly noindex with safe base headers',async()=>{
 const c=await read('firebase.staging.phase1.json');
 const headers=Object.fromEntries(c.hosting.headers.find(x=>x.source==='**').headers.map(x=>[x.key,x.value]));
 assert.match(headers['X-Robots-Tag'],/^noindex, nofollow, noarchive$/);
 assert.equal(headers['X-Content-Type-Options'],'nosniff');
 assert.equal(headers['Referrer-Policy'],'strict-origin-when-cross-origin');
 assert.match(headers['Permissions-Policy'],/camera=\(\)/);
 const html=c.hosting.headers.find(x=>x.source==='**/*.html');
 assert.ok(html.headers.some(h=>h.key==='Cache-Control'&&h.value.includes('no-cache')));
});
test('production config is separate, indexable and not rewritten by staging',async()=>{
 const c=await read('firebase.launch.json');
 assert.equal(c.hosting.public,'dist');
 assert.equal(c.hosting.target,undefined);
 assert.equal(c.hosting.headers.some(rule=>rule.source==='**'&&rule.headers.some(h=>h.key==='X-Robots-Tag'&&h.value.includes('noindex'))),false);
});
test('staging builder is local-only and changes generated dist not approved source',async()=>{
 const script=await readFile(path.join(root,'scripts/build-phase1-staging.mjs'),'utf8');
 assert.match(script,/scripts\/build-phase1\.mjs/);
 assert.match(script,/Disallow: \/(?:\\n)?/);
 assert.match(script,/noindex,nofollow,noarchive/);
 assert.match(script,/dist/);
 assert.doesNotMatch(script,/firebase deploy|firebase hosting:|https:\/\//);
});
