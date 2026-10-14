import { getAdminDb } from '@/lib/firebase-admin';
import { resolvePricingConfig } from '@/src/config/pricing';
import { ApiInputError } from '@/lib/api-input';

export async function getServerPricing() {
  try {
    const snap = await getAdminDb().collection('settings').doc('pricing').get();
    return resolvePricingConfig(snap.data() ?? {});
  } catch {
    throw new ApiInputError('Pricing is unavailable. Please try again later.', 503);
  }
}
