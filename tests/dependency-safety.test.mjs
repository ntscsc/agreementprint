import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
test('Firebase Auth loads and JWKS verifies signatures without require(ESM) support', () => {
  execFileSync(process.execPath, ['--no-experimental-require-module', '-e', `
    const assert = require('node:assert/strict');
    const { createRequire } = require('node:module');
    const { generateKeyPairSync, sign, verify } = require('node:crypto');
    const { getAuth } = require('firebase-admin/auth');
    assert.equal(typeof getAuth, 'function');
    const authRequire = createRequire(require.resolve('firebase-admin/auth'));
    const jwksClient = authRequire('jwks-rsa');
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'regression-key', alg: 'RS256', use: 'sig' };
    const client = jwksClient({ jwksUri: 'https://unused.example/jwks', getKeysInterceptor: async () => [jwk] });
    (async () => {
      const key = await client.getSigningKey('regression-key');
      const payload = Buffer.from('Firebase signing key compatibility test');
      const signature = sign('RSA-SHA256', payload, privateKey);
      assert.equal(verify('RSA-SHA256', payload, key.getPublicKey(), signature), true);
      assert.equal(verify('RSA-SHA256', Buffer.from('tampered'), key.getPublicKey(), signature), false);
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `], { stdio: 'pipe', timeout: 15000 });
});
test('braces preserves normal glob expansion and rejects malicious nesting without stack exhaustion', () => {
  execFileSync(process.execPath, ['scripts/patch-braces.mjs']);
  const braces = require('braces');
  assert.deepEqual(braces.expand('file-{a,b}.ts'), ['file-a.ts', 'file-b.ts']);
  assert.deepEqual(braces.expand('{1..3}'), ['1', '2', '3']);
  for (const pattern of ['{'.repeat(1000) + 'a,b' + '}'.repeat(1000), '('.repeat(1000) + 'x' + ')'.repeat(1000)]) {
    for (const operation of [braces, braces.parse, braces.compile, braces.expand, braces.stringify]) {
      assert.throws(() => operation(pattern), (error) => error instanceof SyntaxError && /safe limit/.test(error.message));
    }
  }
});
