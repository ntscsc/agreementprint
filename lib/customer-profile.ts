export interface CustomerProfile { name: string; phone: string; }

export function validateCustomerProfile(value: unknown): CustomerProfile {
  const data = value as Partial<CustomerProfile> | null;
  if (!data || typeof data.name !== 'string' || data.name.trim().length < 2 || data.name.trim().length > 100) throw new Error('Enter your full name (2–100 characters).');
  if (typeof data.phone !== 'string' || !/^[6-9][0-9]{9}$/.test(data.phone.trim())) throw new Error('Enter a valid 10-digit Indian mobile number.');
  return { name: data.name.trim(), phone: data.phone.trim() };
}
