import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Temporary mitigation for GHSA-vfj7-8cjw-p6xm: upstream 3.0.3 has no fixed release.
// Cap parser AST depth before recursive compilation/stringification can exhaust the stack.
const require = createRequire(import.meta.url);
let packagePath;
try { packagePath = require.resolve('braces/package.json'); }
catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
  // Production-only installs omit the development tooling that brings in braces.
  console.log('braces is absent; no development dependency patch is needed.');
  process.exit(0);
}
const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
if (pkg.version !== '3.0.3') throw new Error('Review/remove the braces mitigation for the new upstream version.');
const target = join(dirname(packagePath), 'lib/parse.js');
let source = readFileSync(target, 'utf8');
const marker = 'STAMPSURE_BRACES_DEPTH_LIMIT';
if (!source.includes(marker)) {
  const occurrences = source.match(/stack\.push\(block\);/g) ?? [];
  if (occurrences.length !== 2) throw new Error('Unexpected braces parser: refusing to apply an unverified patch.');
  source = source.replaceAll('stack.push(block);', `if (stack.length >= 64) throw new SyntaxError('Brace pattern nesting exceeds safe limit'); // ${marker}\n      stack.push(block);`);
  writeFileSync(target, source);
}
console.log('Applied braces nesting limit (upstream advisory still appears in npm audit).');
