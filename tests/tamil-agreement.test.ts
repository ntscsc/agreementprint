import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { tamilAmountInWords, tamilNumberToWords } from '../lib/tamil-number-to-words.ts';
import { restoreAgreementTerms } from '../lib/agreement-draft.ts';
import { checkoutDetailsChanged } from '../lib/order-checkout-details.ts';
import { formatPropertyAddress } from '../lib/agreement-formatter.ts';
import { parseTypedCalendarDate, displayCalendarDate, isValidCalendarDate } from '../lib/calendar-date.ts';

const require = createRequire(import.meta.url), ts = require('typescript');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
function load(file: string, dependencies: Record<string, unknown>) {
  const target = { exports: {} as any };
  runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, {
    module: target, exports: target.exports, require: (name: string) => {
      if (name === 'react/jsx-runtime') return require(name);
      assert.ok(name in dependencies, `Unexpected dependency ${name}`);
      return dependencies[name];
    },
  });
  return target.exports;
}
const { TamilRentalAgreement } = load('../components/agreement/TamilRentalAgreement.tsx', {
  '@/lib/agreement-formatter': load('../lib/agreement-formatter.ts', {}),
  '@/lib/tamil-number-to-words': { tamilAmountInWords },
  '@/src/content/tamil-rental-template.json': require('../src/content/tamil-rental-template.json'),
  '@/src/content/tamil-shop-template.json': require('../src/content/tamil-shop-template.json'),
});
const terms = { language: 'Tamil', paintingDeduction: 2750, monthlyRent: 15250.75, securityDeposit: 0, maintenanceCharges: 600, startDate: '2026-10-17', tenureMonths: 6, noticePeriodDays: 45, rentIncreasePct: 7, paymentDueDay: 9, stampPaperDenomination: 200, deliveryLocation: 'Within Chennai', deliveryRecipient: 'Owner', includeNotary: false };

test('Zero painting deduction omits its entire clause in previews and final agreements', () => {
  for (const customerPreview of [true, false]) for (const stampPaperDenomination of [100, 200]) for (const paintingDeduction of [0, 2750]) {
    const html = renderToStaticMarkup(React.createElement(TamilRentalAgreement, {
      data: { agreementTerms: { ...terms, paintingDeduction, stampPaperDenomination } },
      stampPaperSpace: true, customerPreview, watermark: 'SAMPLE DRAFT', stampMargin: () => null,
    }));
    assert.equal(html.replace(/<[^>]+>/g, '').includes('பெயிண்ட்'), paintingDeduction > 0);
    assert.equal(html.replace(/<[^>]+>/g, '').includes('ரூ.2,750/-'), paintingDeduction > 0);
    assert.ok(html.replace(/<[^>]+>/g, '').includes('ரூ.15,250.75/-'), 'Monthly rent remains unchanged');
  }
});

test('Tamil amounts handle Indian groups, zero, paise, rounding and invalid input', () => {
  assert.equal(tamilAmountInWords(0), 'பூஜ்ஜியம் ரூபாய்');
  assert.equal(tamilAmountInWords(15250.75), 'பதினைந்து ஆயிரத்து இருநூற்று ஐம்பது ரூபாய் எழுபத்து ஐந்து பைசா');
  assert.equal(tamilNumberToWords(100000), 'ஒரு லட்சம்');
  assert.equal(tamilNumberToWords(10000000), 'ஒரு கோடி');
  assert.equal(tamilAmountInWords(999.999), 'ஆயிரம் ரூபாய்');
  for (const invalid of [-1, Infinity, NaN, 1000000001]) assert.equal(tamilAmountInWords(invalid), '');
});

