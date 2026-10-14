# StampVendorWebsite

A web application for stamp vendor services and rental agreement drafting, with customer ordering, fee calculation, order tracking, and an administration interface. Standard rental orders collect entered details. A separate custom agreement service accepts private sample templates/photos for review and manual quotation.

Repository: https://github.com/pradeep1992official/StampVendorWebsite

## Features

- Guided order intake for property, owner, tenant, and agreement terms.
- Rental agreement document generation and PDF utilities.
- Fee calculation and pricing display.
- Customer order history and tracking.
- Google sign-in through Firebase Authentication.
- Firebase Firestore and Storage integration.
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
| Authentication and data | Firebase Authentication, Firestore, Storage |
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
| `APP_URL` | Public application URL used for production integration redirects, including the PhonePe payment return URL (for example, `https://your-domain.example`). Local development uses the current request origin instead. |

Configure the PhonePe webhook in the PhonePe Business dashboard to call `https://<your-domain>/api/payment/phonepe/webhook` and use the same webhook username and password configured above. Checkout uses the server-calculated saved order total; credentials are never exposed to the browser. Missing PhonePe or Firebase Admin credentials prevent online checkout and payment confirmation.

Never commit real secrets or add secret keys to browser-visible variables. `.env.local` is excluded by the repository's existing `.gitignore`.

## Firebase configuration

`lib/firebase.ts` loads client configuration from `firebase-applet-config.json` and uses its `firestoreDatabaseId` when initializing Firestore.

Before using the application:

1. Confirm the Firebase project, Storage bucket, and Firestore database ID are the intended ones.
2. Enable Google sign-in and authorize the domains used for local development and hosting in Firebase Authentication.
3. Review and deploy `firestore.rules` and `storage.rules` to the intended project through your Firebase deployment setup or console.
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

Pricing is validated before saving, when reading saved settings, during fee calculation, and at checkout. The four package prices must be whole rupees and cover stamp duty plus courier: minimums are Rs.150/Rs.200 for Rs.100 stamp paper in Chennai/Tamil Nadu and Rs.250/Rs.300 for Rs.200 stamp paper; the optional notary surcharge may be zero. Non-finite, fractional, negative and unsafe amounts are rejected. Firestore rules enforce the same constraints on direct writes to `settings/pricing`. Deploy both the Firestore and Storage rule changes with the application.

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


## Custom agreement requests

- `/custom-agreement`: Google sign-in, agreement purpose/language/customisation, contact consent and preference, one to three PDF/DOCX/JPG/PNG samples (10 MB each). No payment at submission.
- `/my-requests`: private history, customer-visible quotes/messages, clarification replies, cancellation before acceptance and retry of sample verification.
- Admin **Custom Requests**: review, assignment, private notes, customer messages, quote and expected completion date. Manual contact and quote acceptance; moving Quote Sent to Accepted requires confirmation that the customer accepted. Accepted prices are immutable. No automatic calls, emails or WhatsApp messages are sent.
- Request creation reserves immutable file descriptors under `customAgreementRequests`. Shared transactions limit each account to five requests/day and the service to 30/minute. Direct Firestore request/audit/limiter access is denied, including client admins. The authorized API strips staff-only fields from customer responses.
- The browser uploads samples through an authenticated server endpoint that enforces reserved ownership, exact size/type, and immutable private storage. Finalization checks the stored file size/type, file signatures and bounded DOCX structure before publishing the request for review. This validation does not perform antivirus scanning.
- Deploy the app, Firestore/Storage rules and `firestore.indexes.json` together. `firebase.json` contains the production rule/index paths; always supply the intended project explicitly, e.g. `firebase deploy --only firestore,storage --project CLIENT_PROJECT_ID`. This command is documentation only; no live deployment was performed. Preserve other existing production indexes when deploying. Customer listing needs the ownerUid/createdAt composite index and will work after it finishes building.
- Storage rules read reserved requests from the default Firestore database; ensure the client project uses `(default)` and enable the Firebase Storage service agent's Firestore access when deploying cross-service rules. Ensure the Storage bucket is provisioned and the server credential can read/write it and sign short-lived download URLs. Downloads require owner/admin authorization and completed file validation (or a legacy Clean scan), then receive a 60-second attachment URL.
- These uploads require Firebase Storage billing/account setup for the client's project. Test valid files, invalid signatures, oversized files, owner isolation, quote acceptance and customer replies against staging. Protocol tests use a local simulated daemon; they do not verify a deployed antivirus engine.
- Operational cleanup: remove files and records for abandoned Uploading requests older than 48 hours, plus unwanted cancelled drafts, through a privileged scheduled job. Check state again transactionally before deleting; do not apply a blanket bucket lifecycle to active/completed samples. Configure TTL on `customAgreementLimits.expiresAt` for account counters. Agree a retention period for completed requests with the client before launch. Cleanup scheduling and production retention policy are not configured by this local implementation.

Local validation: 68 application tests and 11 Firebase rules emulator tests pass, including request isolation, forged metadata, immutable uploads, server-controlled transitions, quote acceptance, clarification persistence, file validation and immutable server uploads. ESLint and TypeScript pass. The isolated standalone build and HTTP checks passed: both new pages returned 200 and all unauthenticated custom-request/download routes returned 401. Real Firebase login/uploads, signed download URLs  still need staging verification; no production customer data or live accounts were modified.

References: [Firebase Admin Storage](https://firebase.google.com/docs/storage/admin/start), [serverless payload limits](https://vercel.com/docs/functions/limitations).

## Earlier recheck fixes

- Enquiries now use the server Admin SDK. Deploy the updated Firestore rules together with the application: client creation of enquiries is denied. The server transaction atomically writes the enquiry and shared counters (3 per phone per hour, 30 total per minute, and a one-minute identical-message guard). The limiter collection is private. Enable Firestore TTL on `enquiryLimits.expiresAt` to clean up expired phone counters; the global counter is one rolling document.
- Package minimums include fixed courier charges, so the itemized sum cannot exceed the total. Existing admin prices below these minimums need correction before checkout resumes.
- Pricing read failures no longer produce confirmed default quotes. Checkout requires the exact reviewed total; changed/missing quotes are shown for approval and checked again before payment. Wizard, My Orders, and return-page retries share this flow.
- Shared agreement validation runs during client order creation, the final wizard submission, and server checkout, before reservations/gateway requests. Malformed JSON and request IDs return 400; invalid/expired tokens return 401.
- Transitive dependency overrides update gRPC, PostCSS, selector parsing, FTP, UUID and telemetry dependencies. Production audit reports zero vulnerabilities. Seven development-only audit entries remain associated with upstream `braces@3.0.3`, which has no patched release. `npm install`/`npm ci` applies a fail-closed parser depth limit using `scripts/patch-braces.mjs`; tests cover regular expansion and hostile nesting across public string APIs. Do not omit install scripts. Review and remove the temporary mitigation when upstream releases a fixed version. The advisory is not suppressed.

These changes are local until deployed. Public tracking authentication was excluded from the requested fixes and remains an open finding. Live PhonePe sandbox and browser walkthroughs still need release verification.

Validation after these fixes: 60 application/regression tests and 9 Firebase rules emulator tests passed; project lint and TypeScript checks passed. The isolated build uses physical dependencies to validate standalone packaging.

The final isolated production build completed without standalone-copy warnings. Standalone HTTP smoke checks returned 200 for homepage/CSS, 400 for malformed contact/tracking/fee requests, and 401 for an invalid payment-status token.
