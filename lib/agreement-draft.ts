import type { AgreementTerms } from './types';

export function restoreAgreementTerms(saved: Partial<AgreementTerms> = {}): Partial<AgreementTerms> {
  return {
    agreementType: 'Rental',
    language: 'English',
    paintingDeduction: 0,
    monthlyRent: undefined,
    securityDeposit: undefined,
    maintenanceCharges: 0,
    startDate: '',
    tenureMonths: 11,
    noticePeriodDays: 30,
    rentIncreasePct: 5,
    paymentDueDay: 5,
    stampPaperDenomination: 100,
    deliveryRecipient: undefined,
    extraCopies: 0,
    ...saved,
    // Older drafts omitted this optional checkbox. Do not coerce strings such
    // as "false" into true; malformed values must still fail validation.
    includeNotary: saved.includeNotary === undefined ? false : saved.includeNotary,
  };
}
