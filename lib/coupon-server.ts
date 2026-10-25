import { customerReferralCapacity, assertCustomerReferralCapacity } from '@/lib/customer-referral-limit';
import type { Firestore } from 'firebase-admin/firestore';
import { ApiInputError } from '@/lib/api-input';
import { couponTotal, isValidCouponCode, couponDiscountAmount } from '@/lib/coupon';

export interface CouponQuote { code: string; subtotal: number; couponDiscount: number; total: number; }

export async function getCouponQuote(db: Firestore, uid: string, code: string, subtotal: number, orderId?: string): Promise<CouponQuote> {
  if (!code) return { code: '', ...couponTotal(subtotal, 0) };
  if (!isValidCouponCode(code)) throw new ApiInputError('Enter a valid coupon code.');
  const [coupon, firstPaid, orders, reservation, settings, legacyDiscounts] = await Promise.all([
    db.collection('referralCodes').doc(code).get(),
    db.collection('referralFirstPaidOrders').doc(uid).get(),
    db.collection('orders').where('ownerUid', '==', uid).get(),
    db.collection('firstOrderCoupons').doc(uid).get(),
    db.collection('settings').doc('referrals').get(),
    db.collection('settings').doc('coupons').get(),
  ]);
  const data = coupon.data();
  if (!data || data.active === false || data.deletedAt || data.kind === 'coupon') throw new ApiInputError('This referral coupon is invalid or inactive.', 400);
  if (data.uid === uid) throw new ApiInputError('You cannot use your own coupon code.');
  if (firstPaid.exists || orders.docs.some(doc => doc.data().payment?.status === 'Paid')) throw new ApiInputError('Coupons are available on your first paid order only.', 409);
  if (orders.docs.some(doc => doc.id !== orderId && doc.data().payment?.status === 'Pending' && (doc.data().payment?.phonepeMerchantOrderId || doc.data().payment?.reservationKey))) throw new ApiInputError('Another order has a pending checkout. Check its payment status before using a first-order coupon.', 409);
  if (reservation.data()?.state === 'reserved' && reservation.data()?.orderId !== orderId) throw new ApiInputError('Your first-order coupon is already reserved for another checkout. Complete it or wait for confirmed payment failure before using a different order.', 409);
  if (data.kind !== 'agent' && typeof data.uid === 'string') assertCustomerReferralCapacity(await customerReferralCapacity(db, data.uid), uid);
  let discountAmount;
  try { discountAmount = couponDiscountAmount(data, { ...legacyDiscounts.data(), ...settings.data() }); }
  catch { throw new ApiInputError('This coupon is temporarily unavailable.', 503); }
  return { code, ...couponTotal(subtotal, discountAmount) };
}
