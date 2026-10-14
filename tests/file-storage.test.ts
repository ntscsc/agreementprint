import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const require = createRequire(import.meta.url), ts = require('typescript');
class InputError extends Error { status: number; constructor(message: string, status = 400) { super(message); this.status = status; } }
function storageModule(storage: Record<string, any>, env: Record<string, string> = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'server-secret', SUPABASE_STORAGE_BUCKET: 'private-files' }) {
  const calls: any[] = [], target = { exports: {} as any };
  const source = readFileSync(new URL('../lib/file-storage.ts', import.meta.url), 'utf8');
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText, {
    module: target, exports: target.exports, Buffer, process: { env },
    require: (name: string) => {
      if (name === '@/lib/api-input') return { ApiInputError: InputError };
      if (name === '@/lib/custom-agreement') return { MAX_SAMPLE_SIZE: 10 * 1024 * 1024 };
      if (name === '@supabase/supabase-js') return { createClient: (url: string, key: string, options: any) => { calls.push({ url, key, options }); return { storage: { from: (bucket: string) => { calls.push({ bucket }); return storage; } } }; } };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return { api: target.exports, calls };
}
test('Supabase uploads are server-authenticated and never overwrite a stored sample', async () => {
  let uploaded: any;
  const h = storageModule({ upload: async (path: string, bytes: Buffer, options: any) => { uploaded = { path, bytes, options }; return { error: null }; } });
  const bytes = Buffer.from('%PDF-example');
  await h.api.uploadPrivateFile('custom-agreements/customer/request/sample-1', bytes, 'application/pdf');
  assert.equal(uploaded.options.upsert, false);
  assert.equal(uploaded.options.contentType, 'application/pdf');
  assert.equal(h.calls[0].options.auth.persistSession, false);
  assert.equal(h.calls[0].options.auth.autoRefreshToken, false);
  assert.equal(h.calls[1].bucket, 'private-files');
});
test('Duplicate uploads allow identical retries and reject content or MIME changes', async () => {
  let bytes = Buffer.from('%PDF-example'), type = 'application/pdf';
  const h = storageModule({ upload: async () => ({ error: { statusCode: '409', message: 'Duplicate' } }), download: async () => ({ data: new Blob([bytes], { type }), error: null }) });
  await h.api.uploadPrivateFile('sample', bytes, type);
  await assert.rejects(h.api.uploadPrivateFile('sample', Buffer.from('%PDF-changed'), type), (error: any) => error.status === 409);
  type = 'image/png';
  await assert.rejects(h.api.uploadPrivateFile('sample', bytes, 'application/pdf'), (error: any) => error.status === 409);
});
test('Private downloads use 60-second attachment links and a safe file name', async () => {
  let signed: any;
  const h = storageModule({ createSignedUrl: async (path: string, expires: number, options: any) => { signed = { path, expires, options }; return { data: { signedUrl: 'https://example.test/temporary' }, error: null }; } });
  assert.equal(await h.api.createPrivateDownloadUrl('sample', '../My sample.pdf'), 'https://example.test/temporary');
  assert.equal(signed.expires, 60);
  assert.equal(signed.options.download, '.._My_sample.pdf');
});
test('Missing files, empty or oversized files and storage failures cannot pass validation', async () => {
  for (const [response, status] of [
    [{ data: null, error: { statusCode: '404', message: 'Not found' } }, 400],
    [{ data: null, error: { statusCode: '500', message: 'Unavailable' } }, 503],
    [{ data: new Blob([]), error: null }, 400],
    [{ data: { size: 10 * 1024 * 1024 + 1 }, error: null }, 400],
  ] as const) {
    const h = storageModule({ download: async () => response });
    await assert.rejects(h.api.readPrivateFile('sample'), (error: any) => error.status === status);
  }
  const missing = storageModule({}, {});
  assert.throws(() => missing.api.getFileStorage(), (error: any) => error.status === 503);
  assert.equal(missing.calls.length, 0);
});
