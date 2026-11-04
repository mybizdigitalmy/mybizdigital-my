# PR-003 — Secure Customer Enquiry Backend Foundation

**Date:** 4 November 2026 | **Status:** CODE-ONLY / LOCAL TESTS — NOT CLOUD-DEPLOYED

**Authorized:** Source and local testing only. No GitHub `main` merge, Firebase deployment, Blaze, billing, DNS, Netlify, Resend account or payment activation.

**Branch:** `feature/pr003-enquiry-foundation` based on exact PR-001 Firebase foundation SHA `6504d5bcd12af6bf9d7efaefc1bdd643a23739ea`.

## What changed

- Retain original `contact.html` (including dedicated form, popup template, conditional fields and two file inputs), original CSS, images, animation and demos. Replace only `assets/contact.js` submission transport with same-origin `/api/enquiry` JSON HTTPS submission, Turnstile widget, human-readable receipt/error handling and exact existing attachment limits. No customer registration required for contact.
- Add `assets/enquiry-public-config.js` with **empty public Turnstile site key**. Submission fails closed until independently approved activation. Never place secret keys in client source.
- Add `functions/src/enquiry-core.mjs` with server-side field/type/size validation, signature checks, Cloudflare Turnstile Siteverify action/hostname checks, per-IP keyed hourly throttling, fingerprinted UUIDv4 idempotency, Firestore persistence and private quarantined Cloud Storage attachments.
- Add `functions/index.mjs` with one Firebase Functions v2 HTTPS handler (`submitEnquiry`) and one bounded 15-minute retry scheduler (`retryEnquiryMail`). Sender and CAPTCHA config stay unconfigured. Firestore/Storage client Rules deny access; Admin SDK enforcement is server-side.
- Durable email state for staff and customer, Resend idempotency keys, retries with backoff and at most 5 attempts, operator-review escalation on exhaustion. Sending an email is not confirmation of provider delivery. No attachment is emailed or exposed via a public URL.
- Extend staging `firebase.json` with the **single** `/api/enquiry` function rewrite, Firestore and Storage Rules file references, and optional local emulators. Existing staging target and noindex headers stay intact.
- Keep PR-001 staging guard as the **default** build behavior. An opt-in guarded build path requires both `PR003_ENABLE_ENQUIRIES=true`, `PR003_BACKEND_APPROVED=true` and a configured public challenge key. Do NOT use before separate staging authorization.

## Security and privacy design

1. HTTPS same-origin POST only. Reject other origins, methods, content types, oversized payloads and unexpected fields; no wildcard CORS, HTML acceptance or unauthenticated reads.
2. Turnstile challenge validated **server-side** with expected action and hostname, including single-use tokens; server credentials in Secret Manager only when approved. Honeypot retained.
3. Keyed hourly rate limits (5 attempts/hour/IP) and maxInstances=2 reduce abuse, but do not constitute a guaranteed cost ceiling. Origin spoofing via non-browser clients is not itself an authentication boundary; Turnstile remains primary. Preserve noindex on staging.
4. One UUIDv4 per submission, server SHA-256 doc id and content fingerprint. Replays with identical data obtain the same receipt; mutated reuse rejected. Firestore create is exclusive; duplicates cannot trigger duplicate business records.
5. Files: maximum 3 MiB each, 6 MiB combined; allowed image/PDF/DOCX extensions; check basic binary signatures, private `quarantine/enquiries/...` storage, no public download URLs. **Not malware scanned**: staff access must remain blocked until scanner/review capability is designed and tested. DOCX structural verification and ZIP-bomb defense before staff processing remain release prerequisites.
6. Stored enquiry status must become `received` before a receipt is shown. Storage errors result in failure, not a false success. The scheduled worker retries unsent email notifications, up to five attempts in a 20-hour window. `needs_review` requires staff intervention and monitoring. Resend idempotency holds 24 hours; this is not an infinite exactly-once guarantee.
7. Firestore `enquiries` and rate-limit documents have no direct browser permissions; Firebase Admin SDK bypasses Rules, so backend validation and least-privilege IAM are required. Sender, DNS authentication, Secrets and private bucket are not configured by this PR.
8. The existing privacy notice must be updated and legally reviewed before processing real customer data with Cloudflare, Firebase/Google and Resend. Retention, deletion, scanning, cross-border data transfers and staff access workflows remain unapproved.

## Tests run in this work session

- `node --test tests/pr003/enquiry.test.mjs tests/pr003/hosting.test.mjs`: **24/24 passed** (synthetic data only).
- `node --check assets/contact.js && node --check functions/index.mjs && node --check functions/src/enquiry-core.mjs`: passed.
- `node scripts/build-static.mjs`: **181 static files / 40 HTML pages**, default protected form; no deployment.
- Emulator attempt `scripts/pr003-emulator-test.sh`: **BLOCKED**, because `firebase-tools` CLI and `firebase-admin`/`firebase-functions` npm dependencies are not installed in this isolated environment and outbound package downloading is unavailable. `tests/pr003/emulator-smoke.mjs` is prepared but **NOT executed**. Do not record an emulator PASS.

## Known limitations / blockers before staging approval

- Cloud staging release/build currently not verified from Firebase API; previous 180/180 live HTTP report is historical, not a test of PR-003.
- Public Turnstile site key intentionally empty; Secret Manager values, exact hostnames and bucket not provisioned. Current guarded build blocks the form and popup.
- The initial spam/cost and email retries use Firestore transactions; total monthly cost, quotas and deliverability depend on usage/region/provider and must be reviewed before Blaze activation.
- Dependency lockfile still needs to be generated from verified npm packages and committed before any deployment; offline npm installation is unavailable in this container.
- Mandatory local Emulator Suite integration with synthetic provider mocks and rules-denial tests is **NOT YET PASS**. No real customer data or provider email has been sent.
- File scanning, abandoned `receiving`/failed record cleanup, data retention/TTL, owner notification monitoring and staff-approved private retrieval are not implemented; do not expose attachment download to administrators yet.
- Composite-index requirements, deployment IAM, Secret Manager bindings, quota/cost alerts and Cloud Functions integration with Firebase Hosting must be validated in a separate authorized staging step.
- Browser integration and responsive screenshots have not been executed in this environment; original page HTML and image files are untouched, but final visual regression acceptance remains required.

## Estimate — no spend authorized

- Cloudflare Turnstile Free: RM0 within its plan limits; Resend Free: RM0 within up to 3,000 emails/month and 100/day, conditional on provider eligibility and sending-domain verification.
- Firebase Hosting/Firestore/Storage/Functions v2: Blaze billing plan is required for deploying the proposed backend and Storage. Consumption can be RM0 within relevant no-cost quotas, **not guaranteed**. Billing alerts alone do not cap spending; limit Functions maxInstances, implement budgets and monitor Storage, egress, reads and scheduled invocations. Cloud Scheduler allowances/pricing must be rechecked at activation. Do not invent fixed MYR monthly charges without expected monthly enquiry volumes and storage retention.

## Next owner authorization boundary

**No cloud action is allowed under PR-003 code approval.** After local Firebase emulators and clean branch tests have been run, owner must separately approve staging project resources, Blaze/budget controls and *staging-only* deployment. Never change `main`, DNS or current Netlify production under this PR.