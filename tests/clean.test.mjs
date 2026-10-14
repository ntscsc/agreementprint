import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

test('clean removes only its project build output, works from another cwd, and is repeatable', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'stampsure-clean-'));
  try {
    await mkdir(join(fixture, 'scripts'));
    await mkdir(join(fixture, '.next', 'cache'), { recursive: true });
    await copyFile(new URL('../scripts/clean.mjs', import.meta.url), join(fixture, 'scripts', 'clean.mjs'));
    await writeFile(join(fixture, '.next', 'cache', 'build'), 'generated');
    await writeFile(join(fixture, 'source.ts'), 'keep');
    for (let run = 0; run < 2; run++) {
      execFileSync(process.execPath, [join(fixture, 'scripts', 'clean.mjs')], { cwd: tmpdir() });
      await assert.rejects(access(join(fixture, '.next')), { code: 'ENOENT' });
      assert.equal(await readFile(join(fixture, 'source.ts'), 'utf8'), 'keep');
    }
  } finally {
    // Only delete the exact temporary fixture created above.
    await rm(fixture, { recursive: true, force: true });
  }
});
