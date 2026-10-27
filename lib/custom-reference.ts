import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { ApiInputError } from '@/lib/api-input';

export async function allocateCustomReference(db: Firestore, tx: Transaction, quantity = 1) {
  const ref = db.collection('systemCounters').doc('customRequestReference');
  const count = Number((await tx.get(ref)).data()?.last ?? 100000) + 1;
  const last = count + quantity - 1;
  if (!Number.isSafeInteger(last) || last > 999999999 || quantity < 1) throw new ApiInputError('Custom reference capacity reached.', 503);
  return { reference: `CA-${count}`, references: Array.from({ length: quantity }, (_, index) => `CA-${count + index}`), write: () => tx.set(ref, { last }) };
}
