import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export const DEFAULT_COURIER_PARTNERS = ['Professional Courier'];

function normalizeCourierPartners(value: unknown): string[] {
  if (!Array.isArray(value)) return DEFAULT_COURIER_PARTNERS;

  const partners = Array.from(
    new Set(
      value
        .filter((partner): partner is string => typeof partner === 'string')
        .map((partner) => partner.trim())
        .filter(Boolean),
    ),
  );

  return partners.length > 0 ? partners : DEFAULT_COURIER_PARTNERS;
}

export async function getCourierPartners(): Promise<string[]> {
  const courierDoc = await getDoc(doc(db, 'settings', 'couriers'));
  return normalizeCourierPartners(courierDoc.data()?.partners);
}

export async function saveCourierPartners(
  partners: string[],
  adminEmail: string,
): Promise<void> {
  const normalizedPartners = normalizeCourierPartners(partners);
  await setDoc(doc(db, 'settings', 'couriers'), {
    partners: normalizedPartners,
    updatedAt: new Date().toISOString(),
    updatedBy: adminEmail,
  });
}
