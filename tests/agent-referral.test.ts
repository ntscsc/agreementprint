import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
type Data = Record<string, any>;

function harness() {
  let records: Data = {};
  const snap = (path: string) => ({ exists: path in records, id: path.split('/').at(-1), data: () => records[path] });
  const db = {
    collection: (name: string) => ({
      get: async () => ({ docs: Object.keys(records).filter(path => path.startsWith(`${name}/`)).map(path => snap(path)) }),
      doc: (id: string) => ({ path: `${name}/${id}`, get: async () => snap(`${name}/${id}`) }),
      where: (key: string, _op: string, value: unknown) => ({ get: async () => ({ docs: Object.entries(records).filter(([path, record]) => path.startsWith(`${name}/`) && key.split('.').reduce((data: any, part: string) => data?.[part], record) === value).map(([path]) => ({ ...snap(path), id: path.split('/').at(-1) })) }) }),
    }),
    runTransaction: async (callback: (tx: Data) => Promise<void>) => {
      const writes: (() => void)[] = [];
      await callback({
        get: async (ref: Data) => snap(ref.path),
        set: (ref: Data, data: Data) => writes.push(() => { records[ref.path] = data; }),
        create: (ref: Data, data: Data) => writes.push(() => { assert.ok(!(ref.path in records)); records[ref.path] = data; }),
        update: (ref: Data, data: Data) => writes.push(() => { for (const [key, value] of Object.entries(data)) { const parts = key.split('.'); let target = records[ref.path]; for (const part of parts.slice(0, -1)) target = target[part] ??= {}; target[parts.at(-1)!] = value; } }),
      });
      writes.forEach(write => write());
    },
  };
  const cache: Data = {};
  function load(name: string): any {
    if (name === 'next/server') return { NextResponse: { json: (body: unknown, options?: ResponseInit) => new Response(JSON.stringify(body), options) } };
    if (name === '@/lib/firebase-admin') return {
      getAdminDb: () => db,
      verifyFirebaseIdToken: async (token: string) => {
        if (token === 'bad') throw Object.assign(new Error('Invalid token'), { code: 'auth/invalid-id-token' });
        return { uid: token, email: token === 'admin' ? 'admin@example.test' : 'customer@example.test', email_verified: token !== 'unverified', name: 'Customer' };
      },
    };
    if (name === '@/src/config/admin') return { ADMIN_EMAILS: ['admin@example.test'] };
    if (!name.startsWith('@/')) return require(name);
    if (cache[name]) return cache[name];
    const source = readFileSync(new URL(`../${name.slice(2)}.ts`, import.meta.url), 'utf8');
    const target = { exports: {} };
    runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText, { exports: target.exports, module: target, require: load, Date, console, TextDecoder, Uint8Array });
    return cache[name] = target.exports;
  }
  return { load, read: (path: string) => records[path], write: (path: string, data: Data) => { records[path] = data; } };
}
function request(body: object, token?: string) {
  return new Request('https://example.test', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
}

async function pay(h: ReturnType<typeof harness>, uid: string, code: string, orderId = `ORDER_${uid}`) {
  h.write(`orders/${orderId}`, { orderId, ownerUid: uid, referralCode: code, customerEmail: `${uid}@example.test`, payment: { status: 'Pending' } });
  await h.load('@/lib/referral-admin').confirmPaidOrderAndGrantReferral(orderId);
}

test('Only verified admins can create agent codes; duplicate codes cannot change ownership', async () => {
  const h = harness();
  const api = h.load('@/app/api/admin/agents/route');
  const body = { action: 'create', name: 'Ravi', contact: '', code: 'AGRAVI2026' };
  assert.equal((await api.POST(request(body))).status, 401);
  assert.equal((await api.POST(request(body, 'bad'))).status, 401);
  assert.equal((await api.POST(request(body, 'customer'))).status, 403);
  assert.equal((await api.POST(request(body, 'unverified'))).status, 403);
  assert.equal((await api.POST(request({ ...body, code: '../RAVI' }, 'admin'))).status, 400);
  assert.equal((await api.POST(request(body, 'admin'))).status, 200);
  assert.equal((await api.POST(request({ ...body, name: 'Other' }, 'admin'))).status, 409);
  assert.equal(h.read('referralCodes/AGRAVI2026').name, 'Ravi');
  assert.equal(h.read('referralCodes/AGRAVI2026').uid, undefined);
});

test('First agent attribution and recorded reward are immutable across retries', async () => {
  const h = harness();
  const admin = h.load('@/app/api/admin/agents/route');
  const customer = h.load('@/app/api/referrals/agent/route');
  for (const code of ['AGRAVI', 'AGPRIYA']) {
    await admin.POST(request({ action: 'create', code, name: code, contact: '' }, 'admin'));
  }
  assert.equal((await customer.POST(request({ code: 'AGUNKNOWN' }, 'customer'))).status, 404);
  assert.equal((await customer.POST(request({ code: 'AGRAVI' }))).status, 401);
  assert.equal((await customer.POST(request({ code: 'AGRAVI', uid: 'forged' }, 'customer'))).status, 200);
  await customer.POST(request({ code: 'AGPRIYA' }, 'customer'));
  assert.equal(h.read('agentReferralCustomers/customer').code, 'AGRAVI');
  assert.equal(h.read('agentReferralCustomers/forged'), undefined);
  const reward = { action: 'reward', uid: 'customer', notes: '₹500 paid via UPI' };
  assert.equal((await admin.POST(request(reward, 'customer'))).status, 403);
  assert.equal((await admin.POST(request({ ...reward, notes: '' }, 'admin'))).status, 400);
  assert.equal((await admin.POST(request(reward, 'admin'))).status, 409);
  await pay(h, 'customer', 'AGRAVI');
  assert.equal((await admin.POST(request(reward, 'admin'))).status, 200);
  await admin.POST(request({ ...reward, notes: 'Retry with different details' }, 'admin'));
  assert.equal(h.read('agentReferralCustomers/customer').rewardNotes, reward.notes);
  assert.equal(h.read('agentReferralCustomers/customer').rewardStatus, 'Rewarded');
});

test('Entering an agent code at checkout validates it and records the authenticated customer', async () => {
  const h = harness();
  await h.load('@/app/api/admin/agents/route').POST(request({ action: 'create', code: 'AGRAVI', name: 'Ravi', contact: '' }, 'admin'));
  const response = await h.load('@/app/api/referrals/validate/route').POST(request({ code: ' ag-ravi ' }, 'customer'));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).valid, true);
  assert.equal(h.read('agentReferralCustomers/customer').code, 'AGRAVI');
  assert.equal(h.read('referralAccounts/customer'), undefined);
  assert.equal(h.read('referralRewards/customer'), undefined);
});

