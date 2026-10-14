import { validateAgreement } from '@/lib/agreement-validation';
import { 
  doc, 
  setDoc, 
  getDoc, 
  deleteDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  onSnapshot 
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { Order, Draft, OrderStatus } from './types';
import { handleFirestoreError, OperationType } from './firestore-errors';
import { omitUndefinedValues } from './firestore-data';
import { isUserAdmin } from '@/src/config/admin';

/**
 * Draft Management (stored strictly in /drafts/{uid})
 */
export async function saveDraft(uid: string, currentStep: number, formData: Partial<Order>): Promise<void> {
  const path = `drafts/${uid}`;
  try {
    const draftRef = doc(db, 'drafts', uid);
    await setDoc(draftRef, {
      ownerUid: uid,
      currentStep,
      formData: omitUndefinedValues(formData),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path, auth.currentUser);
  }
}

export async function getDraft(uid: string): Promise<Draft | null> {
  const path = `drafts/${uid}`;
  try {
    const draftRef = doc(db, 'drafts', uid);
    const snap = await getDoc(draftRef);
    if (snap.exists()) {
      return snap.data() as Draft;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path, auth.currentUser);
    return null;
  }
}

export async function deleteDraft(uid: string): Promise<void> {
  const path = `drafts/${uid}`;
  try {
    const draftRef = doc(db, 'drafts', uid);
    await deleteDoc(draftRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path, auth.currentUser);
  }
}

/**
 * Order Creation
 * Enforces rules:
 * - payment.status is strictly 'Pending'
 * - no courier or correctionMessage present
 * - status is 'Submitted'
 */
export async function createOrder(
  orderPayload: Omit<Order, 'status' | 'payment' | 'courier' | 'correctionMessage' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const path = `orders/${orderPayload.orderId}`;
  try {
    validateAgreement(orderPayload);
    const orderDoc: Order = {
      ...orderPayload,
      status: 'Submitted',
      payment: {
        status: 'Pending',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Strip courier & correctionMessage if accidentally present
    delete (orderDoc as { courier?: unknown }).courier;
    delete (orderDoc as { correctionMessage?: unknown }).correctionMessage;

    const orderRef = doc(db, 'orders', orderPayload.orderId);
    await setDoc(orderRef, orderDoc);

    // Clean up draft after order creation
    if (auth.currentUser?.uid) {
      await deleteDraft(auth.currentUser.uid).catch(() => {});
    }

    return orderPayload.orderId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path, auth.currentUser);
    throw err;
  }
}

/**
 * Owner Document Correction Update
 * Rules permit owner update ONLY when:
 * - existing status == 'Documents needed'
 * - transitions to status == 'Under verification'
 * - modifies only detail / proof fields
 */
export async function submitDocumentCorrection(
  orderId: string,
  corrections: {
    ownerDetails?: Order['ownerDetails'];
    tenantDetails?: Order['tenantDetails'];
    propertyDetails?: Order['propertyDetails'];
    proofUploads?: Order['proofUploads'];
  }
): Promise<void> {
  const path = `orders/${orderId}`;
  try {
    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, {
      ...corrections,
      status: 'Under verification' as OrderStatus,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path, auth.currentUser);
  }
}

/**
 * Check if the signed-in user is the authorized vendor administrator
 */
export async function checkIsAdmin(): Promise<boolean> {
  if (!auth.currentUser) return false;
  return isUserAdmin(auth.currentUser.email, auth.currentUser.emailVerified);
}
