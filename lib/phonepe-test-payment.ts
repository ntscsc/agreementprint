import { getAdminDb } from '@/lib/firebase-admin';
import { ApiInputError } from '@/lib/api-input';
export const TEST_PAYMENT_PAISE = 100;
export async function settleTestPayment(id: string, amount: unknown, state: string, transactionId?: string) {
  if (amount !== TEST_PAYMENT_PAISE) throw new ApiInputError('Test payment amount did not match Rs.1.', 409);
  const db = getAdminDb();
  const ref = db.collection('phonepeTestPayments').doc(id);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data()?.amount !== TEST_PAYMENT_PAISE) throw new ApiInputError('Test payment not found.', 404);
    if (snap.data()?.state === 'COMPLETED') return;
    tx.update(ref, { state, updatedAt: new Date().toISOString(), ...(transactionId ? { transactionId } : {}) });
  });
}
