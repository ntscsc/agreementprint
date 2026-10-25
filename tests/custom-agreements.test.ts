import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { validateCustomInput, validateSample, canTransition, MAX_SAMPLE_SIZE } from '../lib/custom-agreement.ts';
const require = createRequire(import.meta.url), ts = require('typescript');
const details = { agreementType: 'Service agreement', purpose: 'An agreement for consulting services', language: 'English', instructions: 'Replace the service scope and update both parties.', preferredDate: '', name: 'Example Customer', phone: '9876543210', email: '', contactConsent: true };
const id = 'CUSTOM_00000000-0000-4000-8000-000000000001';
type Data = Record<string, any>;
function harness(seed: Data = {}, extras: Data = {}) {
  let documents = structuredClone(seed), queue = Promise.resolve(), autoId = 0;
  const snapshot = (path: string, source = documents) => ({ exists: path in source, id: path.split('/').at(-1), data: () => structuredClone(source[path]) });
  const db = {
    collection: (name: string) => {
      let key = '', value: unknown, count = Infinity;
      const query = {
        doc: (id: string = `auto-${++autoId}`) => ({ path: `${name}/${id}`, get: async () => snapshot(`${name}/${id}`), update: async (data: Data) => { documents[`${name}/${id}`] = { ...documents[`${name}/${id}`], ...structuredClone(data) }; } }),
        where: (k: string, _op: string, v: unknown) => { key = k; value = v; return query; },
        orderBy: () => query, limit: (n: number) => { count = n; return query; },
        get: async () => ({ docs: Object.keys(documents).filter((p) => p.startsWith(`${name}/`) && (!key || documents[p][key] === value)).slice(0, count).map((p) => snapshot(p)) }),
      }; return query;
    },
    runTransaction: (callback: (tx: Data) => Promise<unknown>) => {
      const result = queue.then(async () => {
        const draft = structuredClone(documents); let writing = false;
        const tx = {
          get: async (ref: Data) => { assert.equal(writing, false, 'No reads after writes'); return snapshot(ref.path, draft); },
          set: (ref: Data, data: Data) => { writing = true; draft[ref.path] = structuredClone(data); },
          create: (ref: Data, data: Data) => { writing = true; assert.ok(!(ref.path in draft)); draft[ref.path] = structuredClone(data); },
          update: (ref: Data, data: Data) => { writing = true; for (const [key, value] of Object.entries(structuredClone(data))) { const keys = key.split('.'); let target = draft[ref.path]; for (const part of keys.slice(0, -1)) target = target[part] ??= {}; target[keys.at(-1)!] = value; } },
        };
        const result = await callback(tx); documents = draft; return result;
      }); queue = result.then(() => undefined, () => undefined); return result;
    },
  };
  let scans = 0, downloads = 0;
  const bytes = Buffer.from('%PDF-example');
  const uploads = new Map<string, Buffer>();
  const cache: Data = {};
  function load(name: string): any {
    if (name in extras) return extras[name];
    if (name === 'next/server') return { NextResponse: class extends Response { static json(data: unknown, options?: ResponseInit) { return new Response(JSON.stringify(data), options); } } };
    if (name === '@/lib/firebase-admin') return { getAdminDb: () => db, verifyFirebaseIdToken: async (token: string) => { if (token === 'bad') throw Object.assign(new Error('Invalid'), { code: 'auth/invalid-id-token' }); return { uid: token, email: token === 'admin' ? 'pradeep1992official@gmail.com' : 'user@example.com', email_verified: true }; } };
    if (name === '@/lib/file-storage') return {
      uploadPrivateFile: async (path: string, data: Buffer, contentType: string) => {
        if (contentType !== 'application/pdf') throw new Error('Unexpected MIME');
        const existing = uploads.get(path);
        if (existing && !existing.equals(data)) throw new (load('@/lib/api-input').ApiInputError)('Different contents', 409);
        uploads.set(path, data);
      },
      readPrivateFile: async (path: string) => { downloads++; return { bytes: uploads.get(path) ?? bytes, contentType: 'application/pdf' }; },
      createPrivateDownloadUrl: async () => 'https://storage.example/private-sample',
    };
    if (name === '@/lib/sample-validation') return { validateSampleBytes: () => { scans++; } };
    if (name === 'razorpay') return { default: class { orders = { create: async (body: unknown) => (await extras.fetch('https://api.razorpay.com/v1/orders', { method: 'POST', body: JSON.stringify(body) })).json() }; } };
    if (!name.startsWith('@/')) return require(name);
    if (name.endsWith('.json')) return { default: JSON.parse(readFileSync(new URL(`../${name.slice(2)}`, import.meta.url), 'utf8')) };
    if (cache[name]) return cache[name];
    const source = readFileSync(new URL(`../${name.slice(2)}.ts`, import.meta.url), 'utf8');
    const target = { exports: {} };
    runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText, { module: target, exports: target.exports, require: load, Date, Buffer, console, URL, AbortSignal, Response, TextDecoder, fetch: extras.fetch, setTimeout, clearTimeout, process: extras.process ?? { env: {} } });
    return cache[name] = target.exports;
  }
  return { load, read: (path: string) => documents[path], scans: () => scans, downloads: () => downloads };
}
function request(method = 'POST', body?: unknown, token = 'customer', url = 'https://example.test/api/custom-agreements') {
  return Object.assign(new Request(url, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }), { nextUrl: new URL(url) });
}
const draft = { ...details, requestId: id, ownerUid: 'customer', status: 'Uploading', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), files: { 'sample-1': { id: 'sample-1', name: 'sample.pdf', size: 12, contentType: 'application/pdf', path: `custom-agreements/customer/${id}/sample-1` } } };

