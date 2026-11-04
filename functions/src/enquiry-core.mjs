/** PR-003 core. No Firebase/network dependencies: adapters are injected for offline tests. */
import {createHash, createHmac, timingSafeEqual} from 'node:crypto';

export const MAX_FILE = 3 * 1024 * 1024;
export const MAX_TOTAL = 6 * 1024 * 1024;
export const MAX_BODY = 9_500_000;
const TYPES = new Set(['nfc', 'website', 'software', 'support', 'general']);
const EXTENSIONS = { logo_file: new Set(['jpg','jpeg','png','webp']), brief_file: new Set(['pdf','docx','jpg','jpeg','png','webp']) };
const FIELD_LIMITS = {full_name:100,email:200,phone:40,company:120,enquiry_type:20,nfc_product:90,nfc_quantity:7,website_industry:100,website_type:100,software_type:120,software_users:120,order_reference:80,support_product:120,estimated_budget:100,project_timeline:100,reference_website:500,message:4000,source_context:50,client_submission_id:70,'bot-field':100};
const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const err = (status, message) => Object.assign(new Error(message), {status});
const sha = input => createHash('sha256').update(input).digest('hex');
const text = (x, max) => { if(typeof x !== 'string' || x.length > max) throw err(400,'Invalid input.'); return x.trim(); };
const match = (buf, sig, pos=0) => Buffer.from(sig,'hex').equals(buf.subarray(pos,pos+sig.length/2));

export function inspectFile(file, field) {
  if(!EXTENSIONS[field] || !file || typeof file !== 'object') throw err(400,'Unexpected attachment.');
  const filename = text(file.name,160).replace(/[\x00-\x1f]/g,'');
  const ext = filename.split('.').pop()?.toLowerCase();
  if(!EXTENSIONS[field].has(ext)) throw err(400,'Unsupported attachment format.');
  if(typeof file.data !== 'string' || file.data.length > Math.ceil(MAX_FILE/3)*4+8 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.data)) throw err(400,'Invalid attachment encoding.');
  const bytes = Buffer.from(file.data,'base64');
  if(!bytes.length || bytes.length > MAX_FILE || bytes.toString('base64') !== file.data) throw err(400,'Attachment exceeds limits or is corrupt.');
  const signatures = {
    jpg: b => match(b,'ffd8ff'), jpeg:b=>match(b,'ffd8ff'),
    png:b=>match(b,'89504e470d0a1a0a'),
    webp:b=>b.length>=12 && b.toString('ascii',0,4)==='RIFF' && b.toString('ascii',8,12)==='WEBP',
    pdf:b=>match(b,'255044462d'),
    docx:b=>match(b,'504b0304')
  };
  if(!signatures[ext](bytes)) throw err(400,'Attachment file content does not match its type.');
  // DOCX and all other attachments stay quarantined. Signature validation is NOT malware scanning.
  const mime = ({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})[ext];
  return {field,ext,mime,size:bytes.length,sha256:sha(bytes),bytes};
}

export function validatePayload(body) {
  if(!body || typeof body!=='object' || Array.isArray(body)) throw err(400,'Invalid enquiry.');
  const keys = Object.keys(body);
  if(keys.some(x=>!['fields','files','turnstileToken'].includes(x))) throw err(400,'Unexpected enquiry fields.');
  const {fields,files={}}=body;
  if(!fields || typeof fields!=='object' || Array.isArray(fields) || !files || typeof files!=='object' || Array.isArray(files)) throw err(400,'Invalid enquiry fields.');
  if(Object.keys(fields).some(x=>!Object.hasOwn(FIELD_LIMITS,x))) throw err(400,'Unexpected enquiry field.');
  const values = Object.fromEntries(Object.entries(FIELD_LIMITS).map(([name,max])=>[name, text(fields[name]??'',max)]));
  if(values.source_context!=='mybizdigital_contact_v1' || values['bot-field']) throw err(400,'Invalid form request.');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(values.client_submission_id)) throw err(400,'Missing submission identifier.');
  if(values.full_name.length<2 || !EMAIL_PATTERN.test(values.email) || !TYPES.has(values.enquiry_type) || values.message.length<10) throw err(400,'Please complete the required fields.');
  if(values.reference_website && !/^https:\/\/[^\s/]+(?:\/[^\s]*)?$/i.test(values.reference_website)) throw err(400,'Invalid reference URL.');
  if(values.nfc_quantity && (!/^\d+$/.test(values.nfc_quantity) || Number(values.nfc_quantity)<1 || Number(values.nfc_quantity)>10000)) throw err(400,'Invalid quantity.');
  if(Object.keys(files).some(x=>!EXTENSIONS[x])) throw err(400,'Unexpected attachment.');
  const attachments = Object.entries(files).filter(([,v])=>v!=null).map(([key,v])=>inspectFile(v,key));
  if(attachments.reduce((n,f)=>n+f.size,0)>MAX_TOTAL) throw err(400,'Combined attachments exceed 6 MB.');
  const turnstileToken = text(body.turnstileToken??'',2048);
  if(!turnstileToken) throw err(400,'Please complete spam verification.');
  const id = sha(values.client_submission_id); // unpredictable receipt key; no PII in path
  const fingerprint = sha(JSON.stringify([values,attachments.map(f=>[f.field,f.sha256,f.size])]));
  return {id, values, attachments, turnstileToken, fingerprint};
}

