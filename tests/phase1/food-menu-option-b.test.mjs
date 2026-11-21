/** PHASE1-004 — exercise exact production message/handoff code, no external providers. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../../scripts/phase1-site.js', import.meta.url)), 'utf8');
const from = src.indexOf('  const WHATSAPP_URL_SAFETY_LIMIT = 1800;');
const until = src.indexOf("  document.addEventListener('click', event => {", from);
assert.ok(from > 0 && until > from, 'Option B source not found');
const realFunctions = src.slice(from, until);
const clickStart = src.indexOf("    if (event.target.closest('[data-phase1-whatsapp]') && active) {", until);
const clickEnd = src.indexOf('    const imageButton =', clickStart);
assert.ok(clickStart > until && clickEnd > clickStart, 'WhatsApp click handler not found');
const realClick = src.slice(clickStart, clickEnd);
const product = {id:'food',name:'Food Menu NFC Stand'};

function fixture({mode='order',business='',tableUrls={},menuUrl='',quantity=1}={}) {
  const messages=[];const opened=[];const notice=[];const elements={};let clipboardSuccess=true;
  const status={hidden:true, children:[],replaceChildren(){this.children=[];},append(...nodes){this.children.push(...nodes);}};
  const inputs = {'#mbd-business':{value:business},'#mbd-url':{value:menuUrl}};
  for(let i=0;i<10;i++)inputs[`#mbd-table-${i}`]={value:tableUrls[i]||''};
  const content={querySelector(selector){
    if(selector==='input[name="mbd-food-mode"]:checked')return {value:mode};
    if(selector==='#mbd-phase1-transfer-status')return status;
    return inputs[selector]??null;
  }};
  const document={createElement(tag){
    const node={tag,value:'',textContent:'',attributes:{},events:{},append(...kids){this.children=(this.children||[]).concat(kids)},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,cb){this.events[k]=cb},focus(){this.focused=true},select(){this.selected=true}};
    elements[tag]=(elements[tag]||[]).concat(node);
    return node;
  }};
  const ctx={URL, content, document, navigator:{clipboard:{async writeText(message){if(!clipboardSuccess)throw Error('denied');messages.push(message);}}},
    NUMBER:'601128194900',quantity,standardEnquiry:p=>`Hello MyBizDigital, I'm interested in your ${p}. Please share more information and ordering details.`,
    url:msg=>`https://wa.me/601128194900?text=${encodeURIComponent(msg)}`,
    openWhatsApp:msg=>opened.push(msg)};
  vm.createContext(ctx);
  vm.runInContext(realFunctions + `\nfunction simulateWhatsAppClick(event,active){${realClick}}`, ctx);
  return {
    ctx, status, messages, opened, notice, elements,
    make: (p=product, includeConfig=true)=>ctx.messageFor(p,includeConfig),
    click: (p=product)=>ctx.simulateWhatsAppClick({target:{closest:sel=>sel==='[data-phase1-whatsapp]'?{}:null}},p),
    clipboardFail:()=>{clipboardSuccess=false;}
  };
}

test('Option A remains unchanged; its shared HTTPS menu URL appears once',()=>{
 const f=fixture({mode:'view',menuUrl:'https://example.com/menu?category=drinks',business:'Cafe'});
 const msg=f.make();
 assert.match(msg,/Setup: Option A — View Menu Only \(one shared menu link\)/);
 assert.match(msg,/Reference URL: https:\/\/example.com\/menu\?category=drinks/);
 assert.match(msg,/Business name: Cafe/);
 assert.doesNotMatch(msg,/Table 01:/);
});

test('Option B: empty optional fields produce no invented table links',()=>{
 const f=fixture();const msg=f.make();
 assert.match(msg,/Food Menu NFC Stand — Option B/);
 assert.match(msg,/Price: RM800 per 10-stand bundle\./);
 assert.match(msg,/Package: 1 bundle of 10 NFC stands\./);
 assert.doesNotMatch(msg,/Table \d\d:/);
 assert.doesNotMatch(msg,/Business:/);
});

test('Option B: partial fields keep correct table numbers and order',()=>{
 const f=fixture({tableUrls:{0:'https://example.com/table01',8:'http://example.net/table09'},business:'Example Restaurant'});
 const msg=f.make();
 assert.match(msg,/Business: Example Restaurant/);
 assert.ok(msg.indexOf('Table 01: https://example.com/table01') < msg.indexOf('Table 09: http://example.net/table09'));
 assert.doesNotMatch(msg,/Table 02:/);
 assert.doesNotMatch(msg,/Table 10:/);
});

test('Option B: ten entries are included losslessly in numbered order',()=>{
 const links=Object.fromEntries(Array.from({length:10},(_,i)=>[i,`https://example.com/table${String(i+1).padStart(2,'0')}?a=1&b=${i}`]));
 const f=fixture({tableUrls:links,business:'Example Restaurant'});
 const msg=f.make();
 const matches=[...msg.matchAll(/^Table (\d{2}): (.+)$/gm)];
 assert.equal(matches.length,10);
 for(let i=0;i<10;i++){assert.equal(matches[i][1],String(i+1).padStart(2,'0'));assert.equal(matches[i][2],links[i]);}
 assert.doesNotMatch(msg,/links prepared:|details can be supplied/);
});

test('Option B: HTTP and HTTPS accepted; unsafe or malformed URLs visibly rejected',()=>{
 for(const url of ['ftp://example.com/x','javascript:alert(1)','not-a-url','https://','https://user:password@example.com/t','https://example.com/bad path']){
  const f=fixture({tableUrls:{2:url}});
  assert.equal(f.make(),null,`must reject ${url}`);
  assert.equal(f.status.hidden,false);
  assert.match(f.status.children[0].textContent,/Table 03.*invalid URL/i);
  f.click();assert.equal(f.opened.length,0,'invalid URL must not open WhatsApp');
 }
});

test('Option B: short completed draft opens WhatsApp only on user click and offers copy fallback',()=>{
 const f=fixture({tableUrls:{0:'https://example.com/t1'}});
 assert.equal(f.opened.length,0);
 f.click();
 assert.equal(f.opened.length,1);
 assert.match(f.opened[0],/Table 01: https:\/\/example.com\/t1/);
 assert.equal(f.status.hidden,false);
 assert.ok(f.status.children.some(x=>x.tag==='textarea'&&x.value===f.opened[0]));
});

test('Option B: long draft is complete, never sent via a risky long URL, can be copied',async()=>{
 const links=Object.fromEntries(Array.from({length:10},(_,i)=>[i,`https://example.com/table${i+1}?token=${'a'.repeat(520)}&index=${i}`]));
 const f=fixture({tableUrls:links});
 f.click();
 assert.equal(f.opened.length,0,'long draft must not be opened as possibly truncated URL');
 const box=f.status.children.find(x=>x.tag==='textarea');
 assert.ok(box,'lossless draft textarea exists');
 assert.equal([...box.value.matchAll(/^Table \d\d:/gm)].length,10);
 for(let i=0;i<10;i++)assert.ok(box.value.includes(links[i]),`full URL ${i+1} preserved`);
 assert.ok(box.value.length > 5200);
 const copy=f.status.children.find(x=>x.tag==='button');
 assert.equal(copy.textContent,'Copy complete message');
 await copy.events.click();
 assert.deepEqual(f.messages,[box.value]);
 const handoff=f.status.children.find(x=>x.tag==='a');
 assert.equal(handoff.href,'https://wa.me/601128194900');
 assert.equal(handoff.target,'_blank');
});

test('Option B: clipboard denial leaves complete message selectable for manual copying',async()=>{
 const f=fixture({tableUrls:{0:'https://example.com/order'}});
 f.click();f.clipboardFail();
 const copy=f.status.children.find(x=>x.tag==='button');
 const draft=f.status.children.find(x=>x.tag==='textarea');
 await copy.events.click();
 assert.equal(draft.focused,true);assert.equal(draft.selected,true);
 assert.match(f.status.children.at(-1).textContent,/manually/);
});

test('other product enquiry remains unchanged',()=>{
 const f=fixture({business:'Salon',menuUrl:'https://instagram.com/salon',quantity:3});
 const msg=f.make({id:'instagram',name:'Instagram NFC Stand'});
 assert.match(msg,/Instagram NFC Stand/);
 assert.match(msg,/Quantity of NFC stands: 3/);
 assert.match(msg,/Business name: Salon/);
 assert.match(msg,/Reference URL: https:\/\/instagram.com\/salon/);
 assert.doesNotMatch(msg,/Option B|Table \d\d:/);
});

test('Option B table input has no silent maxlength clipping; Option A maxlength unchanged',()=>{
 assert.match(src,/id="mbd-table-\$\{i\}" type="url" placeholder="https:\/\/restaurant.com\/order\/\.\.\."/);
 assert.doesNotMatch(src,/id="mbd-table-\$\{i\}" type="url"[^>]*maxlength=/);
 assert.match(src,/Optional shared menu URL <input id="mbd-url" type="url"[^>]*maxlength="500"/);
});