test('customer profiles require name and mobile, isolate accounts and preserve creation history', async () => {
  const h = harness(), route = h.load('@/app/api/customer-profile/route');
  assert.equal((await route.GET(request('GET', undefined, 'bad'))).status, 401);
  assert.equal((await route.GET(new Request('https://example.test/api/customer-profile'))).status, 401);
  assert.equal((await route.GET(request('GET'))).status, 200);
  for (const fields of [{ name: '', phone: '9876543210' }, { name: 'Customer' }, { name: 'Customer', phone: '1234567890' }, { name: 'Customer', phone: '' }]) {
    assert.equal((await route.POST(request('POST', fields))).status, 400);
  }
  assert.equal((await route.POST(request('POST', { name: '  Example Customer  ', phone: '9876543210', ownerUid: 'other', email: 'spoof@example.test' }))).status, 200);
  const saved = h.read('customerProfiles/customer');
  assert.equal(saved.name, 'Example Customer');
  assert.equal(saved.ownerUid, 'customer');
  assert.equal(saved.email, 'user@example.com');
  assert.equal(h.read('customerProfiles/other'), undefined);
  assert.equal((await (await route.GET(request('GET', undefined, 'other'))).json()).profile, null);
  assert.equal((await (await route.GET(request('GET'))).json()).profile.phone, '9876543210');
  assert.equal((await route.POST(request('POST', { name: 'Updated Customer', phone: '8765432109' }))).status, 200);
  assert.equal(h.read('customerProfiles/customer').createdAt, saved.createdAt);
});
test('feedback requests contact details for incomplete profiles and publishes after they are saved', async () => {
  for (const profile of [undefined, { name: '', phone: '9876543210' }, { name: 'Customer' }, { name: 'Customer', phone: '123' }]) {
    const h = harness(profile ? { 'customerProfiles/customer': profile } : {});
    const route = h.load('@/app/api/customer-reviews/route');
    const response = await route.POST(request('POST', { rating: 5, comment: 'Helpful service and clear communication.' }));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, 'CUSTOMER_PROFILE_REQUIRED');
    assert.equal(h.read('publishedCustomerReviews/customer'), undefined);
    assert.equal(h.read('customerReviews/customer'), undefined);
  }
  const h = harness({ 'customerProfiles/customer': { name: ' Example Customer ', phone: '9876543210' } });
  const route = h.load('@/app/api/customer-reviews/route');
  const response = await route.POST(request('POST', { rating: 4, comment: 'Helpful service and clear communication.' }));
  assert.equal(response.status, 200);
  assert.equal(h.read('publishedCustomerReviews/customer').name, 'Example Customer');
  assert.equal(h.read('publishedCustomerReviews/customer').rating, 4);
  assert.equal(h.read('customerReviews/customer').status, 'Published');
});

