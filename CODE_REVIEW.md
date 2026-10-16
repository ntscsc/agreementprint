# Code review ? 15 October 2026

Repository-wide automated verification and targeted manual review of authentication, order intake, administration, agreement generation, referrals, payments, uploads, API routes, database rules and deployment configuration. Existing workspace edits were preserved.

## Scope

- 157 project files inventoried before adding this report.
- 148 code/configuration files scanned; 134 JavaScript/TypeScript source files parsed without syntax errors.
- 43 literal internal links/assets resolved against repository routes and public files.
- Application TypeScript compilation, whole-project ESLint, application tests, rules emulator tests and production packaging checked separately.
- The lockfile was included in dependency auditing. Generated output and installed dependencies were excluded from first-party source inspection. Private environment values were not copied into this report.
- This combines automated coverage with targeted manual review; it is not a proof that every possible runtime error has been eliminated.

## Fixes

1. Aligned Firestore/legacy Storage administrator allowlists with src/config/admin.ts. Fixed the stale emulator admin fixture and added an allowlist consistency test.
2. Persisted customer clarification text with the order correction, validated its length, displayed it to administrators and added actual service/rules regressions.
3. Rejected incomplete customer-created order records at the database boundary; prevented corrections from changing purchased agreement terms or replacing required details with malformed objects.
4. Isolated customer/admin/referral/payment screen state by signed-in account. Referral attribution no longer holds the application's authentication loading state open.
5. Fixed month-overflow and timezone-dependent agreement dates, invalid dates/tenures, dropped paise, large/non-finite number conversion, duplicate currency units and blank words for a zero deposit.
6. Added a 64 KB limit to shared JSON request reading, including chunked bodies. Reused the safe API response reader throughout customer/admin screens so HTML hosting failures produce readable errors. Malformed checkout conflicts cannot prompt or retry payment.
7. Rate-limited public tracking transactionally (10/reference/minute and 120 total/minute), made missing-reference and wrong-phone responses identical, disabled caching of tracking responses and generated new order IDs with cryptographic UUIDs. Tracking still intentionally uses reference plus phone, rather than account authentication.
8. Kept valid agent referral codes consistent with submission validation, preserved the existing draft/default-notary repair and aligned property PIN validation across client/server/rules.
9. Added APP_URL to the environment example and optional NEXT_BUILD_DIR support for isolated verification alongside development. Language selection updates the document language even if browser storage is unavailable.

## Validation

- Application/regression tests: 95 passed, 0 failed.
- Firebase Firestore/Storage emulator tests: 13 passed, 0 failed, using the demo project only.
- Production dependency audit: 0 known vulnerabilities.
- Full dependency audit: 7 high-severity development-tool findings remain in the existing braces dependency chain. The repository's postinstall parser-depth mitigation and its regression test pass. These advisories remain visible; they were not suppressed, and unsafe major-version downgrades suggested by npm were not applied.
- Static scan issues: 0.
- Whole-project ESLint and application TypeScript checks passed.
- Production build passed with NEXT_BUILD_DIR=.next-review, generating all 44 build entries.
- Standalone production HTTP smoke checks passed: 22 pages returned 200; 14 homepage assets loaded; 13 API validation/authentication checks returned their expected 400/401/413 statuses; an unknown route returned 404.

## Deployment and remaining checks

- These are local changes. Deploy the application and updated Firestore rules together. Storage rules are retained only for the legacy storage configuration; current custom uploads use Supabase.
- The secondary administrator now follows the existing application setting, ntcsc@gmail.com. Review that intended account before deploying an authorization change.
- Configure Firestore TTL on orderTrackingLimits.expiresAt to remove expired per-reference counters. Existing enquiry/custom-request counter TTL and abandoned-upload cleanup also require operational configuration.
- Real Google sign-in, signed-in order/payment completion, PhonePe webhooks and real private Supabase upload/download flows still require staging verification. No customer data was modified and no real payment was started during this review.
- The public tracking design still discloses its limited tracking fields to anyone who knows the reference and a registered phone number. Rate limiting reduces guessing; it does not turn these values into strong authentication.
- Business content needs owner review: vendor licence/address/contact fields remain blank in src/config/vendor.ts, and the agreement template does not render the collected maintenance-charge or rent-increase fields. No new contractual wording, licence details or business facts were invented.
- Very long agreement inputs may overflow the fixed printed A4 pages; print layout should be checked with representative maximum-length customer data.

## Files included in source/configuration scan

