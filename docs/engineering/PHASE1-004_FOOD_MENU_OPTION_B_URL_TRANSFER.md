# PHASE1-004 — Food Menu Option B WhatsApp URL transfer

**Status:** Code-only fix, local testing completed; NOT DEPLOYED.

**Source baseline:** `feature/phase1-whatsapp-static` at `5096aa6bc4d681eb2c6f8198932da7f008aa00db` (archive Git tree `4836e4fe8e101294bc557aa450dac10674e8b226`).

**Fix branch:** `fix/phase1-004-food-menu-option-b-links`, forked from the approved baseline. This change does **not** modify the existing Phase 1 branch, `main`, products, contact page, Firebase configuration, demos or commerce code.

## Root cause and correction

`messageFor()` previously included only the number of completed Food Menu Option B fields. It omitted their actual URLs. On user click, the amended Option B path now produces the correct product name, RM800/10-stand price, fixed bundle, optional business name, selected Option B and each nonempty `Table NN: http(s)://...` entry in its source field order. Empty fields remain optional. Invalid or non-http(s) URLs trigger a visible message and stop WhatsApp handoff, rather than being silently ignored.

The Option B input `maxlength="500"` was removed to prevent silently clipped pasted long URLs. Option A's existing behavior and its shared menu input were not altered. Other products' existing messages remain unchanged.

A conservative 1800-character **encoded WhatsApp URL** threshold is used because provider/browser URL limits vary: when exceeded, the whole message appears in a selectable, read-only text area with a `Copy complete message` button and separate user-controlled `Open WhatsApp to paste message` link. No long WhatsApp prefill URL is attempted. For shorter Option B drafts, WhatsApp opens with the complete encoded message; a copy fallback remains available if the recipient app drops or truncates content. Clipboard errors retain a manual-select alternative. Neither path automatically submits a WhatsApp message or uses storage/backend services.

## Edited source files

1. `scripts/phase1-site.js` — Option B URL validation, ordered message transfer, controlled long-link fallback, and notice state.
2. `scripts/phase1-site.css` — narrowly scoped styling for the new inline fallback/validation notice.
3. `tests/phase1/food-menu-option-b.test.mjs` — synthetic, provider-independent tests of the **actual function and click-handler source**.
4. This engineering note.

## Verified local commands

- `node --check scripts/phase1-site.js` — PASS.
- `node --check scripts/build-phase1.mjs` — PASS.
- `node --check scripts/build-phase1-staging.mjs` — PASS.
- `node --test --test-concurrency=1 tests/phase1/*.test.mjs` — **34/34 PASS** (including 10 new Option B tests).
- `node --test tests/launch/launch.test.mjs` — **5/5 PASS**.
- `node scripts/build-phase1-staging.mjs` — PASS: 185 public files, 40 HTML routes, 15 design and 16 app demos, sitewide HTML `noindex`, `robots.txt: Disallow: /`, no sitemap.
- Local output inspection — updated JS/CSS copied byte-identically; no private/config files; no cart/checkout or unsupported Contact form in generated root pages.
- Supplemental Chromium tests using a minimal fixture and generated production JS/CSS — **5/5 viewport runs PASS** at 320/390/768/1024/1440 px, covering short, invalid and long Option B interactions, no uncaught page errors.

**Limitations:** Full HTTP-browser site QA, real WhatsApp handoff/length behavior, and Firebase deployment are **not tested** in this code-only task. Staging source could not be retrieved directly from the staging domain because the environment blocks DNS resolution. The official current baseline was verified via GitHub branch and archive tree SHA.

## Staging update — requires separate owner authorization

1. Confirm this fix branch commit and whether it is approved for staged release. Do **not** merge automatically.
2. Using an authenticated Firebase CLI/approved operator, verify `mybizdigital-staging`, Hosting site `mybizdigital-staging`, Spark billing, existing staging release ID, and rollback procedure. Ensure the production domain is not connected.
3. On an exact checkout of this fix commit, run:
   ```bash
   node --test --test-concurrency=1 tests/phase1/*.test.mjs
   node --test tests/launch/launch.test.mjs
   node scripts/build-phase1-staging.mjs
   ```
4. After separate **staging deployment approval**, use the existing project/target mapping and hosting-only config:
   ```bash
   firebase deploy --project mybizdigital-staging --config firebase.staging.phase1.json --only hosting:staging-site
   ```
   The config includes a staging-specific predeploy build. Never use generic `firebase deploy`.
5. Confirm actual response `X-Robots-Tag`, robots restrictions, staging assets, product modal/Option A, all 10 table URLs, partial/invalid/long message behavior on real WhatsApp, desktop/mobile layout and rollback availability.

**Release restriction:** No staging or production deployment, DNS, billing, customer database, payment activation or `main` modification authorized by this change.
