# StampVendorWebsite

A web application for stamp vendor services and rental agreement drafting, with customer ordering, fee calculation, order tracking, and an administration interface. Standard rental orders collect entered details. A separate custom agreement service accepts private sample templates/photos for review and manual quotation.

Repository: https://github.com/pradeep1992official/StampVendorWebsite

## Features

- Guided order intake for property, owner, tenant, and agreement terms.
- Rental agreement document generation and PDF utilities.
- Fee calculation and pricing display.
- Customer order history and tracking.
- Google sign-in through Firebase Authentication.
- Firebase Authentication and Firestore, with private Supabase file storage.
- Administration interface for managing orders.
- PhonePe Business checkout with server-side payment verification.
- Referral codes, first-paid-order rewards, and checkout credit redemption.
- English and Tamil translation resources.
- Contact, FAQ, pricing, and policy pages.

Feature availability depends on configuration. A working preview does not confirm that authentication, payments, or database operations are fully configured.

## Technology

| Area | Technology |
| --- | --- |
| Framework | Next.js 15, App Router |
| UI | React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Authentication and data | Firebase Authentication and Firestore |
| File uploads | Private Supabase Storage |
| Payments | PhonePe Business Standard Checkout API |
| Documents | jsPDF, html2canvas |
| Checks | ESLint and Node.js test runner |

## Local setup

Use Node.js 22 and npm to match the reported AI Studio migration environment.

```sh
git clone https://github.com/pradeep1992official/StampVendorWebsite.git
cd StampVendorWebsite
npm install
```

Create `.env.local` from `.env.example`. On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

On macOS or Linux:

```sh
cp .env.example .env.local
```

Fill in the required settings, then start the application:

```sh
npm run dev
```

Open http://localhost:3000, or the address printed by the development server.

Development output uses `.next-dev`; production builds use `.next`. This keeps `npm run build` from overwriting a running preview's generated files. `NEXT_BUILD_DIR` can override the output directory; use distinct directories for concurrent development and build processes.

### Customer bills

After confirmed payment, customers can download an order bill as a PDF from the confirmation screen, PhonePe payment return page, or My Orders. The authenticated `/api/orders/bill` endpoint checks ownership and reads the saved payment totals; pending, failed, refunded or inconsistent payment records cannot produce a paid bill. The bill includes the saved package total, coupon discount, referral credits, amount paid and available transaction reference. It is a payment receipt, not a GST tax invoice or a receipt for tenancy rent/deposit. Older paid records without a saved amount require support review.

PDF generation runs on the server with PDFKit and the bundled OFL-licensed Noto Sans font. The standalone build traces the font into the bill route; no public bill files are stored. Downloads are private and not cached. No email is sent automatically.

When using npm, commit the generated `package-lock.json` so other environments use the same dependency versions. Once it exists and matches `package.json`, use `npm ci` for reproducible installs.

## Environment variables

Configure these in `.env.local` for local development and in the hosting environment's secrets/settings for deployed environments.

| Variable | Purpose |
| --- | --- |
| `PHONEPE_CLIENT_ID` | PhonePe Business API client ID |
| `PHONEPE_CLIENT_SECRET` | Server-side PhonePe API client secret |
| `PHONEPE_CLIENT_VERSION` | PhonePe Business client version |
| `PHONEPE_ENV` | `sandbox` for testing or `production` for live payments |
| `PHONEPE_WEBHOOK_USERNAME` | Basic-auth username configured for the PhonePe webhook |
| `PHONEPE_WEBHOOK_PASSWORD` | Basic-auth password configured for the PhonePe webhook |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Optional Firebase service account JSON for server-side token verification and payment updates; production can use Application Default Credentials |
| `GEMINI_API_KEY` | Gemini API access where Gemini features are used |
| `APP_URL` | Public HTTPS application URL used for production integration redirects, including the PhonePe payment return URL (for example, `https://agreementprint.in`). Required for custom agreement checkout in production. Custom agreement checkout returns to `http://localhost:3000/my-requests` locally; other local payment flows use the current request origin with wildcard hosts normalized to localhost. |

Configure the PhonePe webhook in the PhonePe Business dashboard to call `https://<your-domain>/api/payment/phonepe/webhook` and use the same webhook username and password configured above. Checkout uses the server-calculated saved order total; credentials are never exposed to the browser. Missing PhonePe or Firebase Admin credentials prevent online checkout and payment confirmation.

Never commit real secrets or add secret keys to browser-visible variables. `.env.local` is excluded by the repository's existing `.gitignore`.

## Firebase configuration

