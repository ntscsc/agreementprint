/**
 * Utility functions for formatting fields into the official Tamil Nadu
 * non-judicial rental agreement format.
 */

export function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Append missing location fields without repeating a city already in the address. */
export function formatPropertyAddress(fullAddress?: string, city?: string, pincode?: string): string {
  if (!fullAddress?.trim()) return '';
  let result = fullAddress.trim();
  const normalize = (text: string) => text.normalize('NFKC').toLocaleLowerCase('en-IN').replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim();
  const cityText = city?.trim();
  if (cityText) {
    const aliases = ['chennai', 'சென்னை'].includes(normalize(cityText)) ? ['chennai', 'சென்னை'] : [normalize(cityText)];
    const parts = result.split(/[,;\n]/).map(normalize);
    const alreadyPresent = parts.some(part => aliases.some(alias => {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(^| )${escaped}( (tamil nadu|tamilnadu|தமிழ்நாடு|india|இந்தியா|[0-9]{6}))*$`, 'u').test(part);
    }));
    if (!alreadyPresent) result += `, ${cityText}`;
  }
  if (pincode?.trim() && !new RegExp(`(^|\\D)${pincode.trim().replace(/[^0-9]/g, '')}(\\D|$)`).test(result)) result += ` - ${pincode.trim()}`;
  return result;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// HTML date inputs are calendar dates, not UTC timestamps. Parse them locally
// so a customer's timezone cannot move the agreement to the preceding day.
function parseDate(dateInput: string | Date): Date {
  if (typeof dateInput !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) return new Date(dateInput);
  const [year, month, day] = dateInput.split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date : new Date(NaN);
}

/**
 * Formats a date into legal execution style, e.g. "7th day of October 2026"
 */
export function formatExecutionDate(dateInput?: string | Date): string {
  const d = dateInput ? parseDate(dateInput) : new Date();
  if (isNaN(d.getTime())) {
    return '';
  }
  const day = d.getDate();
  const ordinalDay = getOrdinal(day);
  const month = MONTH_NAMES[d.getMonth()];
  const year = d.getFullYear();
  return `${ordinalDay} day of ${month} ${year}`;
}

/**
 * Formats a date for validity clauses, e.g. "01/11/2026" or "1st November 2026"
 */
export function formatLegalDate(dateInput?: string | Date): string {
  if (!dateInput) return '';
  const d = parseDate(dateInput);
  if (isNaN(d.getTime())) return '';
  const day = getOrdinal(d.getDate());
  const month = MONTH_NAMES[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Calculates the end date given a start date and tenure in months.
 * For an 11-month agreement starting on 2026-11-01, end date is 2027-09-30 (11 calendar months minus 1 day).
 */
export function calculateAgreementEndDate(startDateInput?: string, tenureMonths: number = 11): string {
  if (!startDateInput) return '';
  const start = parseDate(startDateInput);
  if (isNaN(start.getTime()) || !Number.isSafeInteger(tenureMonths) || tenureMonths < 1 || tenureMonths > 120) return '';

  // Add tenure months
  const end = new Date(start);
  end.setDate(1);
  end.setMonth(end.getMonth() + tenureMonths);
  const lastDay = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
  end.setDate(Math.min(start.getDate(), lastDay));
  // Deduct 1 day to complete the exact tenure
  end.setDate(end.getDate() - 1);

  return formatLegalDate(end);
}

/**
 * Converts notice period in days to a numeric month string for Clause 6.
 */
export function formatNoticePeriodMonths(days?: number): string {
  if (!days || isNaN(days)) return '1';
  const months = Math.max(1, Math.round(days / 30));
  return `${months}`;
}

/**
 * Formats property type description for Clause preamble:
 * e.g. "Residential Flat premises" or "Independent Residential House"
 */
export function formatPropertyDescription(type?: string, furnishing?: string, businessName?: string): string {
  if (!type) return 'Residential premises';
  const furn = furnishing ? `${furnishing} ` : '';
  switch (type) {
    case 'Flat':
      return `${furn}Residential Flat / Apartment premises`;
    case 'House':
      return `${furn}Independent Residential House premises`;
    case 'Commercial Shop':
      return businessName?.trim()
        ? `${furn}Commercial Shop / Office premises (for "${businessName.trim()}")`
        : `${furn}Commercial Shop / Office premises`;
    default:
      return `${furn}${type} premises`;
  }
}
/** Only an explicitly entered, finite positive deduction belongs in the agreement. */
export function printablePaintingDeduction(value?: number): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

/** Preserve whole-rupee display, but always show both paise digits for fractions. */
export function formatAgreementAmount(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function paintingDeductionSummary(value?: number): string {
  const amount = printablePaintingDeduction(value);
  return amount === undefined ? 'None (₹0)' : `₹${formatAgreementAmount(amount)}`;
}
