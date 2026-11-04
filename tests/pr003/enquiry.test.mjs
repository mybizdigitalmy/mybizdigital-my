import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {validatePayload,verifyChallenge,originAllowed,ipKey,acceptEnquiry,processOne,deliverOne,retryPending,buildMail,MAX_FILE} from '../../functions/src/enquiry-core.mjs';

const values = () => ({
  source_context:'mybizdigital_contact_v1',client_submission_id:randomUUID(),
  full_name:'Test User', email:'test@example.invalid', enquiry_type:'website',
  message:'A genuine example enquiry message for testing.', 'bot-field':''
});
const request = () => ({fields:values(),files:{},turnstileToken:'synthetic-token'});
const fakePng=Buffer.from('89504e470d0a1a0a00000000','hex');
const attach=() => ({name:'example.png',data:fakePng.toString('base64')});
const snap = data => ({exists:!!data,data:()=>structuredClone(data)});
function nestedSet(target,path,value){
  const keys=path.split('.');let o=target;
  for(const k of keys.slice(0,-1))o=o[k]??={};
  o[keys.at(-1)]=structuredClone(value);
}
function makeDb(){
  const docs=new Map();let waiting=Promise.resolve();
  function doc(path){return {
    path, get:async()=>snap(docs.get(path)),
    create:async data=>{if(docs.has(path))throw Error('already exists');docs.set(path,structuredClone(data));},
    update:async updates=>{const d=docs.get(path);if(!d)throw Error('missing');for(const [k,v] of Object.entries(updates))nestedSet(d,k,v);},
    set:async data=>docs.set(path,structuredClone(data))
  }}
  const db={docs,
    collection:name=>({doc:id=>doc(name+'/'+id),where:(key,op,value)=>({limit:()=>({get:async()=>({docs:Array.from(docs.entries()).filter(([k,d])=>k.startsWith(name+'/') && d[key]===value).map(([key,d])=>({id:key.split('/')[1],data:()=>structuredClone(d)}))})})})}),
    runTransaction:async fn=>{let release;const previous=waiting;waiting=new Promise(r=>release=r);await previous;try{
      const tx={get:d=>d.get(),set:(d,val)=>docs.set(d.path,structuredClone(val)),update:(d,u)=>{const v=docs.get(d.path);for(const [k,val] of Object.entries(u))nestedSet(v,k,val)}};
      return await fn(tx);
    }finally{release();}}
  };return db;
}
function harness(extra={}) {
  const db=makeDb(),files=new Map(),emails=[],now=()=>new Date('2026-11-04T04:00:00.000Z');
  const ctx={db,ip:'203.0.113.2',now,rateSecret:'development-rate-secret',turnstileSecret:'development-turnstile-secret',allowedHosts:['localhost'],
    fetchFn:async()=>({ok:true,json:async()=>({success:true,action:'mbd_enquiry',hostname:'localhost'})}),
    sender:'MyBizDigital <notifications@notify.mybizdigital.my>',
    storage:{save:async(path,b)=>{files.set(path,Buffer.from(b));},remove:async path=>{files.delete(path);}},
    rateLimit:async()=>{}, sendMail:async(payload,key)=>{emails.push({payload,key});},
    deliver:async id=>deliverOne(id,ctx)
  };
  return {ctx,db,files,emails};
}

