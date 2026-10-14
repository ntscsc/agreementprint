'use client';

export async function requestReviewedCheckout(body: Record<string, unknown>, idToken: string) {
  const send = (data: Record<string, unknown>) => fetch('/api/payment/phonepe/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(data),
  });
  const response = await send(body);
  if (response.status !== 409) return response;
  const quote = await response.clone().json();
  if (!quote.quoteRequired || !Number.isSafeInteger(quote.reviewedTotal) || quote.reviewedTotal <= 0) return response;
  const message = `Review your payment:\nPackage total: ₹${quote.reviewedTotal}\nReferral credits: ₹${quote.creditApplied}\nAmount due: ₹${quote.amountDue}\n\nContinue with this price?`;
  if (!window.confirm(message)) throw new Error('Payment was not started. Review the price before continuing.');
  // A second server check is mandatory. A further price change returns another conflict.
  return send({ ...body, reviewedTotal: quote.reviewedTotal });
}