test('server sample uploads enforce ownership, exact reservation and immutable retry contents', async () => {
  const h = harness({ [`customAgreementRequests/${id}`]: draft });
  const route = h.load('@/app/api/custom-agreements/upload/route');
  const upload = (token = 'customer', body = '%PDF-example', type = 'application/pdf') => {
    const url = `https://example.test/api/custom-agreements/upload?requestId=${id}&sampleId=sample-1`;
    return Object.assign(new Request(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': type }, body }), { nextUrl: new URL(url) });
  };
  assert.equal((await route.POST(upload('bad'))).status, 401);
  assert.equal((await route.POST(upload('other'))).status, 404);
  assert.equal((await route.POST(upload('customer', '%PDF-example', 'image/png'))).status, 400);
  assert.equal((await route.POST(upload('customer', 'short'))).status, 400);
  assert.equal((await route.POST(upload('customer', '%PDF-example-too-big'))).status, 413);
  assert.equal((await route.POST(upload())).status, 200);
  assert.equal((await route.POST(upload())).status, 200);
  assert.equal((await route.POST(upload('customer', '%PDF-changed'))).status, 409);
  for (const changes of [{ status: 'Submitted' }, { scanLeaseId: 'scanning', scanLeaseUntil: Date.now() + 180000 }]) {
    const locked = harness({ [`customAgreementRequests/${id}`]: { ...draft, ...changes } });
    assert.equal((await locked.load('@/app/api/custom-agreements/upload/route').POST(upload())).status, 409);
  }
  const expired = harness({ [`customAgreementRequests/${id}`]: { ...draft, scanLeaseId: 'previous-scan', scanLeaseUntil: 0 } });
  assert.equal((await expired.load('@/app/api/custom-agreements/upload/route').POST(upload())).status, 200);
});
test('custom request validation enforces contact consent, contact bounds, dates and sample limits', () => {
  assert.equal(validateCustomInput(details).contactConsent, true);
  assert.equal(validateCustomInput(details).includeNotary, false);
  assert.equal(validateCustomInput({ ...details, includeNotary: true }).includeNotary, true);
  for (const changes of [{ contactConsent: false }, { includeNotary: 'yes' }, { phone: '1234567890' }, { phone: '' }, { phone: undefined }, { preferredDate: '2026-02-30' }, { instructions: 'short' }, { purpose: 'x'.repeat(1001) }]) assert.throws(() => validateCustomInput({ ...details, ...changes }));
  assert.equal(validateSample({ name: 'photo.JPG', size: MAX_SAMPLE_SIZE, contentType: 'image/jpeg' }).size, MAX_SAMPLE_SIZE);
  for (const sample of [{ name: 'sample.exe', size: 1, contentType: 'application/pdf' }, { name: '../sample.pdf', size: 1, contentType: 'application/pdf' }, { name: 'sample.pdf', size: MAX_SAMPLE_SIZE + 1, contentType: 'application/pdf' }, { name: 'sample.pdf', size: 2, contentType: 'image/png' }]) assert.throws(() => validateSample(sample));
  assert.equal(canTransition('Submitted', 'Completed'), false);
  assert.equal(canTransition('Quote Sent', 'Accepted'), true);
  assert.equal(canTransition('Completed', 'Under Review'), false);
});

test('Custom quotes add extra stamped copies once, retain the base amount, and charge the full total', async () => {
  for (const invalid of [-1, 0.5, 101, '2', null]) assert.throws(() => validateCustomInput({ ...details, extraCopies: invalid }));
  assert.equal(validateCustomInput({ ...details, extraCopies: 3, stampPaperDenomination: 200 }).extraCopies, 3);
  const h = harness({ [`customAgreementRequests/${id}`]: { ...draft, status: 'Under Review', extraCopies: 2, stampPaperDenomination: 200 } });
  const route = h.load('@/app/api/custom-agreements/route');
  const body = { requestId: id, status: 'Quoted / Awaiting Payment', quoteAmount: 600 };
  for (let retry = 0; retry < 2; retry++) {
    assert.equal((await route.PATCH(request('PATCH', body, 'admin'))).status, 200);
    const saved = h.read(`customAgreementRequests/${id}`);
    assert.equal(saved.quoteBaseAmount, 600);
    assert.equal(saved.extraCopyFee, 300);
    assert.equal(saved.quoteAmount, 900);
    assert.equal(h.load('@/lib/custom-payment').payableCustomQuote(saved), 900);
  }
});
test('request creation is idempotent, server-controlled, and rate-limited across concurrent submissions', async () => {
  const h = harness(), route = h.load('@/app/api/custom-agreements/route');
  const body = { action: 'create', requestId: id, details: { ...details, includeNotary: true }, files: [{ name: 'sample.pdf', size: 12, contentType: 'application/pdf' }], status: 'Completed', quoteAmount: 1 };
  assert.equal((await route.POST(request('POST', body))).status, 200);
  assert.equal(h.read(`customAgreementRequests/${id}`).status, 'Uploading');
  assert.equal(h.read(`customAgreementRequests/${id}`).includeNotary, true);
  assert.equal(h.read(`customAgreementRequests/${id}`).quoteAmount, undefined);
  assert.equal((await route.POST(request('POST', body))).status, 200);
  assert.equal((await route.POST(request('POST', body, 'other'))).status, 409);
  const results = await Promise.all(Array.from({ length: 6 }, (_, i) => route.POST(request('POST', { ...body, requestId: `CUSTOM_00000000-0000-4000-8000-${String(i + 2).padStart(12, '0')}` }))));
  assert.equal(results.filter((r) => r.status === 200).length, 4);
  assert.equal(results.filter((r) => r.status === 429).length, 2);
});
test('finalization validates samples before submission and blocks foreign ownership; retries are idempotent', async () => {
  const h = harness({ [`customAgreementRequests/${id}`]: draft }), route = h.load('@/app/api/custom-agreements/route');
  assert.equal((await route.POST(request('POST', { action: 'finalize', requestId: id }, 'other'))).status, 404);
  assert.equal(h.scans(), 0);
  assert.equal((await route.POST(request('POST', { action: 'finalize', requestId: id }))).status, 200);
  assert.equal(h.read(`customAgreementRequests/${id}`).status, 'Submitted');
  assert.equal(h.read(`customAgreementRequests/${id}`).verificationStatus, 'Validated');
  assert.equal((await route.POST(request('POST', { action: 'finalize', requestId: id }))).status, 200);
  assert.equal(h.scans(), 1);
});
test('invalid sample keeps uploads unreviewable and clears the verification lease for retries', async () => {
  const h = harness({ [`customAgreementRequests/${id}`]: draft }, { '@/lib/sample-validation': { validateSampleBytes: () => { throw new Error('Invalid sample signature'); } } });
  assert.equal((await h.load('@/app/api/custom-agreements/route').POST(request('POST', { action: 'finalize', requestId: id }))).status, 500);
  assert.equal(h.read(`customAgreementRequests/${id}`).status, 'Uploading');
  assert.equal(h.read(`customAgreementRequests/${id}`).scanLeaseUntil, 0);
  assert.equal((await h.load('@/app/api/custom-agreements/sample/route').GET(request('GET', undefined, 'customer', `https://example.test/api/custom-agreements/sample?requestId=${id}&sampleId=sample-1`))).status, 409);
});
test('customer views hide internal fields, download access is scoped and admin scope is protected', async () => {
  const h = harness({ [`customAgreementRequests/${id}`]: { ...draft, status: 'Submitted', verificationStatus: 'Validated', internalNotes: 'Secret', assignedTo: 'Staff' } });
  const route = h.load('@/app/api/custom-agreements/route');
  const response = await route.GET(request('GET')); const result = await response.json();
  assert.equal(result.requests[0].internalNotes, undefined); assert.equal(result.requests[0].assignedTo, undefined);
  assert.equal((await route.GET(request('GET', undefined, 'customer', 'https://example.test/api/custom-agreements?scope=admin'))).status, 403);
  assert.equal((await route.GET(request('GET', undefined, 'bad'))).status, 401);
  assert.equal((await route.GET(request('GET', undefined, 'other'))).status, 200);
  const samples = h.load('@/app/api/custom-agreements/sample/route');
  const url = `https://example.test/api/custom-agreements/sample?requestId=${id}&sampleId=sample-1`;
  assert.equal((await samples.GET(request('GET', undefined, 'other', url))).status, 404);
  assert.equal((await samples.GET(request('GET', undefined, 'customer', url))).status, 200);
});
test('review transitions, manual acceptance, quote locks and persisted customer clarifications are enforced', async () => {
  const h = harness({ [`customAgreementRequests/${id}`]: { ...draft, status: 'Under Review', scanStatus: 'Clean' } }), route = h.load('@/app/api/custom-agreements/route');
  const patch = (body: Data, token = 'admin') => route.PATCH(request('PATCH', { requestId: id, ...body }, token));
  assert.equal((await patch({ status: 'Completed' })).status, 409);
  assert.equal((await patch({ status: 'Quote Sent' })).status, 400);
  assert.equal((await patch({ status: 'Quote Sent', quoteAmount: 500 })).status, 200);
  assert.equal((await patch({ status: 'Accepted' })).status, 400);
  assert.equal((await patch({ status: 'Accepted', acceptanceConfirmed: true })).status, 200);
  assert.equal((await patch({ status: 'In Progress', quoteAmount: 900 })).status, 409);
  assert.equal((await patch({ status: 'In Progress' })).status, 409, 'Unpaid accepted requests cannot enter preparation');
  const paid = harness({ [`customAgreementRequests/${id}`]: { ...draft, status: 'Accepted', quoteAmount: 500, payment: { status: 'Paid', amount: 500 } } });
  assert.equal((await paid.load('@/app/api/custom-agreements/route').PATCH(request('PATCH', { requestId: id, status: 'In Progress' }, 'admin'))).status, 200);
  assert.equal((await patch({ status: 'Completed' }, 'customer')).status, 409);
  const h2 = harness({ [`customAgreementRequests/${id}`]: { ...draft, status: 'Clarification Required' } });
  const answer = { requestId: id, action: 'reply', customerReply: 'Please use the updated service description.' };
  assert.equal((await h2.load('@/app/api/custom-agreements/route').PATCH(request('PATCH', answer))).status, 200);
  assert.equal(h2.read(`customAgreementRequests/${id}`).customerReply, answer.customerReply);
  assert.equal(h2.read(`customAgreementRequests/${id}`).status, 'Under Review');
});
test('sample signature checks reject disguised files and malformed DOCX without unsafe extraction', () => {
  const scanner = harness({}, { '@/lib/sample-validation': undefined });
  // Load the real file validator rather than the API test stub.
  const source = readFileSync(new URL('../lib/sample-validation.ts', import.meta.url), 'utf8'), target = { exports: {} as any };
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText, { module: target, exports: target.exports, require: (name: string) => name.startsWith('@/') ? scanner.load(name) : require(name), Buffer, setTimeout, clearTimeout, process: { env: {} } });
  target.exports.validateSampleBytes(Buffer.from('%PDF-example'), 'application/pdf');
  for (const type of ['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']) assert.throws(() => target.exports.validateSampleBytes(Buffer.from('x'), type));
});

test('custom quote checkout charges the saved amount, protects ownership and resumes pending attempts', async () => {
  const path = `customAgreementRequests/${id}`;
  const calls: any[] = [];
  const h = harness({ [path]: { ...draft, status: 'Quote Sent', quoteAmount: 600 } }, {
    '@/lib/phonepe': { getPhonePeCredentials: () => ({ production: false }), getPhonePeAccessToken: async () => 'token', getPhonePeApiBase: () => 'https://phonepe.example', fetchPhonePeOrderStatus: async () => ({ state: 'PENDING' }) },
    fetch: async (_url: string, options: any) => { calls.push(JSON.parse(options.body)); return new Response(JSON.stringify({ redirectUrl: 'https://phonepe.example/checkout' }), { status: 200 }); },
  });
  const route = h.load('@/app/api/custom-agreements/payment/route');
  const pay = (quoteAmount = 600, token = 'customer') => route.POST(request('POST', { requestId: id, action: 'pay', quoteAmount }, token));
  assert.equal((await pay(600, 'other')).status, 404);
  assert.equal((await pay(1)).status, 409);
  const results = await Promise.all([pay(), pay()]);
  assert.equal(results.filter(r => r.status === 200).length, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].amount, 60000);
  assert.match(calls[0].paymentFlow.merchantUrls.redirectUrl, /my-requests\?paymentRequest=/);
  assert.equal(h.read(path).status, 'Quoted / Awaiting Payment');
  assert.equal((await pay()).status, 200);
  assert.equal(calls.length, 1);
  assert.equal((await h.load('@/app/api/custom-agreements/route').PATCH(request('PATCH', { requestId: id, action: 'cancel' }))).status, 409);
  const settle = h.load('@/lib/custom-payment').settleCustomPayment;
  const merchantOrderId = h.read(path).payment.merchantOrderId;
  await assert.rejects(settle(merchantOrderId, 100, 'COMPLETED'), /amount/);
  assert.equal(h.read(path).payment.status, 'Pending');
  await settle(merchantOrderId, 60000, 'COMPLETED', 'verified-transaction');
  assert.equal(h.read(path).payment.status, 'Paid');
  assert.equal(h.read(path).status, 'Accepted');
  await settle(merchantOrderId, 60000, 'FAILED');
  assert.equal(h.read(path).payment.status, 'Paid');
  assert.equal((await pay()).status, 200);
  assert.equal(calls.length, 1);
});

