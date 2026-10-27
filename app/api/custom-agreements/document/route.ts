import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { ApiInputError } from '@/lib/api-input';
import { customIdentity, customError, requestReference } from '@/lib/custom-request-server';
import { MAX_SAMPLE_SIZE, validateSample } from '@/lib/custom-agreement';
import { validateSampleBytes } from '@/lib/sample-validation';
import { uploadPrivateFile } from '@/lib/file-storage';

export const runtime = 'nodejs';
export const maxDuration = 120;
export async function POST(req: NextRequest) {
  try {
    const identity = await customIdentity(req);
    if (!identity.admin) throw new ApiInputError('Administrator access required.', 403);
    const requestId = requestReference(req.nextUrl.searchParams.get('requestId'));
    const kind = req.nextUrl.searchParams.get('kind');
    if (kind !== 'draft' && kind !== 'final') throw new ApiInputError('Choose a draft or final document.');
    const db = getAdminDb(), ref = db.collection('customAgreementRequests').doc(requestId);
    const before = (await ref.get()).data();
    if (!before) throw new ApiInputError('Request not found.', 404);
    if ((before.documents || []).length >= 50) throw new ApiInputError('Document version limit reached.', 409);
    if (before.payment?.status !== 'Paid' || !(kind === 'draft' ? ['In Progress'] : ['Ready']).includes(before.status)) throw new ApiInputError(kind === 'draft' ? 'Start drafting after payment before uploading a draft.' : 'Obtain customer approval and mark ready before uploading the final document.', 409);
    const reader = req.body?.getReader();
    if (!reader) throw new ApiInputError('Choose a document.');
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > MAX_SAMPLE_SIZE) { await reader.cancel(); throw new ApiInputError('Documents must be under 10 MB.', 413); } chunks.push(value); }
    let file;
    try { file = validateSample({ name: req.nextUrl.searchParams.get('name'), size, contentType: req.headers.get('content-type') }); }
    catch (error) { throw new ApiInputError((error as Error).message); }
    if (file.contentType !== 'application/pdf') throw new ApiInputError('Upload the draft or final document as a PDF.');
    const bytes = Buffer.concat(chunks); validateSampleBytes(bytes, file.contentType);
    const id = randomUUID(), path = `custom-documents/${requestId}/${id}`;
    await uploadPrivateFile(path, bytes, file.contentType);
    await db.runTransaction(async tx => {
      const current = (await tx.get(ref)).data();
      if (!current || current.updatedAt !== before.updatedAt) throw new ApiInputError('Request changed during upload. Refresh and retry.', 409);
      const documents = current.documents || [];
      if (documents.length >= 50) throw new ApiInputError('Document version limit reached.', 409);
      const at = new Date(Math.max(Date.now(), (Date.parse(current.updatedAt) || 0) + 1)).toISOString();
      const document = { ...file, id, path, kind, uploadedAt: at, version: documents.filter((d: { kind: string }) => d.kind === kind).length + 1 };
      tx.update(ref, { documents: [...documents, document], updatedAt: at });
      tx.create(db.collection('customAgreementAudit').doc(id), { requestId, actorUid: identity.uid, action: `upload-${kind}`, documentId: id, createdAt: at });
    });
    return NextResponse.json({ uploaded: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return customError(error); }
}
