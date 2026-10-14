import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export const DEFAULT_SUPPORT_EMAIL = 'pradeep1992@official.com';

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
