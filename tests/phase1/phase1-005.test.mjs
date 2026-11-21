import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const get = name => readFile(path.join(root,'dist',name),'utf8');
const source = name => readFile(path.join(root,name),'utf8');
// The test runner must use --test-concurrency=1; other legacy files rebuild dist.
test('PHASE1-005: all promotional prices precede their own crossed-out regular price',async()=>{
 const html=await get('index.html');
 const pairs=[...html.matchAll(/<span class="mbd-phase1-price-pair"><span class="product-price">([^<]+)<\/span><del class="mbd-phase1-regular-price">([^<]+)<\/del><\/span>/g)];
 assert.equal(pairs.length,5);
 assert.deepEqual(pairs.map(x=>[x[1],x[2]]),[['RM100','RM111'],['RM100','RM111'],['RM100','RM111'],['RM100','RM111'],['RM800','RM1,111']]);
 assert.ok(html.includes('10 NFC stands per bundle'));
 assert.ok(html.includes('href="#products" id="shop"'));
 assert.ok(!(await source('index.html')).includes('mbd-phase1-price-pair'), 'source HTML must remain unchanged');
});
test('PHASE1-005: product details regular price is subtle and promotional price remains first',async()=>{
 const js=await get('assets/phase1-site.js'), css=await get('assets/phase1-site.css');
 assert.ok(js.includes('<strong>${escapeText(product.price)}</strong><del class="mbd-phase1-regular-price">${food?\'RM1,111\':\'RM111\'}</del>'));
 assert.match(css,/\.mbd-phase1-regular-price\{[^}]*line-through/);
 assert.match(css,/\.mbd-phase1-price-pair/);
 assert.match(js,/RM800 per 10-stand bundle/);
 assert.match(js,/optionBMessage\(product\)/);
 assert.match(js,/Table \$\{String\(table\)\.padStart\(2, '0'\)\}/);
});
test('PHASE1-005: sample review disclosure is explicit and repetitive labels are removed',async()=>{
 const html=await get('index.html');
 assert.match(html,/NFC Experiences in Everyday Business/);
 assert.doesNotMatch(html,/Rated 5\.0 by First-Time Buyers/);
 assert.match(html,/fictional, not verified customer reviews/);
 assert.equal((html.match(/ · Illustrative<\/span>/g)||[]).length,0);
 assert.equal((html.match(/class="mbd-marquee-card"/g)||[]).length,60);
 assert.equal((html.match(/class="mbd-marquee-set"/g)||[]).length,2,'source loop preserved; third set added at runtime');
 assert.doesNotMatch(html,/"aggregateRating"|"reviewCount"/i);
});
test('PHASE1-005: reviews use native scrolling, drag/swipe, keyboard, reduced motion and auto resume',async()=>{
 const js=await get('assets/phase1-site.js'),css=await get('assets/phase1-site.css');
 for(const needle of ['requestAnimationFrame(frame)',"event.key === 'ArrowLeft'", "event.pointerType === 'touch'", "addEventListener('wheel'", "addEventListener('pointermove'", "addEventListener('touchstart'", "prefers-reduced-motion: reduce",'reviewTrack.append(clone)','pausedUntil'])assert.ok(js.includes(needle),needle);
 assert.match(css,/overflow-x:auto!important/);
 assert.match(css,/animation:none!important/);
 assert.match(css,/scrollbar-width:none/);
});
test('PHASE1-005: newsletter remains fail-closed on all nine root pages until verified provider setup',async()=>{
 const pages=['index.html','about.html','business-apps.html','contact.html','order-support.html','privacy-policy.html','product-support.html','terms-and-conditions.html','web-development.html'];
 const settings=JSON.parse(await source('scripts/phase1-newsletter-config.json'));
 assert.deepEqual(settings,{provider:'buttondown',username:'',enabled:false});
 for(const page of pages){
  const html=await get(page);
  assert.match(html,/Newsletter sign-ups are not enabled until our provider is verified\./);
  assert.match(html,/<button type="button" disabled title="Newsletter sign-ups coming soon">Notify me<\/button>/);
  assert.doesNotMatch(html,/action="https:\/\/buttondown\.com/);
  assert.match(html,/href="privacy-policy\.html"/);
  assert.match(html,/New products, straight to your inbox/);
 }
});
test('PHASE1-005: verified provider branch creates a native opt-in with actual POST and explicit consent',async()=>{
 const src=await source('scripts/build-phase1.mjs');
 const match=src.match(/function phase1005Newsletter\(html, settings\) \{[\s\S]*?\n\}/);
 assert.ok(match,'newsletter transform missing');
 const render=new Function('assert',`${match[0]}; return phase1005Newsletter;`)((ok,msg)=>{if(!ok)throw Error(msg)});
 const sample='<div class="mbd-f-newsletter"><div class="mbd-f-subscribe-box"><input disabled><button disabled>Notify me</button></div><span class="mbd-f-subscribe-note">old</span></div>';
 const enabled=render(sample,{enabled:true,username:'mybizdigital'});
 assert.match(enabled,/method="post" action="https:\/\/buttondown\.com\/api\/emails\/embed-subscribe\/mybizdigital"/);
 assert.match(enabled,/name="email"/);
 assert.match(enabled,/type="checkbox" form="mbd-newsletter-form" required/);
 assert.match(enabled,/name="embed" value="1"/);
 assert.match(enabled,/button type="submit"/);
 assert.match(enabled,/double|confirm by email/i);
 assert.doesNotMatch(enabled,/Thank you! You have been subscribed/);
 const off=render(sample,{enabled:false,username:''});
 assert.match(off,/disabled/);
 assert.doesNotMatch(off,/action="https:/);
});