export async function verifyChallenge({token, secret, allowedHosts, fetchFn=fetch}) {
  if(!secret || !allowedHosts?.length) throw err(503,'Enquiries are temporarily unavailable.');
  const abort = AbortSignal.timeout(4500);
  let response;
  try { response = await fetchFn('https://challenges.cloudflare.com/turnstile/v0/siteverify', {method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({secret,response:token}),signal:abort}); }
  catch { throw err(503,'Spam verification temporarily unavailable.'); }
  if(!response.ok) throw err(503,'Spam verification temporarily unavailable.');
  let result;
  try { result=await response.json(); } catch {throw err(503,'Spam verification temporarily unavailable.');}
  if(!result.success || result.action!=='mbd_enquiry' || !allowedHosts.includes(result.hostname)) throw err(403,'Please retry spam verification.');
}

export function originAllowed(origin, allowedOrigins) {
  try {const x=new URL(origin);return x.protocol==='https:' && allowedOrigins.includes(x.origin) || x.protocol==='http:' && /^localhost$|^127\.0\.0\.1$/.test(x.hostname) && allowedOrigins.includes(x.origin);} catch{return false;}
}
export function ipKey(ip, secret, date=new Date()) {
  if(!secret) throw err(503,'Enquiries temporarily unavailable.');
  const hour=date.toISOString().slice(0,13);
  return createHmac('sha256',secret).update(hour+'\0'+ip).digest('hex');
}

export async function acceptEnquiry(body, ctx) {
  const input = validatePayload(body);
  const ref = ctx.db.collection('enquiries').doc(input.id);
  // A replay with exactly the same data may obtain its reference without consuming another one-time token.
  const prior=await ref.get();
  if(prior.exists) {
    const existing=prior.data();
    if(existing.fingerprint!==input.fingerprint) throw err(409,'Submission identifier already used.');
    if(existing.status==='received') return {ok:true,receipt:'MBD-'+input.id.slice(0,12).toUpperCase(),duplicate:true};
    throw err(503,'Submission is being processed. Please retry later.');
  }
  await ctx.rateLimit(ipKey(ctx.ip,ctx.rateSecret,ctx.now()),5);
  await verifyChallenge({token:input.turnstileToken,secret:ctx.turnstileSecret,allowedHosts:ctx.allowedHosts,fetchFn:ctx.fetchFn});
  const created=ctx.now().toISOString();
  await ref.create({fingerprint:input.fingerprint,status:'receiving',mailPending:false,createdAt:created,fields:input.values,attachments:[],delivery:{owner:{status:'pending',attempts:0},customer:{status:'pending',attempts:0}}});
  const paths=[];
  try {
    const descriptors=[];
    for(const f of input.attachments){
      const path=`quarantine/enquiries/${input.id}/${f.field}.${f.ext}`;
      await ctx.storage.save(path,f.bytes,{contentType:f.mime,cacheControl:'private, no-store',metadata:{quarantine:'true',sha256:f.sha256}});
      paths.push(path);
      descriptors.push({field:f.field,size:f.size,sha256:f.sha256,contentType:f.mime,path,quarantined:true});
    }
    await ref.update({status:'received',mailPending:true,attachments:descriptors,receivedAt:ctx.now().toISOString()});
  } catch(e) {
    // Leave a durable failed state for investigation. No false receipt on storage failure.
    await ref.update({status:'failed',failureCode:'STORAGE_OR_PERSISTENCE_ERROR'}).catch(()=>{});
    await Promise.allSettled(paths.map(p=>ctx.storage.remove(p)));
    throw err(503,'We could not save your enquiry. Please email support@mybizdigital.my.');
  }
  // Email is best-effort immediately and is durably retried by the scheduled worker.
  try {await ctx.deliver(input.id);} catch { /* status stays pending for retry */ }
  return {ok:true,receipt:'MBD-'+input.id.slice(0,12).toUpperCase(),duplicate:false};
}

