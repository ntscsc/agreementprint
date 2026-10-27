import test from 'node:test';
import assert from 'node:assert/strict';
import { receiptPeriods, formatReceiptAmount } from '../lib/rent-receipt.ts';
import { amountInWords } from '../lib/number-to-words.ts';

function date(value: Date) {
  return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-');
}

test('Monthly receipt periods have inclusive ends without overlapping or missing days', () => {
  for (const start of [new Date(2026, 0, 1), new Date(2026, 0, 15), new Date(2026, 0, 31), new Date(2024, 0, 31), new Date(2024, 1, 29), new Date(2026, 11, 31)]) {
    const original = start.getTime();
    const periods = receiptPeriods(start, 12);
    assert.equal(start.getTime(), original);
    assert.equal(periods.length, 12);
    for (let index = 0; index < periods.length; index++) {
      assert.ok(periods[index].periodEndDate >= periods[index].paymentDate);
      if (index + 1 < periods.length) {
        const nextDay = new Date(periods[index].periodEndDate);
        nextDay.setDate(nextDay.getDate() + 1);
        assert.equal(date(nextDay), date(periods[index + 1].paymentDate));
      }
    }
  }
  assert.deepEqual(receiptPeriods(new Date(2026, 0, 1), 2).map(p => [date(p.paymentDate), date(p.periodEndDate)]), [['2026-01-01', '2026-01-31'], ['2026-02-01', '2026-02-28']]);
  assert.deepEqual(receiptPeriods(new Date(2024, 0, 31), 2).map(p => [date(p.paymentDate), date(p.periodEndDate)]), [['2024-01-31', '2024-02-28'], ['2024-02-29', '2024-03-30']]);
});

test('Receipt amounts preserve paise in figures and words', () => {
  assert.equal(formatReceiptAmount(15250.75), '15,250.75');
  assert.equal(amountInWords(15250.75), 'Fifteen Thousand Two Hundred Fifty Rupees and Seventy Five Paise');
  assert.equal(formatReceiptAmount(0.01), '0.01');
  assert.equal(amountInWords(0.01), 'Zero Rupees and One Paise');
  assert.equal(formatReceiptAmount(15000), '15,000');
  assert.equal(amountInWords(15000), 'Fifteen Thousand Rupees');
});
