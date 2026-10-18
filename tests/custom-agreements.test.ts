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
  let documents = structuredClone(seed), queue = Promise.resolve();
  const snapshot = (path: string, source = documents) => ({ exists: path in source, id: path.split('/').at(-1), data: () => structuredClone(source[path]) });
  const db = {
    collection: (name: string) => {
      let key = '', value: unknown, count = 100;
      const query = {
        doc: (id: string) => ({ path: `${name}/${id}`, get: async () => snapshot(`${name}/${id}`), update: async (data: Data) => { documents[`${name}/${id}`] = { ...documents[`${name}/${id}`], ...structuredClone(data) }; } }),
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
    if (name === 'next/server') return { NextResponse: { json: (data: unknown, options?: ResponseInit) => new Response(JSON.stringify(data), options) } };
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
    if (!name.startsWith('@/')) return require(name);
    if (cache[name]) return cache[name];
    const source = readFileSync(new URL(`../${name.slice(2)}.ts`, import.meta.url), 'utf8');
    const target = { exports: {} };
    runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText, { module: target, exports: target.exports, require: load, Date, Buffer, console, URL, AbortSignal, fetch: extras.fetch, setTimeout, clearTimeout, process: extras.process ?? { env: {} } });
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