```text
.eslintrc.json
.github/workflows/checks.yml
app/about/page.tsx
app/admin/AdminClient.tsx
app/admin/page.tsx
app/api/admin/agents/route.ts
app/api/admin/referrals/route.ts
app/api/contact/route.ts
app/api/custom-agreements/route.ts
app/api/custom-agreements/sample/route.ts
app/api/custom-agreements/upload/route.ts
app/api/orders/calculate-fee/route.ts
app/api/orders/track/route.ts
app/api/payment/create-order/route.ts
app/api/payment/phonepe/create-order/route.ts
app/api/payment/phonepe/status/route.ts
app/api/payment/phonepe/test-product/route.ts
app/api/payment/phonepe/webhook/route.ts
app/api/payment/webhook/route.ts
app/api/referrals/agent/route.ts
app/api/referrals/me/route.ts
app/api/referrals/validate/route.ts
app/api/upload/route.ts
app/contact/ContactClient.tsx
app/contact/page.tsx
app/custom-agreement/page.tsx
app/disclaimer/page.tsx
app/faq/FaqClient.tsx
app/faq/faq-data.ts
app/faq/page.tsx
app/globals.css
app/how-it-works/page.tsx
app/layout.tsx
app/my-orders/MyOrdersClient.tsx
app/my-orders/page.tsx
app/my-requests/page.tsx
app/order/page.tsx
app/page.tsx
app/payment-test/page.tsx
app/payment/phonepe/return/page.tsx
app/pricing/page.tsx
app/privacy-policy/page.tsx
app/referrals/page.tsx
app/refund-policy/page.tsx
app/rent-agreement/page.tsx
app/rent-receipt/page.tsx
app/services/page.tsx
app/terms/page.tsx
app/track/TrackClient.tsx
app/track/page.tsx
components/BrandMark.tsx
components/DisclaimerBanner.tsx
components/Footer.tsx
components/Header.tsx
components/PriceBreakdownCard.tsx
components/SupportEmailLink.tsx
components/VendorPlaceholderNotice.tsx
components/WhatsAppButton.tsx
components/agreement/RentalAgreementDocument.tsx
components/custom-agreements/CustomRequestForm.tsx
components/custom-agreements/CustomRequests.tsx
components/order/AgreementTermsStep.tsx
components/order/OrderConfirmation.tsx
components/order/OrderIntakeWizard.tsx
components/order/OwnerStep.tsx
components/order/ProgressIndicator.tsx
components/order/PropertyStep.tsx
components/order/ReviewStep.tsx
components/order/TenantStep.tsx
components/referrals/AgentReferralAdmin.tsx
components/referrals/ReferralDashboard.tsx
components/rent-receipt/RentReceiptGenerator.tsx
eslint.config.mjs
firebase-applet-config.json
firebase-blueprint.json
firebase.json
firebase.test.json
firestore.indexes.json
firestore.rules
hooks/use-mobile.ts
lib/agent-referral.ts
lib/agreement-draft.ts
lib/agreement-formatter.ts
lib/agreement-validation.ts
lib/api-input.ts
lib/api-response.ts
lib/auth-context.tsx
lib/checkout-client.ts
lib/checkout-lock.ts
lib/courier-service.ts
lib/custom-agreement.ts
lib/custom-request-server.ts
lib/file-storage.ts
lib/firebase-admin.ts
lib/firebase.ts
lib/firestore-data.ts
lib/firestore-errors.ts
lib/i18n/context.tsx
lib/i18n/en.ts
lib/i18n/ta.ts
lib/image-compressor.ts
lib/number-to-words.ts
lib/order-checkout-details.ts
lib/order-service.ts
lib/payment-attempt.ts
lib/phonepe-test-payment.ts
lib/phonepe.ts
lib/pincode-utils.ts
lib/pricing-service.ts
lib/referral-admin.ts
lib/referral-utils.ts
lib/sample-validation.ts
lib/server-pricing.ts
lib/support-email.ts
lib/types.ts
lib/utils.ts
metadata.json
netlify.toml
next.config.ts
package.json
postcss.config.mjs
scripts/clean.mjs
scripts/patch-braces.mjs
src/config/admin.ts
src/config/pricing.ts
src/config/vendor-services.ts
src/config/vendor.ts
storage.rules
tests/agent-referral.test.ts
tests/agreement-document.test.ts
tests/api-response.test.ts
tests/checkout-client.test.ts
tests/clean.test.mjs
tests/custom-agreements.test.ts
tests/dependency-safety.test.mjs
tests/draft-sanitization.test.ts
tests/fee-calculation.test.ts
tests/file-storage.test.ts
tests/firebase-rules.emulator.test.mjs
tests/high-severity.test.ts
tests/payment-attempt.test.ts
tests/phonepe-test-product.test.ts
tests/pincode-utils.test.ts
tests/pricing-validation.test.ts
tests/referral.test.ts
tests/security-rules-validation.test.ts
tests/validation.test.ts
tsconfig.json
```
