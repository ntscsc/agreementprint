# PhonePe policy readiness review

Reviewed 16 October 2026. Scope: six policy pages in local source and unauthenticated HTTP checks of https://agreementprint.in. This is a readiness review, not PhonePe approval or a certification of legal compliance. No deployment or KYC submission was performed.

## Assessment

Not ready to describe as approval-ready. The public website serves older content; two new policy routes return 404. The local revision covers the main topics but still requires verified business contact/grievance details and operational timing information.

## Page-by-page findings

| Page | Local revision | Public website at review |
| --- | --- | --- |
| /terms | HTTP 200; operator, service scope, prices/payment and governing law present. Fix `customer?s` punctuation. | HTTP 200; older service name, blank `Licence:` and no Net Time Systems identity/address. |
| /privacy-policy | HTTP 200; collection, purpose, providers, security, rights and retention purposes described. No named grievance officer; retention periods and request turnaround remain unspecified. | HTTP 200; older privacy text, no operator/address disclosure or meaningful provider explanation. |
| /refund-policy | HTTP 200; before/after-printing eligibility, deductions, original payment method and three-business-day initiation present. Specify request-decision timing and a bank-credit estimate confirmed with the gateway; verify ability to restore spent referral credits. | HTTP 200; old three-to-five-business-day credit promise and status-linked refund wording; charges after printing incompletely explained. |
| /return-policy | HTTP 200; personalised goods, damage/incorrect delivery, reporting target, return costs and customer errors covered. Confirm return-review and replacement-dispatch targets. | HTTP 404. |
| /shipping-policy | HTTP 200; area, dispatch target, tracking, charges and failed delivery covered. Only a two-day dispatch target is provided; no estimated transit/delivery range. Clarify calendar versus business days using the real fulfilment process. | HTTP 404. |
| /disclaimer | HTTP 200; independent status, limits of legal service, registration distinction and customer remedies covered. Fix `parties?` punctuation. | HTTP 200; old blank licence and certification/vendor-register claims. |

## Priority actions before resubmission

1. Deploy the reviewed revision and recheck all six public URLs and footer links without signing in. Localhost is not the site PhonePe reviews.
2. Supply an active customer support phone and a designated grievance officer's name, designation and contact details. Publish the complaint route and acknowledgement/resolution process. Rule 4 of the E-Commerce Rules specifies acknowledgement within 48 hours and redress within one month; staff must actually support these commitments.
3. Confirm Net Time Systems, the supplied door/address numbering, entity type and brand relationship against the merchant KYC documents and settlement account. This review did not access those records.
4. Supply realistic delivery/transit, replacement and refund-credit estimates. Do not invent carrier or bank promises just to fill a template. Keep the accepted quote/order and all policy timings consistent.
5. Verify the authorised vendor/e-Stamp claims still used in the local footer, About page and FAQ. `src/config/vendor.ts` has an empty licence field. This is missing evidence in the repository, not proof the business is unlicensed. Provide supporting credentials or remove unsupported claims before submission.
6. Confirm pradeep1992@official.com (or the Firestore-configured support email) is monitored, the published hours are correct, refunds can be handled within the promise, and referral credits can be restored where the policy promises it.
7. Fix the two visible punctuation errors. Do not change business identity/address placement: the user requested identity once per policy and address in policy pages only.

## Evidence and limits

- All six local URLs returned HTTP 200 and contained the operator name and address.
- Public /terms, /privacy-policy, /refund-policy and /disclaimer returned HTTP 200 but contained older policy content. Public /return-policy and /shipping-policy returned HTTP 404. Verified directly over HTTPS; the web browsing service could not read these pages, so checks used Python urllib as a fallback.
- No end-to-end payment/refund, mailbox delivery, carrier fulfilment, private KYC evidence or database permission audit was performed.
- PhonePe's public Merchant Profiling Guidelines describe identity/document verification and business restrictions, not a complete public policy-page approval rubric. Findings labelled as improvements are review judgments, not asserted PhonePe rules.

## Sources

- PhonePe Merchant Profiling Guidelines: https://www.phonepe.com/apollo/pdf/Merchant_Profiling_Guidelines.pdf
- PhonePe Grievance Policy (merchant fulfilment and refund disputes): https://www.phonepe.com/grievance-policy/
- Government notification, Consumer Protection (E-Commerce) Rules, 2020, especially Rule 4: https://static.investindia.gov.in/s3fs-public/2020-07/220661_7.pdf
- Government announcement of 2026 amendments, effective 1 January 2027 (not treated as already effective for this review): https://www.pib.gov.in/PressReleasePage.aspx?PRID=2308759&lang=1&reg=48
