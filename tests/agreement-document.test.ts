import test from 'node:test';
import assert from 'node:assert/strict';
import { numberToWordsIndian, amountInWords } from '../lib/number-to-words.ts';
import { 
  getOrdinal, 
  formatExecutionDate, 
  calculateAgreementEndDate, 
  formatNoticePeriodMonths, 
  formatPropertyDescription 
} from '../lib/agreement-formatter.ts';

test('Indian Rupee Number to Words Converter for Legal Agreements', () => {
  assert.equal(numberToWordsIndian(15000), 'Fifteen Thousand');
  assert.equal(amountInWords(15000), 'Fifteen Thousand Rupees');

  assert.equal(numberToWordsIndian(100000), 'One Lakh');
  assert.equal(amountInWords(100000), 'One Lakh Rupees');

  assert.equal(numberToWordsIndian(250000), 'Two Lakhs Fifty Thousand');
  assert.equal(amountInWords(250000), 'Two Lakhs Fifty Thousand Rupees');

  assert.equal(numberToWordsIndian(18500), 'Eighteen Thousand Five Hundred');
  assert.equal(amountInWords(18500), 'Eighteen Thousand Five Hundred Rupees');

  assert.equal(amountInWords(0), '');
  assert.equal(amountInWords(null as any), '');
});

test('Agreement Formatter: Ordinal Numbers & Dates', () => {
  assert.equal(getOrdinal(1), '1st');
  assert.equal(getOrdinal(2), '2nd');
  assert.equal(getOrdinal(3), '3rd');
  assert.equal(getOrdinal(5), '5th');
  assert.equal(getOrdinal(21), '21st');
  assert.equal(getOrdinal(22), '22nd');

  const exec = formatExecutionDate('2026-10-07');
  assert.match(exec, /7th day of October 2026/);
});

test('Agreement Formatter: 11-Month Tenure Calculation', () => {
  // Start on 1st November 2026 for 11 months -> ends on 30th September 2027
  const end = calculateAgreementEndDate('2026-11-01', 11);
  assert.match(end, /30th September 2027/);
});

test('Agreement Formatter: Notice Period & Property Descriptions', () => {
  assert.equal(formatNoticePeriodMonths(30), '1');
  assert.equal(formatNoticePeriodMonths(60), '2');
  assert.equal(formatNoticePeriodMonths(90), '3');

  assert.equal(formatPropertyDescription('Flat', 'Semi-Furnished'), 'Semi-Furnished Residential Flat / Apartment premises');
  assert.equal(formatPropertyDescription('House', 'Unfurnished'), 'Independent Residential House premises');
  assert.equal(formatPropertyDescription('Commercial Shop'), 'Commercial Shop / Office premises');
  assert.equal(formatPropertyDescription('Commercial Shop', 'Unfurnished', 'Sri Balaji Traders'), 'Commercial Shop / Office premises (for "Sri Balaji Traders")');
});
