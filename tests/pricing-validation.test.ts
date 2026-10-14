import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import * as pricing from '../src/config/pricing.ts';

test('Pricing rejects zero, negative, fractional, non-finite and unsafe package amounts', () => {
  for (const key of ['stamp100Chennai', 'stamp100TamilNadu', 'stamp200Chennai', 'stamp200TamilNadu']) {
    for (const amount of [0, -1, 200.5, NaN, Infinity, -Infinity, '350', Number.MAX_SAFE_INTEGER, null]) {
      assert.throws(() => pricing.validatePricingConfig({ ...pricing.DEFAULT_PRICING, [key]: amount }));
      assert.throws(() => pricing.calculateOrderPrice({ ...pricing.DEFAULT_PRICING, [key]: amount } as pricing.PricingConfig));
    }
  }
});

test('Notary surcharge can be zero but must be a finite non-negative whole amount', () => {
  pricing.validatePricingConfig({ ...pricing.DEFAULT_PRICING, notaryExtraFee: 0 });
  for (const amount of [-1, 0.5, NaN, Infinity, '200']) {
    assert.throws(() => pricing.validatePricingConfig({ ...pricing.DEFAULT_PRICING, notaryExtraFee: amount }));
  }
});

test('Missing saved prices use defaults while explicitly invalid saved prices fail closed', () => {
  assert.deepEqual(pricing.resolvePricingConfig({}), pricing.DEFAULT_PRICING);
  assert.equal(pricing.resolvePricingConfig({ stamp100Chennai: 400 }).stamp100Chennai, 400);
  assert.throws(() => pricing.resolvePricingConfig({ stamp100Chennai: 0 }));
  assert.throws(() => pricing.resolvePricingConfig({ stamp200TamilNadu: '500' }));
  assert.equal(pricing.calculateOrderPrice(pricing.DEFAULT_PRICING, 200, 'Within Tamil Nadu', true).totalPayable, 700);
});

function service(saved: Record<string, unknown>, writes: unknown[], readFails = false) {
  const require = createRequire(import.meta.url);
  const ts = require('typescript');
  const source = readFileSync(new URL('../lib/pricing-service.ts', import.meta.url), 'utf8');
  const modules: Record<string, unknown> = {
    './firebase': { db: {} }, '@/src/config/pricing': pricing,
    'firebase/firestore': {
      doc: () => ({}), getDoc: async () => { if (readFails) throw new Error('Network failure'); return { exists: () => true, data: () => saved }; },
      setDoc: async (_ref: unknown, data: unknown) => { writes.push(data); },
    },
  };
  const target = { exports: {} as { getPricingConfig: () => Promise<pricing.PricingConfig>; savePricingConfig: (config: unknown, email: string) => Promise<void> } };
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText, {
    module: target, exports: target.exports, Date, console,
    require: (name: string) => { if (!(name in modules)) throw new Error(`Unexpected dependency: ${name}`); return modules[name]; },
  });
  return target.exports;
}

test('Actual pricing service rejects bad values before a Firestore write', async () => {
  const writes: unknown[] = []; const actual = service({}, writes);
  for (const value of [0, -1, 350.5, NaN, Infinity, '350']) {
    await assert.rejects(actual.savePricingConfig({ stamp100Chennai: value }, 'admin@example.com'));
  }
  assert.equal(writes.length, 0);
  await actual.savePricingConfig({ stamp100Chennai: 400, notaryExtraFee: 0 }, 'admin@example.com');
  assert.equal(writes.length, 1);
  assert.equal((writes[0] as pricing.PricingConfig).stamp100Chennai, 400);
});

test('Actual pricing service does not silently replace corrupt saved pricing with defaults', async () => {
  await assert.rejects(service({ stamp100Chennai: 0 }, []).getPricingConfig());
  await assert.rejects(service({ notaryExtraFee: Infinity }, []).getPricingConfig());
});

// Source checks, not Firebase emulator execution.
test('Draft Storage rules separate reads/deletes from new-file validation', () => {
  const source = readFileSync(new URL('../storage.rules', import.meta.url), 'utf8');
  const draft = source.slice(source.indexOf('match /drafts/{uid}/{file}'));
  const accessRule = draft.match(/allow read, delete:[^;]+;/)?.[0] || '';
  assert.match(accessRule, /request\.auth\.uid == uid/);
  assert.doesNotMatch(accessRule, /request\.resource/);
  assert.match(draft, /allow create, update:/);
  assert.match(draft, /request\.resource\.size <= 5 \* 1024 \* 1024/);
  assert.match(draft, /request\.resource\.contentType\.matches/);
});

test('Firestore rules reject invalid pricing even for direct admin writes', () => {
  const source = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  assert.match(source, /amount is int && amount >= minimum/);
  assert.match(source, /settingId != 'pricing' \|\| isValidPricing\(request\.resource\.data\)/);
  assert.match(source, /isValidPrice\(data\.stamp100Chennai, 150\)/);
  assert.match(source, /isValidPrice\(data\.stamp200TamilNadu, 300\)/);
  assert.match(source, /isValidPrice\(data\.notaryExtraFee, 0\)/);
});


test('Minimum valid packages cover stamp duty and courier and every breakdown sums correctly', () => {
  const minimum = { stamp100Chennai: 150, stamp100TamilNadu: 200, stamp200Chennai: 250, stamp200TamilNadu: 300, notaryExtraFee: 0 };
  for (const denomination of [100, 200] as const) {
    for (const location of ['Within Chennai', 'Within Tamil Nadu'] as const) {
      const result = pricing.calculateOrderPrice(minimum, denomination, location, false);
      const courier = location === 'Within Chennai' ? 50 : 100;
      const serviceFee = result.basePackagePrice - denomination - courier;
      assert.ok(serviceFee >= 0);
      assert.equal(denomination + courier + serviceFee + result.notaryFee, result.totalPayable);
    }
  }
  for (const [key, value] of Object.entries(minimum).filter(([key]) => key !== 'notaryExtraFee')) {
    assert.throws(() => pricing.validatePricingConfig({ ...minimum, [key]: value - 1 }));
  }
});

test('Pricing read failures cannot present a confirmed default price', async () => {
  await assert.rejects(service({}, [], true).getPricingConfig(), /Network failure/);
});
