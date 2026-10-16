import { NextRequest, NextResponse } from 'next/server';
import { readJsonObject, inputErrorStatus, ApiInputError } from '@/lib/api-input';
import { getAdminDb, verifyFirebaseIdToken } from '@/lib/firebase-admin';
import { ADMIN_EMAILS } from '@/src/config/admin';
import { normalizeReferralCode } from '@/lib/referral-utils';
import { isValidCouponCode, isValidCouponDiscount } from '@/lib/coupon';

async function requireAdmin(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new ApiInputError('Sign in is required.', 401);
  const user = await verifyFirebaseIdToken(token);
  if (!user.email_verified || !ADMIN_EMAILS.some(email => email.toLowerCase() === user.email?.toLowerCase())) {
    throw new ApiInputError('Administrator access is required.', 403);
  }
  return user;
}

function failure(error: unknown) {
  const status = inputErrorStatus(error) || 500;
  return NextResponse.json({ error: status === 500 ? 'Could not process agent referrals.' : (error as Error).message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const db = getAdminDb();
    const [agents, customers, paidOrders] = await Promise.all([
      db.collection('referralCodes').where('kind', '==', 'agent').get(),
      db.collection('agentReferralCustomers').get(),
      db.collection('orders').where('payment.status', '==', 'Paid').get(),
    ]);
    const confirmedOrders = new Map(paidOrders.docs.map(doc => [doc.id, doc.data().ownerUid]));
    return NextResponse.json({
      agents: agents.docs.map(doc => ({ ...doc.data(), code: doc.id, customerDiscountAmount: doc.data().customerDiscountAmount ?? doc.data().discountAmount ?? 0 })),
      customers: customers.docs.map(doc => ({ ...doc.data(), uid: doc.id,
        hasPaidOrder: typeof doc.data().eligiblePaidOrderId === 'string' && confirmedOrders.get(doc.data().eligiblePaidOrderId) === doc.id,
      })),
    });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    const body = await readJsonObject(request);
    const db = getAdminDb();
    const now = new Date().toISOString();
    if (body.action === 'reward') {
      if (typeof body.uid !== 'string' || !body.uid || body.uid.includes('/') || body.uid.length > 128 ||
          typeof body.notes !== 'string' || !body.notes.trim() || body.notes.length > 1000) {
        throw new ApiInputError('Choose a customer and enter reward details (up to 1,000 characters).', 400);
      }
      const ref = db.collection('agentReferralCustomers').doc(body.uid);
      await db.runTransaction(async transaction => {
        const customer = await transaction.get(ref);
        if (!customer.exists) throw new ApiInputError('Customer not found.', 404);
        if (customer.data()?.rewardStatus === 'Rewarded') return;
        const data = customer.data()!;
        if (typeof data.eligiblePaidOrderId !== 'string') throw new ApiInputError('The referred customer must pay their first order before the agent can be rewarded.', 409);
        const paidOrder = await transaction.get(db.collection('orders').doc(data.eligiblePaidOrderId));
        if (paidOrder.data()?.ownerUid !== body.uid || paidOrder.data()?.payment?.status !== 'Paid') throw new ApiInputError('A confirmed paid order is required.', 409);
        const agent = await transaction.get(db.collection('referralCodes').doc(data.code));
        const rewardPaidAmount = data.rewardAmount ?? agent.data()?.rewardAmount ?? 0;
        if (!isValidCouponDiscount(rewardPaidAmount)) throw new ApiInputError('Set a valid agent reward before recording payment.', 400);
        transaction.update(ref, { rewardStatus: 'Rewarded', rewardPaidAmount, rewardNotes: body.notes.trim(), rewardedAt: now, rewardedBy: admin.email });
      });
    } else if (body.action === 'create') {
      const code = normalizeReferralCode(body.code);
      const customerDiscountAmount = body.customerDiscountAmount ?? 0;
      const rewardAmount = body.rewardAmount ?? 0;
      if (!isValidCouponCode(code) || !isValidCouponDiscount(rewardAmount) || !isValidCouponDiscount(customerDiscountAmount) || typeof body.name !== 'string' || !body.name.trim() || body.name.length > 100 ||
          typeof body.contact !== 'string' || body.contact.length > 200) {
        throw new ApiInputError('Enter a name, a unique code with 5 to 20 letters/numbers, and whole-rupee agent reward and new-customer discount amounts from 0 to 100,000.', 400);
      }
      const ref = db.collection('referralCodes').doc(code);
      await db.runTransaction(async transaction => {
        const existing = await transaction.get(ref);
        if (existing.exists) throw new ApiInputError('This coupon code is already in use.', 409);
        transaction.create(ref, { kind: 'agent', active: true, name: body.name.trim(), contact: body.contact.trim(), rewardAmount, customerDiscountAmount, createdAt: now, createdBy: admin.email });
      });
    } else if (body.action === 'update' || body.action === 'delete') {
      const code = normalizeReferralCode(body.code);
      if (!isValidCouponCode(code)) throw new ApiInputError('Choose a valid agent code.', 400);
      if (body.action === 'update' && (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 100 ||
          typeof body.contact !== 'string' || body.contact.length > 200 || !isValidCouponDiscount(body.rewardAmount) ||
          (body.customerDiscountAmount !== undefined && !isValidCouponDiscount(body.customerDiscountAmount)) ||
          (body.active !== undefined && typeof body.active !== 'boolean'))) {
        throw new ApiInputError('Enter a name and whole-rupee agent reward and new-customer discount amounts from 0 to 100,000.', 400);
      }
      const ref = db.collection('referralCodes').doc(code);
      await db.runTransaction(async transaction => {
        const agent = await transaction.get(ref);
        if (agent.data()?.kind !== 'agent') throw new ApiInputError('Agent not found.', 404);
        if (body.action === 'delete') {
          transaction.update(ref, { active: false, deletedAt: now, updatedBy: admin.email });
        } else {
          if (agent.data()?.deletedAt) throw new ApiInputError('This agent has been removed.', 409);
          transaction.update(ref, { name: body.name.trim(), contact: body.contact.trim(), rewardAmount: body.rewardAmount,
            ...(body.customerDiscountAmount === undefined ? {} : { customerDiscountAmount: body.customerDiscountAmount }),
            ...(body.active === undefined ? {} : { active: body.active }), updatedAt: now, updatedBy: admin.email });
        }
      });
    } else throw new ApiInputError('Unknown action.', 400);
    return NextResponse.json({ saved: true });
  } catch (error) { return failure(error); }
}