test('accepts valid enquiry data without an attachment',()=>{
  const x=validatePayload(request());assert.match(x.id,/^[a-f0-9]{64}$/);assert.equal(x.values.enquiry_type,'website');
});
test('refuses missing name, invalid email, short message, and invalid enquiry type',()=>{
  for(const [k,value] of [['full_name',''],['email','bad'],['message','tiny'],['enquiry_type','admin']]){
    const x=request();x.fields[k]=value;assert.throws(()=>validatePayload(x),/required fields/);
  }
});
test('rejects unexpected parameters and bot honeypot content',()=>{
  const x=request();x.fields.admin=true;assert.throws(()=>validatePayload(x),/Unexpected/);
  const y=request();y.fields['bot-field']='Hello';assert.throws(()=>validatePayload(y),/Invalid form/);
});
test('requires UUIDv4, fixed context and a challenge',()=>{
  const x=request();x.fields.client_submission_id='guess';assert.throws(()=>validatePayload(x),/identifier/);
  const y=request();y.fields.source_context='another_site';assert.throws(()=>validatePayload(y),/Invalid form/);
  const z=request();z.turnstileToken='';assert.throws(()=>validatePayload(z),/spam/);
});
test('accepts expected PNG signature and quarantines metadata on storage',async()=>{
  const x=request();x.files.logo_file=attach();const h=harness();const receipt=await acceptEnquiry(x,h.ctx);
  assert.equal(receipt.ok,true); assert.equal(h.files.size,1);
  const doc=Array.from(h.db.docs.values()).find(x=>x.status==='received');assert.equal(doc.attachments[0].quarantined,true);
  assert.match(doc.attachments[0].path,/^quarantine\/enquiries\//);
});
test('rejects spoofed types, malformed base64 and over-limit files',()=>{
  const x=request();x.files.logo_file={name:'wrong.png',data:Buffer.from('evil').toString('base64')};assert.throws(()=>validatePayload(x),/does not match/);
  const y=request();y.files.brief_file={name:'case.pdf',data:'a$'};assert.throws(()=>validatePayload(y),/encoding/);
  const z=request();z.files.logo_file={name:'large.png',data:Buffer.alloc(MAX_FILE+1,1).toString('base64')};assert.throws(()=>validatePayload(z),/limits|encoding/);
});
test('rejects DOCX with non-ZIP content and unsupported formats',()=>{
  const a=request();a.files.brief_file={name:'invoice.docx',data:Buffer.from('fake').toString('base64')};assert.throws(()=>validatePayload(a),/does not match/);
  const b=request();b.files.logo_file={name:'code.svg',data:Buffer.from('<svg>').toString('base64')};assert.throws(()=>validatePayload(b),/Unsupported/);
});
test('validates supported quantity and reference URL',()=>{
  const x=request();x.fields.nfc_quantity='-2';assert.throws(()=>validatePayload(x),/quantity/);
  const y=request();y.fields.reference_website='javascript:alert(1)';assert.throws(()=>validatePayload(y),/URL/);
});
test('rejects invalid, replayed and wrong-host CAPTCHA',async()=>{
  for(const body of [{success:false},{success:true,hostname:'evil.example',action:'mbd_enquiry'},{success:true,hostname:'localhost',action:'other'}]){
    await assert.rejects(()=>verifyChallenge({token:'x',secret:'s',allowedHosts:['localhost'],fetchFn:async()=>({ok:true,json:async()=>body})}),/retry/);
  }
});
test('fails closed on CAPTCHA transport failure or missing secrets',async()=>{
  await assert.rejects(()=>verifyChallenge({token:'x',secret:'',allowedHosts:['localhost']}),/unavailable/);
  await assert.rejects(()=>verifyChallenge({token:'x',secret:'s',allowedHosts:['localhost'],fetchFn:async()=>{throw Error('network');}}),/unavailable/);
});
test('allows configured exact origins only',()=>{
  assert.equal(originAllowed('https://mybizdigital-staging.web.app',['https://mybizdigital-staging.web.app']),true);
  assert.equal(originAllowed('https://mybizdigital-staging.web.app.evil.com',['https://mybizdigital-staging.web.app']),false);
  assert.equal(originAllowed('https://other.example',['https://mybizdigital-staging.web.app']),false);
  assert.equal(originAllowed('http://localhost:5000',['http://localhost:5000']),true);
});
test('IP limiter keys are not raw IP and rotate hourly',()=>{
  const a=ipKey('203.0.113.2','secret',new Date('2026-11-04T04:00:00Z'));
  const b=ipKey('203.0.113.2','secret',new Date('2026-11-04T05:00:00Z'));
  assert.notEqual(a,b);assert.ok(!a.includes('203.0.113'));
});
test('a repeated exact submission returns same receipt without creating another email',async()=>{
  const h=harness(),input=request();const first=await acceptEnquiry(input,h.ctx);
  const second=await acceptEnquiry(input,h.ctx);
  assert.equal(first.receipt,second.receipt); assert.equal(second.duplicate,true);assert.equal(h.emails.length,2);
});
test('UUID reuse with changed payload is rejected',async()=>{
  const h=harness(),input=request();await acceptEnquiry(input,h.ctx);
  input.fields.message='A different message at least 10 characters.';
  await assert.rejects(()=>acceptEnquiry(input,h.ctx),/identifier already used/);
});
test('rate limit rejects before CAPTCHA storage',async()=>{
  const h=harness(),input=request();h.ctx.rateLimit=async()=>{throw Object.assign(Error('limited'),{status:429})};
  await assert.rejects(()=>acceptEnquiry(input,h.ctx),/limited/);assert.equal(h.db.docs.size,0);
});
test('storage failure cannot return a false positive receipt',async()=>{
  const h=harness(),input=request();input.files.logo_file=attach();h.ctx.storage.save=async()=>{throw Error('storage failure')};
  await assert.rejects(()=>acceptEnquiry(input,h.ctx),/could not save/);
  assert.equal(Array.from(h.db.docs.values()).filter(d=>d.status==='received').length,0);
});
test('mail-provider failure records pending state while accepting saved enquiry',async()=>{
  const h=harness();h.ctx.sendMail=async()=>{throw Error('resend down');};
  const x=await acceptEnquiry(request(),h.ctx);
  assert.equal(x.ok,true);
  const d=Array.from(h.db.docs.values()).find(x=>x.status==='received');
  assert.equal(d.delivery.owner.status,'pending');assert.equal(d.delivery.customer.status,'pending');
});
test('retry worker resends pending mail once with provider idempotency keys',async()=>{
  const h=harness();let failed=true;h.ctx.sendMail=async(p,key)=>{if(failed)throw Error('down');h.emails.push({p,key});};
  await acceptEnquiry(request(),h.ctx);failed=false;
  h.ctx.now=()=>new Date('2026-11-04T04:10:00Z');
  await retryPending(h.ctx);
  assert.equal(h.emails.length,2);
  assert.ok(h.emails[0].key.startsWith('mbd-enquiry-'));
  await retryPending(h.ctx);assert.equal(h.emails.length,2);
});
test('existing in-flight lease suppresses duplicate notifications',async()=>{
  const h=harness();h.ctx.sendMail=async()=>{throw Error('down')};const req=request();await acceptEnquiry(req,h.ctx);
  const d=Array.from(h.db.docs.values()).find(x=>x.status==='received');d.delivery.owner={status:'sending',attempts:1,leaseUntil:'2026-11-04T04:01:00Z'};
  const res=await processOne(Array.from(h.db.docs.entries()).find(([k,d])=>k.startsWith('enquiries/'))[0].split('/')[1],'owner',h.ctx);
  assert.equal(res,false);
});
test('email templates escape attacker input and do not include direct attachment links',()=>{
  const m=buildMail('owner','f'.repeat(64),{fields:{...values(),full_name:'<img src=x onerror=alert(1)>'},attachments:[]},'MyBizDigital <notifications@notify.mybizdigital.my>');
  assert.ok(!m.html.includes('<img'));assert.ok(m.html.includes('&lt;img'));
});