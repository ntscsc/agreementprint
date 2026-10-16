import type { Order } from './types';

export function getOrderBill(order: Order) {
  if (order.payment?.status !== 'Paid') throw new Error('A bill is available only after payment is confirmed.');
  const payment = order.payment;
  const money = (value: unknown) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.round(value * 100))) {
      throw new Error('The saved payment details require review before a bill can be issued.');
    }
    return Math.round(value * 100);
  };
  const paid = money(payment.amount);
  const credits = money(payment.referralCreditApplied ?? 0);
  const discount = money(payment.couponDiscount ?? 0);
  const total = money(payment.totalBeforeCredits ?? (paid + credits) / 100);
  const subtotal = money(payment.subtotal ?? (total + discount) / 100);
  if (subtotal - discount !== total || total - credits !== paid) {
    throw new Error('The saved payment totals do not balance. Please contact support.');
  }
  return {
    reference: `AP-${order.orderId}`,
    orderId: order.orderId,
    customerEmail: order.customerEmail,
    orderDate: order.createdAt,
    paidAt: payment.paidAt,
    gateway: payment.gateway ?? 'Recorded payment',
    transaction: payment.phonepeTransactionId ?? payment.razorpayPaymentId ?? payment.phonepeMerchantOrderId,
    description: `Rental agreement package${order.agreementTerms.stampPaperDenomination ? ` - Rs. ${order.agreementTerms.stampPaperDenomination} stamp paper` : ''}, preparation, printing and delivery${order.agreementTerms.includeNotary ? ', including selected notary service' : ''}`,
    subtotal: subtotal / 100,
    discount: discount / 100,
    couponCode: payment.couponCode,
    credits: credits / 100,
    paid: paid / 100,
  };
}

export type OrderBill = ReturnType<typeof getOrderBill>;
