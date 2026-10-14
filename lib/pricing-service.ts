import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { DEFAULT_PRICING, PricingConfig, resolvePricingConfig, validatePricingConfig } from '@/src/config/pricing';

const PRICING_DOC_PATH = 'settings/pricing';

/**
 * Fetches the active pricing configuration from Firestore.
 * Falls back to DEFAULT_PRICING only if the document does not exist; read failures propagate.
 */
export async function getPricingConfig(): Promise<PricingConfig> {
  const snap = await getDoc(doc(db, 'settings', 'pricing'));
  return resolvePricingConfig(snap.exists() ? snap.data() : {});
}

/**
 * Updates the pricing configuration in Firestore.
 * Requires administrator credentials according to firestore.rules.
 */
export async function savePricingConfig(
  config: Partial<PricingConfig>,
  adminEmail: string
): Promise<void> {
  const validated = { ...DEFAULT_PRICING, ...config };
  validatePricingConfig(validated);
  const docRef = doc(db, 'settings', 'pricing');
  const now = new Date().toISOString();
  await setDoc(docRef, {
    stamp100Chennai: validated.stamp100Chennai,
    stamp100TamilNadu: validated.stamp100TamilNadu,
    stamp200Chennai: validated.stamp200Chennai,
    stamp200TamilNadu: validated.stamp200TamilNadu,
    notaryExtraFee: validated.notaryExtraFee,
    updatedAt: now,
    updatedBy: adminEmail,
  });
}
