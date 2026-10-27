import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { customIdentity, customBody, customError } from '@/lib/custom-request-server';
import { ApiInputError, validDocumentId } from '@/lib/api-input';
import { gatewayCredentials, validRazorpaySignature, paymentReturnPath } from '@/lib/payment-gateway';
import { settleRazorpayCheckout } from '@/lib/gateway-settlement';
import { dismissRazorpayCheckout } from '@/lib/razorpay-dismissal';

export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  try {
    const identity = await customIdentity(req), body = await customBody(req);
    if (!validDocumentId(body.attempt)) throw new ApiInputError('Invalid payment reference.');
    const record = (await getAdminDb().collection('razorpayCheckouts').doc(body.attempt).get()).data();
    if (!record || record.ownerUid !== identity.uid) throw new ApiInputError('Payment not found.', 404);
    const credentials = gatewayCredentials('Razorpay');
    if (!credentials || credentials.keyId !== record.keyId || !record.razorpayOrderId) throw new ApiInputError('The existing checkout needs verification. Please contact support.', 409);
    let result: Record<string, unknown>;
    if (body.action === 'options') {
      if (/^CUSTOMPAY[a-f0-9]{32}$/.test(body.attempt)) {
        const attempt = (await getAdminDb().collection('customPhonepeAttempts').doc(body.attempt).get()).data();
        const request = attempt ? (await getAdminDb().collection('customAgreementRequests').doc(attempt.requestId).get()).data() : null;
        if (!request || ['Cancelled', 'Declined'].includes(request.status)) throw new ApiInputError('This request is closed. Return to My Requests.', 409);
      }
      if (!/^(CUSTOMPAY|REPLPAY|RZTEST)/.test(body.attempt)) {
        const attempt = (await getAdminDb().collection('phonepePaymentAttempts').doc(body.attempt).get()).data();
        const order = attempt ? (await getAdminDb().collection('orders').doc(attempt.orderId).get()).data() : null;
        if (order?.status === 'Cancelled') throw new ApiInputError('This order is cancelled. Return to My Orders.', 409);
      }
      if (/^REPLPAY[a-f0-9]{32}$/.test(body.attempt)) {
        const replacement = (await getAdminDb().collection('orderReplacements').doc(body.attempt).get()).data();
        if (!replacement || !['Awaiting payment', 'Ready'].includes(replacement.state)) throw new ApiInputError('This replacement checkout is closed. Return to My Orders.', 409);
      }
      result = { key: credentials.keyId, order_id: record.razorpayOrderId, razorpayOrderId: record.razorpayOrderId, amount: record.amount, currency: record.currency, returnUrl: paymentReturnPath(record.returnUrl), paid: record.state === 'COMPLETED' };
    } else if (body.action === 'dismiss') {
      result = await dismissRazorpayCheckout(body.attempt, identity.uid);
    } else if (body.action === 'verify' || body.action === 'status') {
      if (body.action === 'verify' && (!body.razorpay_order_id || !body.razorpay_payment_id || !body.razorpay_signature)) throw new ApiInputError('Payment ID, order ID and signature are required.', 400);
      if (body.action === 'verify' && (body.razorpay_order_id !== record.razorpayOrderId || typeof body.razorpay_payment_id !== 'string' || !/^pay_[A-Za-z0-9]+$/.test(body.razorpay_payment_id) || !validRazorpaySignature(`${record.razorpayOrderId}|${body.razorpay_payment_id}`, body.razorpay_signature, credentials.keySecret!))) throw new ApiInputError('Payment signature is invalid.', 400);
      result = await settleRazorpayCheckout(body.attempt);
    } else throw new ApiInputError('Invalid checkout action.');
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return customError(error); }
}
