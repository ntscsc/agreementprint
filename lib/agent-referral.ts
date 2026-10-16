import { type Firestore } from 'firebase-admin/firestore';
import { ApiInputError } from '@/lib/api-input';

export async function recordAgentReferral(db: Firestore, code: string, user: { uid: string; name?: string; email?: string }) {
  const paidOrders = await db.collection('orders').where('ownerUid', '==', user.uid).get();
  if (paidOrders.docs.some(order => order.data().payment?.status === 'Paid')) throw new ApiInputError('Only new customers can use a referral coupon.', 409);
  await db.runTransaction(async transaction => {
    const codeRef = db.collection('referralCodes').doc(code);
    const customerRef = db.collection('agentReferralCustomers').doc(user.uid);
    const [agent, customer, firstPaid] = await Promise.all([transaction.get(codeRef), transaction.get(customerRef), transaction.get(db.collection('referralFirstPaidOrders').doc(user.uid))]);
    if (firstPaid.exists) throw new ApiInputError('Only new customers can use a referral coupon.', 409);
    if (agent.data()?.kind !== 'agent' || agent.data()?.active === false || agent.data()?.deletedAt) throw new ApiInputError('Agent code not found.', 404);
    if (customer.exists) return;
    transaction.create(customerRef, {
      code, uid: user.uid, name: user.name || '', email: user.email || '',
      joinedAt: new Date().toISOString(), rewardStatus: 'Awaiting payment',
    });
  });
}
