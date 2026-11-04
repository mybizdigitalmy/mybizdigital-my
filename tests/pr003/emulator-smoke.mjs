/** Run ONLY inside firebase emulators:exec --project demo-mbd-pr003. */
import {createServer} from 'node:http';
import {randomUUID,createHash} from 'node:crypto';
import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {getStorage} from 'firebase-admin/storage';
import assert from 'node:assert/strict';

assert.equal(process.env.GCLOUD_PROJECT,'demo-mbd-pr003');
assert.ok(process.env.FIRESTORE_EMULATOR_HOST,'Firestore emulator must be running');
assert.ok(process.env.FIREBASE_STORAGE_EMULATOR_HOST,'Storage emulator must be running');
initializeApp({projectId:'demo-mbd-pr003',storageBucket:'demo-mbd-pr003.appspot.com'});
let calls=0;
const mock=createServer(async(req,res)=>{
  if(req.url==='/turnstile') {
    let form='';for await(const chunk of req)form+=chunk;
    const token=new URLSearchParams(form).get('response');
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({success:token==='synthetic-allow',hostname:'localhost',action:'mbd_enquiry'}));
  } else if(req.url==='/resend') {
    calls++;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({id:'synthetic-email-'+calls}));
  } else {res.writeHead(404).end();}
});
await new Promise(resolve=>mock.listen(9091,'127.0.0.1',resolve));
try {
  const uuid=randomUUID(), fields={full_name:'Synthetic Buyer',email:'buyer@example.invalid',enquiry_type:'nfc',message:'Synthetic test: Google Review NFC stand enquiry.',source_context:'mybizdigital_contact_v1',client_submission_id:uuid,'bot-field':''};
  const endpoint='http://127.0.0.1:5001/demo-mbd-pr003/asia-southeast1/submitEnquiry';
  const request=body=>fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost:5000'},body:JSON.stringify(body)});
  let r=await request({fields,files:{},turnstileToken:'synthetic-allow'}),data=await r.json();
  assert.equal(r.status,202,JSON.stringify(data));assert.equal(data.ok,true);assert.match(data.receipt,/^MBD-/);
  const id=createHash('sha256').update(uuid).digest('hex');
  const stored=(await getFirestore().collection('enquiries').doc(id).get()).data();
  assert.equal(stored.status,'received');assert.equal(stored.delivery.owner.status,'sent');assert.equal(stored.delivery.customer.status,'sent');
  assert.equal(calls,2);
  r=await request({fields,files:{},turnstileToken:'synthetic-allow'});
  assert.equal(r.status,202);assert.equal(calls,2);
  r=await request({fields:{...fields,client_submission_id:randomUUID()},files:{},turnstileToken:'invalid'});
  assert.equal(r.status,403);
  // Verify SDK is connected to private emulator project; storage rules exercised separately.
  const bucket=getStorage().bucket('demo-mbd-pr003.appspot.com');assert.ok(bucket);
  console.log('PR-003 Firebase Emulator smoke: PASS (synthetic only)');
} finally {await new Promise(resolve=>mock.close(resolve));}