test('custom quote payments reject unquoted stages and keep failed attempts retryable', async () => {
  const path = `customAgreementRequests/${id}`, merchantOrderId = 'CUSTOMPAY0123456789abcdef0123456789abcdef';
  const h = harness({ [path]: { ...draft, status: 'Quoted / Awaiting Payment', quoteAmount: 600, payment: { status: 'Pending', merchantOrderId } }, [`customPhonepeAttempts/${merchantOrderId}`]: { requestId: id, ownerUid: 'customer', amount: 600 } });
  const helper = h.load('@/lib/custom-payment');
  for (const status of ['Cancelled', 'Accepted', 'Completed']) assert.throws(() => helper.payableCustomQuote({ status, quoteAmount: 600 }));
  assert.throws(() => helper.payableCustomQuote({ status: 'Submitted' }));
  await helper.settleCustomPayment(merchantOrderId, 60000, 'FAILED');
  assert.equal(h.read(path).payment.status, 'Failed');
  assert.equal(h.read(path).status, 'Quoted / Awaiting Payment');
  assert.equal(helper.payableCustomQuote(h.read(path)), 600);
});

test('saving a quote promotes submitted and reviewed requests and records the quoted status in the audit', async () => {
  for (const status of ['Submitted', 'Under Review']) {
    const path = `customAgreementRequests/${id}`;
    const h = harness({ [path]: { ...draft, status } });
    const route = h.load('@/app/api/custom-agreements/route');
    assert.equal((await route.PATCH(request('PATCH', { requestId: id, status, quoteAmount: 600 }, 'admin'))).status, 200);
    assert.equal(h.read(path).status, 'Quoted / Awaiting Payment');
    assert.equal(h.read(path).quoteAmount, 600);
    const listed = await (await route.GET(request('GET'))).json();
    assert.equal(listed.requests[0].status, 'Quoted / Awaiting Payment');
    assert.equal(h.load('@/lib/custom-payment').payableCustomQuote(h.read(path)), 600);
    const audit = await (await h.load('@/lib/firebase-admin').getAdminDb().collection('customAgreementAudit').get()).docs[0].data();
    assert.equal(audit.toStatus, 'Quoted / Awaiting Payment');
  }
});