test('Agent codes need no fixed prefix and retain their own discount while attribution stays immutable', async () => {
  const h = harness();
  const admin = h.load('@/app/api/admin/agents/route');
  const body = { action: 'create', name: 'Ravi', contact: '', code: 'RAVI2026', customerDiscountAmount: 125 };
  assert.equal((await admin.POST(request(body, 'admin'))).status, 200);
  assert.equal(h.read('referralCodes/RAVI2026').kind, 'agent');
  assert.equal(h.read('referralCodes/RAVI2026').customerDiscountAmount, 125);
  for (const customerDiscountAmount of [-1, 1.5, '125', 100001]) {
    assert.equal((await admin.POST(request({ ...body, code: 'OTHER2026', customerDiscountAmount }, 'admin'))).status, 400);
  }
  const response = await h.load('@/app/api/referrals/agent/route').POST(request({ code: 'ravi-2026' }, 'customer'));
  assert.equal(response.status, 200);
  assert.equal(h.read('agentReferralCustomers/customer').code, 'RAVI2026');
  const validation = await h.load('@/app/api/referrals/validate/route').POST(request({ code: 'RAVI2026' }, 'customer'));
  assert.equal(validation.status, 200);
  assert.equal(h.read('agentReferralCustomers/customer').code, 'RAVI2026');
});

test('Agent rewards are individual, snapshotted, and paid manually without changing past referrals', async () => {
  const h = harness();
  const admin = h.load('@/app/api/admin/agents/route');
  const referral = h.load('@/app/api/referrals/agent/route');
  const agent = { code: 'RAVI2026', name: 'Ravi', contact: '', rewardAmount: 350, customerDiscountAmount: 25 };
  assert.equal((await admin.POST(request({ action: 'create', ...agent }, 'admin'))).status, 200);
  await referral.POST(request({ code: agent.code }, 'first'));
  assert.equal(h.read('agentReferralCustomers/first').rewardAmount, undefined);
  assert.equal(h.read('agentReferralCustomers/first').rewardStatus, 'Awaiting payment');
  await pay(h, 'first', agent.code);
  assert.equal(h.read('agentReferralCustomers/first').rewardAmount, 350);
  assert.equal((await admin.POST(request({ action: 'update', ...agent, name: 'Ravi updated', rewardAmount: 500 }, 'admin'))).status, 200);
  await referral.POST(request({ code: agent.code }, 'second'));
  await pay(h, 'second', agent.code);
  assert.equal(h.read('agentReferralCustomers/second').rewardAmount, 500);
  assert.equal(h.read('referralCodes/RAVI2026').customerDiscountAmount, 25);
  await admin.POST(request({ action: 'reward', uid: 'first', notes: 'Paid via bank transfer', rewardPaidAmount: 9999 }, 'admin'));
  assert.equal(h.read('agentReferralCustomers/first').rewardPaidAmount, 350);
  await admin.POST(request({ action: 'reward', uid: 'first', notes: 'Retry' }, 'admin'));
  assert.equal(h.read('agentReferralCustomers/first').rewardPaidAmount, 350);
  assert.equal(h.read('agentReferralCustomers/first').rewardNotes, 'Paid via bank transfer');
});