`lib/firebase.ts` loads client configuration from `firebase-applet-config.json` and uses its `firestoreDatabaseId` when initializing Firestore.

Before using the application:

1. Confirm the Firebase project and Firestore database ID, plus the Supabase URL and private bucket, are the intended ones.
2. Enable Google sign-in and authorize the domains used for local development and hosting in Firebase Authentication.
3. Review and deploy Firestore rules and indexes with `npx firebase-tools deploy --only firestore --project agreementprint`. File uploads use Supabase; do not deploy Firebase Storage rules or provision a Firebase Storage bucket.
4. Test customer and administrator access and database reads/writes.

AI Studio migration may provision or select an applet database. Verify its identity before using existing customer data. Environment variables alone do not replace the Firebase JSON configuration used by this repository.

## Business configuration

| File | Purpose |
| --- | --- |
| `src/config/vendor.ts` | Vendor identity, contact details, and vendor fee placeholders |
| `src/config/pricing.ts` | Pricing configuration |
| `src/config/admin.ts` | Administrator email and UI authorization helper |
| `firestore.rules` | Database access rules |
| `storage.rules` | Upload access rules |

Replace remaining vendor placeholders with verified business information. Keep administrator settings consistent with access rules; a client-side email check alone does not enforce database permissions.

The public support email can be updated by an authorized administrator in the Admin Console under **Support Settings**. It is stored in Firestore at `settings/support` and used for the Contact page, footer, privacy policy, and refund policy. Contact form submissions are saved as enquiries in Firestore; configuring this address does not enable automatic enquiry email notifications.

Courier partners can be managed by an authorized administrator in the Admin Console under **Courier Partners**. The initial option is Professional Courier; additions are stored in Firestore at `settings/couriers` and become available in the dispatch form after saving.

Customers can visit **Referral Credits** to get a unique share link and view referrals and their credit ledger. A referring customer earns the administrator-configured reward after a new customer’s first rental-agreement order is paid. The reward is credited once, does not expire, and can be applied to the full total of a future order. Customers choose the amount to use at checkout; credit is not cash-redeemable. Administrators manage the reward amount under **Referral Credits** in the Admin Console.

Referral account data, credit reservations, and the reward ledger are server-managed. Referral API routes require Firebase ID-token verification; do not grant client Firestore access to referral account or ledger collections. Deploy the updated Firestore rules along with the application.

### Payment security rollout

Customer-created orders may contain only `payment: { status: 'Pending' }`, and their `orderId` must match the document ID. PhonePe checkout creates a server-only record in `phonepePaymentAttempts` alongside the order update and credit reservation before requesting checkout. Checkout reuse, status verification, and webhooks require this record to match the order and customer; gateway amounts and URLs are read from this record rather than client-originated order metadata.

Deploy the updated `firestore.rules` and application together. The private attempt collection must remain inaccessible to all client SDKs. Existing pending PhonePe attempts created before this change have no trusted record and will not be reused or automatically confirmed. Review their actual gateway status before allowing another checkout to avoid charging a customer twice. Reconcile completed legacy payments using verified gateway records; do not backfill trusted attempts from the old order payment fields. Orders already marked Paid are unchanged.

Checkout is serialized per order with server-only `checkoutLocks` records. Gateway-pending attempts are reused even after the local checkout timer expires; a replacement requires a confirmed failed/expired gateway outcome. Uncertain gateway responses retain their attempt and credit reservation for verification. A delayed completion for a released or superseded attempt requires vendor reconciliation and cannot consume a newer reservation. Existing reserved credits without a payment-attempt association also require reconciliation before settlement.

After a confirmed failed/expired attempt, the wizard sends the current reviewed details to checkout, which saves them and recalculates pricing before creating the replacement. Edits and credit changes are rejected while an existing checkout is payable. Credit release and terminal payment updates commit atomically, and each reservation cycle has its own refund-ledger entry.

Document-upload controls are disabled because this service does not collect files. The legacy `/api/upload` endpoint returns HTTP 410 and performs no uploads or downloads. Storage rules retain correct owner-only read/delete handling for any historical draft files; size and format checks apply only to file creation/update. These Storage rules do not affect autosaved agreement forms, which are Firestore documents.

PhonePe is the active payment integration. The unused legacy `/api/payment/create-order` and `/api/payment/webhook` endpoints return HTTP 410 and cannot create gateway orders or modify payments. Historical payment type fields remain for compatibility with existing records.

