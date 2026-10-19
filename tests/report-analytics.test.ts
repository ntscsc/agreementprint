import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAnalyticsSheets, reportDate } from '../lib/report-analytics.ts';
import { buildReportsXlsx } from '../lib/admin-report-xlsx.ts';
import { inflateRawSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { presentReportSheets } from '../lib/report-presentation.ts';

const at = '2026-09-30T20:00:00Z'; // 1 October, India time.
const data = {
  orders: [
    { orderId: 'original', ownerUid: 'customer', createdAt: at, updatedAt: at, replacedByOrderId: 'replacement', status: 'Cancelled', payment: { status: 'Paid', amount: 500, paidAt: at } },
    { orderId: 'replacement', ownerUid: 'customer', createdAt: at, updatedAt: at, replacesOrderId: 'original', status: 'Drafting', propertyDetails: { city: ' Chennai ', fullAddress: 'QA TEST ONLY' }, agreementTerms: { agreementType: 'Rental', language: 'Tamil', includeNotary: true, extraCopies: 1 }, payment: { status: 'Paid', amount: 600, totalBeforeCredits: 650, referralCreditApplied: 50, paidAt: at } },
    { orderId: 'unpaid', ownerUid: 'other', createdAt: at, updatedAt: 'invalid', status: 'Submitted', payment: { status: 'Failed' } },
  ],
  customAgreementRequests: [{ requestId: 'custom', ownerUid: 'customer', createdAt: at, updatedAt: at, status: 'Completed', agreementType: 'Affidavit', payment: { status: 'Paid', amount: 200, paidAt: at } }],
  customerProfiles: [{ id: 'customer', name: 'Saved name', phone: '9999999999' }],
  referralAccounts: [{ id: 'account-only' }],
};
const payments = [{ reference: 'original', uid: 'customer', at, amount: 500 }, { reference: 'replacement', uid: 'customer', at, amount: 100 }, { reference: 'custom', uid: 'customer', at, amount: 200 }];
const refunds = [{ uid: 'customer', at, amount: 50 }];
const generate = () => buildAnalyticsSheets(data, payments, refunds, new Date('2026-10-18T12:00:00Z'));
const sheet = (name: string) => generate().find(row => row.name === name)!;
const cell = (name: string, row: number, header: string) => { const tab = sheet(name); return tab.rows[row][tab.headers.indexOf(header)]; };

test('Monthly analytics reconcile receipts and refunds without counting carried cash as new sales', () => {
  assert.equal(cell('Monthly Trends', 0, 'Month (IST)'), '2026-10');
  assert.equal(cell('Monthly Trends', 0, 'New standard orders'), 2);
  assert.equal(cell('Monthly Trends', 0, 'Replacement records'), 1);
  assert.equal(cell('Monthly Trends', 0, 'Active sales (INR)'), 850);
  assert.equal(cell('Monthly Trends', 0, 'Cash received (INR)'), 800);
  assert.equal(cell('Monthly Trends', 0, 'Confirmed refunds (INR)'), 50);
  assert.equal(cell('Monthly Trends', 0, 'Net cash (INR)'), 750);
  assert.equal(cell('Monthly Trends', 0, 'Average agreement value (INR)'), 425);
  assert.equal(cell('Monthly Trends', 0, 'Possible test cash (INR)'), 100);
});

test('Breakdowns are independent dimensions with normalized cities and shares', () => {
  const tab = sheet('Sales Breakdown');
  const sources = tab.rows.filter(row => row[0] === 'Source');
  assert.equal(sources.reduce((sum, row) => sum + Number(row[4]), 0), 850);
  assert.equal(sources.reduce((sum, row) => sum + Number(row[6]), 0), 1);
  assert.ok(tab.rows.some(row => row[0] === 'City' && row[1] === 'CHENNAI'));
});

test('Customer value ranks by net receipts, includes account-only users and excludes replacement originals from repeat counts', () => {
  assert.equal(cell('Customer Value', 0, 'Customer ID'), 'customer');
  assert.equal(cell('Customer Value', 0, 'Active paid agreements'), 2);
  assert.equal(cell('Customer Value', 0, 'Segment'), 'Repeat paid customer');
  assert.equal(cell('Customer Value', 0, 'Net cash (INR)'), 750);
  assert.equal(sheet('Customer Value').rows.length, 3);
});

test('Action queue excludes replaced/completed work and flags missing dates without inventing age', () => {
  const queue = sheet('Action Queue');
  assert.equal(queue.rows.length, 2);
  assert.ok(!queue.rows.some(row => row[0] === 'original' || row[0] === 'custom'));
  const failed = queue.rows.find(row => row[0] === 'unpaid')!;
  assert.equal(failed[5], 'Follow up on failed payment');
  assert.equal(failed[7], null);
  assert.ok(sheet('Data Quality').rows.some(row => row[0] === 'replacement' && row[2] === 'Possible test record'));
  assert.ok(sheet('Data Quality').rows.some(row => row[0] === 'unpaid' && row[2] === 'Missing/invalid update date'));
});

test('Missing paid amounts do not become fabricated zero prices or average values', () => {
  const missing = { ...data, orders: [{ orderId: 'unknown-value', ownerUid: 'customer', status: 'Submitted', createdAt: at, updatedAt: at, payment: { status: 'Paid' } }], customAgreementRequests: [] };
  const tabs = buildAnalyticsSheets(missing, [], [], new Date(at));
  const monthly = tabs.find(row => row.name === 'Monthly Trends')!;
  const unknown = monthly.rows.find(row => row[0] === 'Date unavailable')!;
  assert.equal(unknown[6], null);
  assert.equal(unknown[11], 1);
  const facts = tabs.find(row => row.name === 'Order Analytics')!;
  assert.equal(facts.rows[0][19], null);
});

test('Pending refund follow-up does not reduce confirmed net cash or include completed legs', () => {
  const tabs = buildAnalyticsSheets({ ...data, creditRefundRequests: [{ id: 'refund-1', ownerUid: 'customer', orderId: 'original', state: 'Processing', updatedAt: at, legs: [{ state: 'Reserved', amount: 100 }, { state: 'COMPLETED', amount: 50 }] }] }, payments, refunds, new Date(at));
  const queue = tabs.find(sheet => sheet.name === 'Action Queue')!;
  const row = queue.rows.find(row => row[2] === 'Refund')!;
  assert.equal(row[9], 'refund-1');
  assert.equal(row[10], 100);
  assert.equal(tabs.find(sheet => sheet.name === 'Monthly Trends')!.rows[0][9], 750);
});

test('Excel dates are numeric date cells in India wall-clock time and percentages have numeric styles', () => {
  assert.equal(reportDate('invalid'), null);
  assert.equal(reportDate(null), null);
  assert.equal(reportDate({ toDate: () => new Date(at) })!.toISOString(), at.replace('Z', '.000Z'));
  const buffer = buildReportsXlsx([{ name: 'Check', note: '', headers: ['Created (IST)', 'Share'], rows: [[new Date(at), 0.5]], percent: [1] }]);
  const parts = new Map<string, string>();
  for (let offset = 0; buffer.readUInt32LE(offset) === 0x04034b50;) {
    const size = buffer.readUInt32LE(offset + 18), length = buffer.readUInt16LE(offset + 26), extra = buffer.readUInt16LE(offset + 28), start = offset + 30 + length + extra;
    parts.set(buffer.subarray(offset + 30, offset + 30 + length).toString(), inflateRawSync(buffer.subarray(start, start + size)).toString());
    offset = start + size;
  }
  const xml = parts.get('xl/worksheets/sheet1.xml')!;
  const serial = Number(xml.match(/r="A5" s="7"><v>([^<]+)/)![1]);
  assert.ok(Math.abs(serial - ((new Date(at).getTime() + 330 * 60000) / 86400000 + 25569)) < 1e-8);
  assert.ok(xml.includes('r="B5" s="9"><v>0.5</v>'));
  assert.ok(parts.get('xl/styles.xml')!.includes('dd mmm yyyy hh:mm'));
});

test('Full export assembles analytics, reconciles customer counts and preserves unique headers and numeric formats', () => {
  const require = createRequire(import.meta.url), ts = require('typescript');
  const target = { exports: {} as any };
  const compiled = ts.transpileModule(readFileSync(new URL('../lib/admin-reports.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  runInNewContext(compiled, { module: target, exports: target.exports, Date, Intl, require: (name: string) => name === './report-presentation' ? { presentReportSheets } : name === './report-analytics' ? { buildAnalyticsSheets, reportDate } : require(name) });
  const sources = ['phonepePaymentAttempts', 'customPhonepeAttempts', 'orderReplacements', 'creditRefundRequests', 'orderRefundHistory', 'referralCodes', 'agentReferralCustomers', 'referralRewards', 'referralLedger', 'adminLogs', 'customAgreementAudit', 'customerReviews'];
  const all = { ...Object.fromEntries(sources.map(name => [name, []])), ...data };
  const result = target.exports.buildAdminReportSheets(all, new Date('2026-10-18T12:00:00Z'));
  assert.equal(result[0].name, 'Summary');
  assert.equal(result[1].name, 'Monthly Trends');
  const customers = result.find((sheet: any) => sheet.name === 'Customer Details');
  assert.equal(result[0].rows.find((row: any) => row[0] === 'Customer accounts')[1], customers.rows.length);
  for (const sheet of result) {
    assert.equal(new Set(sheet.headers).size, sheet.headers.length, sheet.name);
    for (const row of sheet.rows) assert.equal(row.length, sheet.headers.length, sheet.name);
    for (const index of [...sheet.money || [], ...sheet.percent || []]) assert.ok(index >= 0 && index < sheet.headers.length);
  }
  const facts = result.find((sheet: any) => sheet.name === 'Order Analytics');
  assert.match(String(facts.rows[0][facts.headers.indexOf('Report reference')]), /^ORD-[0-9]{10}$/);
  assert.ok(facts.rows[0][facts.headers.indexOf('Created (IST)')] instanceof Date);
  assert.ok(buildReportsXlsx(result).length > 1000);
});
