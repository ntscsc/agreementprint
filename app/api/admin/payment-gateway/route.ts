import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { customIdentity, customBody, customError } from '@/lib/custom-request-server';
import { ApiInputError } from '@/lib/api-input';
import { gatewayCredentials, parsePaymentGateway } from '@/lib/payment-gateway';

export const runtime = 'nodejs';
const json = (data: unknown) => NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
async function admin(req: NextRequest) {
  const identity = await customIdentity(req);
  if (!identity.admin) throw new ApiInputError('Administrator access required.', 403);
  return identity;
}
export async function GET(req: NextRequest) {
  try {
    await admin(req);
    const record = (await getAdminDb().collection('settings').doc('paymentGateway').get()).data();
    return json({ activeGateway: parsePaymentGateway(record?.activeGateway), configured: { PhonePe: !!gatewayCredentials('PhonePe'), Razorpay: !!gatewayCredentials('Razorpay') } });
  } catch (error) { return customError(error); }
}
export async function POST(req: NextRequest) {
  try {
    const identity = await admin(req), body = await customBody(req);
    if (body.activeGateway === undefined) throw new ApiInputError('Choose a payment gateway.');
    const activeGateway = parsePaymentGateway(body.activeGateway);
    if (!gatewayCredentials(activeGateway)) throw new ApiInputError(`${activeGateway} server credentials are not configured.`, 409);
    const db = getAdminDb(), ref = db.collection('settings').doc('paymentGateway');
    await db.runTransaction(async tx => {
      const previous = (await tx.get(ref)).data()?.activeGateway ?? 'PhonePe';
      if (body.previousGateway !== previous) throw new ApiInputError('The gateway changed. Refresh these settings and try again.', 409);
      const now = new Date().toISOString();
      tx.set(ref, { activeGateway, updatedBy: identity.uid, updatedAt: now });
      tx.create(db.collection('adminLogs').doc(), { action: 'PAYMENT_GATEWAY_CHANGED', previousGateway: previous, activeGateway, adminUid: identity.uid, timestamp: now });
    });
    return json({ activeGateway });
  } catch (error) { return customError(error); }
}
