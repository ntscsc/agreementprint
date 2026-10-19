# Payment gateway setup

The admin console's **Payment Gateway** section selects PhonePe or Razorpay for new rental/lease orders, custom agreement payments and replacement balances. PhonePe remains the default when no setting exists. Unconfigured gateways cannot be activated.

Only the authenticated admin API writes `settings/paymentGateway`, with an audit entry and a check against concurrent changes. No API secrets are returned to the admin screen. Deploy the updated Firestore rules with the application.

## Razorpay

Set these server environment variables in local `.env.local` or your hosting's secret settings:

```
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
APP_URL=https://agreementprint.in
```

Use `rzp_test_...` credentials for staging. Configure automatic payment capture in the Razorpay dashboard. Orders are marked paid only after server verification of the exact order, INR amount and full captured payment; a successful browser callback alone is insufficient.

The supplied test key ID and secret are configured locally in the ignored `.env` file. Restart the development server after changing environment files. Only the public key ID is returned by the authenticated checkout-options endpoint; the key secret stays on the server. A `NEXT_PUBLIC_` variable is not needed for this integration. If `.env.local` defines the same variables, Next.js gives those values priority.

### Standard Checkout endpoints

The existing routes are reused instead of adding a second payment implementation:

- `POST /api/payment/phonepe/create-order` is the existing order checkout router. It uses the admin-selected gateway, calculates the payable amount on the server, and creates a Razorpay order when Razorpay is selected. The historical path also serves existing PhonePe orders.
- `POST /api/payment/razorpay/test-product` with `{ "action": "start" }` creates or resumes the fixed Rs.1 product. It does not require changing the active gateway for customer orders. New order responses include `order_id`, `amount` in paise and `currency`, plus the internal reference and checkout link.
- `POST /api/payment/razorpay/checkout` with `{ "action": "options", "attempt": "..." }` returns the authenticated customer's saved order and public key ID for the modal.
- The same endpoint with `action: "verify"`, `attempt`, `razorpay_order_id`, `razorpay_payment_id` and `razorpay_signature` validates HMAC-SHA256 against the server's stored order ID, then confirms capture and the exact amount before returning `paid: true`. Missing fields and signature mismatches return HTTP 400. All payment actions require the signed-in customer's Firebase bearer token.

Order creation uses the `razorpay` Node SDK and rejects amounts below 100 paise. The existing Standard Checkout page loads `https://checkout.razorpay.com/v1/checkout.js`, opens the modal and handles both dismissal and `payment.failed`.

### Try the checkout manually

1. Run `npm run dev` and open `http://localhost:3000/payment-test?gateway=Razorpay`.
2. Sign in, select Razorpay and click **Test Rs.1 with Razorpay**.
3. On the secure checkout page, click **Continue to payment** to open the Razorpay modal.
4. Use Razorpay's test payment methods to complete or cancel the payment. Successful checkout verifies the signature and capture on the backend, then returns to the test page. Use **Check payment status** to view the result.

No automated tests or payment transactions were run during the credential setup and Standard Checkout completion.

Configure a Razorpay webhook at:

```
https://agreementprint.in/api/payment/razorpay/webhook
```

Subscribe to `payment.captured` and `order.paid`, and set `RAZORPAY_WEBHOOK_SECRET` to the secret chosen in the dashboard. Standard Checkout and signature verification work with the key ID and key secret alone; the webhook secret is required to accept background webhook notifications, including when the browser closes before confirmation. Raw webhook bodies are bounded and authenticated with HMAC SHA-256. Replay is safe because settlement is transactional and idempotent. Refunds are reconciled through the admin refund controls using the original payment provider and a stable Razorpay refund idempotency key.

After configuring test credentials and the webhook, select Razorpay in the admin console, place test orders, exercise success and cancellation, and verify the order status. Use live credentials only after staging verification. The `/payment-test` page has a PhonePe/Razorpay selector and an isolated Rs.1 test product for each provider. This selection does not change the active gateway for customer orders. Test-mode keys simulate payment; live keys charge Rs.1, as shown before payment. Each provider keeps its own customer test-payment reference. Browser callbacks and webhooks confirm Razorpay test payments through the same capture-verification flow used by real orders, without creating an agreement, referral reward or order.

## Existing checkouts and refunds

- A pending checkout stays with its original gateway after the active setting changes. Changing the setting does not create a new charge for a pending order.
- Discounts, prices and credits are calculated and reserved on the server before either provider is called. Fully credit-funded or coupon-funded orders need no gateway charge.
- Razorpay orders remain resumable after an individual payment fails or the customer closes checkout; these events do not release reserved credits or start another order.
- A timeout during Razorpay order creation is held for reconciliation rather than creating a second payable order. If the provider order was already associated successfully, its local checkout link can be recovered automatically. If the process stopped before the provider ID could be saved, support must reconcile the Razorpay order by the hashed receipt before repairing the private association. Never delete the association to retry blindly.
- Keep the original provider credentials available while payments or refunds are pending. Changing to a different Razorpay account/key ID blocks verification of older checkouts until their original credentials are restored.
- Existing collection and field names containing `phonepe` are retained for backward compatibility. The authoritative attempt's `gateway` determines the provider; new Razorpay associations are held in server-only collections. Refunds use those protected associations, independent of the active setting.
- Refund approval retains the existing live-mode requirement and policy checks. Test-mode refunds remain blocked by the application's refund flow.

## Validation

`npm test` includes mocked provider and transactional service tests for both gateways, including switching, concurrency, capture verification, callbacks, webhooks, coupons, credits and refunds. `npm run test:rules` exercises the actual security rules against local Firebase emulators and requires Java. These tests do not charge a card or modify production accounts.

Provider references:

- https://razorpay.com/docs/payments/server-integration/nodejs/integration-steps/
- https://razorpay.com/docs/api/refunds/normal-refunds-idempotent
