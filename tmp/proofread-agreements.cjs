const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const cache = new Map();
function load(name) {
  if (!name.startsWith('@/')) return require(name);
  if (cache.has(name)) return cache.get(name);
  if (name.endsWith('.json')) return JSON.parse(fs.readFileSync(name.replace('@/', ''), 'utf8'));
  const ext = name.includes('/components/') ? 'tsx' : 'ts';
  const mod = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(`${name.replace('@/', '')}.${ext}`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
  }).outputText, { module: mod, exports: mod.exports, require: load, Date, console });
  cache.set(name, mod.exports);
  return mod.exports;
}
(async () => {
  const result = await require('postcss')([require('@tailwindcss/postcss')()]).process(fs.readFileSync('app/globals.css', 'utf8'), { from: path.resolve('app/globals.css') });
  const css = result.css.replace(/@import url\([^;]+;/g, '').replace("url('/fonts/NotoSansTamil.ttf')", `url('file:///${path.resolve('public/fonts/NotoSansTamil.ttf').replaceAll('\\', '/')}')`);
  fs.mkdirSync('tmp/pdfs', { recursive: true });
  const person = { fullName: 'Example Person', relativeName: 'Example Relative', relationship: 'Daughter of', age: 35, address: '12 Example Street, Chennai', pincode: '600001', phone: '9876543210' };
  for (const kind of ['rental', 'lease', 'tamil-house', 'tamil-shop']) for (const stamp of [100, 200]) {
    const data = { ownerDetails: person, tenantDetails: { ...person, fullName: 'Example Tenant', relationship: 'Wife of' }, propertyDetails: { fullAddress: '24 Example Main Road, Chennai', city: 'Chennai', pincode: '600001', propertyType: kind === 'tamil-shop' ? 'Commercial Shop' : 'House', furnishing: 'Unfurnished', businessName: 'Example Stores' }, agreementTerms: { agreementType: kind === 'lease' ? 'Lease' : 'Rental', language: kind.startsWith('tamil') ? 'Tamil' : 'English', monthlyRent: kind === 'lease' ? 0 : 17500, securityDeposit: kind === 'lease' ? 500000 : 75000, maintenanceCharges: 1500, rentIncreasePct: kind === 'lease' ? 0 : 10, paymentDueDay: 9, tenureMonths: 11, noticePeriodDays: 45, startDate: '2026-10-18', paintingDeduction: 2750, stampPaperDenomination: stamp } };
    const html = renderToStaticMarkup(React.createElement(load('@/components/agreement/RentalAgreementDocument').RentalAgreementDocument, { data, blankStampSpace: true }));
    fs.writeFileSync(`tmp/pdfs/${kind}-${stamp}.html`, `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${html}</body></html>`);
  }
})();
