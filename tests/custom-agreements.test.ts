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
      let count = Infinity;
      const filters: [string, string, unknown][] = [];
      let ordering = '', direction = 'asc', after: any = null;
      const query = {
        doc: (id: string = `auto-${++autoId}`) => ({ path: `${name}/${id}`, get: async () => snapshot(`${name}/${id}`), update: async (data: Data) => { documents[`${name}/${id}`] = { ...documents[`${name}/${id}`], ...structuredClone(data) }; } }),
        where: (k: string, op: string, v: unknown) => { filters.push([k, op, v]); return query; },
        orderBy: (field: string, order: string) => { ordering = field; direction = order; return query; }, startAfter: (doc: any) => { after = doc; return query; }, limit: (n: number) => { count = n; return query; },
        get: async () => {
          const docs = Object.keys(documents).filter(p => p.startsWith(`${name}/`) && filters.every(([key, op, expected]) => {
            const actual = key.split('.').reduce((value: any, field) => value?.[field], documents[p]);
            return op === 'in' ? (expected as unknown[]).includes(actual) : op === '>=' ? actual >= (expected as any) : op === '<' ? actual < (expected as any) : actual === expected;
          })).sort((a, b) => {
            if (!ordering) return 0;
            const av = documents[a][ordering] || '', bv = documents[b][ordering] || '';
            return (String(av).localeCompare(String(bv)) || a.localeCompare(b)) * (direction === 'desc' ? -1 : 1);
          }).filter(p => {
            if (!after) return true;
            const av = documents[p][ordering] || '', bv = after.data()[ordering] || '';
            const comparison = String(av).localeCompare(String(bv)) || p.split('/').at(-1)!.localeCompare(after.id);
            return direction === 'desc' ? comparison < 0 : comparison > 0;
          }).slice(0, count).map(p => snapshot(p));
          return { docs, size: docs.length, empty: !docs.length };
        },
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
      return new Response(JSON.stringify(url.endsWith('/payments') ? { items: [] } : { ...providerOrder, status: 'created', attempts: 0, amount_paid: 0, amount_due: providerOrder.amount }));
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
  const call = (data: Data, token = 'admin') => route.POST(request('POST', { ...(data.action === 'prepare' ? { checks: { details: true, stampAndCopies: true, signingSpace: true } } : {}), ...(data.action === 'collect' ? { confirmed: true } : {}), ...data }, token));
  const workflow = h.load('@/app/api/admin/order-workflow/route');
  const verify = (order: Data) => workflow.POST(request('POST', { orderId, channel: 'Counter', action: 'verify', updatedAt: order.updatedAt, detailsChecked: true }, 'admin'));
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
  assert.equal((await call({ action: 'print', orderId, updatedAt: order.updatedAt })).status, 400);
  assert.equal(h.read(`counterOrders/${orderId}`).preparationStartedAt, undefined);
  assert.equal(h.read(`counterOrders/${orderId}`).updatedAt, order.updatedAt);
  assert.equal((await call({ action: 'prepare', orderId, updatedAt: order.updatedAt })).status, 409);
  assert.equal((await call({ action: 'prepare', orderId, updatedAt: order.updatedAt, allowUnpaid: true })).status, 409);
  assert.equal((await verify(order)).status, 200);
  order = h.read(`counterOrders/${orderId}`);
  assert.equal((await call({ action: 'prepare', orderId, updatedAt: order.updatedAt, allowUnpaid: true })).status, 200);
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
  assert.equal(order.detailsVerifiedAt, undefined);
  assert.equal(order.preparationCompletedAt, undefined);
  assert.equal((await verify(order)).status, 200);
  order = h.read(`counterOrders/${orderId}`);
  assert.equal((await call({ action: 'prepare', orderId, updatedAt: order.updatedAt })).status, 200);
  order = h.read(`counterOrders/${orderId}`);
  assert.equal((await call({ action: 'collect', orderId, updatedAt: order.updatedAt })).status, 200);
  order = h.read(`counterOrders/${orderId}`);
  assert.equal(order.status, 'Delivered');
  assert.ok(order.collectedAt);
  assert.equal((await call({ ...paid, updatedAt: order.updatedAt })).status, 409);
  assert.equal((await call({ action: 'prepare', orderId, updatedAt: order.updatedAt })).status, 200);
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

test('admin workflow API enforces authorisation, stage checks, stale versions and atomic audit records', async () => {
  const initial = { orderId: 'ONLINE_WORKFLOW', ownerUid: 'customer', status: 'Under verification', payment: { status: 'Paid', amount: 350 },
    agreementTerms: { extraCopies: 0 }, createdAt: '2026-10-26T00:00:00.000Z', updatedAt: '2026-10-26T00:00:00.000Z' };
  const h = harness({ 'orders/ONLINE_WORKFLOW': initial });
  const api = h.load('@/app/api/admin/order-workflow/route');
  const call = (action: string, fields: Data = {}, token = 'admin') => api.POST(request('POST', { channel: 'Online', orderId: initial.orderId, updatedAt: h.read('orders/ONLINE_WORKFLOW').updatedAt, action, ...fields }, token));
  assert.equal((await call('verify', { detailsChecked: true }, 'customer')).status, 403);
  assert.equal((await call('complete', { confirmed: true })).status, 409);
  assert.equal(h.read('orders/ONLINE_WORKFLOW').status, 'Under verification');
  assert.equal((await call('verify', { detailsChecked: true })).status, 200);
  assert.equal((await call('prepare', { updatedAt: initial.updatedAt, checks: { details: true, stampAndCopies: true, signingSpace: true } })).status, 409);
  assert.equal((await call('prepare', { checks: { details: true } })).status, 409);
  assert.equal((await call('prepare', { checks: { details: true, stampAndCopies: true, signingSpace: true } })).status, 200);
  assert.equal((await call('dispatch', { courierName: 'Courier' })).status, 409);
  assert.equal((await call('dispatch', { courierName: 'Courier', trackingNumber: 'TRACK123' })).status, 200);
  assert.equal((await call('complete')).status, 409);
  assert.equal((await call('complete', { confirmed: true })).status, 200);
  const saved = h.read('orders/ONLINE_WORKFLOW');
  assert.equal(saved.status, 'Delivered'); assert.ok(saved.detailsVerifiedAt); assert.ok(saved.preparationCompletedAt); assert.ok(saved.completedAt);
  const logs = await h.load('@/lib/firebase-admin').getAdminDb().collection('adminLogs').get();
  assert.equal(logs.docs.length, 4);
  assert.deepEqual(logs.docs.map((doc: Data) => doc.data().action), ['WORKFLOW_VERIFY', 'WORKFLOW_PREPARE', 'WORKFLOW_DISPATCH', 'WORKFLOW_COMPLETE']);
});

test('consolidated work API excludes counter orders while reporting today’s counter receipts separately', async () => {
  const stamp = new Date().toISOString();
  const online = { orderId: 'ONLINE1', status: 'Under verification', payment: { status: 'Paid', amount: 350 }, ownerDetails: { fullName: 'Owner' }, tenantDetails: { fullName: 'Tenant' }, createdAt: stamp, updatedAt: stamp };
  const h = harness({ 'orders/ONLINE1': online, 'orders/DONE': { ...online, orderId: 'DONE', status: 'Delivered' },
    'counterOrders/COUNTER1': { ...online, orderId: 'COUNTER1', source: 'Counter', payment: { status: 'Paid', paidAt: stamp, amount: 250 } },
    'orderReplacements/CHANGE1': { requestId: 'CHANGE1', originalOrderId: 'ONLINE1', state: 'Review required', createdAt: stamp },
    'creditRefundRequests/REFUND1': { requestId: 'REFUND1', orderId: 'DONE', state: 'Awaiting approval', amount: 100, createdAt: stamp },
  });
  const route = h.load('@/app/api/admin/work-queue/route');
  assert.equal((await route.GET(request('GET'))).status, 403);
  const result = await route.GET(request('GET', undefined, 'admin'));
  assert.equal(result.status, 200);
  const data = await result.json();
  assert.equal(data.items.length, 3);
  assert.equal(data.items.some((item: Data) => item.channel === 'Counter'), false);
  assert.equal(data.summary.pendingWorkload, 3); assert.equal(data.summary.todayCounterCollections, 250);
  assert.equal(data.summary.pendingRefunds, 1); assert.equal(data.summary.pendingRefundAmount, 100);
});

test('queue links fetch the exact change, refund and custom request with administrator-only access', async () => {
  const changeId = 'REPLPAY' + 'a'.repeat(32), refundId = 'CREF' + 'b'.repeat(32);
  const h = harness({ [`orderReplacements/${changeId}`]: { requestId: changeId, state: 'Review required', createdAt: '2020-01-01' },
    [`creditRefundRequests/${refundId}`]: { requestId: refundId, state: 'Awaiting approval', createdAt: '2020-01-01' },
    [`customAgreementRequests/${id}`]: draft,
  });
  for (const [module, path, requestId] of [
    ['@/app/api/admin/replacements/route', '/api/admin/replacements', changeId],
    ['@/app/api/admin/credit-refunds/route', '/api/admin/credit-refunds', refundId],
    ['@/app/api/custom-agreements/route', '/api/custom-agreements?scope=admin', id],
  ]) {
    const route = h.load(module), url = `https://example.test${path}${path.includes('?') ? '&' : '?'}requestId=${requestId}`;
    assert.equal((await route.GET(request('GET', undefined, 'customer', url))).status, 403);
    const result = await route.GET(request('GET', undefined, 'admin', url));
    assert.equal(result.status, 200);
    const data = await result.json();
    assert.equal(data.requests.length, 1); assert.equal(data.requests[0].requestId, requestId);
  }
});


test('custom documents require payment, version-specific approval, courier dispatch and confirmed delivery', async () => {
  const path = `customAgreementRequests/${id}`;
  const h = harness({ [path]: { ...draft, status: 'In Progress', payment: { status: 'Paid', amount: 500 }, documents: [] } });
  const route = h.load('@/app/api/custom-agreements/route');
  const patch = (body: Data, token = 'admin') => route.PATCH(request('PATCH', { requestId: id, ...body }, token));
  assert.equal((await patch({ status: 'Completed' })).status, 409);
  assert.equal((await patch({ status: 'Awaiting Approval' })).status, 409);
  // Use the actual document upload route; customers cannot publish documents.
  const upload = h.load('@/app/api/custom-agreements/document/route');
  const fileRequest = (kind: string, token = 'admin') => Object.assign(new Request(`https://example.test/api/custom-agreements/document?requestId=${id}&kind=${kind}&name=draft.pdf`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/pdf' }, body: '%PDF-example' }), { nextUrl: new URL(`https://example.test/api/custom-agreements/document?requestId=${id}&kind=${kind}&name=draft.pdf`) });
  assert.equal((await upload.POST(fileRequest('draft', 'customer'))).status, 403);
  assert.equal((await upload.POST(fileRequest('final'))).status, 409);
  assert.equal((await upload.POST(fileRequest('draft'))).status, 200);
  const first = h.read(path).documents[0];
  const sample = h.load('@/app/api/custom-agreements/sample/route');
  const url = `https://example.test/api/custom-agreements/sample?requestId=${id}&documentId=${first.id}&preview=1`;
  assert.equal((await sample.GET(request('GET', undefined, 'customer', url))).status, 404);
  assert.equal((await patch({ status: 'Awaiting Approval' })).status, 200);
  assert.equal((await sample.GET(request('GET', undefined, 'customer', url))).status, 200);
  assert.equal((await sample.GET(request('GET', undefined, 'other', url))).status, 404);
  assert.equal((await patch({ status: 'Ready' })).status, 409);
  assert.equal((await patch({ action: 'approve-draft', documentId: first.id }, 'other')).status, 404);
  assert.equal((await patch({ action: 'approve-draft', documentId: 'old-version' }, 'customer')).status, 409);
  assert.equal((await patch({ action: 'request-revision', documentId: first.id, customerReply: 'Please revise the service scope.' }, 'customer')).status, 200);
  assert.equal((await patch({ status: 'Ready' })).status, 409);
  assert.equal((await patch({ status: 'In Progress' })).status, 200);
  assert.equal((await upload.POST(fileRequest('draft'))).status, 200);
  assert.equal(h.read(path).documents[1].version, 2);
  assert.equal((await patch({ status: 'Awaiting Approval' })).status, 200);
  const second = h.read(path).documents[1];
  assert.equal((await patch({ action: 'approve-draft', documentId: first.id }, 'customer')).status, 409);
  assert.equal((await patch({ action: 'approve-draft', documentId: second.id }, 'customer')).status, 200);
  assert.equal((await patch({ status: 'Ready' })).status, 200);
  assert.equal((await patch({ status: 'Completed' })).status, 409);
  assert.equal((await patch({ status: 'Dispatched' })).status, 409);
  assert.equal((await patch({ status: 'Dispatched', courierName: 'DTDC', trackingNumber: '' })).status, 409);
  assert.equal((await patch({ status: 'Dispatched', courierName: 'DTDC', trackingNumber: 'D12345' }, 'customer')).status, 409);
  assert.equal((await patch({ status: 'Dispatched', courierName: 'DTDC', trackingNumber: 'D12345' })).status, 200);
  assert.equal(h.read(path).courier.trackingNumber, 'D12345');
  assert.equal((await patch({ status: 'Completed' })).status, 409);
  assert.equal((await patch({ status: 'Completed', deliveryConfirmed: false })).status, 409);
  assert.equal((await patch({ status: 'Completed', deliveryConfirmed: true })).status, 200);
  assert.ok(h.read(path).deliveredAt);
  assert.equal(h.read(path).documents.some((document: Data) => document.kind === 'final'), false);
  assert.equal(h.read(path).customerApproval.status, 'Approved');
  assert.equal(h.read(path).payment.status, 'Paid');
});

test('custom quotes itemize without inventing legacy charges, preserve revisions and enforce expiry', async () => {
  const path = `customAgreementRequests/${id}`, h = harness({ [path]: { ...draft, status: 'Under Review', extraCopies: 2 } });
  const route = h.load('@/app/api/custom-agreements/route');
  const patch = (body: Data) => route.PATCH(request('PATCH', { requestId: id, status: 'Quoted / Awaiting Payment', ...body }, 'admin'));
  const items = { drafting: 300, stampPaper: 100, notary: 0, delivery: 100 };
  assert.equal((await patch({ quoteAmount: 501, quoteBreakdown: items })).status, 400);
  assert.equal((await patch({ quoteAmount: 500, quoteBreakdown: items, quoteValidUntil: '2027-12-31' })).status, 200);
  assert.equal(h.read(path).quoteAmount, 800);
  assert.equal(h.read(path).quoteHistory.length, 1);
  assert.equal((await patch({ quoteAmount: 600, quoteBreakdown: { ...items, drafting: 400 } })).status, 200);
  assert.equal(h.read(path).quoteHistory.length, 2);
  assert.equal(h.read(path).quoteHistory[0].amount, 800);
  const payment = h.load('@/lib/custom-payment');
  assert.throws(() => payment.payableCustomQuote({ status: 'Quoted / Awaiting Payment', quoteAmount: 500, quoteValidUntil: '2020-01-01' }), /expired/);
  assert.equal(payment.payableCustomQuote({ status: 'Quoted / Awaiting Payment', quoteAmount: 500, quoteValidUntil: '2099-12-31' }), 500);
});

test('staff can revise commitments during pending payment without changing the quote or workflow', async () => {
  const path = `customAgreementRequests/${id}`, h = harness({ [path]: { ...draft, status: 'Quoted / Awaiting Payment', quoteAmount: 500, preferredDate: '2026-10-23', expectedDate: '2026-10-24', payment: { status: 'Pending', amount: 500 } } });
  const route = h.load('@/app/api/custom-agreements/route');
  const patch = (body: Data) => route.PATCH(request('PATCH', { requestId: id, status: 'Quoted / Awaiting Payment', ...body }, 'admin'));
  assert.equal((await patch({ expectedDate: '2026-10-28' })).status, 400);
  assert.equal((await patch({ expectedDate: '2026-10-28', deadlineReason: 'Customer will provide the missing sample tomorrow.' })).status, 200);
  assert.equal(h.read(path).preferredDate, '2026-10-23');
  assert.equal(h.read(path).deadlineHistory[0].previousDate, '2026-10-24');
  assert.equal((await patch({ quoteAmount: 600 })).status, 409);
  assert.equal((await patch({ updatedAt: 'stale', expectedDate: '2026-10-29', deadlineReason: 'Another revision' })).status, 409);
});

test('custom request pagination reaches beyond 100 records and date/stage filters run on the server', async () => {
  const records: Data = {};
  for (let i = 1; i <= 110; i++) {
    const requestId = `CUSTOM_00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
    records[`customAgreementRequests/${requestId}`] = { ...draft, requestId, status: i % 2 ? 'Submitted' : 'Completed', createdAt: new Date(Date.UTC(2026, 0, i)).toISOString() };
  }
  const h = harness(records), route = h.load('@/app/api/custom-agreements/route');
  let cursor = '', seen: string[] = [], refs = new Set();
  do {
    const response = await route.GET(request('GET', undefined, 'admin', `https://example.test/api/custom-agreements?scope=admin${cursor ? `&cursor=${cursor}` : ''}`));
    assert.equal(response.status, 200);
    const page = await response.json(); seen.push(...page.requests.map((r: Data) => r.requestId)); page.requests.forEach((r: Data) => refs.add(r.publicReference)); cursor = page.nextCursor;
  } while (cursor);
  assert.equal(seen.length, 110); assert.equal(new Set(seen).size, 110); assert.equal(refs.size, 110);
  const page = await (await route.GET(request('GET', undefined, 'admin', 'https://example.test/api/custom-agreements?scope=admin&stage=REVIEW&from=2026-01-01&to=2026-01-10'))).json();
  assert.equal(page.requests.length, 5); assert.ok(page.requests.every((r: Data) => r.status === 'Submitted'));
  assert.equal((await route.GET(request('GET', undefined, 'admin', 'https://example.test/api/custom-agreements?scope=admin&from=invalid'))).status, 400);
});


test('custom stage labels separate payment from work and only commitments become overdue', () => {
  const h = harness(), helper = h.load('@/lib/custom-workflow');
  assert.equal(helper.customWorkStage({ status: 'Accepted' }), 'Awaiting payment');
  assert.equal(helper.customWorkStage({ status: 'Accepted', payment: { status: 'Paid' } }), 'Ready to draft');
  assert.equal(helper.customWorkStage({ status: 'In Progress', payment: { status: 'Paid' } }), 'Drafting');
  const preference = helper.customDateState({ status: 'Quoted / Awaiting Payment', preferredDate: '2026-10-23' }, new Date('2026-10-26T12:00:00Z'));
  assert.equal(preference.overdue, false); assert.equal(preference.preferencePassed, true);
  assert.equal(helper.customDateState({ status: 'In Progress', expectedDate: '2026-10-26' }, new Date('2026-10-26T18:29:00Z')).overdue, false);
  assert.equal(helper.customDateState({ status: 'In Progress', expectedDate: '2026-10-26' }, new Date('2026-10-26T18:31:00Z')).overdue, true);
  assert.equal(helper.customDateState({ status: 'Completed', expectedDate: '2026-10-23' }, new Date('2026-10-26T12:00:00Z')).overdue, false);
  assert.equal(helper.fileSize(12000), '11.7 KB');
});

test('paid quotes cannot have their charge allocation rewritten and legacy quote revisions retain the original', async () => {
  const path = `customAgreementRequests/${id}`, items = { drafting: 300, stampPaper: 100, notary: 0, delivery: 100 };
  const paid = harness({ [path]: { ...draft, status: 'In Progress', quoteAmount: 500, quoteBaseAmount: 500, quoteBreakdown: items, payment: { status: 'Paid', amount: 500 } } });
  assert.equal((await paid.load('@/app/api/custom-agreements/route').PATCH(request('PATCH', { requestId: id, status: 'In Progress', quoteAmount: 500, quoteBreakdown: { ...items, drafting: 400, delivery: 0 } }, 'admin'))).status, 409);
  assert.deepEqual(paid.read(path).quoteBreakdown, items);
  const legacy = harness({ [path]: { ...draft, status: 'Quoted / Awaiting Payment', quoteAmount: 500 } });
  assert.equal((await legacy.load('@/app/api/custom-agreements/route').PATCH(request('PATCH', { requestId: id, status: 'Quoted / Awaiting Payment', quoteAmount: 600 }, 'admin'))).status, 200);
  assert.deepEqual(legacy.read(path).quoteHistory.map((q: Data) => q.amount), [500, 600]);
});


test('single base quote can replace a former itemized quote while preserving its history', async () => {
  const path = `customAgreementRequests/${id}`;
  const h = harness({ [path]: { ...draft, status: 'Quoted / Awaiting Payment', quoteAmount: 500, quoteBaseAmount: 500, quoteBreakdown: { drafting: 300, stampPaper: 100, notary: 0, delivery: 100 } } });
  const response = await h.load('@/app/api/custom-agreements/route').PATCH(request('PATCH', { requestId: id, status: 'Quoted / Awaiting Payment', quoteAmount: 600 }, 'admin'));
  assert.equal(response.status, 200);
  assert.equal(h.read(path).quoteAmount, 600);
  assert.equal(h.read(path).quoteBreakdown, null);
  assert.ok(h.read(path).quoteHistory[0].breakdown);
  assert.equal(h.read(path).quoteHistory[1].breakdown, undefined);
});


test('administrators using the customer page can cancel and respond to their own requests', async () => {
  const path = `customAgreementRequests/${id}`;
  for (const status of ['Submitted', 'Quoted / Awaiting Payment']) {
    const h = harness({ [path]: { ...draft, ownerUid: 'admin', status, ...(status === 'Submitted' ? {} : { quoteAmount: 250 }) } });
    const response = await h.load('@/app/api/custom-agreements/route').PATCH(request('PATCH', { requestId: id, action: 'cancel' }, 'admin'));
    assert.equal(response.status, 200);
    assert.equal(h.read(path).status, 'Cancelled');
  }
  const clarification = harness({ [path]: { ...draft, ownerUid: 'admin', status: 'Clarification Required' } });
  assert.equal((await clarification.load('@/app/api/custom-agreements/route').PATCH(request('PATCH', { requestId: id, action: 'reply', customerReply: 'Please use the corrected address.' }, 'admin'))).status, 200);
  assert.equal(clarification.read(path).status, 'Under Review');
  const approval = harness({ [path]: { ...draft, ownerUid: 'admin', status: 'Awaiting Approval', payment: { status: 'Paid' }, documents: [{ id: 'v1', kind: 'draft' }], customerApproval: { status: 'Pending', documentId: 'v1' } } });
  assert.equal((await approval.load('@/app/api/custom-agreements/route').PATCH(request('PATCH', { requestId: id, action: 'approve-draft', documentId: 'v1' }, 'admin'))).status, 200);
  assert.equal(approval.read(path).customerApproval.status, 'Approved');
});

test('customer actions never let administrators impersonate another owner or bypass cancellation restrictions', async () => {
  const path = `customAgreementRequests/${id}`;
  const other = harness({ [path]: { ...draft, status: 'Submitted' } });
  assert.equal((await other.load('@/app/api/custom-agreements/route').PATCH(request('PATCH', { requestId: id, action: 'cancel' }, 'admin'))).status, 404);
  assert.equal(other.read(path).status, 'Submitted');
  for (const record of [{ status: 'In Progress' }, { status: 'Quoted / Awaiting Payment', payment: { status: 'Pending', amount: 250 } }]) {
    const h = harness({ [path]: { ...draft, ownerUid: 'admin', ...record } });
    assert.equal((await h.load('@/app/api/custom-agreements/route').PATCH(request('PATCH', { requestId: id, action: 'cancel' }, 'admin'))).status, 409);
    assert.equal(h.read(path).status, record.status);
  }
});


test('customers can fetch only their own focused request after a payment return', async () => {
  const path = `customAgreementRequests/${id}`;
  const h = harness({ [path]: { ...draft, status: 'Quoted / Awaiting Payment', quoteAmount: 500, internalNotes: 'Staff only', assignedTo: 'Private staff name' } });
  const route = h.load('@/app/api/custom-agreements/route');
  const url = `https://example.test/api/custom-agreements?requestId=${id}`;
  const response = await route.GET(request('GET', undefined, 'customer', url));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.requests.length, 1);
  assert.equal(result.requests[0].requestId, id);
  assert.equal(result.requests[0].internalNotes, undefined);
  assert.equal(result.requests[0].assignedTo, undefined);
  assert.equal((await route.GET(request('GET', undefined, 'other', url))).status, 404);
});


test('stale custom checkouts offer a safe retry after 20 minutes and reuse the same provider order', async () => {
  const path = `customAgreementRequests/${id}`, merchantOrderId = 'CUSTOMPAY0123456789abcdef0123456789abcdef';
  const old = new Date(Date.now() - 21 * 60_000).toISOString();
  const flags: boolean[] = []; let created = 0, state = 'PENDING';
  const h = harness({ [path]: { ...draft, status: 'Quoted / Awaiting Payment', quoteAmount: 500, payment: { status: 'Pending', merchantOrderId, amount: 500, startedAt: old } }, [`customPhonepeAttempts/${merchantOrderId}`]: { gateway: 'Razorpay', requestId: id, ownerUid: 'customer', amount: 500, initiatedAt: old, redirectUrl: '/payment/razorpay/checkout?attempt=existing' } }, {
    '@/lib/payment-gateway': { getCheckoutCredentials: async () => ({ gateway: 'Razorpay' }), getGatewayAccessToken: async () => '', fetchGatewayOrderStatus: async (_a: unknown, _b: unknown, _c: unknown, check: boolean) => { flags.push(check); return { state, retrySafe: true, amount: 50000 }; }, createGatewayCheckout: async () => { created++; throw new Error('Must reuse the original order'); } },
  });
  const route = h.load('@/app/api/custom-agreements/payment/route');
  const call = (action: string) => route.POST(request('POST', { requestId: id, action, quoteAmount: 500 }));
  const result = await (await call('status')).json();
  assert.equal(result.retryAvailable, true); assert.equal(result.reviewRequired, false);
  assert.equal(h.read(path).payment.status, 'Pending');
  assert.equal(h.read(path).payment.merchantOrderId, merchantOrderId);
  const resumed = await (await call('pay')).json();
  assert.equal(resumed.redirectUrl, '/payment/razorpay/checkout?attempt=existing');
  assert.equal(h.read(path).payment.retryAvailable, false);
  assert.ok(h.read(`customPhonepeAttempts/${merchantOrderId}`).resumedAt);
  assert.equal((await (await call('status')).json()).retryAvailable, true);
  assert.deepEqual(flags, [true, true, true]); assert.equal(created, 0);
  state = 'COMPLETED';
  assert.equal((await (await call('status')).json()).paid, true);
  assert.equal(h.read(path).payment.status, 'Paid');
});

test('threshold never resets an unresolved or authorised payment, including PhonePe pending after expiry', async () => {
  for (const gateway of ['Razorpay', 'PhonePe']) {
    const path = `customAgreementRequests/${id}`, merchantOrderId = 'CUSTOMPAY0123456789abcdef0123456789abcdef';
    const old = new Date(Date.now() - 21 * 60_000).toISOString();
    const h = harness({ [path]: { ...draft, status: 'Quoted / Awaiting Payment', quoteAmount: 500, payment: { status: 'Pending', merchantOrderId, amount: 500 } }, [`customPhonepeAttempts/${merchantOrderId}`]: { gateway, requestId: id, ownerUid: 'customer', amount: 500, initiatedAt: old, redirectUrl: 'https://provider.example/old' } }, {
      '@/lib/payment-gateway': { getCheckoutCredentials: async () => ({ gateway }), getGatewayAccessToken: async () => '', fetchGatewayOrderStatus: async () => ({ state: 'PENDING', retrySafe: false, expireAt: Date.now() - 60000 }) },
    });
    const route = h.load('@/app/api/custom-agreements/payment/route');
    const result = await (await route.POST(request('POST', { requestId: id, action: 'status' }))).json();
    assert.equal(result.reviewRequired, true); assert.equal(result.retryAvailable, false);
    assert.equal((await route.POST(request('POST', { requestId: id, action: 'pay', quoteAmount: 500 }))).status, 409);
    assert.equal(h.read(path).payment.status, 'Pending'); assert.equal(h.read(path).payment.merchantOrderId, merchantOrderId);
  }
});

test('gateway-confirmed expiry resets the payment and permits a new checkout', async () => {
  const path = `customAgreementRequests/${id}`, merchantOrderId = 'CUSTOMPAY0123456789abcdef0123456789abcdef';let created = 0;
  const h = harness({ [path]: { ...draft, status: 'Quoted / Awaiting Payment', quoteAmount: 500, payment: { status: 'Pending', merchantOrderId, amount: 500 } }, [`customPhonepeAttempts/${merchantOrderId}`]: { gateway: 'PhonePe', requestId: id, ownerUid: 'customer', amount: 500, initiatedAt: new Date().toISOString() } }, {
    '@/lib/payment-gateway': { getCheckoutCredentials: async () => ({ gateway: 'PhonePe' }), getGatewayAccessToken: async () => '', fetchGatewayOrderStatus: async () => ({ state: 'EXPIRED', amount: 50000 }), createGatewayCheckout: async () => { created++; return new Response(JSON.stringify({ redirectUrl: 'https://provider.example/new' })); } },
  });
  const route = h.load('@/app/api/custom-agreements/payment/route');
  assert.equal((await (await route.POST(request('POST', { requestId: id, action: 'status' }))).json()).state, 'EXPIRED');
  assert.equal(h.read(path).payment.status, 'Failed');
  assert.equal((await route.POST(request('POST', { requestId: id, action: 'pay', quoteAmount: 500 }))).status, 200);
  assert.notEqual(h.read(path).payment.merchantOrderId, merchantOrderId);assert.equal(created, 1);
});


test('closing custom QR checkout offers immediate same-order retry and permits verified unpaid cancellation', async () => {
  for (const actor of ['customer', 'admin']) {
    const path = `customAgreementRequests/${id}`, merchantOrderId = 'CUSTOMPAY0123456789abcdef0123456789abcdef';
    let authorized = false;
    const h = harness({ [path]: { ...draft, status: 'Quoted / Awaiting Payment', quoteAmount: 500, payment: { status: 'Pending', merchantOrderId, amount: 500 } },
      [`customPhonepeAttempts/${merchantOrderId}`]: { gateway: 'Razorpay', requestId: id, ownerUid: 'customer', amount: 500, initiatedAt: new Date().toISOString(), redirectUrl: '/payment/razorpay/checkout?attempt=existing' },
      [`razorpayCheckouts/${merchantOrderId}`]: { ownerUid: 'customer', keyId: 'rzp_test_Example123', razorpayOrderId: 'order_customclose', amount: 50000, currency: 'INR', receipt: 'customclose', state: 'PENDING', returnUrl: `https://example.test/my-requests?paymentRequest=${id}` },
    }, { process: { env: { RAZORPAY_KEY_ID: 'rzp_test_Example123', RAZORPAY_KEY_SECRET: 'test-secret' } }, fetch: async (url: string) => new Response(JSON.stringify(url.endsWith('/payments') ? { items: authorized ? [{ order_id: 'order_customclose', amount: 50000, currency: 'INR', status: 'authorized' }] : [] } : { id: 'order_customclose', amount: 50000, currency: 'INR', receipt: 'customclose', amount_paid: 0, amount_due: 50000, attempts: authorized ? 1 : 0, status: authorized ? 'attempted' : 'created' })) });
    const checkout = h.load('@/app/api/payment/razorpay/checkout/route');
    const dismissed = await checkout.POST(request('POST', { attempt: merchantOrderId, action: 'dismiss' }));
    assert.equal(dismissed.status, 200);assert.equal((await dismissed.json()).retryAvailable, true);
    assert.equal(h.read(path).payment.retryAvailable, true);
    const payment = h.load('@/app/api/custom-agreements/payment/route');
    assert.equal((await (await payment.POST(request('POST', { requestId: id, action: 'status' }))).json()).retryAvailable, true);
    const route = h.load('@/app/api/custom-agreements/route');
    authorized = true;
    const body = { requestId: id, ...(actor === 'customer' ? { action: 'cancel' } : { status: 'Cancelled' }) };
    assert.equal((await route.PATCH(request('PATCH', body, actor))).status, 409, 'Cached retry flag cannot cancel an authorised payment');
    authorized = false;
    assert.equal((await route.PATCH(request('PATCH', body, actor))).status, 200);
    assert.equal(h.read(path).status, 'Cancelled');
    assert.equal((await payment.POST(request('POST', { requestId: id, action: 'pay', quoteAmount: 500 }))).status, 409);
    assert.equal((await checkout.POST(request('POST', { attempt: merchantOrderId, action: 'options' }))).status, 409);
    await h.load('@/lib/custom-payment').settleCustomPayment(merchantOrderId, 50000, 'COMPLETED', 'late-capture');
    assert.equal(h.read(path).status, 'Cancelled', 'Late capture never reopens a cancelled request');
    assert.equal(h.read(path).payment.status, 'Paid');assert.equal(h.read(path).payment.reviewRequired, true);
  }
});


test('admins can decline verified-unpaid requests without changing their quote or bypassing active payment checks', async () => {
  const path = `customAgreementRequests/${id}`, merchantOrderId = 'CUSTOMPAY0123456789abcdef0123456789abcdef';
  for (const state of ['IDLE', 'PROCESSING', 'FAILED', 'COMPLETED']) {
    const h = harness({ [path]: { ...draft, status: 'Quoted / Awaiting Payment', quoteAmount: 500, quoteBaseAmount: 500, updatedAt: '2026-10-26T00:00:00.000Z', payment: { status: 'Pending', merchantOrderId, amount: 500 } }, [`customPhonepeAttempts/${merchantOrderId}`]: { gateway: 'Razorpay', requestId: id, ownerUid: 'customer', amount: 500 } }, {
      '@/lib/payment-gateway': { getCheckoutCredentials: async () => ({ gateway: 'Razorpay' }), getGatewayAccessToken: async () => '', fetchGatewayOrderStatus: async () => ({ state: ['FAILED', 'COMPLETED'].includes(state) ? state : 'PENDING', retrySafe: state === 'IDLE', amount: 50000 }) },
    });
    const route = h.load('@/app/api/custom-agreements/route');
    const response = await route.PATCH(request('PATCH', { requestId: id, status: 'Declined', updatedAt: '2026-10-26T00:00:00.000Z', customerMessage: 'We cannot provide this document.' }, 'admin'));
    if (state === 'IDLE' || state === 'FAILED') {
      assert.equal(response.status, 200, state);
      assert.equal(h.read(path).status, 'Declined');
      assert.equal(h.read(path).quoteAmount, 500);
      assert.equal(h.read(path).customerMessage, 'We cannot provide this document.');
    } else {
      assert.equal(response.status, 409, state);
      assert.notEqual(h.read(path).status, 'Declined');
      assert.equal(h.read(path).payment.status, state === 'COMPLETED' ? 'Paid' : 'Pending');
    }
  }
});
