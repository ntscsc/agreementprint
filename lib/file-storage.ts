import { createClient } from '@supabase/supabase-js';
import { ApiInputError } from '@/lib/api-input';
import { MAX_SAMPLE_SIZE } from '@/lib/custom-agreement';

export function getFileStorage() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim();
  if (!url || !key || !bucket) throw new ApiInputError('File storage is not configured. Please contact our team.', 503);
  // This module is used only by server routes. Never send the secret key to a browser.
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from(bucket);
}

export async function readPrivateFile(path: string): Promise<{ bytes: Buffer; contentType: string }> {
  const { data, error } = await getFileStorage().download(path);
  if (error || !data) {
    if (error && (Number(error.statusCode) === 404 || /not found/i.test(error.message))) throw new ApiInputError('A sample upload is incomplete. Retry the upload before submitting.');
    throw new ApiInputError('Your file could not be read. Please try again.', 503);
  }
  if (data.size < 1 || data.size > MAX_SAMPLE_SIZE) throw new ApiInputError('Invalid sample file size.');
  return { bytes: Buffer.from(await data.arrayBuffer()), contentType: data.type };
}

export async function uploadPrivateFile(path: string, bytes: Buffer, contentType: string): Promise<void> {
  const { error } = await getFileStorage().upload(path, bytes, { contentType, upsert: false, cacheControl: '0' });
  if (!error) return;
  if (Number(error.statusCode) !== 409 && !/already exists/i.test(error.message)) throw new ApiInputError('Your file could not be uploaded. Please try again.', 503);
  // A retry can reuse exactly the same contents, but cannot overwrite an existing file.
  const existing = await readPrivateFile(path);
  if (existing.contentType !== contentType || !existing.bytes.equals(bytes)) throw new ApiInputError('This sample has already been uploaded with different contents.', 409);
}

export async function createPrivateDownloadUrl(path: string, fileName: string): Promise<string> {
  const name = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const { data, error } = await getFileStorage().createSignedUrl(path, 60, { download: name });
  if (error || !data?.signedUrl) throw new ApiInputError('Your download could not be prepared. Please try again.', 503);
  return data.signedUrl;
}
