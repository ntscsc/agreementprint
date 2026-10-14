import { randomUUID } from 'node:crypto';
import type { Firestore, Transaction } from 'firebase-admin/firestore';

export async function acquireCheckoutLock(db: Firestore, orderId: string, uid: string) {
  const token = randomUUID();
  const ref = db.collection('checkoutLocks').doc(orderId);
  await db.runTransaction(async (tx) => {
    const order = await tx.get(db.collection('orders').doc(orderId));
    const lock = await tx.get(ref);
    if (!order.exists || order.data()?.ownerUid !== uid) throw new Error('Order access denied.');
    if (order.data()?.payment?.status === 'Paid') throw new Error('This order is already paid.');
    if (Number(lock.data()?.expiresAt) > Date.now()) throw new Error('Checkout is already starting. Please retry shortly.');
    tx.set(ref, { token, expiresAt: Date.now() + 120_000 });
  });
  return token;
}

export async function assertCheckoutLock(db: Firestore, tx: Transaction, orderId: string, token: string) {
  const lock = await tx.get(db.collection('checkoutLocks').doc(orderId));
  if (lock.data()?.token !== token || Number(lock.data()?.expiresAt) <= Date.now()) {
    throw new Error('Checkout changed while processing. Please retry.');
  }
}

export async function releaseCheckoutLock(db: Firestore, orderId: string, token: string) {
  const ref = db.collection('checkoutLocks').doc(orderId);
  await db.runTransaction(async (tx) => {
    const lock = await tx.get(ref);
    if (lock.data()?.token === token) tx.delete(ref);
  });
}
