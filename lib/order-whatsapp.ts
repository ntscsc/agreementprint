import type { Order } from '@/lib/types';

export function orderWhatsAppLink(order: Order, stage: 'review' | 'prepare' | 'courier' | 'feedback', origin: string, trackingUrl: string | null) {
  if (order.status === 'Cancelled' || order.replacedByOrderId) return null;
  const digits = (order.customerPhone || order.ownerDetails.phone || '').replace(/\D/g, '');
  const phone = digits.length === 10 ? `91${digits}` : digits;
  if (!/^91[6-9]\d{9}$/.test(phone)) return null;
  const reference = order.publicReference || order.orderId;
  const account = new URL('/my-orders', origin).href;
  let update: string;
  if (stage === 'review') {
    if (!['Submitted', 'Under verification', 'Documents needed'].includes(order.status)) return null;
    update = order.status === 'Documents needed'
      ? `We need a few corrections to your agreement details.${order.correctionMessage ? `\n${order.correctionMessage}` : ''}\n\nPlease sign in and review the requested corrections:\n${account}`
      : order.payment.status !== 'Paid'
        ? `Your agreement order is saved. Please sign in to review the payment status and complete payment if needed:\n${account}`
        : `We have received your agreement order and are reviewing the details.\n\nView your order:\n${account}`;
  } else if (stage === 'prepare') {
    if (order.status !== 'Drafting') return null;
    update = `We are preparing your agreement on stamp paper. We will share the courier details after dispatch.\n\nView your order:\n${account}`;
  } else if (stage === 'courier') {
    if (order.status !== 'Dispatched' || !order.courier?.trackingNumber) return null;
    update = `Your agreement has been dispatched.\n\nCourier: ${order.courier.courierName}\nConsignment number: ${order.courier.trackingNumber}${trackingUrl ? `\nTrack your delivery: ${trackingUrl}\nEnter the consignment number above if requested.` : ''}\n\nView your order:\n${account}`;
  } else {
    if (order.status !== 'Delivered') return null;
    update = `Your agreement has been delivered. Thank you for choosing AgreementPrint!\n\nPlease share your feedback about your experience:\n${new URL('/reviews', origin).href}`;
  }
  return `https://wa.me/${phone}?text=${encodeURIComponent(`Hello,\n\nOrder: ${reference}\n\n${update}\n\nThank you,\nAgreementPrint`)}`;
}
