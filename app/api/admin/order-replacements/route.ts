import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { customIdentity, customError } from '@/lib/custom-request-server';
import { ApiInputError, readJsonObject, validDocumentId } from '@/lib/api-input';
import { getCheckoutCredentials, getGatewayAccessToken, fetchGatewayOrderStatus } from '@/lib/payment-gateway';
import { abandonReplacement, settleReplacement } from '@/lib/order-replacement';

export async function POST(req: NextRequest) {
  try {
    const identity = await customIdentity(req);
    if (!identity.admin) throw new ApiInputError('Administrator access required.', 403);
    const body = await readJsonObject(req);
    if (!validDocumentId(body.orderId)) throw new ApiInputError('Invalid order reference.');
    const db = getAdminDb(), originalRef = db.collection('orders').doc(body.orderId);
    const original = (await originalRef.get()).data();
    if (!original?.replacementPendingId) throw new ApiInputError('No unpaid replacement is pending. Refresh the order.', 409);
    const requestId = original.replacementPendingId, ref = db.collection('orderReplacements').doc(requestId);
    const record = (await ref.get()).data();
    if (!record || record.originalOrderId !== body.orderId || record.ownerUid !== original.ownerUid) throw new ApiInputError('Replacement details need review.', 409);
    if (record.checkoutLeaseUntil > Date.now()) throw new ApiInputError('Checkout is opening. Please wait and try again.', 409);
    if (!['Awaiting payment', 'Ready', 'Failed'].includes(record.state)) throw new ApiInputError('This replacement cannot be cancelled.', 409);
    if (record.checkoutStartedAt) {
      const credentials = await getCheckoutCredentials(db, record.gateway ?? 'PhonePe');
      if (!credentials) throw new ApiInputError('Payment verification is unavailable. The order remains on hold.', 503);
      const status = await fetchGatewayOrderStatus(credentials, await getGatewayAccessToken(credentials), requestId);
      if (status.state === 'COMPLETED') {
        await settleReplacement(requestId, 'COMPLETED', status.amount, status.paymentDetails?.find(payment => payment.state === 'COMPLETED')?.transactionId);
        return NextResponse.json({ order: (await originalRef.get()).data(), message: 'Replacement payment is confirmed. The replacement order is ready for verification.' });
      }

    }
    const order = await abandonReplacement(body.orderId, identity.uid, true);
    return NextResponse.json({ order, message: 'Replacement abandoned. The original paid order is released. Any late replacement payment will be flagged for refund review.' });
  } catch (error) { return customError(error); }
}