test('Removing an agent blocks new referrals, reserves the code, and preserves payable history', async () => {
  const h = harness();
  const admin = h.load('@/app/api/admin/agents/route');
  const referral = h.load('@/app/api/referrals/agent/route');
  const agent = { code: 'RAVI2026', name: 'Ravi', contact: '', rewardAmount: 100 };
  await admin.POST(request({ action: 'create', ...agent }, 'admin'));
  await referral.POST(request({ code: agent.code }, 'customer'));
  await pay(h, 'customer', agent.code);
  assert.equal((await admin.POST(request({ action: 'delete', code: agent.code }, 'customer'))).status, 403);
  assert.equal((await admin.POST(request({ action: 'delete', code: agent.code }, 'admin'))).status, 200);
  assert.equal((await referral.POST(request({ code: agent.code }, 'another'))).status, 404);
  assert.equal(h.read('referralCodes/RAVI2026').active, false);
  assert.equal((await admin.POST(request({ action: 'create', ...agent }, 'admin'))).status, 409);
  assert.equal((await admin.POST(request({ action: 'update', ...agent }, 'admin'))).status, 409);
  assert.equal((await admin.POST(request({ action: 'reward', uid: 'customer', notes: 'Paid final reward' }, 'admin'))).status, 200);
  assert.equal(h.read('agentReferralCustomers/customer').rewardPaidAmount, 100);
  for (const rewardAmount of [-1, 1.5, '100', 100001]) {
    assert.equal((await admin.POST(request({ action: 'create', ...agent, code: 'OTHER2026', rewardAmount }, 'admin'))).status, 400);
  }
});

test('Dashboard excludes unpaid sign-ins, missing orders and payments owned by another customer', async () => {
  const h = harness();
  const admin = h.load('@/app/api/admin/agents/route');
  const referral = h.load('@/app/api/referrals/agent/route');
  await admin.POST(request({ action: 'create', code: 'RAVI2026', name: 'Ravi', contact: '', rewardAmount: 150 }, 'admin'));
  await referral.POST(request({ code: 'RAVI2026' }, 'customer'));
  const summary = h.load('@/lib/referral-summary').summarizeAgentReferrals;
  const getCustomers = async () => (await (await admin.GET(request({}, 'admin'))).json()).customers;
  let customers = await getCustomers();
  assert.equal(customers[0].hasPaidOrder, false);
  assert.equal(summary(customers).paidCustomers, 0);
  assert.equal(summary(customers).awaitingCustomerPayment, 1);
  assert.equal(summary(customers).paymentsDue, 0);
  h.write('agentReferralCustomers/customer', { ...h.read('agentReferralCustomers/customer'), eligiblePaidOrderId: 'MISSING' });
  assert.equal((await getCustomers())[0].hasPaidOrder, false);
  h.write('orders/MISSING', { ownerUid: 'someone-else', payment: { status: 'Paid' } });
  assert.equal((await getCustomers())[0].hasPaidOrder, false);
  await pay(h, 'customer', 'RAVI2026');
  customers = await getCustomers();
  assert.equal(summary(customers).paidCustomers, 1);
  assert.equal(summary(customers).awaitingCustomerPayment, 0);
  assert.equal(summary(customers).paymentsDue, 1);
  await admin.POST(request({ action: 'reward', uid: 'customer', notes: 'UPI reference 123' }, 'admin'));
  customers = await getCustomers();
  assert.equal(summary(customers).paidCustomers, 1);
  assert.equal(summary(customers).paymentsDue, 0);
  assert.equal(summary(customers).recordedPaymentTotal, 150);
});

test('Zero-rate paid referrals have no agent payment due; returning customers cannot be attributed again', async () => {
  const h = harness();
  const admin = h.load('@/app/api/admin/agents/route');
  const referral = h.load('@/app/api/referrals/agent/route');
  await admin.POST(request({ action: 'create', code: 'RAVI2026', name: 'Ravi', contact: '', rewardAmount: 0 }, 'admin'));
  await referral.POST(request({ code: 'RAVI2026' }, 'customer'));
  await pay(h, 'customer', 'RAVI2026');
  const data = await (await admin.GET(request({}, 'admin'))).json();
  const summary = h.load('@/lib/referral-summary').summarizeAgentReferrals(data.customers);
  assert.equal(summary.paidCustomers, 1);
  assert.equal(summary.paymentsDue, 0);
  assert.equal((await referral.POST(request({ code: 'RAVI2026' }, 'customer'))).status, 409);
});
