import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
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
