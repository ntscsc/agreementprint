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

const person = { fullName: 'Example Person', relativeName: 'Example Relative', relationship: 'Daughter of', age: 30, address: '12 Example Street Delhi', pincode: '110001', phone: '9876543210' };
const property = { fullAddress: '12 Example Street, Chennai', city: 'Chennai', pincode: '600001', propertyType: 'House', furnishing: 'Unfurnished' };
const terms = { language: 'English', monthlyRent: 17500, securityDeposit: 75000, maintenanceCharges: 1500, rentIncreasePct: 15, paymentDueDay: 9, tenureMonths: 6, noticePeriodDays: 45, startDate: '2026-10-17', paintingDeduction: 2750, stampPaperDenomination: 100, deliveryRecipient: 'Owner', deliveryLocation: 'Within Tamil Nadu', includeNotary: false };

test('Final print templates reserve blank stamp space without images or draft watermarks', () => {
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
  for (const kind of ['rental', 'lease', 'tamil-house', 'tamil-shop']) for (const stampPaperDenomination of [100, 200]) {
    const html = renderToStaticMarkup(React.createElement(load('@/components/agreement/RentalAgreementDocument').RentalAgreementDocument, {
      blankStampSpace: true,
      data: { ownerDetails: person, tenantDetails: person, propertyDetails: { ...property, propertyType: kind === 'tamil-shop' ? 'Commercial Shop' : 'House', businessName: 'Example Stores' }, agreementTerms: { ...terms, agreementType: kind === 'lease' ? 'Lease' : 'Rental', language: kind.startsWith('tamil') ? 'Tamil' : 'English', stampPaperDenomination } },
    }));
    assert.equal((html.match(/class="stamp-paper-allowance/g) || []).length, stampPaperDenomination === 200 ? 2 : 1);
    assert.equal((html.match(/class="agreement-page /g) || []).length, 3);
    assert.doesNotMatch(html, /stamp-paper-100\.png|SAMPLE DRAFT|schedule hereunder|Which at No:|Rupees[^<]*Rupees/);
    assert.match(html, /75,000/);
  }
});

function render(data: unknown, customerPreview = true) {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  return renderToStaticMarkup(React.createElement(load('@/components/agreement/RentalAgreementDocument').RentalAgreementDocument, { data, customerPreview })).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

test('English customer and final drafts include all selected contractual terms for both stamp packages', () => {
  for (const stampPaperDenomination of [100, 200]) for (const customerPreview of [true, false]) {
    const text = render({ ownerDetails: person, tenantDetails: { ...person, relationship: 'Wife of' }, propertyDetails: property, agreementTerms: { ...terms, stampPaperDenomination } }, customerPreview);
    for (const value of ['17,500', '75,000', '1,500', '15%', '9th', '45 days', '17th October 2026', '16th April 2027', 'Daughter of', 'Wife of', 'Chennai', '600001', 'Unfurnished']) assert.ok(text.includes(value), value);
    assert.doesNotMatch(text, /S\/o|OWNER have|on this day of/);
    assert.equal((text.match(/unlawful/g) || []).length, 1);
    assert.equal(text.includes('SAMPLE DRAFT'), customerPreview);
  }
});

test('Tamil house and shop drafts preserve maintenance, annual increase and spouse wording', () => {
  for (const propertyType of ['House', 'Commercial Shop']) for (const stampPaperDenomination of [100, 200]) for (const customerPreview of [true, false]) {
    const text = render({ ownerDetails: { ...person, relationship: 'Wife of' }, tenantDetails: { ...person, relationship: 'Husband of' }, propertyDetails: { ...property, propertyType, businessName: 'Example Stores' }, agreementTerms: { ...terms, language: 'Tamil', stampPaperDenomination } }, customerPreview);
    for (const value of ['1,500', '15%', 'கணவரின் பெயர்', 'மனைவியின் பெயர்', '45', '6', '9']) assert.ok(text.includes(value), value);
    assert.doesNotMatch(text, /S\/o/);
  }
});

test('Every English relationship is retained in rental and lease output; legacy records stay neutral', () => {
  for (const agreementType of ['Rental', 'Lease']) for (const relationship of ['Son of', 'Daughter of', 'Wife of', 'Husband of', 'Child of', 'Spouse of']) {
    const text = render({ ownerDetails: { ...person, relationship }, tenantDetails: { ...person, relationship }, propertyDetails: property, agreementTerms: { ...terms, agreementType } });
    assert.equal((text.match(new RegExp(relationship, 'g')) || []).length, 2);
  }
  const text = render({ ownerDetails: { ...person, relationship: undefined }, agreementTerms: terms });
  assert.ok(text.includes('Parent / spouse:'));
  assert.doesNotMatch(text, /S\/o/);
});

test('Property PIN checks require a listed six-digit PIN starting with 6 without matching city spelling', () => {
  const { validateProperty, validatePerson } = load('@/lib/agreement-validation');
  assert.doesNotThrow(() => validatePerson(person, 'owner'));
  assert.doesNotThrow(() => validateProperty(property));
  assert.doesNotThrow(() => validateProperty({ ...property, city: 'Madurai', pincode: '625001' }));
  for (const city of ['Thirukoilur', 'Tirukoilur', 'Tirukkoyilur', 'Chennai']) assert.doesNotThrow(() => validateProperty({ ...property, city, pincode: '605757' }));
  assert.doesNotThrow(() => validateProperty({ ...property, city: 'சென்னை' }));
  for (const patch of [{ pincode: '110001' }, { pincode: '670001' }, { pincode: '605001' }, { pincode: '60575' }, { pincode: '6057577' }, { pincode: '699999' }]) assert.throws(() => validateProperty({ ...property, ...patch }));
  assert.throws(() => validatePerson({ ...person, relationship: 'Unknown' }, 'owner'));
});

test('Relationship and financial edits invalidate an already reviewed checkout', () => {
  const current = { ownerDetails: person, agreementTerms: terms };
  assert.ok(checkoutDetailsChanged(current, { ownerDetails: { ...person, relationship: 'Spouse of' } }));
  assert.ok(checkoutDetailsChanged(current, { agreementTerms: { ...terms, maintenanceCharges: 1600 } }));
  assert.ok(checkoutDetailsChanged(current, { agreementTerms: { ...terms, rentIncreasePct: 10 } }));
  assert.equal(restoreAgreementTerms(terms).maintenanceCharges, 1500);
  assert.equal(restoreAgreementTerms(terms).rentIncreasePct, 15);
});
