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

// Business cap for an individual package rate or notary surcharge, in rupees.
export const MAX_PRICING_AMOUNT = 100_000;
export const PRICING_MINIMUMS = {
  stamp100Chennai: 150, stamp100TamilNadu: 200,
  stamp200Chennai: 250, stamp200TamilNadu: 300, notaryExtraFee: 0,
} as const;

export type PricingField = keyof typeof PRICING_MINIMUMS;

export function pricingFieldError(key: PricingField, value: unknown): string | null {
  const minimum = PRICING_MINIMUMS[key];
  return typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > MAX_PRICING_AMOUNT
    ? `Enter a whole-rupee amount between ₹${minimum.toLocaleString('en-IN')} and ₹${MAX_PRICING_AMOUNT.toLocaleString('en-IN')}.`
    : null;
}

export function validatePricingConfig(value: unknown): asserts value is PricingConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid pricing configuration.');
  const data = value as Record<string, unknown>;
  for (const key of Object.keys(PRICING_MINIMUMS) as PricingField[]) {
    const error = pricingFieldError(key, data[key]);
    if (error) throw new Error(`${key}: ${error}`);
  }
}

// Missing settings use published defaults. Explicit invalid values fail closed.
export function resolvePricingConfig(value: Record<string, unknown>): PricingConfig {
  const pricing = { ...DEFAULT_PRICING, ...value };
  validatePricingConfig(pricing);
  return pricing;
}

export interface PriceBreakdown {
  extraCopies: number;
  extraCopyFee: number;
  stampPaperDenomination: 100 | 200;
  deliveryLocation: 'Within Chennai' | 'Within Tamil Nadu';
  includeNotary: boolean;
  basePackagePrice: number;
  notaryFee: number;
  totalPayable: number;
  description: string;
}

export const EXTRA_COPY_PRICE = 150;
export const MAX_EXTRA_COPIES = 100;
export function extraCopiesError(value: unknown): string | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= MAX_EXTRA_COPIES
    ? null : `Choose a whole number of extra copies between 0 and ${MAX_EXTRA_COPIES}.`;
}

export function calculateOrderPrice(
  pricing: PricingConfig,
  stampPaper: 100 | 200 = 100,
  deliveryLocation: 'Within Chennai' | 'Within Tamil Nadu' = 'Within Chennai',
  includeNotary: boolean = false,
  extraCopies: number = 0
): PriceBreakdown {
  validatePricingConfig(pricing);
  const copyError = extraCopiesError(extraCopies);
  if (copyError) throw new Error(copyError);
  const isChennai = deliveryLocation === 'Within Chennai';
  let basePackagePrice = 350;

  if (stampPaper === 200) {
    basePackagePrice = isChennai ? (pricing.stamp200Chennai ?? 450) : (pricing.stamp200TamilNadu ?? 500);
  } else {
    // 100 default
    basePackagePrice = isChennai ? (pricing.stamp100Chennai ?? 350) : (pricing.stamp100TamilNadu ?? 400);
  }

  const notaryFee = includeNotary ? (pricing.notaryExtraFee ?? 200) : 0;
  const extraCopyFee = extraCopies * EXTRA_COPY_PRICE;
  const totalPayable = basePackagePrice + notaryFee + extraCopyFee;

  const description = `₹${stampPaper} Stamp Paper (${deliveryLocation}) inclusive of courier charges${
    includeNotary ? ' + Notary Public Verification & Seal' : ''
  }${extraCopies ? ` + ${extraCopies} extra stamped copies (₹${EXTRA_COPY_PRICE} each)` : ''}`;

  return {
    extraCopies,
    extraCopyFee,
    stampPaperDenomination: stampPaper,
    deliveryLocation,
    includeNotary,
    basePackagePrice,
    notaryFee,
    totalPayable,
    description,
  };
}
