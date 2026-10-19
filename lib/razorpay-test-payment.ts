import { getAdminDb } from '@/lib/firebase-admin';
import { ApiInputError } from '@/lib/api-input';
import { TEST_PAYMENT_PAISE } from '@/lib/phonepe-test-payment';

export async function settleRazorpayTestPayment(id: string, ownerUid: string, amount: unknown, transactionId?: string) {
  if (amount !== TEST_PAYMENT_PAISE) throw new ApiInputError('Test payment amount did not match Rs.1.', 409);
  const db = getAdminDb(), ref = db.collection('razorpayTestPayments').doc(id);
  await db.runTransaction(async tx => {
    const record = (await tx.get(ref)).data();
    if (!record || record.ownerUid !== ownerUid || record.amount !== TEST_PAYMENT_PAISE || record.gateway !== 'Razorpay') throw new ApiInputError('Test payment not found.', 404);
    if (record.state === 'COMPLETED') return;
    tx.update(ref, { state: 'COMPLETED', updatedAt: new Date().toISOString(), ...(transactionId ? { transactionId } : {}) });
  });
}
