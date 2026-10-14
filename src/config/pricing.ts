/**
 * Single source of truth for vendor agreement pricing configuration.
 * Admin can update these prices dynamically via the admin desk.
 */

export interface PricingConfig {
  stamp100Chennai: number;    // Rs. 350 default
  stamp100TamilNadu: number;  // Rs. 400 default
  stamp200Chennai: number;    // Rs. 450 default
  stamp200TamilNadu: number;  // Rs. 500 default
  notaryExtraFee: number;     // Rs. 200 default
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_PRICING: PricingConfig = {
  stamp100Chennai: 350,
  stamp100TamilNadu: 400,
  stamp200Chennai: 450,
  stamp200TamilNadu: 500,
  notaryExtraFee: 200,
};

export const MAX_PRICING_AMOUNT = Math.floor(Number.MAX_SAFE_INTEGER / 200);
const PRICING_MINIMUMS = {
  stamp100Chennai: 150, stamp100TamilNadu: 200,
  stamp200Chennai: 250, stamp200TamilNadu: 300, notaryExtraFee: 0,
} as const;

export function validatePricingConfig(value: unknown): asserts value is PricingConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid pricing configuration.');
  const data = value as Record<string, unknown>;
  for (const [key, minimum] of Object.entries(PRICING_MINIMUMS)) {
    const amount = data[key];
    if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < minimum || amount > MAX_PRICING_AMOUNT) {
      throw new Error(`${key} must be a whole-rupee amount between ${minimum} and ${MAX_PRICING_AMOUNT}.`);
    }
  }
}

// Missing settings use published defaults. Explicit invalid values fail closed.
export function resolvePricingConfig(value: Record<string, unknown>): PricingConfig {
  const pricing = { ...DEFAULT_PRICING, ...value };
  validatePricingConfig(pricing);
  return pricing;
}

export interface PriceBreakdown {
  stampPaperDenomination: 100 | 200;
  deliveryLocation: 'Within Chennai' | 'Within Tamil Nadu';
  includeNotary: boolean;
  basePackagePrice: number;
  notaryFee: number;
  totalPayable: number;
  description: string;
}

export function calculateOrderPrice(
  pricing: PricingConfig,
  stampPaper: 100 | 200 = 100,
  deliveryLocation: 'Within Chennai' | 'Within Tamil Nadu' = 'Within Chennai',
  includeNotary: boolean = false
): PriceBreakdown {
  validatePricingConfig(pricing);
  const isChennai = deliveryLocation === 'Within Chennai';
  let basePackagePrice = 350;

  if (stampPaper === 200) {
    basePackagePrice = isChennai ? (pricing.stamp200Chennai ?? 450) : (pricing.stamp200TamilNadu ?? 500);
  } else {
    // 100 default
    basePackagePrice = isChennai ? (pricing.stamp100Chennai ?? 350) : (pricing.stamp100TamilNadu ?? 400);
  }

  const notaryFee = includeNotary ? (pricing.notaryExtraFee ?? 200) : 0;
  const totalPayable = basePackagePrice + notaryFee;

  const description = `₹${stampPaper} Stamp Paper (${deliveryLocation}) inclusive of courier charges${
    includeNotary ? ' + Notary Public Verification & Seal' : ''
  }`;

  return {
    stampPaperDenomination: stampPaper,
    deliveryLocation,
    includeNotary,
    basePackagePrice,
    notaryFee,
    totalPayable,
    description,
  };
}
