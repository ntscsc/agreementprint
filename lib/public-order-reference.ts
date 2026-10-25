import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { ApiInputError } from '@/lib/api-input';

export async function allocatePublicOrderReference(db: Firestore, tx: Transaction, orderId: string) {
  const counter = db.collection('systemCounters').doc('publicOrderReference');
  const current = (await tx.get(counter)).data();
  const number = Number(current?.last ?? 99999) + 1;
  if (!Number.isSafeInteger(number) || number > 999999) throw new ApiInputError('Order reference capacity reached. Contact support.', 503);
  const reference = `AP-${number}`;
  const ref = db.collection('publicOrderReferences').doc(reference);
  if ((await tx.get(ref)).exists) throw new ApiInputError('Order reference allocation needs review.', 503);
  return { reference, write: () => { tx.set(counter, { last: number }); tx.create(ref, { orderId }); } };
}
