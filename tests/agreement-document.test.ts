import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { numberToWordsIndian, amountInWords } from '../lib/number-to-words.ts';
import { 
  getOrdinal, 
  formatExecutionDate, 
  formatLegalDate,
  calculateAgreementEndDate, 
  formatNoticePeriodMonths, 
  formatPropertyDescription 
} from '../lib/agreement-formatter.ts';

test('Rendered agreement keeps currency units accurate and spells out a zero deposit', () => {
  const require = createRequire(import.meta.url), ts = require('typescript');
  const cache = new Map<string, any>();
  function load(name: string): any {
    if (!name.startsWith('@/')) return require(name);
    if (cache.has(name)) return cache.get(name);
    const extension = name.includes('/components/') ? 'tsx' : 'ts';
    const source = readFileSync(new URL(`../${name.slice(2)}.${extension}`, import.meta.url), 'utf8');
    const target = { exports: {} };
    runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, {
      module: target, exports: target.exports, require: load, Date, console,
    });
    cache.set(name, target.exports);
    return target.exports;
  }
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
  const { RentalAgreementDocument } = load('@/components/agreement/RentalAgreementDocument');
  const markup = renderToStaticMarkup(React.createElement(RentalAgreementDocument, {
    data: { agreementTerms: { monthlyRent: 15000.75, securityDeposit: 0, startDate: '2026-01-31', tenureMonths: 1 } },
  }));
  const text = markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.match(text, /Fifteen Thousand Rupees and Seventy Five Paise/);
  assert.match(text, /Zero Rupees/);
  assert.match(text, /27th February 2026/);
  assert.doesNotMatch(text, /Rupees\s+Fifteen Thousand Rupees/);
});

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

test('Agreement dates clamp month anniversaries and reject invalid calendar input', () => {
  assert.equal(calculateAgreementEndDate('2026-01-31', 1), '27th February 2026');
  assert.equal(calculateAgreementEndDate('2024-01-31', 1), '28th February 2024');
  assert.equal(calculateAgreementEndDate('2024-02-29', 12), '27th February 2025');
  assert.equal(calculateAgreementEndDate('2026-12-31', 1), '30th January 2027');
  for (const date of ['2026-02-30', '2026-13-01', 'invalid']) {
    assert.equal(formatLegalDate(date), '');
    assert.equal(calculateAgreementEndDate(date, 11), '');
  }
  for (const months of [0, -1, 1.5, Infinity, 121]) assert.equal(calculateAgreementEndDate('2026-01-01', months), '');
  const oldTimezone = process.env.TZ;
  try {
    process.env.TZ = 'America/Los_Angeles';
    assert.equal(formatLegalDate('2026-10-07'), '7th October 2026');
    assert.equal(formatExecutionDate('2026-10-07'), '7th day of October 2026');
  } finally {
    if (oldTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = oldTimezone;
  }
});

test('Currency words retain paise and safely handle large or non-finite values', () => {
  assert.equal(amountInWords(15000.75), 'Fifteen Thousand Rupees and Seventy Five Paise');
  assert.equal(amountInWords(0.01), 'Zero Rupees and One Paise');
  assert.equal(amountInWords(999.999), 'One Thousand Rupees');
  assert.equal(numberToWordsIndian(10_000_000_000), 'One Thousand Crores');
  assert.equal(amountInWords(Infinity), '');
  assert.equal(numberToWordsIndian(Infinity), '');
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
