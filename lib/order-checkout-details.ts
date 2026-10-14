const fields = ['ownerDetails', 'tenantDetails', 'propertyDetails', 'agreementTerms', 'proofUploads', 'customerEmail', 'customerPhone', 'referralCode'] as const;

export function selectCheckoutDetails(value: Record<string, unknown>) {
  return Object.fromEntries(fields.filter((key) => value[key] !== undefined).map((key) => [key, value[key]]));
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const data = value as Record<string, unknown>;
    return `{${Object.keys(data).filter((key) => data[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonical(data[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function checkoutDetailsChanged(order: Record<string, unknown>, details: Record<string, unknown>) {
  return Object.keys(details).some((key) => canonical(order[key]) !== canonical(details[key]));
}
