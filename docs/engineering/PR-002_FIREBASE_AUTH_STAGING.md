# PR-002 — Firebase Authentication Foundation (STAGING ONLY)

**Status:** Implemented in code for review; NOT deployed or merged. Cloud configuration and live authentication are NOT verified.
**Authority:** MBD-ENG-SEC-001 v1.0 (Phases 01, 02, 03, 05, 08); founder explicitly approved mandatory registered-and-verified accounts, overriding optional guest checkout in the generic checklist.
**Branch:** `feature/firebase-auth-staging` based on PR-001 Hosting foundation (commit `6504d5bcd12af6bf9d7efaefc1bdd643a23739ea`).

## Scope and preservation
- Add staging-only modal handling for existing Home navigation `#login`/`#signup` links. No existing menu layout, product imagery, shopping cart logic, checkout preview, demos, manifests or footer modified.
- Use Firebase **modular** JS Auth SDK pinned to Google's official CDN version 12.19.0, loaded dynamically **only** on staging/localhost after both public config fields are filled and validated.
- New customer creation, sign-in, browser-session persistence, Firebase verification email, resend cooldown, sign-out, password reset, verification refresh and generic errors compatible with email-enumeration protection.
- Do not collect personal data unless the developer explicitly activates the verified staging Web App configuration. With empty public `apiKey` and `appId`, submissions are disabled.
- No payment, Firestore, server endpoint, login claims, staff/admin roles, cloud resource creation or live personal data.
- Customer verification in browser is only for UX; the future trusted backend MUST verify identity tokens, email verification and authorization independently before any order/payment action. Current checkout remains nontransactional.
- Staging-only contact form guard and Hosting `noindex`/security headers preserved.

## Firebase staging activation prerequisites (NOT done)
1. Verify the registered **MyBizDigital-Staging-Web** app, obtain its public Web App configuration (Web API key and app ID only) through Firebase Console. This is *client configuration*, not an Admin SDK credential. Never share payment keys, private keys, service-account JSON or customer passwords.
2. Confirm project `mybizdigital-staging`, verified Hosting Site ID `mybizdigital-staging`; Email/Password provider status and email-enumeration protection; permitted redirect/authorized domains including the staging site as necessary.
3. Configure and review Authentication email sender/templates. Firebase's default templates do NOT prove branded emails have been configured; custom sender domains/features may have eligibility/plan limitations. Preserve Zoho mail independently.
4. Explicitly approve updating the *public* config in `assets/auth-staging-config.js`, and separately approve any cloud provider changes. No billing upgrades.
5. For real emails, verify official project/provider quotas and rate limits; the UI adds a one-minute resend throttle but is **not** server-side abuse protection.
6. Staging-only deployment requires its own approval after tests. `main` and Netlify production remain unchanged. The approved DESIGN-001 branch stays unmerged.

## Run local tests
```sh
node --test tests/auth/auth.test.cjs
node --test tests/hosting/hosting.test.mjs
node --check assets/auth-staging.js
node --check assets/auth-policy.js
```
The Hosting test's audited expected static-file count increases from 180 to 184: **four added public assets** (auth policy, web config, auth module and isolated CSS). All 40 pages remain; only `index.html` is changed for stylesheet/script references.

## Key negative/positive acceptance cases
- Disallow auth SDK on production/Netlify hostnames; missing or cross-project config fails closed.
- No passwords, tokens or customer details in logs, query parameters, analytics or URL fragments; Firebase SDK manages session persistence.
- Signup triggers verification; unverified sign-in still allows access to resend, but **does not permit purchases**. Email verification refresh requires a Firebase user reload.
- Generic reset response even when email not registered; account existence must not be inferred from login errors.
- Invalid credentials, weak passwords, repeated resends, network errors, disabled provider and SDK failure have accessible error feedback.
- Account dialog is keyboard and mobile accessible; original shop/cart/demos/contact guards unchanged.
- Full Firebase Auth Emulator integration and real staging email round-trip have **NOT** been executed by static unit tests and are launch gates. Production server-side token verification and protected order access remain future work.
- Firebase SDK CDN imports need deliberate CSP configuration before any future live production release; no CSP changes made in PR-002.

## Rollback
Reset the PR-002 feature branch to the pre-implementation Firebase foundation SHA `6504d5bcd12af6bf9d7efaefc1bdd643a23739ea`. No `main` or deployed release is affected by this PR.

## Staging password policy alignment — owner reported saved on 2 November 2026
- Email enumeration protection was visually verified as enabled in the Firebase Console.
- Owner confirmed saving password **Require enforcement** with minimum length 12, maximum length 128, and required uppercase, lowercase, numeric and special characters; cloud policy readback after saving is not independently verified.
- PR-002 client validation and form labels now require the same criteria and accept only Firebase's documented special-character set. Firebase Authentication enforces its own server-side policy; client validation is guidance, not an authorization boundary.
- No changes to Firebase settings were made through this code update, and no staging deployment, customer registration, or email round-trip has occurred.
