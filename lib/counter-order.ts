import { validatePerson, validateProperty, validateTerms } from '@/lib/agreement-validation';
import { ApiInputError } from '@/lib/api-input';
import type { Order } from '@/lib/types';
export type CounterPaymentMethod = 'Cash' | 'UPI' | 'Card' | 'Unpaid';
export interface CounterOrder extends Order {
  source: 'Counter'; counterAmount: number; counterPaymentMethod: CounterPaymentMethod;
  counterPaymentReference: string; createdBy: string; collectedAt?: string;
}

export function validateCounterAgreement(value: Record<string, any>) {
  validatePerson(value.ownerDetails, 'owner');
  validatePerson(value.tenantDetails, 'tenant');
  validateProperty(value.propertyDetails);
  validateTerms(value.agreementTerms);
  if (value.agreementTerms.agreementType === 'Lease' && !['House', 'Flat'].includes(value.propertyDetails.propertyType)) throw new ApiInputError('Lease agreements are available for residential properties only.');
  if (value.agreementTerms.language === 'Tamil' && value.propertyDetails.propertyType !== 'Commercial Shop' && (typeof value.agreementTerms.paintingDeduction !== 'number' || !Number.isFinite(value.agreementTerms.paintingDeduction) || value.agreementTerms.paintingDeduction < 0 || value.agreementTerms.paintingDeduction > 1e9)) throw new ApiInputError('Enter a valid painting deduction, or 0 for none.');
}