test('existing submitted quotes are displayed as awaiting payment and accepted by checkout', async () => {
  const path = `customAgreementRequests/${id}`;
  const h = harness({ [path]: { ...draft, status: 'Submitted', quoteAmount: 600 } }, {
    '@/lib/phonepe': { getPhonePeCredentials: () => ({}), getPhonePeAccessToken: async () => 'token', getPhonePeApiBase: () => 'https://phonepe.example' },
    fetch: async () => new Response(JSON.stringify({ redirectUrl: 'https://phonepe.example/checkout' })),
  });
  const listed = await (await h.load('@/app/api/custom-agreements/route').GET(request('GET'))).json();
  assert.equal(listed.requests[0].status, 'Quoted / Awaiting Payment');
  assert.equal(listed.requests[0].quoteAmount, 600);
  const result = await h.load('@/app/api/custom-agreements/payment/route').POST(request('POST', { requestId: id, action: 'pay', quoteAmount: 600 }));
  assert.equal(result.status, 200);
  assert.equal(h.read(path).status, 'Quoted / Awaiting Payment');
});

test('custom agreement payments use Razorpay and resume the same checkout after switching gateways', async () => {
  const path = `customAgreementRequests/${id}`;
  let created = 0, providerOrder: Data;
  const h = harness({ [path]: { ...draft, status: 'Quoted / Awaiting Payment', quoteAmount: 600 }, 'settings/paymentGateway': { activeGateway: 'Razorpay' } }, {
    process: { env: { RAZORPAY_KEY_ID: 'rzp_test_Example123', RAZORPAY_KEY_SECRET: 'test-secret', RAZORPAY_WEBHOOK_SECRET: 'webhook-secret' } },
    fetch: async (url: string, init: Data) => {
      if (init.method === 'POST') { created++; providerOrder = { ...JSON.parse(init.body), id: 'order_custom123' }; return new Response(JSON.stringify(providerOrder)); }
      return new Response(JSON.stringify({ ...providerOrder, status: 'created' }));
    },
  });
  const route = h.load('@/app/api/custom-agreements/payment/route');
  const body = { requestId: id, action: 'pay', quoteAmount: 600 };
  const response = await route.POST(request('POST', body));
  assert.equal(response.status, 200);
  assert.match((await response.json()).redirectUrl, /payment\/razorpay\/checkout/);
  assert.equal(h.read(path).payment.gateway, 'Razorpay');
  await h.load('@/lib/firebase-admin').getAdminDb().collection('settings').doc('paymentGateway').update({ activeGateway: 'PhonePe' });
  const resumed = await route.POST(request('POST', body));
  assert.equal(resumed.status, 200);
  assert.match((await resumed.json()).redirectUrl, /payment\/razorpay\/checkout/);
  assert.equal(created, 1);
});