test('Tamil draft uses entered terms rather than sample fixed amounts and periods', () => {
  const html = renderToStaticMarkup(React.createElement(TamilRentalAgreement, { data: { ownerDetails: {fullName:'குமார்'}, tenantDetails: {fullName:'ரவி'}, agreementTerms: terms }, stampPaperSpace: true, customerPreview: true, watermark: React.createElement('span', null, 'SAMPLE DRAFT'), stampMargin: (page: number) => React.createElement('aside', null, `STAMP-${page}`) }));
  for (const text of ['குமார்', 'ரவி', 'ரூ.2,750/-', 'ரூ.15,250.75/-', 'பூஜ்ஜியம் ரூபாய்', '45 நாள்', 'வரை 6 மாதம்', 'தேதி 9-க்குள்', 'ரூ.600/-', '7%', '16 ஏப்ரல் 2027', 'STAMP-1', 'STAMP-2']) assert.ok(html.replace(/<[^>]+>/g, '').includes(text), text);
  assert.equal((html.match(/SAMPLE DRAFT/g) || []).length, 3);
  assert.equal((html.match(/lang="ta"/g) || []).length, 3);
  assert.ok(!html.replace(/<[^>]+>/g, '').includes('ரூ.5,000/-'));
  assert.ok(!html.replace(/<[^>]+>/g, '').includes('3 மாத முன்'));
  const plain = renderToStaticMarkup(React.createElement(TamilRentalAgreement, { data: {agreementTerms:{...terms, stampPaperDenomination:100}}, stampPaperSpace:false, customerPreview:false, watermark:'SAMPLE DRAFT', stampMargin:()=> 'STAMP' }));
  assert.ok(!plain.includes('STAMP'));
  assert.ok(!plain.includes('SAMPLE DRAFT'));
  const stamp100 = renderToStaticMarkup(React.createElement(TamilRentalAgreement, { data:{agreementTerms:{...terms,stampPaperDenomination:100}}, stampPaperSpace:true, customerPreview:false, watermark:null, stampMargin:(page:number)=>`STAMP-${page}` }));
  assert.ok(stamp100.includes('STAMP-1'));
  assert.ok(!stamp100.includes('STAMP-2'));
});

test('Language/deduction persist in restored drafts and participate in checkout change detection', () => {
  assert.equal(restoreAgreementTerms().language, 'English');
  const restored = restoreAgreementTerms({language:'Tamil', paintingDeduction:0});
  assert.equal(restored.language, 'Tamil');
  assert.equal(restored.paintingDeduction, 0);
  assert.ok(checkoutDetailsChanged({agreementTerms:terms}, {agreementTerms:{...terms, language:'English'}}));
  assert.ok(checkoutDetailsChanged({agreementTerms:terms}, {agreementTerms:{...terms, paintingDeduction:0}}));
});

test('Server validates language/deduction while accepting legacy English terms', () => {
  const {validateTerms, validateAgreement} = load('../lib/agreement-validation.ts', {'@/lib/api-input':{ApiInputError:Error}, '@/lib/coupon':{isValidCouponCode:()=>true}, '@/lib/property-postcode':{propertyPostcodeError:()=>null}});
  assert.throws(()=>validateTerms(terms), /Painting deduction cannot exceed/);
  const validTerms = { ...terms, securityDeposit: 50000 };
  assert.doesNotThrow(()=>validateTerms(validTerms));
  const legacy = {...validTerms}; delete (legacy as any).language; delete (legacy as any).paintingDeduction;
  assert.doesNotThrow(()=>validateTerms(legacy));
  for (const patch of [{language:'Other'}, {paintingDeduction:-1}, {paintingDeduction:Infinity}, {paintingDeduction:'5000'}]) assert.throws(()=>validateTerms({...validTerms,...patch}));
  const person = {fullName:'Test Person',relativeName:'Test Relative',age:30,address:'12 Example Street Chennai',pincode:'600061',phone:'9876543210'};
  const agreement = {ownerDetails:person,tenantDetails:person,agreementTerms:validTerms,propertyDetails:{fullAddress:'12 Example Street Chennai',city:'Chennai',pincode:'600061',propertyType:'House',furnishing:'Unfurnished'}};
  assert.doesNotThrow(()=>validateAgreement(agreement));
  assert.throws(()=>validateAgreement({...agreement,agreementTerms:{...validTerms,paintingDeduction:undefined}}), /painting/);
  const commercial = {...agreement,agreementTerms:{...validTerms,paintingDeduction:undefined},propertyDetails:{...agreement.propertyDetails,propertyType:'Commercial Shop',businessName:'Example shop'}};
  assert.doesNotThrow(()=>validateAgreement(commercial));
  assert.throws(()=>validateAgreement({...commercial,propertyDetails:{...commercial.propertyDetails,businessName:''}}), /business/);
});

