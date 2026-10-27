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
    const documentId = req.nextUrl.searchParams.get('documentId');
    if (!documentId && !/^sample-[1-3]$/.test(sampleId)) throw new ApiInputError('Invalid sample reference.');
    const data = (await getAdminDb().collection('customAgreementRequests').doc(id).get()).data();
    if (!data || (!identity.admin && data.ownerUid !== identity.uid)) throw new ApiInputError('Sample not found.', 404);
    const sample = documentId ? data.documents?.find((d: { id: string }) => d.id === documentId) : data.files?.[sampleId];
    if (documentId && sample?.kind === 'draft' && !identity.admin && !sample.publishedAt) throw new ApiInputError('Draft not shared for approval yet.', 404);
    if (!sample || (!documentId && data.verificationStatus !== 'Validated' && data.scanStatus !== 'Clean')) throw new ApiInputError('The file is unavailable until verification completes.', 409);
    const inline = req.nextUrl.searchParams.get('preview') === '1';
    if (inline && !['application/pdf', 'image/jpeg', 'image/png'].includes(sample.contentType)) throw new ApiInputError('Preview is available for PDFs and images.');
    const url = await createPrivateDownloadUrl(sample.path, sample.name, inline);
    return NextResponse.json({ url }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return customError(error); }
}
