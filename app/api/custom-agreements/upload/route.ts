import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { ApiInputError } from '@/lib/api-input';
import { uploadPrivateFile } from '@/lib/file-storage';
import { MAX_SAMPLE_SIZE } from '@/lib/custom-agreement';
import { customIdentity, customError, requestReference } from '@/lib/custom-request-server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const identity = await customIdentity(req);
    const requestId = requestReference(req.nextUrl.searchParams.get('requestId'));
    const sampleId = req.nextUrl.searchParams.get('sampleId') ?? '';
    if (!/^sample-[1-3]$/.test(sampleId)) throw new ApiInputError('Invalid sample reference.');
    const record = (await getAdminDb().collection('customAgreementRequests').doc(requestId).get()).data();
    if (!record || record.ownerUid !== identity.uid) throw new ApiInputError('Request not found.', 404);
    if (record.status !== 'Uploading' || record.scanLeaseUntil > Date.now()) throw new ApiInputError('This request is no longer accepting uploads.', 409);
    const sample = record.files?.[sampleId];
    const path = `custom-agreements/${identity.uid}/${requestId}/${sampleId}`;
    if (!sample || sample.path !== path || !Number.isSafeInteger(sample.size) || sample.size < 1 || sample.size > MAX_SAMPLE_SIZE) {
      throw new ApiInputError('Invalid reserved sample.');
    }
    if (req.headers.get('content-type') !== sample.contentType) throw new ApiInputError('Sample type does not match the request.');
    const reader = req.body?.getReader();
    if (!reader) throw new ApiInputError('Choose a sample file.');
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > sample.size) {
        await reader.cancel();
        throw new ApiInputError('Sample size does not match the request.', 413);
      }
      chunks.push(value);
    }
    if (length !== sample.size) throw new ApiInputError('Sample upload is incomplete. Please retry.');
    const bytes = Buffer.concat(chunks);
    await uploadPrivateFile(path, bytes, sample.contentType);
    return NextResponse.json({ uploaded: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return customError(error); }
}
