import { type Firestore } from 'firebase-admin/firestore';
import { ApiInputError } from '@/lib/api-input';

export async function recordAgentReferral(db: Firestore, code: string, user: { uid: string; name?: string; email?: string }) {
  await db.runTransaction(async transaction => {
    const codeRef = db.collection('referralCodes').doc(code);
    const customerRef = db.collection('agentReferralCustomers').doc(user.uid);
    const [agent, customer] = await Promise.all([transaction.get(codeRef), transaction.get(customerRef)]);
    if (agent.data()?.kind !== 'agent') throw new ApiInputError('Agent code not found.', 404);
    if (customer.exists) return;
    transaction.create(customerRef, {
      code, uid: user.uid, name: user.name || '', email: user.email || '',
      joinedAt: new Date().toISOString(), rewardStatus: 'Pending',
    });
  });
}
