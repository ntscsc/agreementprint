import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export const DEFAULT_SUPPORT_EMAIL = 'pradeep1992@official.com';

export function subscribeToSupportEmail(onEmail: (email: string) => void) {
  return onSnapshot(doc(db, 'settings', 'support'), snapshot => {
    const email = snapshot.data()?.email;
    onEmail(typeof email === 'string' && email.trim() ? email.trim() : DEFAULT_SUPPORT_EMAIL);
  }, error => {
    console.warn('Could not subscribe to support email setting:', error);
    // Keep the last known email if the connection is interrupted.
  });
}

export async function getSupportEmail(): Promise<string> {
  try {
    const supportDoc = await getDoc(doc(db, 'settings', 'support'));
    const email = supportDoc.data()?.email;
    return typeof email === 'string' && email.trim()
      ? email.trim()
      : DEFAULT_SUPPORT_EMAIL;
  } catch (error) {
    console.warn('Could not load support email setting:', error);
    return DEFAULT_SUPPORT_EMAIL;
  }
}

export async function saveSupportEmail(email: string, adminEmail: string): Promise<void> {
  await setDoc(doc(db, 'settings', 'support'), {
    email: email.trim(),
    updatedAt: new Date().toISOString(),
    updatedBy: adminEmail,
  });
}