Pricing is validated before saving, when reading saved settings, during fee calculation, and at checkout. The four package prices must be whole rupees and cover stamp duty plus courier: minimums are Rs.150/Rs.200 for Rs.100 stamp paper in Chennai/Tamil Nadu and Rs.250/Rs.300 for Rs.200 stamp paper; the optional notary surcharge may be zero. Non-finite, fractional, negative and unsafe amounts are rejected. Firestore rules enforce the same constraints on direct writes to `settings/pricing`. Deploy the Firestore rules with the application; file storage uses a private Supabase bucket.

## Project structure

```text
app/                          Pages, layouts, and API routes
  api/payment/phonepe/        PhonePe checkout, status, and webhook endpoints
  api/referrals/             Referral validation and customer credit endpoints
  admin/                      Administration interface
  order/                      Customer order intake
  referrals/                  Customer referral dashboard
  my-orders/                  Customer order history
  track/                      Order tracking
  rent-agreement/             Rental agreement page
components/                   Shared UI and order/agreement components
hooks/                        Shared React hooks
lib/                          Firebase, services, document utilities, translations
src/config/                   Vendor, pricing, and administrator settings
tests/                        Validation, fee, rules, and document tests
firebase-applet-config.json   Firebase client configuration
next.config.ts               Next.js configuration
firestore.rules              Firestore access rules
storage.rules                Firebase Storage access rules
```

## Development checks

```sh
npm run lint
npm test
npm run test:rules
npm run build
```

`npm test` runs the fast unit and mocked route tests, including checkout concurrency, credit reservation/release, pricing validation, and safe build cleanup. `npm run test:rules` runs the actual Firestore and Storage rules in Firebase's local emulators using the isolated `demo-stampsure-tests` project; it never uses the application's production Firebase configuration. Install Java 21 or newer and put `java` on PATH before running it. The first run downloads the emulator binaries.

The emulator suite checks customer/admin access, forged order payment fields, correction restrictions, private server collections, pricing constraints, and historical draft-file reads/deletes and upload limits. Source-only rules tests remain supplemental. These checks do not replace PhonePe sandbox checkout/webhook testing or a browser walkthrough of sign-in, ordering, and tracking.

The GitHub Actions workflow at `.github/workflows/checks.yml` runs lint, TypeScript, application tests, emulator tests, and a production build on pushes and pull requests.

`npm run clean` removes only this project's `.next` build output and is safe to repeat. Stop the development server before using it, then restart or rebuild as needed.

To run a production build locally:

```sh
npm run build
npm run start
```

## AI Studio, Antigravity, and VS Code workflow

Use GitHub as the shared source of truth and finish one editing session before handing the project to another tool.

### AI Studio startup

For the AI Studio environment described in the migration report, use this development script in `package.json`:

```json
"dev": "next dev -p 3000 -H 0.0.0.0"
```

This binds the development server to port 3000 on all interfaces. The GitHub copy inspected during README preparation still uses `next dev`; commit the migration changes when ready to keep the environments aligned.

### Handing work between tools

1. Review and save AI Studio changes to GitHub.
2. In your local checkout, save any pending work and pull the latest connected branch.
3. Open the checkout in VS Code and Antigravity. Use Antigravity Local mode for sequential edits in that folder, or a separate worktree for isolated work.
4. Make changes, run the development checks, and commit and push them.
5. Before continuing in AI Studio, update its files from the latest GitHub version.

If AI Studio offers a pull/update option, use it and verify the connected branch. If it only offers **Force push**, that action sends AI Studio's code to GitHub and may replace the branch; it does not import local changes.

If pulling is unavailable, import the updated repository into a fresh AI Studio project. ZIP upload into an existing project is a manual alternative: test it on a copy first, check that files are at the project root, and reconcile deleted or renamed files. ZIP upload should not be treated as Git synchronization.

For larger local changes, create a feature branch and merge it into the branch connected to AI Studio after review:

```sh
git switch -c feature/describe-your-change
```

Ask AI tools to preserve the existing Next.js architecture, routes, authentication, pricing, validation, and document generation while making the requested change.

## Troubleshooting

