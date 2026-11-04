#!/usr/bin/env bash
# PR-003 local-only emulator instructions. Do NOT connect to staging/prod projects.
set -euo pipefail
if ! command -v firebase >/dev/null 2>&1; then echo 'BLOCKED: firebase-tools CLI is not installed.' >&2; exit 127; fi
if [ ! -d functions/node_modules ]; then echo 'BLOCKED: functions dependencies not installed (npm install --prefix functions).' >&2; exit 127; fi
export GCLOUD_PROJECT=demo-mbd-pr003
export ENQUIRY_ALLOWED_ORIGINS=http://localhost:5000
export ENQUIRY_TURNSTILE_HOSTS=localhost
export ENQUIRY_STORAGE_BUCKET=demo-mbd-pr003.appspot.com
export ENQUIRY_MAIL_FROM='MyBizDigital <notifications@notify.mybizdigital.my>'
export PR003_TEST_TURNSTILE_SECRET=synthetic
export PR003_TEST_RATE_SECRET=synthetic
export PR003_TEST_RESEND_API_KEY=synthetic
export PR003_TEST_TURNSTILE_URL=http://127.0.0.1:9091/turnstile
export PR003_TEST_RESEND_URL=http://127.0.0.1:9091/resend
firebase emulators:exec --project demo-mbd-pr003 --only functions,firestore,storage,hosting 'node tests/pr003/emulator-smoke.mjs'