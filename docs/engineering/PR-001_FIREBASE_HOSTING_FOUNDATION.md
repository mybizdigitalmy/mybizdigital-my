# PR-001 — Firebase Hosting Foundation (STAGING ONLY)

**Status:** Prepared for owner review; NOT deployed and NOT merged.
**Source:** mybizdigitalmy/mybizdigital-my at commit 0676254bd385e868b3410c7939a229f478414c73.
**Security authority:** MBD-ENG-SEC-001 v1.0 (30 October 2026).
**Branch:** feature/firebase-foundation, independent of premium design and HitPay.

## Staging environment record

| Item | Value | Verification |
|---|---|---|
| Firebase project | MyBizDigital-Staging | Owner confirmed; screenshot consistent |
| Project ID | mybizdigital-staging | Owner confirmed; console URL consistent |
| Web App | MyBizDigital-Staging-Web | Owner confirmed; app details not independently verified |
| Plan | Spark (Free) | Owner confirmed; screenshot consistent |
| Hosting site ID | mybizdigital-staging | Owner-confirmed 1 November 2026; cloud API readback not performed |
| Production Firebase / DNS | UNVERIFIED | Out of scope |

## Exact scope and preservation

PR-001 initially added five files: .firebaserc, firebase.json, scripts/build-static.mjs, tests/hosting/hosting.test.mjs and this note. This target-binding revision modifies ONLY .firebaserc, tests/hosting/hosting.test.mjs and this note.

No modifications to any existing HTML, CSS, JS, videos or images; all 15 website demos and 16 business app demos, original products and assets, navigation, animations, responsive behavior, static-black footer, Netlify files and both asset manifests are preserved.

- Build allowlist: nine root HTML pages plus assets/, demos/ and apps/, with allowed static file extensions only.
- Generated directory: dist/, already excluded by the existing .gitignore. Do not commit dist.
- Rejects symlinks, dotfiles and unexpected extensions in public trees; copies approved assets byte-for-byte.
- Hosting public directory is dist, not the repository root.
- Hosting target staging-site is now explicitly bound to the owner-confirmed Hosting site mybizdigital-staging under the staging Firebase project in .firebaserc. This is a local Git configuration change, NOT a cloud operation or deployment.
- Staging-only headers: X-Robots-Tag noindex/nofollow/noarchive, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin; HTML cache no-cache/must-revalidate.
- No wildcard SPA rewrite, automatic domain redirect, production configuration, credentials, CSP or HSTS.
- No Firebase Auth, Firestore, Functions, HitPay, DNS modification or billing upgrade.

## Local checks — Node.js 20+

From repository root:

    node --test tests/hosting/hosting.test.mjs

The test suite generates dist, checks 180 exact public files and 40 HTML pages, compares source and output bytes, checks explicit internal references and prevents private files from entering the public payload. The build alone can be run via:

    node scripts/build-static.mjs

Automated tests cannot certify live TLS, real response headers, visual fidelity or dynamic form behavior. The hosting target mapping test now expects exactly the staging project mybizdigital-staging and one Hosting resource mybizdigital-staging.

## Mandatory acceptance before any staging deployment

1. Confirm the owner-reported Hosting site ID and Spark plan via read-only Firebase Console or CLI inspection before deployment. Local target mapping is present, but cloud resource lookup and deployed behavior remain untested.
2. Verify GitHub/Netlify branch deployment triggers and avoid automatic preview deployments without owner approval.
3. Verify all 40 pages and 31 demos against approved desktop/tablet/mobile design baselines, navigation, animation, media, interactions and accessibility.
4. Test staging routes, real 404 responses, HTTPS, noindex, caching and security headers.
5. Verify no excluded file, credential, source map, backup, manifest, Netlify function source or internal document is reachable.
6. Existing contact.js POSTS to Netlify Forms and cannot submit via Firebase Hosting alone. Preserve the UI; secure contact replacement is separately required before production cutover.
7. Current login/signup, cart and checkout are previews; never accept live orders or interpret sample UI as backend functionality.
8. Record staging release, URL, screenshot evidence and rollback test before production consideration.

## Guarded future steps (require additional explicit approval)

The staging-site target is bound in .firebaserc to the owner-confirmed site ID. The equivalent Firebase CLI command (NOT run; no need to run again) is:

    firebase target:apply hosting staging-site mybizdigital-staging --project staging

Verify the local target configuration read-only using:

    firebase target --project staging

The mapping is not deployment. After a separate approved staging go/no-go decision:

    firebase deploy --only hosting:staging-site --project staging

Keep mybizdigital.my on the existing Netlify deployment. No domain, DNS, Zoho mail, Firebase paid billing, production resources or HitPay settings can be modified under PR-001.

Rollback: restore the last recorded known-good staging Hosting release if one exists; if no staging release existed, do not direct users to the incomplete staging URL. The source rollback is baseline/pre-firebase-2026-10-30 at 0676254bd385e868b3410c7939a229f478414c73.

## Phase 00 remains independent

00.02 visual approvals and full live comparisons; 00.03 DNS/third-party inventory; 00.04 shipping, warranty and legal decisions; and 00.06 formal founder acceptance are pending. This PR does not mark any unverified item PASS.
