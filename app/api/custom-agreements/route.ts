import { createHash, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminBucket } from '@/lib/firebase-admin';
import { ApiInputError } from '@/lib/api-input';
import { CustomRequest, CustomStatus, validateCustomInput, validateSample, canTransition, validDate } from '@/lib/custom-agreement';
import { customIdentity, customBody, customError, requestReference } from '@/lib/custom-request-server';
import { validateSampleBytes } from '@/lib/sample-validation';

export const runtime = 'nodejs';
export const maxDuration = 120;
const json = (data: unknown) => NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });

export async function GET(req: NextRequest) {
  try {
    const identity = await customIdentity(req), db = getAdminDb();
    const scope = req.nextUrl.searchParams.get('scope');
    if (scope === 'admin' && !identity.admin) throw new ApiInputError('Administrator access required.', 403);
    const base = db.collection('customAgreementRequests');
    const snapshot = await (scope === 'admin' ? base.orderBy('createdAt', 'desc') : base.where('ownerUid', '==', identity.uid).orderBy('createdAt', 'desc')).limit(100).get();
    const requests = snapshot.docs.map((doc) => {
      const data = doc.data();
      delete data.scanLeaseId; delete data.scanLeaseUntil;
      if (scope !== 'admin') { delete data.internalNotes; delete data.assignedTo; delete data.ownerUid; delete data.ownerEmail; delete data.scanHashes; delete data.sampleHashes; }
      return data;
    });
    return json({ requests });
  } catch (error) { return customError(error); }
}

export async function POST(req: NextRequest) {
  try {
    const identity = await customIdentity(req), body = await customBody(req), db = getAdminDb();
    const requestId = requestReference(body.requestId), requestRef = db.collection('customAgreementRequests').doc(requestId);
    if (body.action === 'create') {
      let details, samples;
      try {
        details = validateCustomInput(body.details);
        if (!Array.isArray(body.files) || body.files.length < 1 || body.files.length > 3) throw new Error('Choose one to three samples.');
        samples = body.files.map(validateSample);
      } catch (error) { throw new ApiInputError((error as Error).message); }
      const files = Object.fromEntries(samples.map((sample, index) => {
        const id = `sample-${index + 1}`;
        return [id, { ...sample, id, path: `custom-agreements/${identity.uid}/${requestId}/${id}` }];
      }));
      const now = Date.now(), day = Math.floor(now / 86_400_000), minute = Math.floor(now / 60_000);
      const userRef = db.collection('customAgreementLimits').doc(createHash('sha256').update(identity.uid).digest('hex'));
      const globalRef = db.collection('customAgreementLimits').doc('global');
      const result = await db.runTransaction(async (tx) => {
        const existing = await tx.get(requestRef), previous = await tx.get(userRef), global = await tx.get(globalRef);
        if (existing.exists) {
          const old = existing.data()!;
          if (old.ownerUid !== identity.uid) throw new ApiInputError('Request reference is unavailable.', 409);
          if (JSON.stringify(old.files) !== JSON.stringify(files)) throw new ApiInputError('Samples have changed. Start a new request.', 409);
          return old;
        }
        const userCount = previous.data()?.day === day ? previous.data()!.count : 0;
        const globalCount = global.data()?.minute === minute ? global.data()!.count : 0;
        if (userCount >= 5 || globalCount >= 30) throw new ApiInputError('Submission limit reached. Please try again later.', 429);
        const timestamp = new Date(now).toISOString();
        const record = { ...details, requestId, files, ownerUid: identity.uid, ownerEmail: identity.email, status: 'Uploading', createdAt: timestamp, updatedAt: timestamp };
        tx.create(requestRef, record);
        tx.set(userRef, { day, count: userCount + 1, expiresAt: new Date(now + 2 * 86_400_000) });
        tx.set(globalRef, { minute, count: globalCount + 1 });
        return record;
      });
      return json({ requestId, files: result.files, status: result.status });
    }
    if (body.action !== 'finalize') throw new ApiInputError('Invalid submission action.');
    const snap = await requestRef.get(), record = snap.data();
    if (!record || record.ownerUid !== identity.uid) throw new ApiInputError('Request not found.', 404);
    if (record.status !== 'Uploading') return json({ requestId, status: record.status });
    // A server lease serializes sample validation and prevents concurrent finalization.
    const leaseId = randomUUID();
    await db.runTransaction(async (tx) => {
      const current = (await tx.get(requestRef)).data()!;
      if (current.status !== 'Uploading' || current.scanLeaseUntil > Date.now()) throw new ApiInputError('Submission is already being verified. Refresh your requests shortly.', 409);
      tx.update(requestRef, { scanLeaseId: leaseId, scanLeaseUntil: Date.now() + 180_000 });
    });
    try {
      const hashes: Record<string, string> = {};
      for (const sample of Object.values(record.files) as CustomRequest['files'][string][]) {
        const file = getAdminBucket().file(sample.path);
        let metadata;
        try { [metadata] = await file.getMetadata(); } catch { throw new ApiInputError('A sample upload is incomplete. Retry the upload before submitting.'); }
        if (Number(metadata.size) !== sample.size || metadata.contentType !== sample.contentType) throw new ApiInputError('Uploaded sample metadata does not match the request.');
        // Firebase may mint a bearer download token during direct upload. Remove it;
        // subsequent access goes through the authorized, short-lived download endpoint.
        await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: null } });
        // Read the exact immutable generation checked above. Client updates/deletes are denied.
        const [bytes] = await getAdminBucket().file(sample.path, { generation: metadata.generation }).download();
        validateSampleBytes(bytes, sample.contentType);
        hashes[sample.id] = createHash('sha256').update(bytes).digest('hex');
      }
      await db.runTransaction(async (tx) => {
        const current = (await tx.get(requestRef)).data()!;
        if (current.status !== 'Uploading' || current.scanLeaseId !== leaseId) throw new ApiInputError('Verification expired. Please retry.', 409);
        tx.update(requestRef, { status: 'Submitted', verificationStatus: 'Validated', sampleHashes: hashes, updatedAt: new Date().toISOString(), scanLeaseUntil: 0 });
      });
      return json({ requestId, status: 'Submitted' });
    } finally {
      await db.runTransaction(async (tx) => {
        const current = (await tx.get(requestRef)).data();
        if (current?.scanLeaseId === leaseId) tx.update(requestRef, { scanLeaseUntil: 0 });
      });
    }
  } catch (error) { return customError(error); }
}

