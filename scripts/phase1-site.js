/* PHASE1-001 — static, enquiry-only UI. No backend, account, cart, checkout or storage. */
(() => {
  'use strict';
  const NUMBER = '601128194900';
  const url = message => `https://wa.me/${NUMBER}?text=${encodeURIComponent(message)}`;
  const escapeText = text => String(text ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const icon = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 11.5a8.5 8.5 0 0 1-12.4 7.6L3.5 20.5l1.4-4.5a8.5 8.5 0 1 1 15.6-4.5Z"/><path d="M8.6 8.1c.4-.4.7-.2 1 .4l.7 1.3c.2.4.1.6-.2.9l-.5.5c.7 1.5 1.8 2.6 3.3 3.2l.6-.6c.3-.3.5-.4.9-.2l1.3.7c.7.4.8.7.4 1.1-.8 1-1.8 1.2-3.1.7-2.6-.9-4.8-3.2-5.6-5.7-.4-1.1-.2-1.9 1.2-2.3Z"/></svg>';
  const openWhatsApp = message => {
    const target = url(message);
    // User-triggered only. Customers review and manually send their message.
    const opened = window.open(target, '_blank', 'noopener,noreferrer');
    // No background submission and no fallback that silently navigates away.
    return opened;
  };
  const standardEnquiry = product => `Hello MyBizDigital, I'm interested in your ${product}. Please share more information and ordering details.`;

  // Direct legacy commerce/account hash paths must never recreate the old workflow.
  if (/^#(?:cart|checkout|login|signup)$/i.test(location.hash)) {
    history.replaceState(null, '', location.pathname + location.search + (document.getElementById('products') ? '#products' : ''));
  }

  // Minimal floating link. Hidden when the footer enters view or mobile menu opens.
  const float = document.createElement('a');
  float.className = 'mbd-phase1-whatsapp-float';
  float.href = url('Hello MyBizDigital, I would like to enquire about your products and services.');
  float.target = '_blank';
  float.rel = 'noopener noreferrer';
  float.setAttribute('aria-label', 'Chat with MyBizDigital on WhatsApp');
  float.innerHTML = icon + '<span>WhatsApp</span>';
  document.body.append(float);
  const footer = document.getElementById('mbd-site-footer');
  let footerVisible = false;
  const syncFloat = () => { float.hidden = footerVisible || !!document.querySelector('.site-header.menu-open'); };
  if (footer && 'IntersectionObserver' in window) {
    new IntersectionObserver(entries => { footerVisible = !!entries[0]?.isIntersecting; syncFloat(); }).observe(footer);
  }
  document.querySelector('.mobile-toggle')?.addEventListener('click', () => requestAnimationFrame(syncFloat));
  const header = document.querySelector('.site-header');
  if (header && 'MutationObserver' in window) new MutationObserver(syncFloat).observe(header, {attributes:true, attributeFilter:['class']});

  const cards = [...document.querySelectorAll('#products .product-card')];
  if (!cards.length) return;
  const ids = ['google','facebook','instagram','tiktok','food'];
  if (cards.length !== ids.length) throw Error('PHASE1-001: unexpected catalogue size');
  const products = cards.map((card, i) => {
    const name = card.querySelector('.product-name')?.textContent.trim();
    const price = card.querySelector('.product-price')?.textContent.trim();
    const description = card.querySelector('.product-benefit')?.textContent.trim();
    const images = [...card.querySelectorAll('[data-product-slide]')].map(node => {
      const img = node.querySelector('img');
      return {view:node.dataset.view,src:img?.getAttribute('src'),alt:img?.alt};
    }).filter(x => x.src);
    if (!name || !price || !images.length) throw Error('PHASE1-001: incomplete product data: ' + ids[i]);
    return {id:ids[i],name,price,description,images};
  });
  const byId = Object.fromEntries(products.map(product => [product.id, product]));

  // Existing product cards, images, text, prices and carousel markup remain unchanged.
  cards.forEach((card, index) => {
    const p = products[index];
    const row = card.querySelector('.product-buy-row');
    const oldView = row?.querySelector('.product-view-link');
    if (!row || !oldView) throw Error('PHASE1-001: product card template changed');
    oldView.remove();
    const controls = document.createElement('div');
    controls.className = 'mbd-card-actions';
    controls.innerHTML = `<button type="button" class="mbd-card-cta mbd-card-cta--outline" data-mbd-phase1-details="${p.id}" aria-label="View ${escapeText(p.name)} details">View Details</button><button type="button" class="mbd-card-cta" data-mbd-phase1-enquire="${p.id}" aria-label="Enquire about ${escapeText(p.name)} on WhatsApp">Enquire on WhatsApp</button>`;
    row.append(controls);
  });

  // Reuse the original product-modal style hooks and actual product images.
  const overlay = document.createElement('div');
  overlay.className = 'mbd-commerce-root mbd-phase1-product-root';
  overlay.dataset.mode = 'product';
  overlay.hidden = true;
  overlay.innerHTML = '<div class="mbd-commerce-backdrop" data-phase1-close="true"></div><div class="mbd-commerce-dialog" role="dialog" aria-modal="true" aria-labelledby="mbd-dialog-title" tabindex="-1"><div class="mbd-dialog-head"><div><p class="mbd-modal-kicker">MYBIZDIGITAL.MY</p><h2 id="mbd-dialog-title">Product details</h2></div><button type="button" class="mbd-icon-button" data-phase1-close="true" aria-label="Close product details">×</button></div><div class="mbd-dialog-scroll" id="mbd-dialog-content"></div></div>';
  document.body.append(overlay);
  const modal = overlay.querySelector('.mbd-commerce-dialog');
  const content = overlay.querySelector('#mbd-dialog-content');
  let active = null, previousFocus = null, quantity = 1, imageIndex = 0;
  function currentImages() {
    const images = active?.images.filter(image => /^(Front|Left|Back|Right)$/i.test(image.view));
    return images?.length ? images : active?.images || [];
  }
  function setImage(index) {
    const images = currentImages();
    if (!images.length) return;
    imageIndex = Math.max(0, Math.min(index, images.length - 1));
    const image = images[imageIndex];
    const display = content.querySelector('#mbd-detail-image');
    if (display) { display.src = image.src; display.alt = image.alt || active.name; }
    content.querySelectorAll('[data-phase1-image]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.phase1Image) === imageIndex)));
  }
  function renderFoodFields() {
    const holder = content.querySelector('#mbd-food-fields');
    if (!holder) return;
    const selected = content.querySelector('input[name="mbd-food-mode"]:checked')?.value || 'view';
    holder.innerHTML = selected === 'view'
      ? '<label class="mbd-phase1-field">Optional shared menu URL <input id="mbd-url" type="url" placeholder="https://restaurant.com/menu" maxlength="500"></label>'
      : '<p class="mbd-field-tip">Option B uses ten table-specific ordering URLs supplied by your existing ordering platform. You can share them in WhatsApp.</p><div class="mbd-table-grid">' + Array.from({length:10},(_,i) => `<label class="mbd-phase1-field">Table ${String(i+1).padStart(2,'0')} link (optional)<input id="mbd-table-${i}" type="url" placeholder="https://restaurant.com/order/..." maxlength="500"></label>`).join('') + '</div>';
  }
  function openDetails(id) {
    const product = byId[id];
    if (!product) return;
    active = product; quantity = 1; imageIndex = 0;
    previousFocus = document.activeElement;
    const images = product.images.filter(x=>/^(Front|Left|Back|Right)$/i.test(x.view));
    const gallery = images.length ? images : product.images;
    const food = id === 'food';
    const productArt = `<div class="mbd-product-art"><div class="mbd-product-image"><img id="mbd-detail-image" src="${escapeText(gallery[0].src)}" alt="${escapeText(gallery[0].alt || product.name)}"></div><div class="mbd-gallery-tabs" aria-label="Product image views">${gallery.map((img,i) => `<button type="button" data-phase1-image="${i}" aria-pressed="${i===0}">${escapeText(img.view)}</button>`).join('')}</div></div>`;
    const foodMode = '<div class="mbd-phase1-food-modes" role="group" aria-label="Food Menu setup option"><label><input type="radio" name="mbd-food-mode" value="view" checked> Option A — View Menu Only</label><label><input type="radio" name="mbd-food-mode" value="order"> Option B — Tap to Order by Table</label></div><div id="mbd-food-fields"></div>';
    const controls = food ? '<span class="mbd-bundle-lock">1 bundle · 10 stands</span>' : '<div class="mbd-qty-control"><button type="button" data-phase1-qty="minus" aria-label="Decrease quantity">−</button><output id="mbd-quantity">1</output><button type="button" data-phase1-qty="plus" aria-label="Increase quantity">+</button></div>';
    content.innerHTML = `<div class="mbd-product-layout">${productArt}<div class="mbd-product-config"><h2 class="mbd-config-title">${escapeText(product.name)}</h2><p class="mbd-config-description">${escapeText(product.description)}</p><div class="mbd-price-row"><strong>${escapeText(product.price)}</strong><span>${food?'per 10-stand bundle':'per NFC stand'}</span></div><div class="mbd-config-box"><h3>Enquire about this NFC stand</h3><p class="mbd-help-copy">Explore the options below. No order, checkout or payment is submitted by this website.</p><label class="mbd-phase1-field">Business / profile name (optional) <input id="mbd-business" type="text" maxlength="100" autocomplete="off" placeholder="Your business name"></label>${food?foodMode:'<label class="mbd-phase1-field">Profile / destination link (optional) <input id="mbd-url" type="url" maxlength="500" placeholder="https://example.com"></label>'}</div><div class="mbd-config-quantity"><div><strong style="font-size:13px">${food?'Bundle quantity':'Quantity'}</strong><div style="font-size:11px;color:#797b82;margin-top:4px">${food?'One bundle = 10 NFC stands':'Per NFC stand'}</div></div>${controls}</div><div class="mbd-config-actions"><button type="button" class="mbd-cta mbd-cta--secondary" data-phase1-close="true">Back</button><button type="button" class="mbd-cta" data-phase1-whatsapp="true">Enquire on WhatsApp</button></div><p class="mbd-phase1-disclaimer">WhatsApp opens a draft message. You choose whether to send it; this website does not collect your details.</p></div></div>`;
    if (food) renderFoodFields();
    overlay.hidden = false;
    document.body.classList.add('mbd-commerce-locked');
    modal.focus({preventScroll:true});
  }
  function closeDetails() {
    overlay.hidden = true; active = null; document.body.classList.remove('mbd-commerce-locked');
    if (previousFocus?.isConnected) previousFocus.focus({preventScroll:true});
  }
  function messageFor(product, includeConfig=false) {
    const food = product.id === 'food';
    let message = standardEnquiry(food ? `${product.name} (RM800 per 10-stand bundle)` : product.name);
    if (food) message += '\nPackage: 1 bundle of 10 NFC stands.';
    if (includeConfig) {
      if (!food && quantity > 1) message += `\nQuantity of NFC stands: ${quantity}.`;
      if (food) {
        const type = content.querySelector('input[name="mbd-food-mode"]:checked')?.value;
        message += type === 'order' ? '\nSetup: Option B — Tap to Order by Table (10 table-specific links).' : '\nSetup: Option A — View Menu Only (one shared menu link).';
        if (type === 'order') {
          const count = [...content.querySelectorAll('[id^="mbd-table-"]')].filter(el => el.value.trim()).length;
          if (count) message += `\nTable-specific links prepared: ${count} of 10 (details can be supplied in WhatsApp).`;
        }
      }
      const business = content.querySelector('#mbd-business')?.value.trim();
      if (business) message += `\nBusiness name: ${business.slice(0,100)}.`;
      const raw = content.querySelector('#mbd-url')?.value.trim();
      if (raw) {
        try { const parsed = new URL(raw); if (parsed.protocol === 'https:' && parsed.hostname.includes('.')) message += `\nReference URL: ${parsed.href.slice(0,500)}`; }
        catch { /* An optional invalid link is omitted, never silently submitted. */ }
      }
    }
    return message;
  }
  document.addEventListener('click', event => {
    const details = event.target.closest?.('[data-mbd-phase1-details]');
    if (details) { event.preventDefault(); openDetails(details.dataset.mbdPhase1Details); return; }
    const enquire = event.target.closest?.('[data-mbd-phase1-enquire]');
    if (enquire) { event.preventDefault(); const product=byId[enquire.dataset.mbdPhase1Enquire]; if(product)openWhatsApp(messageFor(product)); return; }
    const view = event.target.closest?.('#products .product-view-link');
    if (view) { event.preventDefault(); const card = view.closest('.product-card'); const i = cards.indexOf(card); if(i>=0) openDetails(products[i].id); }
  });
  overlay.addEventListener('click', event => {
    if (event.target.closest('[data-phase1-close]')) { closeDetails(); return; }
    if (event.target.closest('[data-phase1-whatsapp]') && active) { openWhatsApp(messageFor(active,true)); return; }
    const imageButton = event.target.closest('[data-phase1-image]');
    if (imageButton) { setImage(Number(imageButton.dataset.phase1Image)); return; }
    const q = event.target.closest('[data-phase1-qty]');
    if (q && active?.id !== 'food') {
      quantity = Math.min(100,Math.max(1,quantity + (q.dataset.phase1Qty==='plus'?1:-1)));
      const display = content.querySelector('#mbd-quantity'); if(display) display.textContent = String(quantity);
    }
  });
  overlay.addEventListener('change', event => { if (event.target.name==='mbd-food-mode') renderFoodFields(); });
  overlay.querySelector('.mbd-commerce-backdrop')?.addEventListener('click', closeDetails);
  document.addEventListener('keydown', event => {
    if (overlay.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); closeDetails(); return; }
    if (event.key !== 'Tab') return;
    const all = [...overlay.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),[tabindex="0"]')].filter(el=>el.getClientRects().length);
    if (!all.length) return;
    if (event.shiftKey && document.activeElement===all[0]) { event.preventDefault(); all.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement===all.at(-1)) { event.preventDefault(); all[0].focus(); }
  });
  if (/^#product-/.test(location.hash)) {
    const id = location.hash.replace('#product-', '');
    if (byId[id]) openDetails(id);
  }
  window.addEventListener('hashchange', () => {
    if (/^#product-/.test(location.hash)) {
      const id=location.hash.replace('#product-', '');
      if (byId[id]) openDetails(id);
    }
    if (/^#(?:cart|checkout|login|signup)$/i.test(location.hash)) history.replaceState(null,'',location.pathname+location.search+'#products');
  });
})();
