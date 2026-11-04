/** PR-003 staging-only candidate: NO CLOUD RESOURCE WAS CREATED/DEPLOYED. */
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import {acceptEnquiry, deliverOne, retryPending, MAX_BODY, originAllowed, err} from './src/enquiry-core.mjs';

if(!getApps().length) initializeApp();
const db=getFirestore();
const turnstileSecret=defineSecret('ENQUIRY_TURNSTILE_SECRET');
const resendKey=defineSecret('ENQUIRY_RESEND_API_KEY');
const rateKey=defineSecret('ENQUIRY_RATE_SECRET');
const common={region:'asia-southeast1', memory:'512MiB', maxInstances:2, timeoutSeconds:45};
const allowedOrigins=()=> (process.env.ENQUIRY_ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
const allowedHosts=()=> (process.env.ENQUIRY_TURNSTILE_HOSTS||'').split(',').map(x=>x.trim()).filter(Boolean);
const now=()=>new Date();
function emulatorOverride(value) {
  if(process.env.FUNCTIONS_EMULATOR==='true' && (process.env.GCLOUD_PROJECT||'').startsWith('demo-')) return process.env[value];
  return undefined;
}
function secretValue(name, param){
  if(process.env.FUNCTIONS_EMULATOR==='true' && (process.env.GCLOUD_PROJECT||'').startsWith('demo-'))
    return process.env['PR003_TEST_'+name] || param.value();
  return param.value();
}
function emailSender() {
  const s=process.env.ENQUIRY_MAIL_FROM||'';
  if(!/^MyBizDigital <[A-Za-z0-9._-]+@notify\.mybizdigital\.my>$/.test(s)) throw err(503,'Email service is not configured.');
  return s;
}
async function sendMail(payload,key) {
  const token=secretValue('RESEND_API_KEY',resendKey);
  if(!token) throw err(503,'Email is not configured.');
  const endpoint=emulatorOverride('PR003_TEST_RESEND_URL')||'https://api.resend.com/emails';
  const r=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(payload),signal:AbortSignal.timeout(6000)});
  if(!r.ok) throw err(503,'Email delivery pending.');
}
function ctx(ip) {
  const bucketName=process.env.ENQUIRY_STORAGE_BUCKET||'';
  if(!/^[a-z0-9][a-z0-9.\-]{2,200}$/i.test(bucketName)) throw err(503,'Storage not configured.');
  const bucket=getStorage().bucket(bucketName);
  return {
    db,ip,now,allowedHosts:allowedHosts(),turnstileSecret:secretValue('TURNSTILE_SECRET',turnstileSecret),rateSecret:secretValue('RATE_SECRET',rateKey),sender:emailSender(),sendMail,
    storage:{
      save:async(path,bytes,meta)=>bucket.file(path).save(bytes,{resumable:false,validation:'crc32c',metadata:{contentType:meta.contentType,cacheControl:meta.cacheControl,metadata:meta.metadata}}),
      remove:async path=>bucket.file(path).delete({ignoreNotFound:true})
    },
    rateLimit:async(key,limit)=>{
      const ref=db.collection('enquiryRateLimits').doc(key);
      await db.runTransaction(async tx=>{
        const snap=await tx.get(ref);const count=(snap.exists?snap.data().count:0)||0;
        if(count>=limit)throw err(429,'Too many enquiries. Please try later or email support@mybizdigital.my.');
        tx.set(ref,{count:count+1,updatedAt:now().toISOString(),expireAt:new Date(now().getTime()+2*3600_000)});
      });
    },
    fetchFn:async(url,opts)=>fetch(emulatorOverride('PR003_TEST_TURNSTILE_URL')||url,opts),
    deliver:async id=>deliverOne(id,{db,now,sender:emailSender(),sendMail})
  };
}
export const submitEnquiry=onRequest({...common,concurrency:4,invoker:'public',secrets:[turnstileSecret,resendKey,rateKey]},async(req,res)=>{
  res.set('Cache-Control','no-store');res.set('X-Content-Type-Options','nosniff');
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Method not allowed.'});
  if(!originAllowed(req.get('Origin')||'',allowedOrigins()))return res.status(403).json({ok:false,error:'Origin not allowed.'});
  if(!/^application\/json(?:;\s*charset=utf-8)?$/i.test(req.get('Content-Type')||''))return res.status(415).json({ok:false,error:'JSON required.'});
  if((req.rawBody?.length||0)>MAX_BODY || Number(req.get('Content-Length')||0)>MAX_BODY)return res.status(413).json({ok:false,error:'Enquiry exceeds upload limit.'});
  try {
    const body=typeof req.body==='object' && !Array.isArray(req.body) ? req.body : JSON.parse(req.rawBody.toString('utf8'));
    const result=await acceptEnquiry(body,ctx(req.ip||'unknown'));
    return res.status(202).json(result);
  } catch(e) {
    const status=Number.isInteger(e.status)&&e.status>=400&&e.status<600?e.status:503;
    // Never echo internal exceptions, PII, provider keys or file names.
    return res.status(status).json({ok:false,error:e.status?e.message:'Enquiry service unavailable. Please email support@mybizdigital.my.'});
  }
});
export const retryEnquiryMail=onSchedule({...common,schedule:'every 15 minutes',timeZone:'Asia/Kuala_Lumpur',secrets:[resendKey]},async()=>{
  try {await retryPending({db,now,sender:emailSender(),sendMail});}
  catch {console.error('Enquiry notification retry failed without disclosing customer data');}
});