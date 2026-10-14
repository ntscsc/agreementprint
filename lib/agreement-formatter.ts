/**
 * Utility functions for formatting fields into the official Tamil Nadu
 * non-judicial rental agreement format.
 */

export function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Formats a date into legal execution style, e.g. "7th day of October 2026"
 */
export function formatExecutionDate(dateInput?: string | Date): string {
  const d = dateInput ? new Date(dateInput) : new Date();
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
  const d = new Date(dateInput);
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
  const start = new Date(startDateInput);
  if (isNaN(start.getTime())) return '';

  // Add tenure months
  const end = new Date(start);
  end.setMonth(end.getMonth() + tenureMonths);
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
  const furn = furnishing && furnishing !== 'Unfurnished' ? `${furnishing} ` : '';
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
