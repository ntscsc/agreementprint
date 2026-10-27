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

test('Painting deduction cannot exceed the deposit in online or counter agreements', () => {
  const { validateAgreement, paintingDeductionError } = load('@/lib/agreement-validation');
  const { validateCounterAgreement } = load('@/lib/counter-order');
  const recipient = { ...person, pincode: '600001' };
  for (const agreementType of ['Rental', 'Lease']) for (const language of ['English', 'Tamil']) for (const propertyType of ['House', 'Flat', 'Commercial Shop']) {
    const agreementTerms = { ...terms, agreementType, language, deliveryLocation: 'Within Chennai', securityDeposit: 50000, ...(agreementType === 'Lease' ? { monthlyRent: 0, rentIncreasePct: 0 } : {}) };
    const agreement = { ownerDetails: recipient, tenantDetails: recipient, propertyDetails: { ...property, propertyType, businessName: 'Example Stores' }, agreementTerms };
    const validators = [validateCounterAgreement];
    if (agreementType !== 'Lease' || (language === 'English' && propertyType !== 'Commercial Shop')) validators.push(validateAgreement);
    for (const validate of validators) {
      for (const paintingDeduction of [0, 49999.99, 50000, undefined]) {
        if (paintingDeduction === undefined && language === 'Tamil' && propertyType !== 'Commercial Shop') continue;
        assert.doesNotThrow(() => validate({ ...agreement, agreementTerms: { ...agreementTerms, paintingDeduction } }));
      }
      for (const paintingDeduction of [50000.01, 50001]) {
        assert.throws(() => validate({ ...agreement, agreementTerms: { ...agreementTerms, paintingDeduction } }), /Painting deduction cannot exceed/);
      }
      if (agreementType === 'Rental') {
        assert.doesNotThrow(() => validate({ ...agreement, agreementTerms: { ...agreementTerms, securityDeposit: 0, paintingDeduction: 0 } }));
        assert.throws(() => validate({ ...agreement, agreementTerms: { ...agreementTerms, securityDeposit: 0, paintingDeduction: 0.01 } }), /Painting deduction cannot exceed/);
      }
      for (const paintingDeduction of [-1, NaN, Infinity]) {
        assert.throws(() => validate({ ...agreement, agreementTerms: { ...agreementTerms, paintingDeduction } }), /valid painting deduction/);
      }
    }
  }
  assert.match(paintingDeductionError(50001, 50000), /cannot exceed/);
  assert.equal(paintingDeductionError(50000, 50000), undefined);
});

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
  return renderToStaticMarkup(React.createElement(load('@/components/agreement/RentalAgreementDocument').RentalAgreementDocument, { data, customerPreview })).replace(/<\/(?:p|div|section|h[1-6])>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
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

test('Tamil leases retain every selected relationship and printable page numbers', () => {
  const { tamilRelationship } = load('@/components/agreement/TamilRentalAgreement');
  assert.notEqual(tamilRelationship('Son of'), tamilRelationship('Daughter of'));
  for (const relationship of ['Son of', 'Daughter of', 'Wife of', 'Husband of', 'Child of', 'Spouse of']) {
    const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
    const html = renderToStaticMarkup(React.createElement(load('@/components/agreement/RentalAgreementDocument').RentalAgreementDocument, {
      blankStampSpace: true,
      data: { ownerDetails: { ...person, relationship }, tenantDetails: { ...person, relationship }, propertyDetails: property, agreementTerms: { ...terms, agreementType: 'Lease', language: 'Tamil' } },
    }));
    assert.equal(html.split(tamilRelationship(relationship)).length - 1, 2);
    assert.equal((html.match(/agreement-page-number/g) || []).length, 3);
    assert.doesNotMatch(html, /agreement-page-number[^\"]*print:hidden/);
  }
});

test('Painting is available in all 16 variants and prints only for a finite positive amount', () => {
  assert.equal(restoreAgreementTerms().paintingDeduction, 0);
  assert.equal(restoreAgreementTerms({ paintingDeduction: 2750 }).paintingDeduction, 2750);
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
  for (const agreementType of ['Rental', 'Lease']) for (const language of ['English', 'Tamil']) for (const propertyType of ['House', 'Commercial Shop']) for (const stampPaperDenomination of [100, 200]) {
    for (const paintingDeduction of [undefined, 0, -1, NaN, Infinity, 2750, 5000.5]) {
      const html = renderToStaticMarkup(React.createElement(load('@/components/agreement/RentalAgreementDocument').RentalAgreementDocument, {
        blankStampSpace: true,
        data: { ownerDetails: person, tenantDetails: person, propertyDetails: { ...property, propertyType, businessName: 'Example Stores' }, agreementTerms: { ...terms, agreementType, language, stampPaperDenomination, paintingDeduction } },
      }));
      const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      assert.equal(/painting charges|பெயிண்ட்/.test(text), typeof paintingDeduction === 'number' && Number.isFinite(paintingDeduction) && paintingDeduction > 0, `${agreementType}/${language}/${propertyType}/${stampPaperDenomination}/${paintingDeduction}`);
      if (paintingDeduction === 2750) assert.ok(text.includes('2,750'));
      if (paintingDeduction === 5000.5) {
        assert.ok(text.includes('5,000.50'));
        assert.doesNotMatch(text, /5,000\.5\s*\/\-/);
      }
    }
  }
});

test('Painting summary preserves both paise digits and distinguishes no deduction', () => {
  const { formatAgreementAmount, paintingDeductionSummary } = load('@/lib/agreement-formatter');
  assert.equal(formatAgreementAmount(5000.5), '5,000.50');
  assert.equal(formatAgreementAmount(5000.05), '5,000.05');
  assert.equal(formatAgreementAmount(5000), '5,000');
  assert.equal(paintingDeductionSummary(5000.5), '₹5,000.50');
  for (const value of [0, undefined]) assert.equal(paintingDeductionSummary(value), 'None (₹0)');
});

test('Tamil home/shop rental and lease clauses keep consecutive numbers across pages', () => {
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
  for (const agreementType of ['Rental', 'Lease']) for (const propertyType of ['House', 'Commercial Shop']) for (const stampPaperDenomination of [100, 200]) {
    let previousCount = 0;
    for (const paintingDeduction of [0, 5000.5]) {
      const html = renderToStaticMarkup(React.createElement(load('@/components/agreement/RentalAgreementDocument').RentalAgreementDocument, {
        blankStampSpace: true,
        data: { ownerDetails: person, tenantDetails: person, propertyDetails: { ...property, propertyType, businessName: 'Example Stores' }, agreementTerms: { ...terms, agreementType, language: 'Tamil', stampPaperDenomination, paintingDeduction } },
      }));
      const numbers = [...html.matchAll(/data-agreement-clause="(\d+)"/g)].map(match => Number(match[1]));
      assert.ok(numbers.length >= 10);
      assert.deepEqual(numbers, Array.from({ length: numbers.length }, (_, i) => i + 1));
      if (paintingDeduction > 0) assert.equal(numbers.length, previousCount + 1);
      previousCount = numbers.length;
    }
  }
});

test('Tamil templates emphasize entered parties, dates, amounts and business details', () => {
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
  for (const agreementType of ['Rental', 'Lease']) for (const propertyType of ['House', 'Commercial Shop']) for (const stampPaperDenomination of [100, 200]) {
    const html = renderToStaticMarkup(React.createElement(load('@/components/agreement/RentalAgreementDocument').RentalAgreementDocument, {
      blankStampSpace: true,
      data: { ownerDetails: person, tenantDetails: person, propertyDetails: { ...property, propertyType, businessName: 'Example Stores' }, agreementTerms: { ...terms, agreementType, language: 'Tamil', stampPaperDenomination, paintingDeduction: 5000.5 } },
    }));
    const bold = [...html.matchAll(/<strong\b[^>]*>(.*?)<\/strong>/gs)].map(match => match[1].replace(/<[^>]+>/g, ''));
    for (const expected of ['Example Person', '75,000', '1,500', '5,000.50', '17 அக்டோபர் 2026', '6']) {
      assert.ok(bold.includes(expected), `${agreementType}/${propertyType}/${stampPaperDenomination}: ${expected}`);
    }
    if (propertyType === 'Commercial Shop') assert.ok(bold.includes('Example Stores'));
  }
});

test('Online review shows the formatted painting deduction only in agreement details', () => {
  cache.set('@/lib/auth-context', { useAuth: () => ({ user: null }) });
  try {
    const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
    const { ReviewStep } = load('@/components/order/ReviewStep');
    for (const paintingDeduction of [0, 5000.5]) {
      const html = renderToStaticMarkup(React.createElement(ReviewStep, {
        ownerData: person, tenantData: person, propertyData: property,
        termsData: { ...terms, paintingDeduction }, referralCode: '',
        onReferralCodeChange() {}, onEditStep() {}, onSubmitOrder() {},
        submitting: false, submissionError: null, paymentPending: false,
        phonePeCheckout: null, paymentOrderId: null, onCheckoutCancelled() {},
      }));
      const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      const expected = paintingDeduction > 0 ? '₹5,000.50' : 'None (₹0)';
      assert.equal(text.split(expected).length - 1, 1, 'visible once in agreement details');
      assert.doesNotMatch(text, /not charged now/);
    }
  } finally {
    cache.delete('@/lib/auth-context');
  }
});
