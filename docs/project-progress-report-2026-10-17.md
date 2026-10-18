# AgreementPrint / StampVendor project progress report

Report date: **17 October 2026, IST**

## Scope

Prepared from local Git history, source code, README.md, CODE_REVIEW.md, policy reviews and this conversation. The earliest Git record is **14 October 2026**. An existing website was imported that day, so the actual project may have started earlier. Features included in the import cannot all be assigned an exact development date.

Implemented means present in source, not necessarily deployed or verified with real customers. Historical test results are distinguished from checks run in this conversation. No live payment, customer-data modification, deployment or current live-site review was performed to prepare this report.

## Timeline

| Date | Work recorded |
| --- | --- |
| 14 October | Repository initialized at 10:06 IST. Existing StampVendor app imported at 10:40 and merged through pull request #1 at 10:45. |
| 14 October | Property/tenant form layout and validation improved. Tests added for agent referrals, storage and PhonePe. Another commit describes command-summary/navigation work, which is not treated here as a customer feature milestone. |
| 14 October | Netlify configuration added, Linux CSS binaries included, example credentials removed and secret-scan exceptions narrowed. |
| 15 October | Shared API-response reader and error-handling tests committed. Repository-wide review documented authentication, security, document, database-rule and deployment fixes. |
| 16 October | Paid-order PDF bill functionality/tests recorded. Policy pages refactored around a shared component and supplied content. Policy/PhonePe readiness reviews documented local-versus-public gaps. |
| 16–17 October | Hosting costs and SEO reviewed in this conversation. Canonicals, sitemap, search exclusions, homepage title and sharing image implemented locally. Exact dates of individual chat edits are not independently recorded. |
| 17 October | This progress report prepared. |

## Customer website and ordering

- Home, About, Services, Contact, FAQ, Pricing, How It Works and policy pages are present.
- Guided rental ordering collects property, owner, tenant and agreement details, followed by review and checkout.
- Firebase Google sign-in, Firestore records, customer order history and tracking are implemented.
- Corrections preserve customer clarification text and display it to administrators.
- English/Tamil translation resources and document-language handling are included.
- Required-field, PIN-code, date and agreement-input validation received improvements.
- Account-dependent screen state was isolated to prevent stale data appearing after account changes.

## Documents and customer bills

Rental-agreement generation, print/PDF utilities and a free rent-receipt page are present. Document fixes cover month-overflow/timezone errors, invalid dates/tenures, paise, large/non-finite values, duplicate currency units and zero deposits.

Paid customers can download a private PDF bill from confirmation, payment-return and My Orders screens. The authenticated server endpoint checks ownership, saved totals and consistent payment records. PDFKit and a bundled Noto Sans font generate the receipt. Pending, failed, refunded or inconsistent payments cannot produce a paid bill.

The bill is a payment receipt, not a GST tax invoice or tenancy rent/deposit receipt. Automatic bill emailing is not implemented. Long agreement inputs and previously reported omissions of maintenance-charge/rent-increase fields still need review.

## Payments and pricing

- PhonePe Business checkout, status verification and authenticated webhooks are implemented.
- Server calculations determine payable amounts; private trusted attempts protect against forged customer payment fields.
- Per-order locks, pending-attempt reuse and coordinated credit reservations address duplicate checkout/retry risks.
- Ambiguous gateway outcomes require verification before replacement checkout.
- Pricing validation checks whole-rupee values and package minimums; changed quotes require customer review.
- Legacy payment endpoints and the obsolete general upload endpoint return HTTP 410.
- A separate fixed Rs.1 PhonePe test product uses isolated records without creating agreement orders/referral rewards.

These implementations do not prove that a real checkout/webhook/refund cycle has passed in production. Returning from PhonePe alone is not proof of payment. Automated gateway refunds are not established by the reviewed work.

## Referrals, coupons and agents

Customer referral links, first-paid-order rewards and checkout credit redemption are implemented. Current documented management has Customers and Agents: customer referrers share reward/discount settings, while each agent has separate reward and new-customer discount amounts.

Server reservations protect first-order eligibility and snapshot pending checkout discounts. Discounts are capped at the order total. Agent payout eligibility requires a matching confirmed paid order; sign-in attribution is reported separately. Zero-rate rewards are excluded from amounts due.

Admins can manage/pause agent codes, retain history and record payouts manually. Removal preserves historic records. Latest customer-settings corrections load both rates before editing, reject empty-as-zero input, distinguish unavailable totals and save rates with an audit entry transactionally. README notes regression updates for that latest correction await a future test run.

## Custom agreements and private files

Customers can submit sample PDF, DOCX, JPEG or PNG files for manual review and quotation. Current files use private Supabase Storage; Firebase handles identity and application records.

Implemented controls include owner/admin access checks, short-lived signed downloads, size/type/signature checks, bounded DOCX checks, hashes and immutable upload retries. Admin workflow includes review, assignment, private notes, customer messages, quotations and expected completion dates. Accepted quotation prices are immutable.