test('Tamil shop template uses business terms, omits unset painting and excludes residential occupancy clauses', () => {
  const html = renderToStaticMarkup(React.createElement(TamilRentalAgreement, {data:{propertyDetails:{fullAddress:'32 Main Road, Chennai',city:'Chennai',pincode:'600061',propertyType:'Commercial Shop',businessName:'Example Stores'},agreementTerms:{...terms,paintingDeduction:undefined}},stampPaperSpace:true,customerPreview:true,watermark:'SAMPLE DRAFT',stampMargin:(page:number)=>`STAMP-${page}`}));
  for (const text of ['கடை வாடகை ஒப்பந்தப் பத்திரம்','Example Stores','32 Main Road, Chennai - 600061','வட்டி ஏதும் கிடையாது','மின் உபயோகக் கட்டண டெபாசிட்','ரூ.15,250.75/-','45 நாள்','வரை 6 மாதம்','STAMP-1','STAMP-2']) assert.ok(html.replace(/<[^>]+>/g, '').includes(text),text);
  for (const text of ['பெயிண்ட்','குடியிருப்புக்கு மட்டுமே','வீட்டின் உரிமையாளர்']) assert.ok(!html.replace(/<[^>]+>/g, '').includes(text),text);
  assert.equal((html.match(/SAMPLE DRAFT/g)||[]).length,3);
});

test('Property addresses avoid duplicate city/PIN while preserving street names and Tamil spelling', () => {
  assert.equal(formatPropertyAddress('12 Main Road, Chennai', 'Chennai', '600061'), '12 Main Road, Chennai - 600061');
  assert.equal(formatPropertyAddress('12 Main Road Chennai - 600061', 'chennai', '600061'), '12 Main Road Chennai - 600061');
  assert.equal(formatPropertyAddress('12 Main Road, சென்னை', 'Chennai', '600061'), '12 Main Road, சென்னை - 600061');
  assert.equal(formatPropertyAddress('12 Main Road, Chennai', 'சென்னை', '600061'), '12 Main Road, Chennai - 600061');
  assert.equal(formatPropertyAddress('12 Chennai Nagar', 'Chennai', '600061'), '12 Chennai Nagar, Chennai - 600061');
  assert.equal(formatPropertyAddress('12 Main Road', 'Madurai', '625001'), '12 Main Road, Madurai - 625001');
});

test('Typed dates accept DD/MM/YYYY and ISO, reject partial/impossible dates and round-trip without timezone shifts', () => {
  assert.equal(parseTypedCalendarDate('17/10/2026'), '2026-10-17');
  assert.equal(parseTypedCalendarDate('2026-10-17'), '2026-10-17');
  assert.equal(displayCalendarDate('2026-10-17'), '17/10/2026');
  assert.equal(parseTypedCalendarDate('05/06/2026'), '2026-06-05');
  assert.equal(parseTypedCalendarDate('5/6/2026'), '2026-06-05');
  assert.equal(parseTypedCalendarDate('29/02/2024'), '2024-02-29');
  assert.equal(isValidCalendarDate('2000-02-29'), true);
  for (const invalid of ['17/10/202', '31/04/2026', '29/02/2026', '29/02/1900', '10/17/2026', '2026-02-30', '0000-01-01', '']) assert.equal(parseTypedCalendarDate(invalid), '');
  assert.equal(displayCalendarDate('bad'), '');
});

test('Tamil preview uses Tamil relationship labels, corrected clauses and a single property city', () => {
  const html = renderToStaticMarkup(React.createElement(TamilRentalAgreement, {data:{ownerDetails:{fullName:'குமார்',relativeName:'ராமன்'},tenantDetails:{fullName:'ரவி',relativeName:'முருகன்'},propertyDetails:{fullAddress:'12 Main Road, சென்னை',city:'Chennai',pincode:'600061'},agreementTerms:terms},stampPaperSpace:false,customerPreview:false,watermark:null,stampMargin:()=>null}));
  assert.ok(html.replace(/<[^>]+>/g, '').includes('பெற்றோர் / வாழ்க்கைத்துணையின் பெயர்'));
  assert.ok(html.replace(/<[^>]+>/g, '').includes('12 Main Road, சென்னை - 600061'));
  for (const typo of ['S/o', 'F/o', 'H/o', 'W/o', 'D/o', 'உரிமையளரிடம்', 'கட்டனத்தை', 'கொள்கிரார்', 'குடியுருப்புக்கு', 'வாடைதாரர்', 'புதுபித்துக்']) assert.ok(!html.replace(/<[^>]+>/g, '').includes(typo), typo);
});
