import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseIdToken } from '@/lib/firebase-admin';
import { ApiInputError, inputErrorStatus } from '@/lib/api-input';
import { isUserAdmin } from '@/src/config/admin';
export async function customIdentity(req: NextRequest) {
  const token = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new ApiInputError('Sign in to continue.', 401);
  const user = await verifyFirebaseIdToken(token);
  return { uid: user.uid, email: user.email ?? '', admin: isUserAdmin(user.email, user.email_verified === true) };
}
export function customError(error: unknown) {
  const status = inputErrorStatus(error) ?? 500;
  if (status === 500) console.error('Custom agreement request failed:', error);
  return NextResponse.json({ error: status === 401 ? 'Sign in again to continue.' : status === 500 ? 'Unable to process this request. Please try again.' : (error as Error).message }, { status, headers: { 'Cache-Control': 'no-store' } });
}
export async function customBody(req: NextRequest): Promise<Record<string, unknown>> {
  // Bounded JSON reads, including chunked requests without Content-Length.
  const reader = req.body?.getReader();
  if (!reader) throw new ApiInputError('Request details are required.');
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    length += value.length;
    if (length > 32 * 1024) { await reader.cancel(); throw new ApiInputError('Request details are too large.', 413); }
    chunks.push(value);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new ApiInputError('Supply a valid JSON object.'); }
}
export function requestReference(value: unknown): string {
  if (typeof value !== 'string' || !/^CUSTOM_[a-f0-9-]{36}$/.test(value)) throw new ApiInputError('Invalid request reference.');
  return value;
}
