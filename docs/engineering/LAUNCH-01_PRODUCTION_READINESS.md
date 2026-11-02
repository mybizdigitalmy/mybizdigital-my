# LAUNCH-01 — Firebase Production Website Preparation (code-only)

**Status:** PROPOSED release candidate; **NOT DEPLOYED**, not merged, no DNS changes, no billing enabled.  
**Source authority:** latest owner-approved DESIGN-001 branch `feature/premium-design-p1` at `902febc2ebd1759a16266d2b0325e56c9a7bef46`.  
**Separate:** PR-002 `feature/firebase-auth-staging` (not merged or deployed to production).

## Decision record — 2 November 2026
- Owner authorized read-only production launch readiness audit, then said "Proceed" to start LAUNCH-01.
- Goal: publish a premium *non-transactional* MyBizDigital marketing/catalogue site, keeping customer checkout and all financial operations disabled.
- Keep original HTML/CSS/JS source, product imagery, original HorizonX-inspired site, solid-black footer, 15 approved design demos, 16 application demos and both image manifests.
- **Source remains untouched.** `node scripts/build-launch.mjs` creates a separate `dist/` output from allowlisted nine root pages, `assets/`, `demos/`, `apps/`, with generated release-only safety substitutions.
- **Contact:** Netlify project has Forms not enabled and the old `assets/contact.js` POSTs to Netlify Forms. Production Firebase Hosting has no form backend. Release-only `contact.html` substitutes an explicit `mailto:support@mybizdigital.my` call to action inside the original contact page shell, and replaces generated `assets/contact.js` with a no-op so native `a href=contact.html` navigation remains intact. This does **not** promise mail delivery; validate mailbox and customer email-app fallback before release.
- **Checkout:** original product/cart gallery stays; release-only `openCheckout()` immediately redirects to Contact and the CTA reads "Enquire before ordering". No guest checkout, authenticated purchases, stock reservation, financial state or customer data collection. The homepage's four nonfunctional desktop/mobile login/signup links are changed in release output to Contact and Get a quote links, with the same existing nav classes. Visual acceptance is required before any deploy.
- **SEO:** release-only `robots.txt`, `sitemap.xml` for the nine root pages, canonical metadata for root pages where absent. Demo and sample app pages stay noindexed.
- **Firebase Hosting:** separate `firebase.launch.json` candidate with public `dist`, cautious security/caching headers; NO bound production Firebase project and NO production target. DO NOT deploy with staging project or `.firebaserc`. Domain must not be changed until verified full release checks.
- **No paid plan, Cloud Functions, Firestore, HitPay, Firebase customer Auth or transactional emails are activated.**
- **Do not mistake this for an e-commerce release**: MBD-ENG-SEC-001 payment and customer-account controls remain critical production gates.

## Local validation
Run from repository root:
```
node --test tests/launch/launch.test.mjs
node scripts/build-launch.mjs
```
Inspect `dist/index.html`, `dist/contact.html`, navigation, mailto behavior, product photos, 15 design demos and 16 business app demos at desktop/tablet/mobile.
No backend, DNS or production deployment is performed.

## Strict production release prerequisites (NOT COMPLETED)
1. Review visible proof of ownership of planned production Firebase project and its project ID, Hosting site ID, cost plan and admin access. **Do not repurpose `mybizdigital-staging` for production.**
2. Confirm original screenshot/design parity, current images and manifests; verify black footer, product pricing (Food Menu RM800/10), media, menu, responsive navigation and demo interactivity.
3. Confirm legal/privacy notices match services *actually used* after migration, consent/data practices, service provider changes, SSM details, warranties, delivery/refund policies and no unsupported marketing claims.
4. Test that customer checkout, contact forms, newsletter and login have no unintended submission paths. No collection without reliable, protected backend; mailto is only an interim channel.
5. Validate real Firebase Hosting staging preview with release candidate, 404, TLS, security headers, cache, robots/sitemap and no leakage of private files.
6. Verify SEO Search Console ownership, canonical hostname and DNS/SSL/migration rollback plan; avoid two competing live canonical sites.
7. Keep existing Netlify production site and DNS intact until explicit founder approval to cut over; have tested rollback plan ready.
8. Future Firebase verified-account checkout, HitPay and transactional mail integration is separately scoped and must pass its own red-team and production acceptance gates.

## Rollback
No source change occurs to approved DESIGN-001. The branch can be abandoned, and existing Netlify `main` deployment remains untouched. No rollback to execute until a real release happens.
