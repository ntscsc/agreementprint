/**
 * Indian Number to Words Converter for Indian Rupee amounts in Legal Agreements.
 * Handles Crores, Lakhs, Thousands, Hundreds according to standard Indian numbering conventions.
 */

const ONES: string[] = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
];

const TENS: string[] = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
];

function convertBelowThousand(n: number): string {
  let str = '';
  if (n >= 100) {
    str += ONES[Math.floor(n / 100)] + ' Hundred ';
    n %= 100;
  }
  if (n >= 20) {
    str += TENS[Math.floor(n / 10)] + ' ';
    n %= 10;
  }
  if (n > 0) {
    str += ONES[n] + ' ';
  }
  return str.trim();
}

export function numberToWordsIndian(num: number): string {
  if (num === 0) return 'Zero';
  if (!Number.isFinite(num) || Math.abs(num) > Number.MAX_SAFE_INTEGER) return '';

  const rounded = Math.floor(Math.abs(num));
  let n = rounded;
  let result = '';

  const crores = Math.floor(n / 10000000);
  n %= 10000000;

  const lakhs = Math.floor(n / 100000);
  n %= 100000;

  const thousands = Math.floor(n / 1000);
  n %= 1000;

  const hundredsAndBelow = n;

  if (crores > 0) {
    result += numberToWordsIndian(crores) + (crores > 1 ? ' Crores ' : ' Crore ');
  }
  if (lakhs > 0) {
    result += convertBelowThousand(lakhs) + (lakhs > 1 ? ' Lakhs ' : ' Lakh ');
  }
  if (thousands > 0) {
    result += convertBelowThousand(thousands) + ' Thousand ';
  }
  if (hundredsAndBelow > 0) {
    result += convertBelowThousand(hundredsAndBelow) + ' ';
  }

  return result.trim();
}

/**
 * Returns formatted words with currency for legal agreements, e.g. "Fifteen Thousand Rupees"
 */
export function amountInWords(num: number | undefined | null): string {
  if (num === undefined || num === null || !Number.isFinite(num) || num <= 0 || !Number.isSafeInteger(Math.round(num * 100))) {
    return '';
  }
  const totalPaise = Math.round(num * 100);
  const words = numberToWordsIndian(Math.floor(totalPaise / 100));
  const paise = totalPaise % 100;
  return `${words} Rupees${paise ? ` and ${numberToWordsIndian(paise)} Paise` : ''}`;
}
