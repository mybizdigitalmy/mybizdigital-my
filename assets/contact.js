/* MyBizDigital contact form: one static Netlify form on contact.html, reused for the popup. */
(()=>{
  'use strict';
  const ALLOWED = new Set(['nfc','website','software','support','general']);
  const MAX_FILE = 3 * 1024 * 1024;
  const MAX_FILES_COMBINED = 6 * 1024 * 1024;
  const ACCEPTED = {
    logo_file:['jpg','jpeg','png','webp'],
    brief_file:['pdf','docx','jpg','jpeg','png','webp']
  };
  const canUseDialog = typeof HTMLDialogElement !== 'undefined' && typeof HTMLDialogElement.prototype.showModal === 'function';
  let dialogPromise;
  let lastTrigger = null;
  let configPromise, turnstilePromise;
  const challengeIds = new WeakMap();
  function configuration(){
    if(!configPromise)configPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='assets/enquiry-public-config.js';
      script.async=true;
      script.onload=()=>{
        const c=window.MBD_ENQUIRY_PUBLIC_CONFIG;
        if(c?.endpoint!=='/api/enquiry'||!/^[-_A-Za-z0-9]{20,100}$/.test(c?.turnstileSiteKey||''))return reject(Error('Enquiry is not configured'));
        resolve(c);
      };
      script.onerror=()=>reject(Error('Configuration unavailable'));
      document.head.appendChild(script);
    });
    return configPromise;
  }
  function turnstileLibrary(){
    if(window.turnstile)return Promise.resolve(window.turnstile);
    if(!turnstilePromise)turnstilePromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async=true; script.defer=true;
      script.onload=()=>window.turnstile?resolve(window.turnstile):reject(Error('Challenge unavailable'));
      script.onerror=()=>reject(Error('Challenge unavailable'));
      document.head.appendChild(script);
    });
    return turnstilePromise;
  }
  async function prepareChallenge(form){
    const c=await configuration();
    const ts=await turnstileLibrary();
    if(challengeIds.has(form))return c;
    const mount=document.createElement('div');
    mount.className='mbd-contact-wide';
    mount.setAttribute('aria-label','Spam verification');
    form.querySelector('.mbd-contact-error')?.before(mount);
    const id=ts.render(mount,{sitekey:c.turnstileSiteKey,action:'mbd_enquiry',theme:'auto'});
    challengeIds.set(form,id);
    return c;
  }
  function resetChallenge(form){
    const id=challengeIds.get(form);
    if(id!==undefined && window.turnstile)window.turnstile.reset(id);
  }
  async function encodeFile(file){
    const bytes=new Uint8Array(await file.arrayBuffer());
    let binary='';
    for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
    return {name:file.name,data:btoa(binary)};
  }
  async function makeRequest(form){
    const config=await prepareChallenge(form);
    const token=window.turnstile?.getResponse(challengeIds.get(form))||'';
    if(!token)throw Error('Complete spam verification before submitting.');
    const formData=new FormData(form);
    const fields={};
    const files={};
    for(const [key,value] of formData.entries()){
      if(value instanceof File){if(value.size)files[key]=await encodeFile(value);}
      else fields[key]=String(value);
    }
    return {endpoint:config.endpoint, body:{fields,files,turnstileToken:token}};
  }

  function updateConditions(form){
    const type=form.elements.enquiry_type.value;
    form.querySelectorAll('[data-enquiry-for]').forEach(group=>{
      const enabled=group.dataset.enquiryFor.split(/\s+/).includes(type);
      group.hidden=!enabled;
      group.querySelectorAll('input,select,textarea').forEach(input=>{input.disabled=!enabled});
    });
  }
  function error(form,message){
    const box=form.querySelector('.mbd-contact-error');
    box.textContent=message;
    box.hidden=!message;
    if(message){box.scrollIntoView({block:'nearest',behavior:'instant'});box.focus?.()}
  }
  function validateFiles(form){
    let size=0;
    for(const name of Object.keys(ACCEPTED)){
      const file=form.elements[name]?.files?.[0];
      if(!file)continue;
      size+=file.size;
      const extension=file.name.split('.').pop()?.toLowerCase() || '';
      if(!ACCEPTED[name].includes(extension))return 'Unsupported file type. Please upload PDF, DOCX, JPG, PNG or WebP files as appropriate.';
      if(file.size>MAX_FILE)return 'Each attachment must be 3 MB or smaller.';
    }
    if(size>MAX_FILES_COMBINED)return 'The total attachments must be 6 MB or smaller.';
    return '';
  }
  function createId(){
    if(window.crypto?.randomUUID)return window.crypto.randomUUID();
    return 'mbd-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  }
  function finish(form,receipt){
    const confirmation=document.createElement('section');
    confirmation.className='mbd-contact-success';
    confirmation.setAttribute('role','status');
    confirmation.setAttribute('tabindex','-1');
    confirmation.innerHTML='<h3>Enquiry Received</h3><p>Your enquiry has been securely recorded. Our team will review it and reply as soon as possible. A separate acknowledgement email may follow; email delivery is not guaranteed.</p>';
    // Never imply email delivery or an order was confirmed merely from an HTTP response.
    const line=document.createElement('p'); line.textContent='Reference: '+receipt; confirmation.append(line);
    form.replaceWith(confirmation);
    confirmation.focus();
  }
  function initForm(form){
    if(form.dataset.mbdReady)return;
    form.dataset.mbdReady='true';
    const input=form.elements.enquiry_type;
    input?.addEventListener('change',()=>updateConditions(form));
    updateConditions(form);
    // Missing public configuration fails closed; staging guard remains authoritative until activation.
    prepareChallenge(form).catch(()=>{});
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      if(!form.reportValidity())return;
      const issue=validateFiles(form);
      if(issue){error(form,issue);return}
      error(form,'');
      const btn=form.querySelector('[type="submit"]');
      const original=btn.textContent;
      btn.disabled=true;
      btn.textContent='Submitting…';
      try{
        if(!form.elements.client_submission_id.value)form.elements.client_submission_id.value=createId();
        const request=await makeRequest(form);
        const response=await fetch(request.endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(request.body),cache:'no-store'});
        const result=await response.json().catch(()=>({}));
        if(response.status!==202 || result.ok!==true || !/^MBD-[A-F0-9]{12}$/.test(result.receipt||''))throw Error(result.error||'Enquiry service unavailable.');
        finish(form,result.receipt);
      }catch(e){
        resetChallenge(form);
        error(form,'Your enquiry could not be submitted. '+(e.message==='Complete spam verification before submitting.'?e.message:'Please try again or email support@mybizdigital.my directly.'));
        btn.disabled=false;
        btn.textContent=original;
      }
    });
  }
  function chooseType(form,type){
    if(!ALLOWED.has(type))return;
    const input=form.elements.enquiry_type;
    if(input){input.value=type;updateConditions(form)}
  }
  async function getDialog(){
    if(!canUseDialog)throw new Error('Dialog not available');
    if(dialogPromise)return dialogPromise;
    dialogPromise=(async()=>{
      const response=await fetch('contact.html',{headers:{Accept:'text/html'}});
      if(!response.ok)throw new Error('Contact page unavailable');
      const html=await response.text();
      const doc=new DOMParser().parseFromString(html,'text/html');
      const original=doc.querySelector('#mbd-contact-form');
      if(!original)throw new Error('Contact form template unavailable');
      const dialog=document.createElement('dialog');
      dialog.className='mbd-contact-dialog';
      dialog.setAttribute('aria-labelledby','mbd-dialog-title');
      const inner=document.createElement('div');
      inner.className='mbd-contact-dialog-inner';
      inner.innerHTML='<div class="mbd-contact-dialog-top"><h2 class="mbd-contact-dialog-heading" id="mbd-dialog-title">Tell us about your project.</h2><button type="button" class="mbd-contact-dialog-close" aria-label="Close enquiry form">×</button></div><p class="mbd-contact-dialog-sub">Share your requirements with MyBizDigital. Fields marked * are required.</p>';
      const form=document.importNode(original,true);
      form.id='mbd-contact-form-modal';
      inner.append(form);
      dialog.append(inner);
      document.body.append(dialog);
      dialog.querySelector('.mbd-contact-dialog-close').addEventListener('click',()=>dialog.close());
      dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
      dialog.addEventListener('close',()=>lastTrigger?.focus());
      initForm(form);
      return dialog;
    })().catch(e=>{dialogPromise=null;throw e});
    return dialogPromise;
  }
  function start(){
    const dedicated=document.querySelector('form[name="mybiz-enquiry"]');
    if(dedicated){
      initForm(dedicated);
      const requested=new URLSearchParams(location.search).get('enquiry');
      chooseType(dedicated,requested);
    }
    document.addEventListener('click',async e=>{
      const anchor=e.target.closest?.('a[data-mbd-enquiry]');
      if(!anchor || e.button!==0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)return;
      if(!canUseDialog)return; // Accessible fallback is the dedicated page.
      e.preventDefault();
      lastTrigger=anchor;
      try{
        const dialog=await getDialog();
        const old=dialog.querySelector('.mbd-contact-success');
        const active=old ? (dialog.remove(),dialogPromise=null,await getDialog()) : dialog;
        chooseType(active.querySelector('form'),anchor.dataset.mbdEnquiry);
        active.showModal();
        active.querySelector('form [name="full_name"]')?.focus();
      }catch(error){location.href=anchor.href}
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();