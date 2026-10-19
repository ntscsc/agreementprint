import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';
import { presentReportSheets } from '../lib/report-presentation.ts';
import { buildReportsXlsx } from '../lib/admin-report-xlsx.ts';

const sheets = [{ name: 'Payments', note: 'Confirmed payments.', headers: ['Payment reference', 'Order or request reference', 'Customer ID', 'Cash received (INR)'], rows: [['payment-1', '1234567890123456', 'uid-1', 350]], money: [3] }];
const profiles = [{ id: 'uid-1', name: 'Customer One', phone: '0987654321' }];
const orders = [{ orderId: '1234567890123456', ownerUid: 'uid-1', customerEmail: 'one@example.com', ownerDetails: { fullName: 'Different property owner' } }];

test('Reports lead with saved account identity and retain financial values and reconciliation references', () => {
  const [sheet] = presentReportSheets(sheets, profiles, [], orders);
  const read = (name: string) => sheet.rows[0][sheet.headers.indexOf(name)];
  assert.equal(read('Customer name'), 'Customer One');
  assert.equal(read('Customer mobile'), '0987654321');
  assert.equal(read('Customer email'), 'one@example.com');
  assert.match(String(read('Customer reference')), /^CUS-[1-9][0-9]{9}$/);
  assert.match(String(read('Report reference')), /^ORD-[1-9][0-9]{9}$/);
  assert.match(String(read('Payment reference (readable)')), /^PAY-[1-9][0-9]{9}$/);
  assert.equal(read('Payment reference'), 'payment-1');
  assert.equal(read('Order or request reference'), '1234567890123456');
  assert.equal(read('Internal customer ID'), 'uid-1');
  assert.equal(sheet.rows[0][sheet.money![0]], 350);
  assert.ok(sheet.headers.indexOf('Cash received (INR)') < sheet.headers.indexOf('Payment reference'));
  assert.deepEqual(sheets[0].money, [3]);
});

test('Customer and order aliases are consistent across sheets and independent of record ordering', () => {
  const [payment, delivery] = presentReportSheets([...sheets, { name: 'Courier & Delivery', note: '', headers: ['Order reference', 'Status'], rows: [['1234567890123456', 'Dispatched']] }], [...profiles].reverse(), [], orders);
  assert.equal(payment.rows[0][0], delivery.rows[0][0]);
  assert.equal(payment.rows[0][payment.headers.indexOf('Report reference')], delivery.rows[0][delivery.headers.indexOf('Order reference (readable)')]);
  assert.equal(delivery.rows[0][1], 'Customer One');
});

test('Missing profiles never substitute agreement parties as customer names', () => {
  const [sheet] = presentReportSheets(sheets, [], [], orders);
  assert.equal(sheet.rows[0][1], 'Not recorded');
  assert.equal(sheet.rows[0][2], 'Not recorded');
  assert.equal(sheet.rows[0][3], 'one@example.com');
});

test('XLSX retains long IDs and formula-like text as inline strings and formats currency after column moves', () => {
  const result = presentReportSheets(sheets, [{ ...profiles[0], name: '=HYPERLINK("bad")' }], [], orders);
  const buffer = buildReportsXlsx(result);
  const parts = new Map<string, string>();
  for (let offset = 0; buffer.readUInt32LE(offset) === 0x04034b50;) {
    const size = buffer.readUInt32LE(offset + 18), nameSize = buffer.readUInt16LE(offset + 26), extra = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 30, offset + 30 + nameSize).toString();
    const start = offset + 30 + nameSize + extra;
    parts.set(name, inflateRawSync(buffer.subarray(start, start + size)).toString());
    offset = start + size;
  }
  const xml = parts.get('xl/worksheets/sheet1.xml')!;
  assert.ok(xml.includes('1234567890123456</t>'));
  assert.ok(xml.includes('0987654321</t>'));
  assert.ok(xml.includes('=HYPERLINK(&quot;bad&quot;)'));
  assert.ok(!xml.includes('<f>'));
  assert.match(xml, /s="4"><v>350<\/v>/);
  assert.ok(parts.get('xl/styles.xml')!.includes('₹'));
});
