# PHASE1-002B — Floating CTA Guard and Firebase Staging Safety (CODE ONLY)

**Date:** 20 November 2026 (MYT). **Approval:** targeted fixes and local QA only. **No cloud deployment, DNS, Netlify, billing, PR merge, commercial copy or Phase 2 activation.**

## Source authority and rollback

- Parent milestone: `feature/phase1-whatsapp-static` at `7e0b33c6af14caac56e5698191cb7ab26f00fa16`, which is based on LAUNCH-01 `e8236d374e7a7752f2a2d1e66a708bd6e6ce129b` and inherits DESIGN-001 `902febc2ebd1759a16266d2b0325e56c9a7bef46`.
- Preserve that pre-remediation commit as the rollback reference. Branch changes must be additive and limited to Phase 1 UI, staging config, staging builder, tests, and this note.
- PR-002 and PR-003 remain untouched. No changes to original homepage, contact page, demos, media, pricing, product images, manifest files or production Firebase configuration.

## UI-001 — Fixed WhatsApp button obstruction

- Existing pill is intentionally hidden while footer or mobile menu is visible. It previously remained visible during product-card scrolling and product modal state.
- Added a simple view-state check: when the entire `#products` region has any visible intersection with viewport, or a Phase 1 product modal/mobile menu/footer is visible, hide the floating pill. Other hero/service areas retain floating CTA. The product enquiry buttons are always available in the catalogue.
- Use passive scroll/resize handlers and `getBoundingClientRect()`; no new dependency, no card CSS/layout changes. Explicitly refresh hidden state when a product dialog opens/closes.
- Unit tests exercise 320, 390, 768, 1024 and 1440px simulated viewports, multiple vertical scroll ranges, mobile-menu state, modal state, footer, and restoration. Real browser layout testing of the *exact* GitHub revision remains a separate acceptance requirement.

## STAGE-001 — Staging only

- `.firebaserc` contains ONLY project alias `staging: mybizdigital-staging` and PR-001 confirmed local site mapping `staging-site → mybizdigital-staging`. This is local configuration based on owner/PR-001 record, NOT proof of live cloud identity or current Hosting release.
- `firebase.staging.phase1.json` contains **only** a `hosting` key; `target: staging-site`, `public: dist`, global `X-Robots-Tag: noindex, nofollow, noarchive`, original safe base headers and HTML cache policy; no Functions, Auth, Database, Cloud Storage or payment configuration. The existing `firebase.launch.json` stays unchanged and indexable for the future production release.
- `scripts/build-phase1-staging.mjs` validates project and target mappings, reuses the existing Phase 1 release builder, injects staging-only `<meta name="robots" content="noindex,nofollow,noarchive">` into all 40 HTML pages, writes `robots.txt` with `Disallow: /`, removes staging sitemap, and modifies only generated `dist/`. The staging configuration's `hosting.predeploy` also calls this guard, avoiding accidental indexable staging uploads.
- These robots/metadata controls are indexing deterrents, not access control. Staging URLs may remain publicly accessible; do not put customer/private data there. Header behavior must still be tested after separately authorized staging deploy.
- The intended *future* staging command, requiring explicit authorization, is `firebase deploy --project mybizdigital-staging --config firebase.staging.phase1.json --only hosting:staging-site`. Do not run it as part of this milestone. Confirm project/site in Firebase Console and take rollback release snapshot first.

## Local tests and limitations

- Run `node --check scripts/phase1-site.js && node --check scripts/build-phase1-staging.mjs`.
- Run `node --test tests/phase1/phase1.test.mjs tests/phase1/floating-guard.test.mjs tests/phase1/staging-config.test.mjs tests/phase1/staging-build.test.mjs` **only on an exact complete GitHub checkout**, then inspect the resulting `dist`.
- The prior PHASE1-002A QA was run from a reconstructed 202-file `main` archive and omitted the 20 DESIGN-001 modified files. An exact GitHub clean checkout / download with SHA verification is required before full source-regression PASS may be claimed. Network restrictions may prevent doing so in the current environment.
- Firebase CLI/real Hosting is not run during this milestone. Local config and synthetic tests do not prove CDN response headers, real browser navigation or real WhatsApp app handoff.

## Unapproved commercial content (unchanged)

- Google Review stock: founder reported 100 units. Other stand models are planned customer-requested China orders; do **not** claim confirmed supplier stock or delivery dates.
- Keep website prices RM100 for four single-stand models and RM800 for Food Menu 10-stand bundle. Founder must approve stock vs preorder terminology and the current ambiguous `RM800 / 10 tables` label.
- WhatsApp Catalogue regular/promotional prices not independently verified. Terms and Conditions still contain obsolete cart/account language; founder review required before production.

## Gate

**Code-only milestone**. Do not deploy until exact-source build, real viewport/browser regression, local Firebase Hosting emulator configuration validation, and separate founder staging authorization.