test('unquoted and invalid legacy requests stay Submitted and customer quote edits are rejected', async () => {
  for (const quoteAmount of [undefined, 0, -1, 600.5, 1_000_001]) {
    const path = `customAgreementRequests/${id}`, h = harness({ [path]: { ...draft, status: 'Submitted', quoteAmount } });
    const route = h.load('@/app/api/custom-agreements/route');
    const listed = await (await route.GET(request('GET'))).json();
    assert.equal(listed.requests[0].status, 'Submitted');
    assert.throws(() => h.load('@/lib/custom-payment').payableCustomQuote(h.read(path)));
    assert.equal((await route.PATCH(request('PATCH', { requestId: id, status: 'Submitted', quoteAmount: 600 }))).status, 409);
    assert.equal(h.read(path).status, 'Submitted');
  }
});


test('price-neutral customer edits retain the order and payment and safely handle retries', async () => {
  const orderId = 'ORDER_SAME_PRICE', requestKey = 'a'.repeat(32);
  const original = { orderId, ownerUid: 'customer', status: 'Under verification', updatedAt: 'before', createdAt: 'original-date',
    ownerDetails: { phone: '9876543210', pincode: '600001' }, tenantDetails: {}, propertyDetails: {},
    agreementTerms: { startDate: '2026-10-01' }, payment: { status: 'Paid', amount: 350 } };
  const quote = { subtotal: 350, discount: 0, total: 350, alreadyPaid: 350, due: 0, surplus: 0, excessCash: 0, excessCredits: 0 };
  const h = harness({ [`orders/${orderId}`]: original }, {
    '@/lib/agreement-validation': { validateAgreement: () => {} },
    '@/src/config/pricing': { resolvePricingConfig: () => ({}) },
    '@/lib/payment-gateway': {},
    '@/lib/order-replacement': {
      preparationHasStarted: async (_tx: unknown, _id: string, order: Data) => ['Drafting', 'Dispatched', 'Delivered'].includes(order.status),
      replacementQuote: () => quote,
    },
  });
  const route = h.load('@/app/api/orders/replace/route');
  const body = { action: 'submit', requestKey, orderId, updatedAt: 'before', reviewedTotal: 350,
    ownerDetails: { ...original.ownerDetails, pincode: '600002' }, tenantDetails: {}, propertyDetails: {},
    agreementTerms: { startDate: '2026-11-01' } };
  const preview = await route.POST(request('POST', { ...body, action: 'preview' }));
  assert.equal(preview.status, 200);
  assert.equal(h.read(`orders/${orderId}`).updatedAt, 'before');
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await route.POST(request('POST', body));
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.edited, true);
    assert.equal(result.order.orderId, orderId);
    assert.equal(result.order.status, 'Under verification');
    assert.equal(result.order.ownerDetails.pincode, '600002');
    assert.equal(result.order.agreementTerms.startDate, '2026-11-01');
    assert.deepEqual(result.order.payment, original.payment);
    assert.equal(result.order.createdAt, original.createdAt);
  }
  assert.equal(h.read(`orderReplacements/REPLPAY${requestKey}`), undefined);
  assert.equal(h.read(`orders/${orderId}`).replacementPendingId, undefined);
  assert.equal(h.read(`orderEditHistory/REPLPAY${requestKey}`).sameOrderEdit, true);
  const changed = await route.POST(request('POST', { ...body, agreementTerms: { startDate: '2026-12-01' } }));
  assert.equal(changed.status, 409);
});


test('customer referral dashboard returns more than 100 referrals, rewards and ledger entries', async () => {
  const seed: Data = {};
  for (let i = 0; i < 125; i++) {
    seed[`orders/order-${i}`] = { ownerUid: `friend-${i}`, referralCode: 'CUSTOMER123', payment: { status: 'Paid' }, createdAt: String(i).padStart(3, '0') };
    seed[`referralRewards/friend-${i}`] = { referrerUid: 'customer', amount: 50 };
    seed[`referralLedger/reward-${i}`] = { ownerUid: 'customer', type: 'reward', amount: 50, createdAt: String(i).padStart(3, '0') };
  }
  const h = harness(seed, {
    '@/lib/referral-admin': { getOrCreateReferralAccount: async () => ({ code: 'CUSTOMER123', balance: 6250 }), getReferralRewardAmount: () => 50 },
  });
  const result = await h.load('@/app/api/referrals/me/route').GET(request('GET'));
  assert.equal(result.status, 200);
  const data = await result.json();
  assert.equal(data.referrals.length, 125);
  assert.equal(data.referrals.filter((r: Data) => r.status === 'Rewarded').length, 125);
  assert.equal(data.ledger.length, 125);
  assert.equal(data.balance, 6250);
});


