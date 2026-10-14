import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { createPrivateDownloadUrl } from '@/lib/file-storage';
import { ApiInputError } from '@/lib/api-input';
import { customIdentity, customError, requestReference } from '@/lib/custom-request-server';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  try {
    const identity = await customIdentity(req);
    const id = requestReference(req.nextUrl.searchParams.get('requestId')), sampleId = req.nextUrl.searchParams.get('sampleId') ?? '';
    if (!/^sample-[1-3]$/.test(sampleId)) throw new ApiInputError('Invalid sample reference.');
    const data = (await getAdminDb().collection('customAgreementRequests').doc(id).get()).data();
    if (!data || (!identity.admin && data.ownerUid !== identity.uid)) throw new ApiInputError('Sample not found.', 404);
    if ((data.verificationStatus !== 'Validated' && data.scanStatus !== 'Clean') || !data.files[sampleId]) throw new ApiInputError('Samples are unavailable until verification completes.', 409);
    const sample = data.files[sampleId];
    const url = await createPrivateDownloadUrl(sample.path, sample.name);
    return NextResponse.json({ url }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return customError(error); }
}