Netlify Functions can fail at startup with `ERR_REQUIRE_ESM` from `jwks-rsa` loading `jose`, before API error handlers run. The scoped npm override `jwks-rsa → jose@5.10.0` keeps Firebase Admin 14 compatible with runtimes that disable synchronous ESM loading. Other consumers retain jose 6. Commit `package.json` and `package-lock.json` together, then rebuild/redeploy Netlify with its cache cleared. Review/remove this workaround when upstream fixes the CommonJS loader (https://github.com/auth0/node-jwks-rsa/issues/507). The dependency regression test loads Firebase Auth with `--no-experimental-require-module` and verifies a locally generated JWKS signature. After deployment, an unauthenticated `/api/custom-agreements` request should return JSON with HTTP 401, rather than an HTML 500 page.

| Problem | Checks |
| --- | --- |
| Development server does not start | Read the first terminal error, check Node.js and dependency installation, and confirm `package.json` is at the project root |
| AI Studio preview cannot connect | Confirm the dev server uses the port and host required by that environment |
| ZIP import does not behave correctly | Check for an extra `StampVendorWebsite-main` folder and stale files from the previous copy |
| Google sign-in fails | Check the sign-in provider and authorized domains in the intended Firebase project |
| Firestore or uploads fail | Check database ID, bucket configuration, authentication, and deployed access rules |
| Payments are unavailable | Configure PhonePe Business API credentials, Firebase Admin credentials, and webhook credentials; test with PhonePe sandbox credentials |
| Edits do not appear during development | Check whether `DISABLE_HMR=true` is disabling file watching; restart the development server after edits |

## Release checks

- Run lint, tests, and the production build.
- Verify vendor information and remaining placeholders.
- Confirm the intended Firebase project and access rules.
- Exercise sign-in, order submission, tracking, and agreement generation.
- Verify PhonePe checkout, return status, and webhook processing in sandbox before enabling production credentials.
- Configure server secrets in the target hosting environment.

## Documentation status

This README was prepared from the GitHub repository and the supplied AI Studio migration report. Migration changes may not yet be committed to GitHub. Application checks were not executed as part of preparing this documentation.


## Agent referral codes

Admin Console → Referral Rewards includes Agent Referral Codes. Create one or more custom codes for each agent, such as `AGRAVI2026`, with a name and optional contact. Codes contain 5–20 uppercase letters/numbers and cannot duplicate existing codes. No prefix is required; each agent code has its own discount. Existing customer referral credits continue unchanged; agent codes do not generate automatic credits.

Share the displayed `/order?coupon=CODE` link. When a visitor signs in, the server records their name, email, tracking date, and agent code. The first agent attribution is permanent; returning signed-in customers can also be tracked, so this is a referral attribution record rather than proof of a new account creation. Pending links are retained locally until recording succeeds. Browser storage restrictions can prevent attribution across navigation before sign-in.

Customers can also enter an agent code in the existing order referral field; successful validation records the same first-agent attribution. The admin can search agents/customers and record a personally delivered reward with details. Rewards are recorded per attributed customer and are idempotent; this action does not send money. Deploy the updated app and Firestore rules together. Live Firebase authentication, share-link attribution, and reward persistence require staging verification. Agent tracking and rewards are private server-managed records.

## Custom agreement requests

- `/custom-agreement`: Google sign-in, agreement purpose/language/customisation, contact consent and preference, one to three PDF/DOCX/JPG/PNG samples (10 MB each). No payment at submission.
- `/my-requests`: private history, customer-visible quotes/messages, clarification replies, cancellation before acceptance and retry of sample verification.
- Admin **Custom Requests**: review, assignment, private notes, customer messages, quote and expected completion date. Manual contact and quote acceptance; moving Quote Sent to Accepted requires confirmation that the customer accepted. Accepted prices are immutable. No automatic calls, emails or WhatsApp messages are sent.
- Request creation reserves immutable file descriptors under `customAgreementRequests`. Shared transactions limit each account to five requests/day and the service to 30/minute. Direct Firestore request/audit/limiter access is denied, including client admins. The authorized API strips staff-only fields from customer responses.
- The browser uploads through an authenticated server endpoint. Supabase uploads use `upsert: false`; identical retry contents are accepted, changed contents rejected. Finalization reads the private file, checks exact size/type, validates file signatures and bounded DOCX structure, and stores its SHA-256 hash before publishing the request for review.
- Deploy the application, Firestore rules and `firestore.indexes.json` using `firebase deploy --only firestore --project CLIENT_PROJECT_ID`. Firebase Storage setup and billing are not needed for file uploads. Preserve other existing production indexes. Customer listing needs the ownerUid/createdAt composite index.
- Configure server-only `SUPABASE_URL`, `SUPABASE_SECRET_KEY` and `SUPABASE_STORAGE_BUCKET`. Keep the bucket private, limit files to 10 MB and allow PDF, DOCX, JPEG and PNG MIME types. Do not add public upload/download policies. The server checks Firebase authentication and request ownership before accessing Supabase; only owners and verified admins can request 60-second attachment download URLs after validation.
- Test valid files, invalid signatures, oversized files, owner isolation, retries and signed downloads against the private Supabase bucket. This application checks file signatures and DOCX structure; it does not perform antivirus scanning.
- Operational cleanup: remove files and records for abandoned Uploading requests older than 48 hours, plus unwanted cancelled drafts, through a privileged scheduled job. Check state again transactionally before deleting; do not apply a blanket bucket lifecycle to active/completed samples. Configure TTL on `customAgreementLimits.expiresAt` for account counters. Agree a retention period for completed requests with the client before launch. Cleanup scheduling and production retention policy are not configured by this local implementation.

Local validation: 68 application tests and 11 Firebase rules emulator tests pass, including request isolation, forged metadata, immutable uploads, server-controlled transitions, quote acceptance, clarification persistence, file validation and immutable server uploads. ESLint and TypeScript pass. The isolated standalone build and HTTP checks passed: both new pages returned 200 and all unauthenticated custom-request/download routes returned 401. Real Firebase login/uploads, signed download URLs  still need staging verification; no production customer data or live accounts were modified.

References: [Supabase private storage](https://supabase.com/docs/guides/storage/buckets/fundamentals), [serverless payload limits](https://vercel.com/docs/functions/limitations).

## Earlier recheck fixes

- Enquiries now use the server Admin SDK. Deploy the updated Firestore rules together with the application: client creation of enquiries is denied. The server transaction atomically writes the enquiry and shared counters (3 per phone per hour, 30 total per minute, and a one-minute identical-message guard). The limiter collection is private. Enable Firestore TTL on `enquiryLimits.expiresAt` to clean up expired phone counters; the global counter is one rolling document.
- Package minimums include fixed courier charges, so the itemized sum cannot exceed the total. Existing admin prices below these minimums need correction before checkout resumes.
- Pricing read failures no longer produce confirmed default quotes. Checkout requires the exact reviewed total; changed/missing quotes are shown for approval and checked again before payment. Wizard, My Orders, and return-page retries share this flow.
- Shared agreement validation runs during client order creation, the final wizard submission, and server checkout, before reservations/gateway requests. Malformed JSON and request IDs return 400; invalid/expired tokens return 401.
- Transitive dependency overrides update gRPC, PostCSS, selector parsing, FTP, UUID and telemetry dependencies. Production audit reports zero vulnerabilities. Seven development-only audit entries remain associated with upstream `braces@3.0.3`, which has no patched release. `npm install`/`npm ci` applies a fail-closed parser depth limit using `scripts/patch-braces.mjs`; tests cover regular expansion and hostile nesting across public string APIs. Do not omit install scripts. Review and remove the temporary mitigation when upstream releases a fixed version. The advisory is not suppressed.

These changes are local until deployed. Public tracking authentication was excluded from the requested fixes and remains an open finding. Live PhonePe sandbox and browser walkthroughs still need release verification.

Validation after these fixes: 60 application/regression tests and 9 Firebase rules emulator tests passed; project lint and TypeScript checks passed. The isolated build uses physical dependencies to validate standalone packaging.

The final isolated production build completed without standalone-copy warnings. Standalone HTTP smoke checks returned 200 for homepage/CSS, 400 for malformed contact/tracking/fee requests, and 401 for an invalid payment-status token.

## Rs.1 PhonePe test product

Open `/payment-test`, sign in and use the fixed Rs.1 checkout. The page shows live or sandbox mode from the server configuration. Set `PHONEPE_ENV=production` with production credentials to test real payment. Test payments are stored separately in server-only `phonepeTestPayments` and `phonepeTestCustomers`; they do not create agreement orders or referral rewards. Returning from PhonePe does not prove payment: use Check payment status to verify it with PhonePe. The existing authenticated webhook also confirms test payments. Pending attempts are reused; ambiguous checkout errors require status verification before another attempt.

## Repository verification (15 October 2026)

See [CODE_REVIEW.md](CODE_REVIEW.md) for review scope, fixes, verification results and remaining integration/content checks. Deploy the application and Firestore rules together: customer clarifications require the new allowed field, and order validation and the administrator allowlist have been tightened. Configure TTL on `orderTrackingLimits.expiresAt` for tracking counter cleanup.

For a production build alongside `npm run dev`, set `NEXT_BUILD_DIR=.next-review` before `npm run build`. This keeps review output separate from the running development server. Normal deployment builds continue to use `.next`.

## First-order coupon discounts

Customer-generated coupon codes all use one amount. Set **Shared customer coupon discount** in **Admin → Referral Rewards → First-Order Coupons**. This applies to existing and future customer-generated codes. The shared setting is stored at `settings/coupons.customerDiscountAmount` and defaults to ₹0 when absent. Old per-code customer amounts are ignored; individual customer codes can only be enabled or disabled.

Agent coupon codes have customizable text and an independent fixed discount per code. Create them in **Agent Coupon Codes**, using any unique 5–20 letters/numbers; no AG prefix is required. Agent and promotion discounts remain independent of the shared customer amount. All amounts accept whole rupees from ₹0–₹100,000. Existing referral credit rewards and historical tracking remain intact.

Customers apply one coupon while reviewing their rental order. Accounts with a previous paid rental order cannot apply it; account eligibility does not verify that a person has never used another account. The server calculates the discount before applying referral credits and caps the discount at the package total. A fully covered order is confirmed without opening PhonePe. The checkout, order history, customer receipt and admin order detail show the discount.

Codes remain in `referralCodes` and orders retain the legacy `referralCode` field for compatibility. New share links use `?coupon=CODE`; existing `?ref=CODE` links remain supported. Server-only `firstOrderCoupons/{uid}` records reserve first-order checkout across simultaneous orders, are consumed on settlement, and released only after verified failure/expiry. Do not expire a pending reservation locally: its gateway payment may still complete. Discount amounts are snapshotted in server-owned payment attempts, so later admin changes apply to new checkouts, not an already pending payment.

Deploy the application and updated Firestore rules together. Do not grant client writes to code configuration, coupon reservations or payment snapshots. Real Google sign-in, PhonePe and the admin/browser workflow still require staging verification before release. No production coupon amounts have been set by this local change.

Latest coupon validation: 113 application/regression tests and 14 Firebase rules emulator tests passed, along with lint, TypeScript and the production build. Coverage includes customer-wide discount consistency, custom agent codes/amounts, admin-only settings, legacy data compatibility and pending payment snapshots.


Agent reward management: each agent has a separate whole-rupee reward, distinct from the customer checkout discount. Admins can add agents, edit names/contact/reward amounts, and remove agents. Removal disables the code and retains referral/payment history; codes cannot be reassigned. New referral records snapshot the agent reward so future edits do not change existing obligations. Admins record payments manually with notes; duplicate requests do not record a second payment. Dashboard totals include active agents, referred customers, pending reviews, recorded payment count and recorded INR totals. Legacy payments without a numeric amount are excluded from monetary totals and retain their notes. Customer referrers continue to share the global admin reward after the referred customer first pays.


Referral management redesign: Admin > Referrals & Coupons now opens Agents. Agents are listed once with their own code, the amount the agent earns, and the amount a new customer saves. Add/Edit opens a focused form; View agent opens referral history and manual payment recording. Pausing disables new attribution/discounts; deleting retains history. Customers contains the shared customer-referrer reward and aggregate credited totals. Customer discounts contains the shared customer-coupon discount; optional promotions are collapsed. Customer-facing referral benefits separately show You earn and Your friend saves. Existing codes, attribution, balances, and payment history are retained. Agent editing now saves both reward and checkout discount together. This redesign has not been tested or built, per the request to wait for "run test".


Current referral scope (supersedes earlier redesign notes): only Customers and Agents remain. For customer referrals, settings/referrals.rewardAmount credits the existing customer after the new customer's first successfully paid order; settings/referrals.refereeDiscountAmount discounts the new customer's first order at checkout. Both amounts are shared by all customer referrers. Each agent has rewardAmount for a manual payout after the first paid order and customerDiscountAmount for the new customer's discount on that order. Agent eligibility is recorded atomically with first-payment settlement; sign-in attribution alone cannot be paid. No joining credits are issued to new customers. The discount is capped at the order total. Legacy agent discountAmount and settings/coupons.customerDiscountAmount are supported as fallbacks until updated through the new controls. Agent rewards, referral balances, historical payment records and pending gateway price snapshots are retained. Standalone promotions are excluded; manage both amounts in Customers or Agents. No tests, lint, type checking, or build were run for this change, per user instruction.

Dashboard count correction: sign-in attribution is shown separately as Awaiting customer payment. Customers who paid and agent payments due require an eligible order whose current server payment status is Paid and whose owner matches the referred customer. Zero-rate agent rewards are excluded from payments due. Customer referral aggregate totals likewise exclude reward rows without a matching confirmed paid order. This change has not been tested, per user instruction.

Latest validation after authorization to run tests: all 121 application/regression tests and all 15 Firebase Firestore/Storage emulator tests passed. ESLint, TypeScript, and the isolated .next-review production build passed. Regression coverage includes unpaid dashboard counts (0 paid, 1 awaiting, 0 due), matching confirmed payment ownership, agent manual payout eligibility, zero-rate rewards, shared customer and individual agent discounts, first-paid-order rewards, concurrent duplicate callbacks, and failed/returning-customer payment exclusion. No live payment was submitted and changes have not been deployed.

Customer referral settings screen corrections: both rates load before editing is enabled; unavailable totals are shown as a dash, not zero. Empty fields are not coerced to zero. Both amounts and their audit entry save together in a server transaction. Errors are displayed inline and settings/totals can be refreshed. Totals exclude malformed, self-referring, unmatched and unpaid reward rows. Regression cases have been updated for a future test run.

### Tamil rental agreement

English Rs.100 stamp-paper orders use `RENTAL AGREEMENT BLANK website.doc`; Rs.200 orders use `RENTAL AGREEMENT BLANK website 200-0.docx`. Both have 13 clauses, including the two-consecutive-months unpaid-rent clause, and owner/tenant signatures on all three pages. The Rs.100 layout has the property recital and clauses 1–6 on page 2. The Rs.200 layout places the property recital on page 1, clauses 1–3 on page 2, and clauses 4–13 with witnesses on page 3; stamp margins remain on its first two pages. Notice periods use the selected form value without rounding partial months. The shared renderer is used for customer previews, confirmations and administrator printing.

Step 4 offers English or Tamil agreement language. Tamil residential orders use the supplied residential template; Commercial Office / Shop + Tamil automatically uses `கடை வாடகை ஒப்பந்தப் பத்திரம் for website.docx` and the business name from Step 3. Both fill names/addresses as entered and use the selected rent, deposit, tenure, due date, notice period, maintenance and renewal increase. The shop template includes the electricity-consumption deposit, interest-free advance, no-subletting and advance-refund clauses. Painting deduction is residential-only and editable (the source's Rs.5,000 is the initial suggestion; enter zero for none); it is not shown or applied to the shop template. Language and property details select the matching customer/admin preview and print layout. Existing orders without a language retain English. Deploy updated Firestore rules with the app to allow Tamil shop orders. Shop/residential regression cases have been updated for a future authorized test run; no tests or production build were run for this addition.

The shared preview/print component handles both templates, including customer sample watermarks and stamp-paper margins. The supplied Rs.100 stamp reference image replaces the blank margin on page 1 for Rs.100 orders and pages 1 and 2 for Rs.200 orders, in English and Tamil residential/shop templates. The image is included in printing and preserves its original proportions. The Stamp Image & Top Margin toggle controls the image and reserved space together. A bundled OFL-licensed Noto Sans Tamil font avoids relying on installed Tamil fonts. Long entries can expand onto additional printed sheets rather than being clipped; review the print preview for the actual order. Deploy updated Firestore rules with the app. Tamil wording was adapted from the supplied document, not newly certified as legally valid.

### Admin visitor counts

The Rental Orders admin dashboard shows unique browser visitors for today, the current calendar month and all time, using Asia/Kolkata dates. Counts begin with the first recorded production visit; historical traffic is not imported. Refreshing or visiting other pages does not increase the same browser's count within that period. Browser storage provides a random identifier; only its SHA-256 hash and last counted day/month are stored in `visitorRegistry`. No IP address, name, email or browsing history is stored by this counter.

`POST /api/visitors` validates origin, visitor ID and allowed page, skips recognised bot user agents/Do Not Track, and updates deduplication and aggregate records in one server transaction. A global 300-new-visits/minute guard bounds burst writes. Local development and Netlify/Vercel preview contexts are excluded. `GET /api/admin/visitors` requires a verified allowlisted administrator and returns uncached totals. The Firestore collections `visitorAnalytics`, `visitorRegistry` and `visitorAnalyticsLimits` deny direct client access; deploy the updated rules with the app. Existing Firebase Admin credentials are required. Do not TTL/delete visitorRegistry records if all-time browser deduplication is to be retained.

The counters are estimates of browsers, not verified people: cleared storage, multiple devices and undetected bots can affect totals; users with unavailable storage or Do Not Track are excluded. Tracking failure never blocks normal website use. The admin display was manually reviewed with clearly labelled sample values; production collection, API/regression tests and builds were not run for this addition, per the user's test preference.

### Canonical URL configuration

Public pages have self-referencing canonical links and are listed at `/sitemap.xml`. Both use the origin of `APP_URL`, falling back to `https://agreementprint.in`. Set `APP_URL` to the preferred production domain, including `https://`, before building. Keep `publicPagePaths` in `lib/seo.ts` aligned with public page metadata when adding routes. Account, tracking, admin, payment and redirect routes are excluded from the sitemap.


### Residential lease agreements

Step 4 now offers Rental or Residential Lease Agreement. Lease uses `LEASE AGREEMENT BLANK for website.doc` in English for House/Flat properties, with both Rs.100 and Rs.200 stamp choices. The existing package pricing, courier selection, notary option and checkout apply to both agreement types. `agreementTerms.agreementType` persists in drafts and orders; missing values on older orders mean Rental.

Lease collects a positive refundable advance (stored as `securityDeposit`), maintenance, commencement date, duration (default 11 months) and notice (default 90 days). Monthly rent and escalation are zero and their controls are hidden. Server validation and Firestore rules enforce the English/residential/no-monthly-rent restrictions. The shared renderer chooses the lease draft for customer preview, confirmation, order history and admin printing. The 15 source clauses remain, with form values replacing dates, amounts, duration and notice. Clause 1 is clarified as no separate monthly rent consistently with clause 2's interest-as-rent wording. Clause 15's replacement-tenant provision is retained and flagged in review alongside the no-subletting clause.

Rs.100 reserves the stamp image on page 1; Rs.200 reserves it on pages 1 and 2. Rs.200 moves clauses 7-12 to page 3 to allow space for the second stamp image. Long entries may expand when printed. Lease labels appear in order history, admin details and paid bills. Deploy the updated Firestore rules with the app before accepting lease orders. No tests, typecheck, lint or build were run for this change, per the user's instruction; print layout and checkout await an authorized verification run.

Lease verification (authorized subsequent run): 133 existing tests and two lease regression tests passed; ESLint passed. The lease regressions exercise both stamp options, all 15 clauses, selected values, invalid combinations, and checkout change detection. Firebase emulator checks require Java, which is not installed/on PATH in this environment.


### Agreement QA corrections (17 October 2026)

English Rs.100/Rs.200 rental contracts now render monthly maintenance and annual rent escalation explicitly (including zero). Clause 10 holds the annual increase instead of duplicating unlawful-use restrictions. Execution wording and rent-receipt grammar are corrected. Tamil residential/shop contracts describe escalation as annual and retain explicit maintenance, due day, notice, duration and painting where applicable. All rental languages and lease documents identify property type/furnishing, including Unfurnished.

Owner and tenant forms collect relationship wording separately from the relative name. Rental/lease print and customer previews use Son of, Daughter of, Wife of, Husband of, Child of or Spouse of; Tamil uses the corresponding parent/spouse labels. Missing legacy relationships remain neutral, without assuming S/o. The selection is retained in person details and participates in checkout detail comparisons. Firestore validates provided relationship values.

Property PIN validation uses a bundled Department of Posts directory snapshot in `src/content/tamil-nadu-postcodes.json`, both before the review step and at server checkout. See the adjacent SOURCE.md for provenance, refresh requirements and limitations. Permanent-address PINs remain India-wide; delivery validation is separate. Firestore rejects property PINs outside Tamil Nadu's broad prefix range; the application/server enforce the full directory checks. Deploy the updated rules with the app.

Custom Agreement and My Requests use the root layout's single main landmark. `devIndicators: false` disables Next's development indicator after restarting the development server. Public launch still requires `npm run build` and production hosting/start (never `next dev`). These local changes do not deploy the site or establish that the public host uses a production build.

Focused agreement regression tests cover maintenance Rs.1,500, escalation 15%, both stamp options, English/Tamil house/shop and shared customer/final output, all relationship choices, invalid property PINs, and permanent addresses outside Tamil Nadu. The full suite, production build, payment calls and emulator checks were not run for these corrections.


### Admin display corrections (17 October 2026)

A shared `maskedAadhaar` formatter masks legacy full-length values at display time and shows only their last four normalized digits. Missing/unusable values show Not provided. It is used in admin order review, customer review and confirmation; records are not rewritten or migrated.

Pricing inputs have unique label associations covering stamp denomination and delivery region. The order-status selector and audit-note input have associated labels. Inline pricing errors use the same whole-rupee/minimum/maximum checks as save validation; blank number inputs stay blank and invalid rather than coercing to zero. Any invalid rate suppresses the live matrix and disables/guards Save All Rates. Notary may validly be zero. No live pricing settings or customer records were edited during verification.

Property PIN policy updated: exactly six digits, starting with 6, and membership in the bundled Tamil Nadu directory. City spelling and address text are not cross-checked against postal locality names. City and address remain required form fields.