test('admin can abandon unstarted, expired and pending replacements without changing original payment', async () => {
  for (const state of ['UNSTARTED', 'EXPIRED', 'PENDING']) {
    const requestId = 'REPLPAY' + 'b'.repeat(32);
    const seed = {
      'orders/ORDER1': { ownerUid: 'customer', payment: { status: 'Paid' }, status: 'Under verification', replacementPendingId: requestId },
      [`orderReplacements/${requestId}`]: { originalOrderId: 'ORDER1', ownerUid: 'customer', state: 'Awaiting payment', ...(state === 'UNSTARTED' ? {} : { checkoutStartedAt: 123 }) },
    };
    const h = harness(seed, {
      '@/lib/payment-gateway': { getCheckoutCredentials: async () => ({}), getGatewayAccessToken: async () => '', fetchGatewayOrderStatus: async () => ({ state }) },
    });
    const route = h.load('@/app/api/admin/order-replacements/route');
    assert.equal((await route.POST(request('POST', { orderId: 'ORDER1' }, 'customer'))).status, 403);
    const response = await route.POST(request('POST', { orderId: 'ORDER1' }, 'admin'));
    assert.equal(response.status, 200);
    assert.equal(h.read('orders/ORDER1').replacementPendingId, null);
    assert.equal(h.read('orders/ORDER1').payment.status, 'Paid');
    assert.equal(h.read(`orderReplacements/${requestId}`).state, 'Abandoned');
  }
});


test('abandoned replacement releases the paid order and late payment goes to refund review exactly once', async () => {
  const requestId = 'REPLPAY' + 'c'.repeat(32);
  const original = { ownerUid: 'customer', payment: { status: 'Paid', amount: 350 }, status: 'Under verification', replacementPendingId: requestId };
  const h = harness({
    'orders/ORDER1': original,
    [`orderReplacements/${requestId}`]: { requestId, ownerUid: 'customer', originalOrderId: 'ORDER1', replacementOrderId: 'NEW1', state: 'Awaiting payment', quote: { due: 100 }, createdAt: '2026-01-01' },
  });
  const lib = h.load('@/lib/order-replacement');
  await assert.rejects(() => lib.abandonReplacement('ORDER1', 'other'), /not found/);
  await lib.abandonReplacement('ORDER1', 'customer');
  assert.equal(h.read('orders/ORDER1').replacementPendingId, null);
  assert.deepEqual(h.read('orders/ORDER1').payment, original.payment);
  await assert.rejects(() => lib.settleReplacement(requestId, 'COMPLETED', 9999, 'pay_late'), /verified amount/);
  for (let i = 0; i < 2; i++) {
    const result = await lib.settleReplacement(requestId, 'COMPLETED', 10000, 'pay_late');
    assert.equal(result.refundPending, true);
  }
  assert.equal(h.read(`orderReplacements/${requestId}`).refundStatus, 'Requested');
  assert.equal(h.read(`orderReplacements/${requestId}`).refundAmount, 100);
  assert.equal(h.read(`orderReplacements/${requestId}`).latePaymentTransactionId, 'pay_late');
  assert.equal(h.read('orders/NEW1'), undefined);
  assert.equal(h.read('orders/ORDER1').status, 'Under verification');
  const refund = await h.load('@/app/api/admin/replacements/route').PATCH(request('PATCH', { requestId, action: 'refund-recorded', notes: 'Refund transfer REF123 confirmed' }, 'admin'));
  assert.equal(refund.status, 200);
  assert.equal(h.read(`orderReplacements/${requestId}`).refundStatus, 'Refunded');
  assert.equal(h.read('orders/NEW1'), undefined);
});


test('short order references have six digits, remain stable and cannot be assigned by another customer', async () => {
  const h = harness({ 'orders/LONG_ORIGINAL_1': { ownerUid: 'customer' }, 'orders/REPLACE_LONG_2': { ownerUid: 'customer' } });
  const route = h.load('@/app/api/orders/reference/route');
  assert.equal((await route.POST(request('POST', { orderId: 'LONG_ORIGINAL_1' }, 'other'))).status, 404);
  const first = await (await route.POST(request('POST', { orderId: 'LONG_ORIGINAL_1' }))).json();
  const repeated = await (await route.POST(request('POST', { orderId: 'LONG_ORIGINAL_1' }))).json();
  const second = await (await route.POST(request('POST', { orderId: 'REPLACE_LONG_2' }))).json();
  assert.match(first.reference, /^AP-\d{6}$/);
  assert.equal(first.reference, repeated.reference);
  assert.notEqual(first.reference, second.reference);
  assert.equal(h.read(`publicOrderReferences/${first.reference}`).orderId, 'LONG_ORIGINAL_1');
  assert.equal(h.read('orders/LONG_ORIGINAL_1').publicReference, first.reference);
});


