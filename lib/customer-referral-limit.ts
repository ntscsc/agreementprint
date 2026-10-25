import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { ApiInputError } from '@/lib/api-input';

export const CUSTOMER_REFERRAL_LIMIT = 3;
export const CUSTOMER_REFERRAL_LIMIT_MESSAGE = 'This customer has already referred the maximum of 3 new customers. Use another referral code or continue without a coupon.';

export async function customerReferralCapacity(db: Firestore, uid: string, tx?: Transaction) {
  const ref = db.collection('customerReferralLimits').doc(uid);
  const snapshot = tx ? await tx.get(ref) : await ref.get();
  const saved = snapshot.data();
  // Seed from existing rewards so the limit also applies to established accounts.
  const rewards = saved ? null : await db.collection('referralRewards').where('referrerUid', '==', uid).get();
  const rewarded: string[] = saved?.rewarded ?? rewards!.docs.map(doc => doc.id);
  const pending: Record<string, string> = { ...(saved?.pending ?? {}) };
  return { ref, rewarded, pending };
}

export function assertCustomerReferralCapacity(capacity: { rewarded: string[]; pending: Record<string, string> }, referredUid: string) {
  const customers = new Set([...capacity.rewarded, ...Object.keys(capacity.pending)]);
  if (!customers.has(referredUid) && customers.size >= CUSTOMER_REFERRAL_LIMIT) throw new ApiInputError(CUSTOMER_REFERRAL_LIMIT_MESSAGE, 409);
}
