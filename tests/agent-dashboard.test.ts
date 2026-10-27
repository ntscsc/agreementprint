import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
type Data = Record<string, any>;

function harness(records: Data) {
  const snapshot = (path: string) => ({ id: path.split('/').at(-1), data: () => records[path] });
  const db = {
    collection: (name: string) => ({
      doc: (id: string) => ({ path: `${name}/${id}` }),
      where: (key: string, _operator: string, value: string) => {
        const get = async (limit = Infinity) => {
          const docs = Object.keys(records).filter(path => path.startsWith(`${name}/`) && records[path][key] === value).slice(0, limit).map(snapshot);
          return { docs, size: docs.length };
        };
        return { get: () => get(), limit: (count: number) => ({ get: () => get(count) }) };
      },
    }),
    getAll: async (...refs: { path: string }[]) => refs.map(ref => snapshot(ref.path)),
  };
  const cache: Data = {};
  function load(name: string): any {
    if (name === 'next/server') return { NextResponse: { json: (body: unknown, options?: ResponseInit) => new Response(JSON.stringify(body), options) } };
    if (name === '@/lib/firebase-admin') return { getAdminDb: () => db, verifyFirebaseIdToken: async (token: string) => ({ uid: token, email: `${token}@example.test`, email_verified: token !== 'unverified' }) };
    if (!name.startsWith('@/')) return require(name);
    if (cache[name]) return cache[name];
    const target = { exports: {} };
    const source = readFileSync(new URL(`../${name.slice(2)}.ts`, import.meta.url), 'utf8');
    runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
      { module: target, exports: target.exports, require: load, Date, console, URL });
    return cache[name] = target.exports;
  }
  const route = load('@/app/api/agents/dashboard/route');
  return {
    load,
    get: (token?: string, query = '') => route.GET(Object.assign(new Request(`https://example.test/api/agents/dashboard${query}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }), { nextUrl: new URL(`https://example.test/api/agents/dashboard${query}`) })),
  };
}

test('agent dashboard requires a verified explicitly linked email and cannot select another agent', async () => {
  const h = harness({
    'referralCodes/AGENTA': { kind: 'agent', name: 'A', loginEmail: 'a@example.test' },
    'referralCodes/AGENTB': { kind: 'agent', name: 'B', loginEmail: 'b@example.test' },
    'referralCodes/CONTACT': { kind: 'agent', contact: 'contact@example.test' },
  });
  assert.equal((await h.get()).status, 401);
  assert.equal((await h.get('unverified')).status, 403);
  assert.equal((await (await h.get('contact')).json()).agents.length, 0);
  assert.equal((await h.get('a', '?code=AGENTB')).status, 403);
  assert.equal((await (await h.get('a')).json()).agents.length, 1);
});

test('dashboard verifies paid-order ownership, keeps frozen commissions and excludes customer contact information', async () => {
  const h = harness({
    'referralCodes/AGENTA': { kind: 'agent', name: 'A', loginEmail: 'a@example.test', rewardAmount: 999 },
    'agentReferralCustomers/customer1': { code: 'AGENTA', name: 'One', email: 'private@example.test', phone: '9999999999', eligiblePaidOrderId: 'paid', rewardAmount: 100, rewardStatus: 'Awaiting payment', joinedAt: '2026-10-01' },
    'agentReferralCustomers/customer2': { code: 'AGENTA', name: 'Two', eligiblePaidOrderId: 'wrong-owner', rewardAmount: 200, joinedAt: '2026-10-02' },
    'agentReferralCustomers/customer3': { code: 'AGENTA', name: 'Three', rewardStatus: 'Rewarded', rewardPaidAmount: 75, rewardNotes: 'Private banking notes', joinedAt: '2026-10-03' },
    'agentReferralCustomers/customer4': { code: 'AGENTA', name: 'Four', rewardStatus: 'Rewarded', joinedAt: '2026-10-04' },
    'agentReferralCustomers/customer5': { code: 'AGENTB', name: 'Other agent customer', rewardStatus: 'Rewarded', rewardPaidAmount: 5000 },
    'orders/paid': { ownerUid: 'customer1', payment: { status: 'Paid' }, publicReference: 'AP-100001' },
    'orders/wrong-owner': { ownerUid: 'someone-else', payment: { status: 'Paid' }, publicReference: 'AP-100002' },
  });
  const response = await h.get('a');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const data = await response.json();
  assert.equal(data.summary.signedUp, 4);
  assert.equal(data.summary.firstOrderPaid, 1);
  assert.equal(data.summary.dueAmount, 100);
  assert.equal(data.summary.paidAmount, 75);
  assert.equal(data.summary.unknownPayments, 1);
  assert.equal(data.referrals.find((row: Data) => row.id === 'customer1').stage, 'Commission due');
  assert.equal(data.referrals.find((row: Data) => row.id === 'customer2').orderReference, undefined);
  assert.ok(!JSON.stringify(data).includes('private@example.test'));
  assert.ok(!JSON.stringify(data).includes('Private banking notes'));
  assert.ok(!JSON.stringify(data).includes('Other agent customer'));
});

test('agent dashboard pagination and filters retain full-account totals', async () => {
  const records: Data = { 'referralCodes/AGENTA': { kind: 'agent', loginEmail: 'a@example.test', name: 'A' } };
  for (let index = 0; index < 28; index++) records[`agentReferralCustomers/c${index}`] = { code: 'AGENTA', name: `Customer ${index}`, joinedAt: `2026-10-${String(index + 1).padStart(2, '0')}` };
  const h = harness(records);
  const first = await (await h.get('a')).json();
  const second = await (await h.get('a', '?page=2')).json();
  assert.equal(first.referrals.length, 25);
  assert.equal(first.hasNext, true);
  assert.equal(second.referrals.length, 3);
  assert.equal(second.summary.signedUp, 28);
  assert.ok(!first.referrals.some((row: Data) => second.referrals.some((other: Data) => row.id === other.id)));
  const empty = await (await h.get('a', '?stage=Commission%20due')).json();
  assert.equal(empty.referrals.length, 0);
  assert.equal(empty.summary.signedUp, 28);
  assert.equal((await h.get('a', '?page=-1')).status, 400);
});