test('walk-in counter creates unpaid orders idempotently, records counter payment and supports print and collection', async () => {
  const h = harness({}, { '@/lib/order-bill-pdf': { renderOrderBill: async () => Buffer.from('%PDF-counter-test') }, '@/src/config/vendor': { VENDOR_CONFIG: { email: 'support@example.com' } } });
  const route = h.load('@/app/api/admin/counter-orders/route');
  const orderId = 'COUNTER_' + 'd'.repeat(32);
  const person = { fullName: 'Walk In Customer', relativeName: '', age: 35, address: '12 Example Street, Chennai', pincode: '600001', phone: '9876543210' };
  const body: Data = { action: 'save', orderId, saveKey: 'a'.repeat(32), ownerDetails: person, tenantDetails: { ...person, fullName: 'Example Tenant' },
    propertyDetails: { fullAddress: '12 Example Street, Chennai', city: 'Chennai', pincode: '600001', propertyType: 'House', furnishing: 'Unfurnished' },
    agreementTerms: { agreementType: 'Rental', language: 'English', monthlyRent: 15000, securityDeposit: 10000, maintenanceCharges: 500, paintingDeduction: 0, startDate: '2026-10-26', tenureMonths: 11, noticePeriodDays: 30, rentIncreasePct: 0, paymentDueDay: 5, stampPaperDenomination: 100, includeNotary: false, extraCopies: 0, deliveryRecipient: 'Owner', deliveryLocation: 'Within Chennai' },
    counterAmount: 350, counterPaymentMethod: 'Unpaid', counterPaymentReference: '' };
  const call = (data: Data, token = 'admin') => route.POST(request('POST', data, token));
  assert.equal((await route.GET(request('GET', undefined, 'customer'))).status, 403);
  assert.equal((await call(body, 'customer')).status, 403);
  assert.equal((await call({ ...body, counterAmount: 0 })).status, 400);
  assert.equal((await call({ ...body, ownerDetails: { ...person, phone: '123' } })).status, 400);
  for (let retry = 0; retry < 2; retry++) assert.equal((await call(body)).status, 200);
  let order = h.read(`counterOrders/${orderId}`);
  assert.match(order.publicReference, /^AP-\d{6}$/);
  assert.equal(order.source, 'Counter');
  assert.equal(order.payment.status, 'Pending');
  assert.equal(h.read(`orders/${orderId}`), undefined);
  assert.equal(h.read('systemCounters/publicOrderReference').last, 100000);
  assert.equal((await call({ action: 'bill', orderId })).status, 409);
  assert.equal((await call({ action: 'print', orderId, updatedAt: order.updatedAt })).status, 409);
  assert.equal((await call({ action: 'print', orderId, updatedAt: order.updatedAt, allowUnpaid: true })).status, 200);
  order = h.read(`counterOrders/${orderId}`);
  assert.equal(order.status, 'Drafting');
  assert.equal((await call({ action: 'collect', orderId, updatedAt: order.updatedAt })).status, 409);
  const paid = { ...body, updatedAt: order.updatedAt, saveKey: 'b'.repeat(32), counterPaymentMethod: 'UPI', counterPaymentReference: 'UPI123456' };
  assert.equal((await call(paid)).status, 200);
  order = h.read(`counterOrders/${orderId}`);
  assert.equal(order.payment.status, 'Paid');
  assert.equal(order.payment.gateway, 'Counter');
  assert.equal(order.payment.amount, 350);
  assert.equal((await call({ ...paid, updatedAt: order.updatedAt, saveKey: 'c'.repeat(32), counterAmount: 500 })).status, 409);
  const bill = await call({ action: 'bill', orderId });
  assert.equal(bill.status, 200);
  assert.match(bill.headers.get('content-type'), /application\/pdf/);
  assert.equal((await call({ action: 'collect', orderId, updatedAt: 'stale' })).status, 409);
  assert.equal((await call({ ...paid, updatedAt: order.updatedAt, saveKey: 'e'.repeat(32), ownerDetails: { ...person, fullName: 'Corrected Landlord' } })).status, 200);
  order = h.read(`counterOrders/${orderId}`);
  assert.equal(order.preparationStartedAt, undefined);
  assert.equal(order.payment.status, 'Paid');
  assert.equal((await call({ action: 'collect', orderId, updatedAt: order.updatedAt })).status, 409);
  assert.equal((await call({ action: 'print', orderId, updatedAt: order.updatedAt })).status, 200);
  order = h.read(`counterOrders/${orderId}`);
  assert.equal((await call({ action: 'collect', orderId, updatedAt: order.updatedAt })).status, 200);
  order = h.read(`counterOrders/${orderId}`);
  assert.equal(order.status, 'Delivered');
  assert.ok(order.collectedAt);
  assert.equal((await call({ ...paid, updatedAt: order.updatedAt })).status, 409);
  assert.equal((await call({ action: 'print', orderId, updatedAt: order.updatedAt })).status, 200);
  assert.equal(h.read(`counterOrders/${orderId}`).status, 'Delivered');
});


test('phone-only customers can validate an agreement without an email', () => {
  const h = harness();
  const person = { fullName: 'Phone Customer', age: 30, relativeName: '', phone: '9876543210', address: '12 Example Street, Chennai', pincode: '600001' };
  const order = { ownerDetails: person, tenantDetails: person, propertyDetails: { fullAddress: '12 Example Street, Chennai', city: 'Chennai', pincode: '600001', propertyType: 'House', furnishing: 'Unfurnished' }, agreementTerms: { language: 'English', monthlyRent: 15000, securityDeposit: 50000, maintenanceCharges: 0, startDate: '2026-10-26', tenureMonths: 11, noticePeriodDays: 30, rentIncreasePct: 0, stampPaperDenomination: 100, includeNotary: false, deliveryRecipient: 'Owner', deliveryLocation: 'Within Chennai' }, customerEmail: '' };
  const validate = h.load('@/lib/agreement-validation').validateAgreement;
  assert.doesNotThrow(() => validate(order));
  assert.throws(() => validate({ ...order, customerEmail: 'not-an-email' }), /email/);
});
