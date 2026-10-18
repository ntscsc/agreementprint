import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { customIdentity, customError } from '@/lib/custom-request-server';
import { ApiInputError, readJsonObject } from '@/lib/api-input';
import { approveCreditRefund, reconcileCreditRefund, rejectCreditRefund } from '@/lib/credit-refunds';
import { getPhonePeCredentials } from '@/lib/phonepe';

export const runtime = 'nodejs';
export const maxDuration = 300;
export async function GET(req: NextRequest) {
  try {
    if (!(await customIdentity(req)).admin) throw new ApiInputError('Administrator access required.', 403);
    const docs = await getAdminDb().collection('creditRefundRequests').where('state', 'in', ['Awaiting approval', 'Processing']).limit(100).get();
    return NextResponse.json({ refundsAvailable: getPhonePeCredentials()?.production === true, requests: docs.docs.map(doc => doc.data()).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return customError(error); }
}
export async function PATCH(req: NextRequest) {
  try {
    const identity = await customIdentity(req);
    if (!identity.admin) throw new ApiInputError('Administrator access required.', 403);
    const body = await readJsonObject(req);
    if (!/^CREF[a-f0-9]{32}$/.test(body.requestId || '')) throw new ApiInputError('Invalid refund reference.');
    const record = (await getAdminDb().collection('creditRefundRequests').doc(body.requestId).get()).data();
    if (!record) throw new ApiInputError('Refund request not found.', 404);
    if (body.action !== 'status' && record.source !== 'Order cancellation') throw new ApiInputError('This legacy credit refund is retained for admin reconciliation. New refund processing is available for cancelled orders only.', 409);
    if (body.action === 'status') await reconcileCreditRefund(body.requestId);
    else {
      if (typeof body.notes !== 'string' || body.notes.trim().length < 5 || body.notes.length > 2000) throw new ApiInputError('Enter the refund-policy review outcome.');
      if (body.action === 'approve' && body.policyConfirmed === true) await approveCreditRefund(body.requestId, identity.uid, body.notes.trim());
      else if (body.action === 'decline') await rejectCreditRefund(body.requestId, identity.uid, body.notes.trim());
      else throw new ApiInputError('Confirm refund-policy eligibility before approving.');
    }
    return NextResponse.json({ saved: true });
  } catch (error) {
    if (!(error instanceof ApiInputError)) {
      console.error('Credit refund approval or recovery failed:', error);
      // These errors contain curated messages, never raw provider bodies or auth data.
      const message = error instanceof Error && /^PhonePe |^Unable to verify refund|^Online refunds/.test(error.message)
        ? error.message : 'The refund could not be confirmed. The refund remains unconfirmed. Check refund status before retrying the same request.';
      return NextResponse.json({ error: message }, { status: 502 });
    }
    return customError(error);
  }
}
