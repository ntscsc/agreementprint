import { propertyPostcodeError } from '@/lib/property-postcode';
import { ApiInputError } from '@/lib/api-input';
import { isValidCouponCode } from '@/lib/coupon';

function object(value: unknown, label: string): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiInputError(`${label} is required.`);
  return value as Record<string, any>;
}
function text(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) throw new ApiInputError(`Enter a valid ${label}.`);
}
function number(value: unknown, label: string, min: number, max: number, whole = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (whole && !Number.isSafeInteger(value))) throw new ApiInputError(`Enter a valid ${label}.`);
}
function choice(value: unknown, label: string, options: unknown[]) {
  if (!options.includes(value)) throw new ApiInputError(`Select a valid ${label}.`);
}

export function validatePerson(value: unknown, label: string) {
  const data = object(value, label);
  text(data.fullName, `${label} name`, 2, 100);
  if (data.relativeName !== undefined && data.relativeName !== '') {
    text(data.relativeName, `${label} relative name`, 0, 100);
    if (data.relativeName.trim()) text(data.relativeName, `${label} relative name`, 2, 100);
  }
  if (data.relationship !== undefined && data.relationship !== '') choice(data.relationship, `${label} relationship`, ['Son of', 'Daughter of', 'Wife of', 'Husband of', 'Child of', 'Spouse of']);
  const age = typeof data.age === 'string' && /^\d{1,3}$/.test(data.age) ? Number(data.age) : data.age;
  number(age, `${label} age`, 18, 120, true);
  text(data.address, `${label} address`, 10, 2000);
  if (data.pincode !== undefined && (typeof data.pincode !== 'string' || !/^[1-9]\d{5}$/.test(data.pincode))) throw new ApiInputError(`Enter a valid ${label} permanent address PIN code.`);
  if (typeof data.phone !== 'string' || !/^[6-9]\d{9}$/.test(data.phone)) throw new ApiInputError(`Enter a valid ${label} phone.`);
  if (data.email !== undefined && data.email !== '' && (typeof data.email !== 'string' || data.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))) throw new ApiInputError(`Enter a valid ${label} email.`);
  if (data.aadhaarLast4 !== undefined && data.aadhaarLast4 !== '' && (typeof data.aadhaarLast4 !== 'string' || !/^\d{4,12}$/.test(data.aadhaarLast4.replace(/[\s-]/g, '')))) throw new ApiInputError(`Enter a valid ${label} identification number.`);
  if (data.pan !== undefined && data.pan !== '' && (typeof data.pan !== 'string' || !/^[A-Z]{5}\d{4}[A-Z]$/.test(data.pan))) throw new ApiInputError(`Enter a valid ${label} PAN.`);
}

export function validateProperty(value: unknown) {
  const data = object(value, 'Property');
  text(data.fullAddress, 'property address', 12, 2000);
  text(data.city, 'property city', 2, 100);
  if (typeof data.pincode !== 'string') throw new ApiInputError('Enter a valid property PIN code.');
  const postcodeError = propertyPostcodeError(data.pincode);
  if (postcodeError) throw new ApiInputError(postcodeError);
  choice(data.propertyType, 'property type', ['House', 'Flat', 'Commercial Shop']);
  choice(data.furnishing, 'furnishing', ['Unfurnished', 'Semi-Furnished', 'Fully Furnished']);
  if (data.propertyType === 'Commercial Shop') text(data.businessName, 'business name', 2, 200);
}

export function validateTerms(value: unknown) {
  const data = object(value, 'Agreement terms');
  if (data.agreementType !== undefined) choice(data.agreementType, 'agreement type', ['Rental', 'Lease']);
  const isLease = data.agreementType === 'Lease';
  if (isLease && data.language !== 'English') throw new ApiInputError('Lease agreements are available in English.');
  if (isLease && (data.monthlyRent !== 0 || data.rentIncreasePct !== 0)) throw new ApiInputError('Lease agreements have no separate monthly rent or annual rent increase.');
  if (isLease) number(data.securityDeposit, 'refundable lease advance', 0.01, 1e9);
  if (data.language !== undefined) choice(data.language, 'agreement language', ['English', 'Tamil']);
  if (data.paintingDeduction !== undefined) number(data.paintingDeduction, 'painting deduction', 0, 1e9);
  number(data.monthlyRent, 'monthly rent', isLease ? 0 : 0.01, 1e9);
  for (const key of ['securityDeposit', 'maintenanceCharges']) number(data[key], key, 0, 1e9);
  number(data.tenureMonths, 'tenure', 1, 120, true);
  number(data.noticePeriodDays, 'notice period', 0, 365, true);
  number(data.rentIncreasePct, 'rent increase', 0, 100);
  if (data.paymentDueDay !== undefined) number(data.paymentDueDay, 'payment due day', 1, 31, true);
  if (typeof data.startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.startDate) || !Number.isFinite(Date.parse(data.startDate)) || new Date(data.startDate).toISOString().slice(0, 10) !== data.startDate) throw new ApiInputError('Enter a valid agreement start date.');
  if (data.extraCopies !== undefined && (typeof data.extraCopies !== 'number' || !Number.isSafeInteger(data.extraCopies) || data.extraCopies < 0 || data.extraCopies > 100)) throw new ApiInputError('Choose a whole number of extra copies between 0 and 100.');
  choice(data.stampPaperDenomination, 'stamp denomination', [100, 200]);
  choice(data.deliveryLocation, 'delivery region', ['Within Chennai', 'Within Tamil Nadu']);
  choice(data.deliveryRecipient, 'delivery recipient', ['Owner', 'Tenant']);
  if (typeof data.includeNotary !== 'boolean') throw new ApiInputError('Notary selection must be a boolean.');
}

export function validateAgreement(value: unknown) {
  const data = object(value, 'Agreement');
  validatePerson(data.ownerDetails, 'owner');
  validatePerson(data.tenantDetails, 'tenant');
  validateProperty(data.propertyDetails);
  validateTerms(data.agreementTerms);
  if (data.agreementTerms.agreementType === 'Lease' && !['House', 'Flat'].includes(data.propertyDetails.propertyType)) throw new ApiInputError('The lease template is for residential houses and flats only.');
  if (data.agreementTerms.language === 'Tamil' && data.propertyDetails.propertyType !== 'Commercial Shop') number(data.agreementTerms.paintingDeduction, 'painting deduction', 0, 1e9);
  const recipient = data.agreementTerms.deliveryRecipient === 'Owner' ? data.ownerDetails : data.tenantDetails;
  const pin = recipient.pincode ?? recipient.address.match(/\b6\d{5}\b/)?.[0];
  if (!pin || !/^6\d{5}$/.test(pin)) throw new ApiInputError('The delivery address needs a Tamil Nadu PIN code.');
  const region = /^600\d{3}$/.test(pin) ? 'Within Chennai' : 'Within Tamil Nadu';
  if (data.agreementTerms.deliveryLocation !== region) throw new ApiInputError('The delivery region must match the selected address PIN code.');
  if (data.customerEmail !== undefined && (typeof data.customerEmail !== 'string' || data.customerEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.customerEmail))) throw new ApiInputError('Enter a valid customer email.');
  if (data.customerPhone !== undefined && (typeof data.customerPhone !== 'string' || !/^[6-9]\d{9}$/.test(data.customerPhone))) throw new ApiInputError('Enter a valid customer phone.');
  if (data.referralCode !== undefined && data.referralCode !== '' && !isValidCouponCode(data.referralCode)) throw new ApiInputError('Enter a valid coupon code.');
}
