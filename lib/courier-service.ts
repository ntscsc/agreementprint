import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { validCourierTrackingLink } from './courier-tracking';

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

export async function getCourierSettings() {
  const snapshot = await getDoc(doc(db, 'settings', 'couriers'));
  return { partners: normalizeCourierPartners(snapshot.data()?.partners), trackingLinks: (snapshot.data()?.trackingLinks || {}) as Record<string, string> };
}

export async function saveCourierPartners(
  partners: string[],
  adminEmail: string,
  trackingLinks: Record<string, string> = {},
): Promise<void> {
  const normalizedPartners = normalizeCourierPartners(partners);
  const links: Record<string, string> = Object.fromEntries(normalizedPartners.map((name): [string, string] => [name, (trackingLinks[name] || '').trim()]).filter(([, link]) => !!link));
  for (const [name, link] of Object.entries(links)) {
    if (!validCourierTrackingLink(link)) throw new Error(`Enter a valid HTTPS tracking link for ${name}.`);
  }
  await setDoc(doc(db, 'settings', 'couriers'), {
    partners: normalizedPartners,
    trackingLinks: links,
    updatedAt: new Date().toISOString(),
    updatedBy: adminEmail,
  });
}
