# PHASE1-001 — WhatsApp-first static business website (CODE ONLY)

**Date:** 19 November 2026 (MYT). **Release status:** NOT DEPLOYED; NO merge, DNS, billing or cloud changes.

## Source and decision authority

- Repo: `mybizdigitalmy/mybizdigital-my`.
- New branch: `feature/phase1-whatsapp-static`, based **exactly** on LAUNCH-01 `e8236d374e7a7752f2a2d1e66a708bd6e6ce129b`.
- LAUNCH-01 is a direct two-commit descendant of owner-approved DESIGN-001 `902febc2ebd1759a16266d2b0325e56c9a7bef46`.
- Production `main` remains `0676254bd385e868b3410c7939a229f478414c73` on Netlify.
- PR-002 (Auth), PR-003 (secure enquiry backend), Firebase foundation and approved premium design branches remain unchanged and unmerged.

## Implementation (only additive source files)

Run `node scripts/build-phase1.mjs` from repository root.

1. Run original LAUNCH-01 `scripts/build-launch.mjs` to copy only the nine root HTML pages and approved `assets`, `demos`, `apps` into `dist/`, create production `robots.txt`/`sitemap.xml`, canonical tags, and disable unsupported Netlify Forms.
2. Apply **generated-output-only** Phase 1 changes. The original `index.html`, `contact.html`, styles, all product art and demos remain byte-for-byte untouched in Git.
3. Remove visible shopping cart, Login, Sign Up and mobile account-action markup from nine root output pages. Retain Products | Services | How It Works | FAQ | Contact navigation, including the original Shop NFC Stands `#products` destination.
4. Replace LAUNCH-01's still-present legacy `mbd-purchase-js-v193` script in generated `index.html` with the isolated `assets/phase1-site.js`. This **removes**, rather than hides, all old add-to-cart, localStorage cart, checkout, shipping and payment-preview code from the public homepage.
5. On the existing NFC cards, replace the old purchasing actions with `View Details` and `Enquire on WhatsApp`. The details dialog retains original price, description and images and offers optional quantity and Food Menu Option A/B fields, including 10 optional table URLs for review in WhatsApp (not silently uploaded). Food Menu remains a **RM800 bundle of 10**.
6. Convert `Request Business Quote` to a prefilled WhatsApp conversation. Replace LAUNCH-01's contact email fallback with **WhatsApp primary**, `support@mybizdigital.my` mailto secondary, keeping the contact page shell. No active form, success confirmation or unsupported network request.
7. Add small CSS and one JS for an accessible floating WhatsApp link (hidden while footer is visible or mobile menu is open). Use ordinary `https://wa.me/601128194900?text=` URLs and `encodeURIComponent`; no Business API, chatbot, database or external chat widget.
8. Remove the retired cart counter asset from the generated public output. Remove unsupported online `Offer`/`InStock` structured-data assertions from the generated homepage only. Retain title, descriptions, canonicals, headings and other approved SEO content.

### Original source retention

Both `ASSET_MANIFEST.json` and `IMAGE_CHANGE_MANIFEST.json` stay in the repository. The Phase 1 build copies demo and application assets byte-for-byte. Cart/auth/PR-002/PR-003 code stays available on its respective branches and in the unmodified original website source for future Phase 2 work.

## Local tests and evidence

Commands:

```
node --check scripts/build-phase1.mjs
node --check scripts/phase1-site.js
node --test tests/phase1/phase1.test.mjs
node scripts/build-phase1.mjs
```

Local tests on source fixture **main at `0676254` plus exact LAUNCH-01 builder**: **11/11 Node tests PASS**, covering preserved URLs, 40 HTML routes, 15 website demos, 16 app demos, public-file allowlist, assets, all five NFC entries, WhatsApp, contact and non-transactional safety. The exact remote LAUNCH-01 branch additionally includes DESIGN-001 demo refinements; its three additional public assets are handled by the count-independent regression test. The new branch must be tested again on a clean checkout before cloud staging approval.

Chromium's network/file navigation is blocked by this execution environment (`ERR_BLOCKED_BY_ADMINISTRATOR`). Browser interactions were tested in **isolated `page.set_content` fixtures**, injecting local styles/scripts without network access. On 1440, 390 and 320px widths, 5 product enquiry drafts, product modal/gallery, quantity, Food Menu Option B, closed-modal behavior and no horizontal overflow were verified; no page exceptions. Contact primary WhatsApp and secondary email were verified in a 390px fixture. These are **NOT** end-to-end HTTP/production visual parity tests; original approved DESIGN-001 comparisons require authorized browser QA on the real build.

## Remaining QA and release gates

- Run `node scripts/build-phase1.mjs` and Node/browser tests from **clean exact LAUNCH-01** branch content, including approved DESIGN-001 files; compare all 15 demos and 16 apps at desktop/tablet/mobile.
- Verify mobile navigation/dropdowns, carousel/hero/media/animations and footer in a true local HTTP browser environment or authorized staging. The isolated fixture does not prove real navigation/asset-loading end to end.
- Perform real-device WhatsApp Click-to-Chat opening checks (Android/iOS/desktop) and confirm no message sends before the customer clicks Send. Confirm the actual WhatsApp catalogue price differences separately with the owner; website product prices were not changed.
- Review Contact/legal/privacy and 5-year warranty claims for Phase 1; validate Search Console, caching, CSP, security headers, 404 and SEO/GEO/AEO on the built candidate.
- Check *separate* Firebase production project identity and Spark plan, approved DNS plan, exact HTTPS/canonical redirects, rollback and Netlify cutover.
- Do **not** deploy or enable Firestore, Functions, Auth, HitPay, storage, Blaze or any payments as part of this milestone.

**Next proposed milestone:** PHASE1-002 — isolated Firebase staging test and full desktop/mobile/live-device QA (separate owner authorization required).
