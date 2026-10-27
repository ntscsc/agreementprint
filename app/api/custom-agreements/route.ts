import { EXTRA_COPY_PRICE } from '@/src/config/pricing';
import { createHash, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { ApiInputError } from '@/lib/api-input';
import { CustomRequest, CustomStatus, validateCustomInput, validateSample, canTransition, validDate, customQuoteStatus } from '@/lib/custom-agreement';
import { customIdentity, customBody, customError, requestReference } from '@/lib/custom-request-server';
import { readPrivateFile } from '@/lib/file-storage';
import { validateSampleBytes } from '@/lib/sample-validation';
import { allocateCustomReference } from '@/lib/custom-reference';
import { customStageFilters } from '@/lib/custom-workflow';
import { getCheckoutCredentials, getGatewayAccessToken, fetchGatewayOrderStatus } from '@/lib/payment-gateway';
import { settleCustomPayment } from '@/lib/custom-payment';

export const runtime = 'nodejs';
export const maxDuration = 120;
const json = (data: unknown) => NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });

export async function GET(req: NextRequest) {
  try {
    const identity = await customIdentity(req), db = getAdminDb();
    const scope = req.nextUrl.searchParams.get('scope');
    if (scope === 'admin' && !identity.admin) throw new ApiInputError('Administrator access required.', 403);
    const base = db.collection('customAgreementRequests');
    const requestedId = req.nextUrl.searchParams.get('requestId');
    const selected = requestedId ? await base.doc(requestReference(requestedId)).get() : null;
    if (selected && !selected.exists) throw new ApiInputError('Custom request not found.', 404);
    if (selected && scope !== 'admin' && selected.data()?.ownerUid !== identity.uid) throw new ApiInputError('Custom request not found.', 404);
    let query = scope === 'admin' ? base.orderBy('createdAt', 'desc') : base.where('ownerUid', '==', identity.uid).orderBy('createdAt', 'desc');
    const stage = req.nextUrl.searchParams.get('stage') || 'ALL';
    const filter = customStageFilters.find(f => f.value === stage);
    if (!filter) throw new ApiInputError('Invalid work stage.');
    if (scope === 'admin' && filter.statuses.length) query = query.where('status', 'in', filter.statuses);
    for (const [param, operator] of [['from', '>='], ['to', '<']] as const) {
      const date = req.nextUrl.searchParams.get(param);
      if (date && !validDate(date)) throw new ApiInputError('Invalid date filter.');
      if (date) query = query.where('createdAt', operator, new Date(Date.parse(`${date}T00:00:00+05:30`) + (param === 'to' ? 86400000 : 0)).toISOString());
    }
    const cursor = req.nextUrl.searchParams.get('cursor');
    if (cursor && !selected) {
      const after = await base.doc(requestReference(cursor)).get();
      if (!after.exists || (scope !== 'admin' && after.data()?.ownerUid !== identity.uid)) throw new ApiInputError('Invalid page cursor.');
      query = query.startAfter(after);
    }
    const pageSize = 25;
    const snapshot = selected ? { docs: [selected] } : await query.limit(pageSize + 1).get();
    const page = snapshot.docs.slice(0, pageSize);
    const missingReferences = page.filter(doc => !doc.data()?.publicReference);
    const references: Record<string, string> = missingReferences.length ? await db.runTransaction(async tx => {
      const current = await Promise.all(missingReferences.map(doc => tx.get(base.doc(doc.id))));
      const missing = current.filter(doc => doc.exists && !doc.data()?.publicReference);
      const mapped: Record<string, string> = Object.fromEntries(current.filter(doc => doc.data()?.publicReference).map(doc => [doc.id, doc.data()!.publicReference]));
      if (missing.length) {
        const allocation = await allocateCustomReference(db, tx, missing.length);
        allocation.write();
        missing.forEach((doc, index) => { mapped[doc.id] = allocation.references[index]; tx.update(base.doc(doc.id), { publicReference: mapped[doc.id] }); });
      }
      return mapped;
    }) : {};
    const requests = page.map((doc) => {
      const data = doc.data();
      if (!data) throw new ApiInputError('Custom request not found.', 404);
      if (!data.publicReference) data.publicReference = references[doc.id];
      data.status = customQuoteStatus(data);
      delete data.scanLeaseId; delete data.scanLeaseUntil;
      if (scope !== 'admin') { delete data.internalNotes; delete data.assignedTo; delete data.ownerUid; delete data.ownerEmail; delete data.scanHashes; delete data.sampleHashes; if (data.documents) data.documents = data.documents.filter((d: { kind: string; publishedAt?: string }) => d.kind === 'final' || d.publishedAt); }
      return data;
    });
    return json({ requests, nextCursor: !selected && snapshot.docs.length > pageSize ? page.at(-1)?.id : null });
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
        if (!identity.admin && userCount >= 5) {
          const reset = new Date((day + 1) * 86_400_000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
          throw new ApiInputError(`You have reached the daily limit of 5 new requests. You can submit again after ${reset} IST. Existing requests can still be viewed and updated. Contact our team if you need more requests.`, 429);
        }
        if (globalCount >= 30) throw new ApiInputError(`Many requests are being submitted right now. Please retry in ${Math.max(1, Math.ceil(((minute + 1) * 60_000 - now) / 1000))} seconds.`, 429);
        const timestamp = new Date(now).toISOString();
        const allocation = await allocateCustomReference(db, tx);
        const record = { ...details, requestId, publicReference: allocation.reference, files, ownerUid: identity.uid, ownerEmail: identity.email, status: 'Uploading', createdAt: timestamp, updatedAt: timestamp };
        allocation.write();
        tx.create(requestRef, record);
        tx.set(userRef, { day, count: userCount + 1, expiresAt: new Date(now + 2 * 86_400_000) });
        tx.set(globalRef, { minute, count: globalCount + 1 });
        return record;
      });
      return json({ requestId, publicReference: result.publicReference, files: result.files, status: result.status });
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
        const { bytes, contentType } = await readPrivateFile(sample.path);
        if (bytes.length !== sample.size || contentType !== sample.contentType) throw new ApiInputError('Uploaded sample does not match the request.');
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
    let safeCloseMerchant = '';
    let verifiedFailedUpdateAt = '', verifiedOriginalUpdateAt = '', verifiedFailedMerchant = '';
    const closingRequest = body.action === 'cancel' || identity.admin && ['Cancelled', 'Declined'].includes(String(body.status));
    if (closingRequest) {
      const before = (await ref.get()).data();
      if (!before || (!identity.admin && before.ownerUid !== identity.uid) || body.action === 'cancel' && before.ownerUid !== identity.uid) throw new ApiInputError('Request not found.', 404);
      if (before.payment?.status === 'Pending' && before.payment.merchantOrderId) {
        const attempt = (await db.collection('customPhonepeAttempts').doc(before.payment.merchantOrderId).get()).data();
        if (!attempt || attempt.ownerUid !== before.ownerUid || attempt.requestId !== requestId || attempt.amount !== before.quoteAmount) throw new ApiInputError('This payment needs verification before closing the request.', 409);
        const credentials = await getCheckoutCredentials(db, attempt?.gateway || 'PhonePe');
        if (!credentials) throw new ApiInputError('Payment verification is unavailable. Please try again.', 503);
        const result = await fetchGatewayOrderStatus(credentials, await getGatewayAccessToken(credentials), before.payment.merchantOrderId, true);
        if (result.state === 'COMPLETED' || ['FAILED', 'EXPIRED'].includes(result.state || '')) {
          await settleCustomPayment(before.payment.merchantOrderId, result.amount, result.state!, result.paymentDetails?.find(p => p.state === 'COMPLETED')?.transactionId);
          if (result.state === 'COMPLETED') throw new ApiInputError('Payment was received. Contact our team for cancellation and refund review.', 409);
          const verified = (await ref.get()).data();
          if (verified && verified.payment?.merchantOrderId === before.payment.merchantOrderId && verified.payment.status === 'Failed') { verifiedOriginalUpdateAt = before.updatedAt; verifiedFailedUpdateAt = verified.updatedAt; verifiedFailedMerchant = before.payment.merchantOrderId; }
        } else if (credentials.gateway === 'Razorpay' && result.retrySafe === true) safeCloseMerchant = before.payment.merchantOrderId;
        else throw new ApiInputError('A payment is still processing. Check its status before closing the request.', 409);
      }
    }
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref), current = snap.data();
      if (!current || (!identity.admin && current.ownerUid !== identity.uid)) throw new ApiInputError('Request not found.', 404);
      const customerAction = ['cancel', 'reply', 'approve-draft', 'request-revision'].includes(String(body.action));
      if (customerAction && current.ownerUid !== identity.uid) throw new ApiInputError('Request not found.', 404);
      const ownVerifiedFailure = closingRequest && verifiedFailedMerchant && current.payment?.merchantOrderId === verifiedFailedMerchant && current.payment.status === 'Failed' && body.updatedAt === verifiedOriginalUpdateAt && current.updatedAt === verifiedFailedUpdateAt;
      if (body.updatedAt && body.updatedAt !== current.updatedAt && !ownVerifiedFailure) throw new ApiInputError('This request changed. Refresh before saving.', 409);
      current.status = customQuoteStatus(current);
      const updates: Record<string, unknown> = { updatedAt: new Date(Math.max(Date.now(), (Date.parse(current.updatedAt) || 0) + 1)).toISOString() };
      const safeUnpaidClosure = safeCloseMerchant && current.payment?.merchantOrderId === safeCloseMerchant && closingRequest && body.quoteAmount === undefined && body.quoteBreakdown === undefined && body.quoteValidUntil === undefined;
      if (current.payment?.status === 'Pending' && !safeUnpaidClosure && (!identity.admin || body.status !== current.status || body.quoteAmount !== undefined || body.quoteBreakdown !== undefined || body.quoteValidUntil !== undefined)) throw new ApiInputError('A payment is pending. Check its status before changing the workflow or quote.', 409);
      if (customerAction || !identity.admin) {
        if (['approve-draft', 'request-revision'].includes(String(body.action))) {
          const document = current.documents?.find((d: { id: string; kind: string }) => d.id === body.documentId && d.kind === 'draft');
          if (current.status !== 'Awaiting Approval' || !document || current.customerApproval?.documentId !== document.id) throw new ApiInputError('This draft is no longer awaiting approval.', 409);
          if (current.customerApproval?.status !== 'Pending') throw new ApiInputError('Your response is already recorded.', 409);
          if (body.action === 'request-revision' && (typeof body.customerReply !== 'string' || body.customerReply.trim().length < 5 || body.customerReply.length > 3000)) throw new ApiInputError('Describe the requested changes (5–3000 characters).');
          updates.customerApproval = { documentId: document.id, status: body.action === 'approve-draft' ? 'Approved' : 'Changes requested', at: updates.updatedAt, ...(body.action === 'request-revision' ? { message: (body.customerReply as string).trim() } : {}) };
        } else if (body.action === 'cancel' && ['Uploading', 'Submitted', 'Under Review', 'Clarification Required', 'Quote Sent', 'Quoted / Awaiting Payment'].includes(current.status)) updates.status = 'Cancelled';
        else if (body.action === 'reply' && current.status === 'Clarification Required') {
          if (typeof body.customerReply !== 'string' || body.customerReply.trim().length < 5 || body.customerReply.length > 3000) throw new ApiInputError('Enter a clarification between 5 and 3000 characters.');
          updates.customerReply = body.customerReply.trim(); updates.status = 'Under Review';
        } else throw new ApiInputError('This request cannot be changed at its current stage.', 409);
      } else {
        if (current.status === 'Uploading') throw new ApiInputError('Samples must finish verification before review.', 409);
        const status = body.status as CustomStatus;
        if (['In Progress', 'Awaiting Approval', 'Ready', 'Dispatched', 'Completed'].includes(status) && current.payment?.status !== 'Paid') throw new ApiInputError('Payment must be confirmed before preparing or completing this request.', 409);
        if (current.payment?.status === 'Paid' && ['Submitted', 'Under Review', 'Quote Sent', 'Quoted / Awaiting Payment'].includes(status)) throw new ApiInputError('A paid request cannot be returned to awaiting payment.', 409);
        if (!canTransition(current.status, status)) throw new ApiInputError('Invalid status transition.', 409);
        updates.status = status === 'Quote Sent' ? 'Quoted / Awaiting Payment' : status;
        if (status === 'Awaiting Approval' && current.status !== status) {
          const draft = [...(current.documents || [])].reverse().find(d => d.kind === 'draft');
          if (!draft) throw new ApiInputError('Upload a draft before requesting customer approval.', 409);
          updates.customerApproval = { status: 'Pending', documentId: draft.id, at: updates.updatedAt };
          updates.documents = current.documents.map((d: { id: string }) => d.id === draft.id ? { ...d, publishedAt: updates.updatedAt } : d);
        }
        if (status === 'Ready' && current.status !== status) {
          if (current.customerApproval?.status !== 'Approved') throw new ApiInputError('The customer must approve the current draft first.', 409);
          const latest = [...(current.documents || [])].reverse().find(d => d.kind === 'draft');
          if (latest?.id !== current.customerApproval.documentId) throw new ApiInputError('Approval must match the latest draft.', 409);
        }
        if (status === 'Dispatched' && current.status !== status) {
          if (typeof body.courierName !== 'string' || !body.courierName.trim() || body.courierName.length > 100 || typeof body.trackingNumber !== 'string' || !body.trackingNumber.trim() || body.trackingNumber.length > 150) throw new ApiInputError('Enter the courier partner and consignment number before dispatch.', 409);
          if (current.customerApproval?.status !== 'Approved') throw new ApiInputError('Customer draft approval is required before dispatch.', 409);
          updates.courier = { courierName: body.courierName.trim(), trackingNumber: body.trackingNumber.trim(), dispatchedAt: updates.updatedAt };
        }
        if (status === 'Completed' && current.status !== status) {
          if (!current.courier?.courierName || !current.courier?.trackingNumber || body.deliveryConfirmed !== true) throw new ApiInputError('Confirm courier delivery before completing this request.', 409);
          updates.deliveredAt = updates.updatedAt;
        }
        for (const [key, max] of [['internalNotes', 5000], ['assignedTo', 100], ['customerMessage', 3000]] as const) {
          if (body[key] !== undefined) {
            if (typeof body[key] !== 'string' || body[key].length > max) throw new ApiInputError(`Invalid ${key}.`);
            updates[key] = body[key].trim();
          }
        }
        if (body.quoteAmount !== undefined) {
          if (typeof body.quoteAmount !== 'number' || !Number.isSafeInteger(body.quoteAmount) || body.quoteAmount < 1 || body.quoteAmount > 1_000_000) throw new ApiInputError('Quote must be a whole-rupee amount between 1 and 1,000,000.');
          const extraCopyFee = (current.extraCopies ?? 0) * EXTRA_COPY_PRICE;
          const baseAmount = current.quoteBaseAmount ?? current.quoteAmount;
          if ((current.payment?.status === 'Paid' || ['Accepted', 'In Progress', 'Awaiting Approval', 'Ready', 'Dispatched', 'Completed'].includes(current.status)) && body.quoteAmount !== baseAmount) throw new ApiInputError('An accepted quote cannot be changed.', 409);
          const total = body.quoteAmount + extraCopyFee;
          if (total > 1_000_000) throw new ApiInputError('Quote including extra copies must not exceed 1,000,000 rupees.');
          updates.quoteBaseAmount = body.quoteAmount;
          updates.extraCopyFee = extraCopyFee;
          updates.quoteAmount = total;
          if (current.quoteBreakdown && body.quoteBreakdown === undefined && body.quoteAmount !== baseAmount) updates.quoteBreakdown = null;
          if (body.quoteBreakdown !== undefined) {
            const breakdown = body.quoteBreakdown as Record<string, unknown>;
            if (!breakdown || typeof breakdown !== 'object' || ['drafting', 'stampPaper', 'notary', 'delivery'].some(k => !Number.isSafeInteger(breakdown[k]) || Number(breakdown[k]) < 0) || Object.values(breakdown).reduce<number>((sum, value) => sum + Number(value), 0) !== body.quoteAmount) throw new ApiInputError('Quote items must be non-negative whole rupees and equal the base quote.');
            updates.quoteBreakdown = Object.fromEntries(['drafting', 'stampPaper', 'notary', 'delivery'].map(k => [k, breakdown[k]]));
            if ((current.payment?.status === 'Paid' || ['Accepted', 'In Progress', 'Awaiting Approval', 'Ready', 'Dispatched', 'Completed'].includes(current.status)) && JSON.stringify(updates.quoteBreakdown) !== JSON.stringify(current.quoteBreakdown)) throw new ApiInputError('An accepted quote breakdown cannot be changed.', 409);
          }
          if (['Submitted', 'Under Review'].includes(status)) updates.status = 'Quoted / Awaiting Payment';
        }
        if (body.expectedDate !== undefined) {
          if (body.expectedDate !== '' && !validDate(body.expectedDate)) throw new ApiInputError('Invalid expected completion date.');
          updates.expectedDate = body.expectedDate;
          if (body.expectedDate !== current.expectedDate) {
            if (current.expectedDate && (typeof body.deadlineReason !== 'string' || body.deadlineReason.trim().length < 5 || body.deadlineReason.length > 1000)) throw new ApiInputError('Explain the revised committed date (5–1000 characters).');
            updates.deadlineHistory = [...(current.deadlineHistory || []), { date: body.expectedDate, previousDate: current.expectedDate || '', reason: String(body.deadlineReason || 'Initial commitment').trim(), at: updates.updatedAt }];
          }
        }
        if (body.quoteValidUntil !== undefined) {
          if (body.quoteValidUntil !== '' && !validDate(body.quoteValidUntil)) throw new ApiInputError('Invalid quote validity date.');
          if ((current.payment?.status === 'Paid' || ['Accepted', 'In Progress', 'Awaiting Approval', 'Ready', 'Dispatched', 'Completed'].includes(current.status)) && body.quoteValidUntil !== (current.quoteValidUntil || '')) throw new ApiInputError('An accepted quote cannot be changed.', 409);
          updates.quoteValidUntil = body.quoteValidUntil;
        }
        const nextBreakdown = 'quoteBreakdown' in updates ? updates.quoteBreakdown : current.quoteBreakdown;
        if (body.quoteAmount !== undefined && (updates.quoteAmount !== current.quoteAmount || JSON.stringify(nextBreakdown) !== JSON.stringify(current.quoteBreakdown) || (updates.quoteValidUntil ?? current.quoteValidUntil) !== current.quoteValidUntil)) {
          const history = current.quoteHistory || (current.quoteAmount ? [{ at: current.updatedAt, amount: current.quoteAmount, baseAmount: current.quoteBaseAmount ?? current.quoteAmount, extraCopyFee: current.extraCopyFee ?? 0, validUntil: current.quoteValidUntil || '', ...(current.quoteBreakdown ? { breakdown: current.quoteBreakdown } : {}) }] : []);
          updates.quoteHistory = [...history, { at: updates.updatedAt, amount: updates.quoteAmount, baseAmount: updates.quoteBaseAmount, extraCopyFee: updates.extraCopyFee, validUntil: updates.quoteValidUntil ?? current.quoteValidUntil ?? '', ...(nextBreakdown ? { breakdown: nextBreakdown } : {}) }];
        }
        if (['Quote Sent', 'Quoted / Awaiting Payment'].includes(status) && !(updates.quoteAmount ?? current.quoteAmount)) throw new ApiInputError('Enter the quote before marking it sent.');
        if (status === 'Clarification Required' && !(updates.customerMessage ?? current.customerMessage)) throw new ApiInputError('Explain the clarification needed.');
        if (['Quote Sent', 'Quoted / Awaiting Payment'].includes(current.status) && status === 'Accepted' && body.acceptanceConfirmed !== true) throw new ApiInputError('Confirm that the customer accepted the quote by contact.');
        if (['Quote Sent', 'Quoted / Awaiting Payment'].includes(current.status) && status === 'Accepted') { updates.acceptedAt = new Date().toISOString(); updates.acceptanceRecordedBy = identity.uid; }
      }
      if (updates.status && updates.status !== current.status) updates.stageChangedAt = updates.updatedAt;
      tx.update(ref, updates);
      tx.create(logRef, { requestId, actorUid: identity.uid, fromStatus: current.status, toStatus: updates.status ?? current.status, action: body.action ?? 'admin-update', createdAt: updates.updatedAt, changes: updates });
    });
    return json({ success: true });
  } catch (error) { return customError(error); }
}
