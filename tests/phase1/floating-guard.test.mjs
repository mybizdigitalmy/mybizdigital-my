import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));
const source=readFileSync(path.join(root,'scripts/phase1-site.js'),'utf8');
const start=source.indexOf('  const productSection = document.getElementById(\'products\');');
const end=source.indexOf("  if (footer && 'IntersectionObserver' in window)",start);
assert.ok(start>=0 && end>start,'audited floating visibility logic must remain available');
const fragment=source.slice(start,end);
function simulate(width, height=800){
 const float={hidden:false};
 let rectangle={top:1500,bottom:2100};
 let mobileOpen=false, dialogOpen=false;
 const section={getBoundingClientRect:()=>rectangle};
 const document={
  getElementById:id=>id==='products'?section:null,
  querySelector:selector=>selector==='.site-header.menu-open'?(mobileOpen?{}:null):selector==='.mbd-phase1-product-root:not([hidden])'?(dialogOpen?{}:null):null
 };
 const window={innerHeight:height,innerWidth:width,addEventListener(){}};
 const api=runInNewContext(`let footerVisible=false;${fragment}\n({syncFloat,setFooter(v){footerVisible=v}})`,{document,window,float});
 return {float,api,setRect:(top,bottom)=>rectangle={top,bottom},setMobile:v=>mobileOpen=v,setDialog:v=>dialogOpen=v};
}
for(const width of [320,390,768,1024,1440]){
 test(`${width}px floating button hides while product section is visible and restores after`,()=>{
  const x=simulate(width);
  for(const [top,bottom] of [[100,900],[-600,30],[700,1200]]){
   x.setRect(top,bottom);x.api.syncFloat();assert.equal(x.float.hidden,true,`overlap risk at ${top},${bottom}`);
  }
  x.setRect(-1200,-1);x.api.syncFloat();assert.equal(x.float.hidden,false);
  x.setRect(801,1500);x.api.syncFloat();assert.equal(x.float.hidden,false);
 });
}
test('floating button stays hidden with mobile menu, product modal and footer',()=>{
 const x=simulate(390);
 x.setMobile(true);x.api.syncFloat();assert.equal(x.float.hidden,true);
 x.setMobile(false);x.setDialog(true);x.api.syncFloat();assert.equal(x.float.hidden,true);
 x.setDialog(false);x.api.setFooter(true);x.api.syncFloat();assert.equal(x.float.hidden,true);
 x.api.setFooter(false);x.api.syncFloat();assert.equal(x.float.hidden,false);
});
test('dialog open/close calls floating visibility sync, without changing approved card styling',()=>{
 assert.match(source,/overlay\.hidden = false;\s*syncFloat\(\)/);
 assert.match(source,/overlay\.hidden = true;\s*syncFloat\(\)/);
 assert.doesNotMatch(fragment,/innerHTML|style\.|classList\.add|classList\.remove/);
});