export async function PATCH(req: NextRequest) {
  try {
    const identity = await customIdentity(req), body = await customBody(req), db = getAdminDb();
    const requestId = requestReference(body.requestId), ref = db.collection('customAgreementRequests').doc(requestId);
    const logRef = db.collection('customAgreementAudit').doc(randomUUID());
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref), current = snap.data();
      if (!current || (!identity.admin && current.ownerUid !== identity.uid)) throw new ApiInputError('Request not found.', 404);
      const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (!identity.admin) {
        if (body.action === 'cancel' && ['Uploading', 'Submitted', 'Under Review', 'Clarification Required', 'Quote Sent'].includes(current.status)) updates.status = 'Cancelled';
        else if (body.action === 'reply' && current.status === 'Clarification Required') {
          if (typeof body.customerReply !== 'string' || body.customerReply.trim().length < 5 || body.customerReply.length > 3000) throw new ApiInputError('Enter a clarification between 5 and 3000 characters.');
          updates.customerReply = body.customerReply.trim(); updates.status = 'Under Review';
        } else throw new ApiInputError('This request cannot be changed at its current stage.', 409);
      } else {
        if (current.status === 'Uploading') throw new ApiInputError('Samples must finish verification before review.', 409);
        const status = body.status as CustomStatus;
        if (!canTransition(current.status, status)) throw new ApiInputError('Invalid status transition.', 409);
        updates.status = status;
        for (const [key, max] of [['internalNotes', 5000], ['assignedTo', 100], ['customerMessage', 3000]] as const) {
          if (body[key] !== undefined) {
            if (typeof body[key] !== 'string' || body[key].length > max) throw new ApiInputError(`Invalid ${key}.`);
            updates[key] = body[key].trim();
          }
        }
        if (body.quoteAmount !== undefined) {
          if (typeof body.quoteAmount !== 'number' || !Number.isSafeInteger(body.quoteAmount) || body.quoteAmount < 1 || body.quoteAmount > 1_000_000) throw new ApiInputError('Quote must be a whole-rupee amount between 1 and 1,000,000.');
          if (['Accepted', 'In Progress', 'Completed'].includes(current.status) && body.quoteAmount !== current.quoteAmount) throw new ApiInputError('An accepted quote cannot be changed.', 409);
          updates.quoteAmount = body.quoteAmount;
        }
        if (body.expectedDate !== undefined) {
          if (body.expectedDate !== '' && !validDate(body.expectedDate)) throw new ApiInputError('Invalid expected completion date.');
          updates.expectedDate = body.expectedDate;
        }
        if (status === 'Quote Sent' && !(updates.quoteAmount ?? current.quoteAmount)) throw new ApiInputError('Enter the quote before marking it sent.');
        if (status === 'Clarification Required' && !(updates.customerMessage ?? current.customerMessage)) throw new ApiInputError('Explain the clarification needed.');
        if (current.status === 'Quote Sent' && status === 'Accepted' && body.acceptanceConfirmed !== true) throw new ApiInputError('Confirm that the customer accepted the quote by contact.');
        if (current.status === 'Quote Sent' && status === 'Accepted') { updates.acceptedAt = new Date().toISOString(); updates.acceptanceRecordedBy = identity.uid; }
      }
      tx.update(ref, updates);
      tx.create(logRef, { requestId, actorUid: identity.uid, fromStatus: current.status, toStatus: updates.status ?? current.status, action: body.action ?? 'admin-update', createdAt: updates.updatedAt });
    });
    return json({ success: true });
  } catch (error) { return customError(error); }
}
