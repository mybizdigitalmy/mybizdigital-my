# PHASE1-005 — Promotional Pricing, Review Scenarios and Newsletter Preparation

**Baseline:** `304fdc772060f3d09861bde75bb87336be4267f3` (`fix/phase1-004-food-menu-option-b-links`).
**Scope:** code and local testing only; no staging/production deployment, Firebase billing, external provider activation, or modifications to original `index.html`, media and demos.

## 1. Pricing (Phase 1 generated public page only)

The builder surgically changes the five NFC price displays in `dist/index.html`:
- Google Review, Facebook, Instagram, TikTok: **RM100**, followed by a smaller grey **~~RM111~~**.
- Food Menu: **RM800**, followed by **~~RM1,111~~**; secondary caption **10 NFC stands per bundle**.

The product detail dialog reads promotional prices from the generated product cards and adds the corresponding regular prices. All original source prices, product artwork, descriptions, gallery presentation, WhatsApp message content, and phase-two purchase code remain in the original website source. No promotional deadline, stock or discount percentage is claimed.

## 2. Review samples and accessible horizontal scrolling

Generated section headline: **NFC Experiences in Everyday Business** (replaces unsupported “Rated 5.0 by First-Time Buyers”).

Visible section disclosure: **Sample business feedback scenarios only. The comments and business names shown are fictional, not verified customer reviews.**

The 60 duplicated card instances retain their appearance, sample quotes, industry categories and locations, with the visible ` · Illustrative` suffix removed. Sample rating-stars are marked decorative for accessibility. No aggregate rating or review-count structured data is added.

The source two-set CSS marquee is preserved. A small Phase 1 script clones one set at runtime, disables the CSS transform animation only in this section, and scrolls the native lane with `requestAnimationFrame`. Mouse drag, native touch/trackpad scrolling and left/right keyboard arrows pause automatic movement; it resumes after interaction. Three identical sets provide a seamless horizontal wrap. `prefers-reduced-motion` disables automatic movement. No external library.

## 3. Newsletter — intentionally NOT operational pending provider setup

Source audit found no active newsletter service: all nine public main-site footers had a disabled email input and Notify me button.

Provider candidate: **Buttondown**, which documents a public, static-HTML form POST endpoint, double opt-in for standard signup forms, and subscriber unsubscribe management.
- Endpoint format: `https://buttondown.com/api/emails/embed-subscribe/<verified-username>`; native `POST`, with `name="email"` and `embed=1`. **No API token appears in public code.**
- After provider verification, a native HTML email field, required explicit marketing-consent checkbox, Privacy Policy link and existing Notify me button submit directly to the provider in a new tab. The provider owns confirmations/errors, duplicate requests, email verification, anti-abuse and unsubscribes. The website does not display a fake success message.
- Configuration: `scripts/phase1-newsletter-config.json` defaults to `{ "provider": "buttondown", "username": "", "enabled": false }`. Until the founder sets up and verifies a real Buttondown account, signup form, consent copy, unsubscribe flow, and approval of provider's current no-cost plan, the generated footer visibly explains the feature is unavailable and the submission control remains disabled.
- A later **separately approved** configuration change may set `username` and `enabled:true`. The build validates the username and otherwise fails closed. Rebuild and test the live provider flow with a consented test address, a duplicate attempt, confirmation, and unsubscribe before treating newsletter as operational.

Provider references: https://docs.buttondown.com/building-your-subscriber-base , https://docs.buttondown.com/double-opt-in , https://docs.buttondown.com/portal . Provider tariffs, limits and merchant/data-processing compliance must be reconfirmed at activation. Do not activate Cloud Functions/Firestore/Firebase Blaze.

## 4. Verification and unchanged scope

Run from a complete checkout of the new fix branch:

```bash
node --check scripts/build-phase1.mjs
node --check scripts/phase1-site.js
node --test --test-concurrency=1 tests/phase1/*.test.mjs
node --test tests/launch/launch.test.mjs
node scripts/build-phase1-staging.mjs
```

Test native scrolling, modal/price hierarchy, consent validation, and the Buttondown form in a real staging browser only after separately approved deployment. Keep staging `noindex` and `robots.txt` protections; verify CDN security headers at that stage.

**Deferred to other milestones:** warranty, stock/preorder notices, cache-control, legal-policy edits, email provider account creation, domain verification and any production deployment.
