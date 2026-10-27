export function draftApprovalWhatsAppLink(request: { phone: string; name: string; requestId: string; publicReference?: string }, origin: string) {
  const digits = request.phone.replace(/\D/g, '');
  const phone = digits.length === 10 ? `91${digits}` : digits;
  if (!/^91[6-9]\d{9}$/.test(phone)) return null;
  const review = new URL('/my-requests', origin);
  review.searchParams.set('requestId', request.requestId);
  const message = `Hello ${request.name},\n\nYour agreement draft (${request.publicReference || request.requestId}) is ready for review.\n\nSign in with the account used for your request:\n${review.href}\n\nDownload and check the draft, then choose Approve draft or Request changes.\n\nThank you,\nAgreementPrint`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function quoteWhatsAppLink(request: { phone: string; name: string; requestId: string; publicReference?: string; quoteAmount?: number; quoteValidUntil?: string }, origin: string) {
  const digits = request.phone.replace(/\D/g, '');
  const phone = digits.length === 10 ? `91${digits}` : digits;
  if (!/^91[6-9]\d{9}$/.test(phone) || !Number.isFinite(request.quoteAmount) || request.quoteAmount! <= 0) return null;
  const review = new URL('/my-requests', origin);
  review.searchParams.set('requestId', request.requestId);
  const validity = request.quoteValidUntil ? `\nValid until: ${new Date(`${request.quoteValidUntil}T00:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}.` : '';
  const message = `Hello ${request.name},\n\nYour custom agreement quote (${request.publicReference || request.requestId}) is ready.\nTotal quote: ₹${request.quoteAmount!.toLocaleString('en-IN')}.${validity}\n\nSign in with the account used for your request to review the quote and pay securely:\n${review.href}\n\nThank you,\nAgreementPrint`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function courierWhatsAppLink(request: { phone: string; name: string; requestId: string; publicReference?: string; courier?: { courierName: string; trackingNumber: string } }, origin: string, trackingUrl: string | null) {
  const digits = request.phone.replace(/\D/g, '');
  const phone = digits.length === 10 ? `91${digits}` : digits;
  if (!/^91[6-9]\d{9}$/.test(phone) || !request.courier?.trackingNumber.trim()) return null;
  const review = new URL('/my-requests', origin);
  review.searchParams.set('requestId', request.requestId);
  const message = `Hello ${request.name},\n\nYour agreement (${request.publicReference || request.requestId}) has been dispatched.\n\nCourier: ${request.courier.courierName}\nConsignment number: ${request.courier.trackingNumber}${trackingUrl ? `\nTrack your delivery: ${trackingUrl}\nEnter the consignment number above if requested.` : ''}\n\nView your request:\n${review.href}\n\nThank you,\nAgreementPrint`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function feedbackWhatsAppLink(request: { phone: string; name: string; requestId: string; publicReference?: string }, origin: string) {
  const digits = request.phone.replace(/\D/g, '');
  const phone = digits.length === 10 ? `91${digits}` : digits;
  if (!/^91[6-9]\d{9}$/.test(phone)) return null;
  const feedback = new URL('/reviews', origin);
  const message = `Hello ${request.name},\n\nYour agreement (${request.publicReference || request.requestId}) has been delivered. Thank you for choosing AgreementPrint!\n\nWe would love to hear about your experience. Please share your feedback here:\n${feedback.href}\n\nThank you,\nAgreementPrint`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function requestStatusWhatsAppLink(request: { phone: string; name: string; requestId: string; publicReference?: string; status: string; customerMessage?: string }, stage: 'submitted' | 'review', origin: string) {
  const digits = request.phone.replace(/\D/g, '');
  const phone = digits.length === 10 ? `91${digits}` : digits;
  if (!/^91[6-9]\d{9}$/.test(phone)) return null;
  if (stage === 'submitted' ? request.status !== 'Submitted' : !['Under Review', 'Clarification Required'].includes(request.status)) return null;
  const review = new URL('/my-requests', origin);
  review.searchParams.set('requestId', request.requestId);
  const update = stage === 'submitted' ? 'We have received your custom agreement request. Our team will review your requirements and samples.'
    : request.status === 'Clarification Required' ? `We need some additional information to proceed.${request.customerMessage ? `\n\n${request.customerMessage}` : ''}\n\nPlease open your request and send your reply.`
    : 'Our team is reviewing your custom agreement requirements and samples. We will share the quote when ready.';
  return `https://wa.me/${phone}?text=${encodeURIComponent(`Hello ${request.name},\n\nRequest: ${request.publicReference || request.requestId}\n\n${update}\n\nView your request:\n${review.href}\n\nThank you,\nAgreementPrint`)}`;
}