const safe = s => String(s).replace(/[&<>"']/g, x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
export function buildMail(kind, id, data, sender) {
  const f=data.fields;
  const subject=kind==='owner' ? 'New MyBizDigital enquiry '+id.slice(0,12).toUpperCase() : 'Enquiry received | MyBizDigital';
  const body=kind==='owner' ? `New enquiry received.\nReference: MBD-${id.slice(0,12).toUpperCase()}\nType: ${f.enquiry_type}\nName: ${f.full_name}\nEmail: ${f.email}\nCompany: ${f.company}\nMessage: ${f.message}\nAttachments: ${data.attachments.length} (private/quarantined; do not forward)\n` : `Hello ${f.full_name},\n\nWe have received your enquiry (MBD-${id.slice(0,12).toUpperCase()}). We will review it and reply as soon as possible.\n\nThis is not an order confirmation or quotation.\n\nMYBIZ DIGITAL SOLUTIONS`;
  return {from:sender,to:[kind==='owner'?'support@mybizdigital.my':f.email],reply_to:['support@mybizdigital.my'],subject,text:body,html:`<div style="font:15px/1.6 Arial,sans-serif"><pre style="white-space:pre-wrap;font:inherit">${safe(body)}</pre></div>`};
}

export async function processOne(id,kind,ctx) {
  const ref=ctx.db.collection('enquiries').doc(id);
  const now=ctx.now(),leaseUntil=new Date(now.getTime()+2*60_000).toISOString();
  const claimed=await ctx.db.runTransaction(async tx=>{
    const doc=await tx.get(ref);
    if(!doc.exists || doc.data().status!=='received') return null;
    const data=doc.data(),state=data.delivery?.[kind];
    if(!state || state.status==='sent' || state.status==='needs_review' || state.attempts>=5) return null;
    if(new Date(data.createdAt).getTime() < now.getTime()-20*3600_000) {
      tx.update(ref,{[`delivery.${kind}.status`]:'needs_review'});return null;
    }
    if(state.status==='sending' && new Date(state.leaseUntil||0).getTime()>now.getTime())return null;
    if(state.nextAt && new Date(state.nextAt).getTime()>now.getTime())return null;
    tx.update(ref,{[`delivery.${kind}`]:{status:'sending',attempts:state.attempts+1,leaseUntil,nextAt:null}});
    return data;
  });
  if(!claimed)return false;
  try {
    const mail=buildMail(kind,id,claimed,ctx.sender);
    await ctx.sendMail(mail,`mbd-enquiry-${id}-${kind}`);
    await ref.update({[`delivery.${kind}.status`]:'sent',[`delivery.${kind}.sentAt`]:ctx.now().toISOString(),[`delivery.${kind}.leaseUntil`]:null});
  } catch {
    // Never log PII/secrets; let bounded scheduler retries or manual intervention recover.
    const d=await ref.get(),a=d.data()?.delivery?.[kind]?.attempts??5;
    const retryAt=new Date(ctx.now().getTime()+Math.min(60,2**a)*60_000).toISOString();
    await ref.update({[`delivery.${kind}.status`]:a>=5?'needs_review':'pending',[`delivery.${kind}.nextAt`]:retryAt,[`delivery.${kind}.leaseUntil`]:null});
  }
  return true;
}
export async function deliverOne(id,ctx){
  await processOne(id,'owner',ctx);await processOne(id,'customer',ctx);
  const ref=ctx.db.collection('enquiries').doc(id);
  await ctx.db.runTransaction(async tx=>{
    const snap=await tx.get(ref),d=snap.data();
    if(!d || d.status!=='received')return;
    if(['owner','customer'].every(k=>['sent','needs_review'].includes(d.delivery?.[k]?.status)))
      tx.update(ref,{mailPending:false});
  });
}

export async function retryPending(ctx){
  const docs=await ctx.db.collection('enquiries').where('mailPending','==',true).limit(100).get();
  for(const doc of docs.docs){
    const d=doc.data();
    if(['owner','customer'].some(k=>['pending','sending'].includes(d.delivery?.[k]?.status))){
      await deliverOne(doc.id,ctx);
    }
  }
}
export {err};