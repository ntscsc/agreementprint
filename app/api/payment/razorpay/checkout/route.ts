import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { customIdentity, customBody, customError } from '@/lib/custom-request-server';
import { ApiInputError, validDocumentId } from '@/lib/api-input';
import { gatewayCredentials, validRazorpaySignature, paymentReturnPath } from '@/lib/payment-gateway';
import { settleRazorpayCheckout } from '@/lib/gateway-settlement';

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
      result = { key: credentials.keyId, order_id: record.razorpayOrderId, razorpayOrderId: record.razorpayOrderId, amount: record.amount, currency: record.currency, returnUrl: paymentReturnPath(record.returnUrl), paid: record.state === 'COMPLETED' };
    } else if (body.action === 'verify' || body.action === 'status') {
      if (body.action === 'verify' && (!body.razorpay_order_id || !body.razorpay_payment_id || !body.razorpay_signature)) throw new ApiInputError('Payment ID, order ID and signature are required.', 400);
      if (body.action === 'verify' && (body.razorpay_order_id !== record.razorpayOrderId || typeof body.razorpay_payment_id !== 'string' || !/^pay_[A-Za-z0-9]+$/.test(body.razorpay_payment_id) || !validRazorpaySignature(`${record.razorpayOrderId}|${body.razorpay_payment_id}`, body.razorpay_signature, credentials.keySecret!))) throw new ApiInputError('Payment signature is invalid.', 400);
      result = await settleRazorpayCheckout(body.attempt);
    } else throw new ApiInputError('Invalid checkout action.');
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return customError(error); }
}
