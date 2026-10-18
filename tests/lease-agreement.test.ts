import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { checkoutDetailsChanged } from '../lib/order-checkout-details.ts';
import { restoreAgreementTerms } from '../lib/agreement-draft.ts';

const require = createRequire(import.meta.url), ts = require('typescript');
const cache = new Map<string, any>();
function load(name: string): any {
  if (!name.startsWith('@/')) return require(name);
  if (cache.has(name)) return cache.get(name);
  if (name.endsWith('.json')) return JSON.parse(readFileSync(new URL(`../${name.slice(2)}`, import.meta.url), 'utf8'));
  const extension = name.includes('/components/') ? 'tsx' : 'ts';
  const target = { exports: {} as any };
  runInNewContext(ts.transpileModule(readFileSync(new URL(`../${name.slice(2)}.${extension}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { module: target, exports: target.exports, require: load, Date, console });
  cache.set(name, target.exports);
  return target.exports;
}
const terms = { agreementType: 'Lease', language: 'English', monthlyRent: 0, securityDeposit: 250000,
  maintenanceCharges: 750, startDate: '2026-10-17', tenureMonths: 6, noticePeriodDays: 60,
  rentIncreasePct: 0, stampPaperDenomination: 100, deliveryLocation: 'Within Chennai', deliveryRecipient: 'Owner', includeNotary: false };

test('Lease renders both stamp options with all clauses and selected financial/date terms', () => {
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
  const { RentalAgreementDocument } = load('@/components/agreement/RentalAgreementDocument');
  for (const denomination of [100, 200]) {
    const html = renderToStaticMarkup(React.createElement(RentalAgreementDocument, { customerPreview: true,
      data: { ownerDetails: { fullName: 'Owner Example' }, tenantDetails: { fullName: 'Tenant Example' },
        propertyDetails: { fullAddress: '12 Example Street, Chennai', city: 'Chennai', pincode: '600001' },
        agreementTerms: { ...terms, stampPaperDenomination: denomination } } }));
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    assert.match(text, /LEASE AGREEMENT/);
    for (const expected of ['Owner Example', 'Tenant Example', '2,50,000', 'Two Lakhs Fifty Thousand Rupees', '16th April 2027', '60 days', '750', 'new tenant', 'no separate monthly rent']) assert.ok(text.includes(expected), expected);
    for (let clause = 1; clause <= 15; clause++) assert.ok(html.includes(`<strong>${clause}.</strong>`), `clause ${clause}`);
    assert.equal((html.match(/class="agreement-page lease-agreement-page/g) || []).length, 3);
    assert.equal((html.match(/class="stamp-paper-allowance/g) || []).length, denomination === 200 ? 2 : 1);
    assert.equal((html.match(/SAMPLE DRAFT/g) || []).length, 3);
    assert.doesNotMatch(text, /monthly rent of Rs/);
    assert.doesNotMatch(text, /Chennai, Chennai/);
  }
});

test('Lease validation rejects rent, escalation, Tamil, zero advance and commercial premises', () => {
  const { validateAgreement } = load('@/lib/agreement-validation');
  const person = { fullName: 'Example Person', relativeName: 'Example Parent', age: 30, address: '12 Example Street Chennai', pincode: '600001', phone: '9876543210' };
  const order = { ownerDetails: person, tenantDetails: person, propertyDetails: { fullAddress: '12 Example Street Chennai', city: 'Chennai', pincode: '600001', propertyType: 'House', furnishing: 'Unfurnished' }, agreementTerms: terms };
  for (const stampPaperDenomination of [100, 200]) assert.doesNotThrow(() => validateAgreement({ ...order, agreementTerms: { ...terms, stampPaperDenomination } }));
  for (const invalid of [{ monthlyRent: 1 }, { rentIncreasePct: 5 }, { language: 'Tamil' }, { securityDeposit: 0 }, { stampPaperDenomination: 500 }, { agreementType: 'Other' }]) assert.throws(() => validateAgreement({ ...order, agreementTerms: { ...terms, ...invalid } }));
  assert.throws(() => validateAgreement({ ...order, propertyDetails: { ...order.propertyDetails, propertyType: 'Commercial Shop', businessName: 'Example Shop' } }));
  const rental = { ...terms, agreementType: 'Rental', monthlyRent: 15000 };
  assert.doesNotThrow(() => validateAgreement({ ...order, agreementTerms: rental }));
  assert.ok(checkoutDetailsChanged({ agreementTerms: rental }, { agreementTerms: terms }));
  assert.equal(restoreAgreementTerms({ agreementType: 'Lease' }).agreementType, 'Lease');
});