Scheduled abandoned-upload cleanup, production TTL configuration and retention decisions remain operational tasks. File validation does not include antivirus scanning. Automatic calls, emails and WhatsApp notifications are not sent by this workflow.

## Administration and hardening

Admin functionality covers orders, corrections, dispatch, courier partners, support settings, referrals/coupons and custom requests. The recorded review tightened administrator allowlists, customer order/correction rules and private server collections.

Additional fixes include bounded JSON bodies, readable errors for invalid/HTML API responses, transactional enquiry/tracking limits, non-cacheable tracking responses, cryptographic order IDs and aligned validation across client/server/rules.

Tracking intentionally remains reference-plus-phone based. Rate limiting reduces guessing but is not authenticated account access. Dependency overrides and a postinstall parser-depth mitigation address documented dependency issues. Historical audits reported zero known production vulnerabilities and seven development-tool findings; no fresh audit was run for this report.

## Policies and business content

Terms, Privacy, Refund/Cancellation, Return and Shipping pages use shared rendering and supplied policy content. A Disclaimer page is also present. Current source identifies Net Time Systems/AgreementPrint, includes the Nanganallur address and hours, and has a grievance-contact section and configured grievance phone.

The 16 October policy audit found older content on the public site and 404 responses for Return and Shipping. Those are historical findings, not current live checks. Older missing-address/grievance observations are partly superseded by current source.

Owner review remains necessary: licence/issuing-authority fields and general support phone/WhatsApp are blank, while an authorised-vendor claim is present. Confirm evidence and contacts. Supplied privacy text promises self-service account deletion; verify that an actual matching flow exists. Confirm all service, refund and delivery promises against operations. No PhonePe KYC approval or policy certification was obtained through this work.

## Hosting and development

The app uses Next.js 15, React 19, TypeScript and Tailwind CSS 4 with server functionality. Work includes Netlify settings, standalone packaging, Linux CSS dependencies, a Firebase Admin CommonJS/ESM compatibility override and separate development/build directories.

GitHub is documented as the shared source of truth across AI Studio/local tools. CI is configured for lint, TypeScript, application tests, Firebase emulator tests and production builds. Configuration does not establish the latest remote CI result.

Your Netlify exhaustion was identified as deployment-related. We discussed preview/branch deployments and fewer production publishes. Cloudflare was considered subject to compatibility testing. The pictured Hostinger Single plan lacked required Node.js support; Node.js-capable Business hosting was discussed. No plan purchase, migration or hosting change was performed in this session.

## SEO completed in this conversation

- Canonical URLs on 16 public pages.
- Shared production origin using APP_URL, defaulting to https://agreementprint.in.
- Generated /sitemap.xml excluding account, tracking, admin, payment and redirect routes.
- noindex/nofollow on My Orders, My Requests, payment return and payment test; Admin already had noindex.
- Homepage title: Online Rental Agreements in Tamil Nadu | AgreementPrint.
- Visually checked 1200 x 630 sharing image using the existing logo/blue branding, connected to Open Graph and Twitter metadata.
- README documentation for canonical/sitemap configuration.

These changes remain local in the inspected workspace. They do not establish indexing/ranking improvements, Search Console verification or measured performance improvements. No robots.txt, business schema or dedicated rental-agreement service landing page was added in these changes.

## Verification record

| Checkpoint | Recorded result | Qualification |
| --- | --- | --- |
| 15 October review | 95 application tests, 13 emulator tests, lint, TypeScript and production build passed. | Historical results from CODE_REVIEW.md. |
| 15 October smoke checks | 22 pages, 14 homepage assets and 13 expected API error responses passed; unknown route returned 404. | Local standalone checks. |
| Later README referral checkpoint | 121 application tests, 15 emulator tests, lint, TypeScript and isolated build passed. | Exact date not recorded; later settings edits require fresh checks. |
| SEO edits in this chat | TypeScript, targeted lint, canonical/sitemap scope checks and whitespace checks passed; image visually inspected. | Full suite/build and live social-crawler checks were not rerun for SEO changes. |

## Next actions

1. Review pending changes, confirm production APP_URL and commit intended work.
2. Run full release checks after latest settings/SEO changes and inspect remote CI.
3. Deploy app and matching Firestore rules/indexes with required server secrets. Current uploads use Supabase, not Firebase Storage.
4. Check live policy pages, sitemap, canonical/noindex tags and sharing image; submit sitemap in Search Console.
5. Verify Google sign-in, ordering/corrections, PhonePe sandbox/webhooks, private uploads/downloads, bills and admin actions in staging.
6. Confirm business credentials, contacts, grievance handling and policy promises.
7. Configure relevant TTLs, safe abandoned-upload cleanup and retention rules.
8. Review long printed agreements and treatment of maintenance/rent-increase terms.

## Evidence

Git commits 0fa6a3e through f4a6dc4; README.md; CODE_REVIEW.md; docs/policy-review.md; docs/phonepe-policy-audit.md; .github/workflows/checks.yml; current application/configuration/assets; this conversation. No private environment values were included.
