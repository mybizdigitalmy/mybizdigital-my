/** PHASE1-001: public build and preservation checks; synthetic/offline only. */
import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const dist = path.join(root, 'dist');
const pages = ['index.html','about.html','business-apps.html','contact.html','order-support.html','privacy-policy.html','product-support.html','terms-and-conditions.html','web-development.html'];
const text = p => readFile(path.join(dist,p),'utf8');
async function files(dir,prefix='') {
 const output=[];
 for(const item of await readdir(dir,{withFileTypes:true})){
  const relative=path.posix.join(prefix,item.name);
  output.push(...(item.isDirectory()?await files(path.join(dir,item.name),relative):[relative]));
 }
 return output.sort();
}
before(()=>execFileSync(process.execPath,['scripts/build-phase1.mjs'],{cwd:root,stdio:'pipe'}));
test('40 routes, 15 design demos, 16 business-app demos preserved',async()=>{
 const list=await files(dist);
 assert.equal(list.filter(f=>f.endsWith('.html')).length,40);
 assert.equal(list.filter(f=>/^demos\/[^/]+\/index\.html$/.test(f)).length,15);
 assert.equal(list.filter(f=>/^apps\/[^/]+\/index\.html$/.test(f)).length,16);
 const copied = pages.length + (await files(path.join(root,'assets'))).length + (await files(path.join(root,'demos'))).length + (await files(path.join(root,'apps'))).length;
 assert.equal(list.length,copied+3,'LAUNCH-01 copy plus robots/sitemap/two scoped assets minus retired cart badge');
});
test('every demo and app asset copied byte-for-byte from the current branch source',async()=>{
 for(const name of (await files(dist)).filter(f=>/^(demos|apps)\//.test(f))){
  assert.deepEqual(await readFile(path.join(dist,name)),await readFile(path.join(root,name)),name);
 }
});
test('approved original homepage/contact/visual assets are never overwritten by release builder',async()=>{
 const home=await readFile(path.join(root,'index.html'),'utf8');
 const contact=await readFile(path.join(root,'contact.html'),'utf8');
 assert.match(home,/id="mbd-purchase-js-v193"/);
 assert.match(home,/>Add to Cart</);
 assert.match(contact,/data-netlify="true"/);
 assert.match(await readFile(path.join(root,'ASSET_MANIFEST.json'),'utf8'),/assets/);
 assert.match(await readFile(path.join(root,'IMAGE_CHANGE_MANIFEST.json'),'utf8'),/assets/);
});
test('all nine published root pages keep approved primary navigation and remove account/cart controls',async()=>{
 for(const page of pages){
  const h=await text(page);
  for(const key of (page==='about.html' ? ['Products','How It Works','FAQ','Contact'] : ['Products','Services','How It Works','FAQ','Contact']))assert.ok(h.includes(key),`${page}: ${key}`);
  assert.doesNotMatch(h,/<a[^>]+class="cart-button"|class="nav-login"|class="btn btn-primary nav-signup"|class="mobile-actions"/);
  assert.doesNotMatch(h,/href="(?:index\.html)?#(?:login|signup|cart|checkout)"/);
  assert.doesNotMatch(h,/src="assets\/cart-nav-count\.js"/);
  assert.match(h,/assets\/phase1-site\.js/);
  assert.match(h,/assets\/phase1-site\.css/);
  assert.match(h,/id="mbd-site-footer"/);
 }
});
test('Shop NFC retains exact approved destination and other homepage design/media remain',async()=>{
 const home=await text('index.html');
 assert.match(home,/href="#products" id="shop">Shop NFC Stands<\/a>/);
 assert.equal((home.match(/data-product-card=""/g)||[]).length,5);
 for(const price of ['RM100','RM800</span><del class="mbd-phase1-regular-price">RM1,111'])assert.ok(home.includes(price),price);
 assert.match(home,/data-carousel-viewport/);
 assert.match(home,/id="how-it-works"/);
 assert.match(home,/id="faq"/);
});
test('quote, contact, and floating WhatsApp use verified number and safe encoded drafts',async()=>{
 const home=await text('index.html'),contact=await text('contact.html');
 assert.match(home,/id="quote"/);assert.match(home,/https:\/\/wa\.me\/601128194900\?text=/);
 assert.match(contact,/https:\/\/wa\.me\/601128194900\?text=/);
 assert.match(contact,/mailto:support@mybizdigital\.my/);
 const js=await text('assets/phase1-site.js');
 assert.match(js,/encodeURIComponent\(message\)/);
 assert.match(js,/wa\.me\/\$\{NUMBER\}/);
 assert.match(js,/aria-label', 'Chat with MyBizDigital on WhatsApp'/);
 assert.match(js,/IntersectionObserver/);
});
test('published home contains no transactional script or browser order/cart workflow',async()=>{
 const home=await text('index.html'),contact=await text('contact.html');
 for(const forbidden of ['mbd-purchase-js-v193','mybizdigital_v191_cart','function openCheckout(', 'data-mbd-checkout', 'Add to Cart','Continue to Checkout','data-mbd-card="buy"'])assert.ok(!home.includes(forbidden),forbidden);
 assert.doesNotMatch(contact,/<form\b|data-netlify="true"/);
 assert.doesNotMatch(await text('assets/contact.js'),/fetch\(|FormData|formSubmitted/);
 assert.ok(!(await files(dist)).includes('assets/cart-nav-count.js'));
});
test('Product schema no longer claims unverified stocks or live online checkout',async()=>{
 const home=await text('index.html');
 const schemas=[...home.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match=>JSON.parse(match[1]));
 const products=schemas.filter(x=>x['@type']==='Product');
 assert.ok(products.length>0);
 for(const product of products)assert.equal(product.offers,undefined);
});
test('Production sitemap and robots stay indexable; demos still noindex',async()=>{
 assert.match(await text('robots.txt'),/Allow: \//);
 assert.doesNotMatch(await text('robots.txt'),/Disallow: \//);
 assert.equal(((await text('sitemap.xml')).match(/<loc>/g)||[]).length,9);
 assert.doesNotMatch((await text('index.html')).slice(0,3000),/noindex/);
});
test('published root pages, demo links and media references all resolve locally',async()=>{
 const known=new Set(await files(dist));let count=0;
 for(const file of [...known].filter(x=>x.endsWith('.html'))){
  const h=await text(file);
  for(const m of h.matchAll(/\b(?:href|src|poster)\s*=\s*["']([^"']+)["']/gi)){
   const url=m[1].replaceAll('&amp;','&').trim();
   if(!url||url.startsWith('#')||/^(?:[a-z][\w+.-]*:|\/\/)/i.test(url)||url.includes('${'))continue;
   let local=url.split(/[?#]/)[0];
   try{local=decodeURIComponent(local);}catch{assert.fail(file+': bad encoding '+url);}
   local=local.startsWith('/')?local.slice(1):path.posix.join(path.posix.dirname(file),local);
   local=path.posix.normalize(local);
   assert.ok(!local.startsWith('../'),file+': relative escape '+url);
   if(!path.posix.extname(local))local+=(local.endsWith('/')?'':'/')+'index.html';
   assert.ok(known.has(local),file+': missing '+local);
   count++;
  }
 }
 assert.ok(count>=500,'Expected broad local HTML link coverage, found '+count);
});
test('generated public output excludes repository metadata, secrets, build configs and backend code',async()=>{
 const forbidden=/^(?:\.git\/|\.env(?:\..*)?|\.firebaserc$|firebase(?:\.launch)?\.json$|scripts\/|tests\/|functions\/|netlify\/|docs\/|ASSET_MANIFEST\.json$|IMAGE_CHANGE_MANIFEST\.json$|node_modules\/)/;
 for(const file of await files(dist)){
  assert.ok(!forbidden.test(file),'private asset: '+file);
  assert.ok(!file.split('/').some(x=>x.startsWith('.')),'dotfile in public: '+file);
  assert.ok(!/\.(?:key|pem|bak|zip|sql|map|mjs|md|json)$/i.test(file),'sensitive file type: '+file);
 }
});
