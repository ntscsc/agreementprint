const units = ['', 'ஒன்று', 'இரண்டு', 'மூன்று', 'நான்கு', 'ஐந்து', 'ஆறு', 'ஏழு', 'எட்டு', 'ஒன்பது'];
const teens = ['பத்து', 'பதினொன்று', 'பன்னிரண்டு', 'பதின்மூன்று', 'பதினான்கு', 'பதினைந்து', 'பதினாறு', 'பதினேழு', 'பதினெட்டு', 'பத்தொன்பது'];
const tens = ['', '', 'இருபது', 'முப்பது', 'நாற்பது', 'ஐம்பது', 'அறுபது', 'எழுபது', 'எண்பது', 'தொண்ணூறு'];
const links = ['', '', 'இருபத்து', 'முப்பத்து', 'நாற்பத்து', 'ஐம்பத்து', 'அறுபத்து', 'எழுபத்து', 'எண்பத்து', 'தொண்ணூற்று'];
const hundreds = ['', 'நூறு', 'இருநூறு', 'முந்நூறு', 'நானூறு', 'ஐந்நூறு', 'அறுநூறு', 'எழுநூறு', 'எண்ணூறு', 'தொள்ளாயிரம்'];
const hundredLinks = ['', 'நூற்று', 'இருநூற்று', 'முந்நூற்று', 'நானூற்று', 'ஐந்நூற்று', 'அறுநூற்று', 'எழுநூற்று', 'எண்ணூற்று', 'தொள்ளாயிரத்து'];

export function tamilNumberToWords(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000) return '';
  if (value === 0) return 'பூஜ்ஜியம்';
  if (value < 10) return units[value];
  if (value < 20) return teens[value - 10];
  if (value < 100) return value % 10 ? `${links[Math.floor(value / 10)]} ${units[value % 10]}` : tens[value / 10];
  if (value < 1000) return value % 100 ? `${hundredLinks[Math.floor(value / 100)]} ${tamilNumberToWords(value % 100)}` : hundreds[value / 100];
  for (const [scale, name, link] of [[10_000_000, 'கோடி', 'கோடியே'], [100_000, 'லட்சம்', 'லட்சத்து'], [1000, 'ஆயிரம்', 'ஆயிரத்து']] as const) {
    if (value >= scale) {
      const count = Math.floor(value / scale), remainder = value % scale;
      // Tamil joins one thousand directly; other groups retain their count.
      const prefix = count === 1 ? (scale === 1000 ? '' : 'ஒரு ') : `${tamilNumberToWords(count)} `;
      return `${prefix}${remainder ? link : name}${remainder ? ` ${tamilNumberToWords(remainder)}` : ''}`;
    }
  }
  return '';
}

export function tamilAmountInWords(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1_000_000_000) return '';
  const totalPaise = Math.round(value * 100);
  const rupees = Math.floor(totalPaise / 100), paise = totalPaise % 100;
  return `${tamilNumberToWords(rupees)} ரூபாய்${paise ? ` ${tamilNumberToWords(paise)} பைசா` : ''}`;
}
