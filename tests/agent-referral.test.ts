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
  const snap = (path: string) => ({ exists: path in records, data: () => records[path] });
  const db = {
    collection: (name: string) => ({ doc: (id: string) => ({ path: `${name}/${id}`, get: async () => snap(`${name}/${id}`) }) }),
    runTransaction: async (callback: (tx: Data) => Promise<void>) => {
      const writes: (() => void)[] = [];
      await callback({
        get: async (ref: Data) => snap(ref.path),
        create: (ref: Data, data: Data) => writes.push(() => { assert.ok(!(ref.path in records)); records[ref.path] = data; }),
        update: (ref: Data, data: Data) => writes.push(() => { records[ref.path] = { ...records[ref.path], ...data }; }),
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
    runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText, { exports: target.exports, module: target, require: load, Date, console });
    return cache[name] = target.exports;
  }
  return { load, read: (path: string) => records[path] };
}
function request(body: object, token?: string) {
  return new Request('https://example.test', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
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
