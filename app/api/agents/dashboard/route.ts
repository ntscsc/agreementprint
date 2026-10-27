import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, verifyFirebaseIdToken } from '@/lib/firebase-admin';
import { ApiInputError, inputErrorStatus } from '@/lib/api-input';
import { agentDashboardTotals, agentReferralStage } from '@/lib/agent-dashboard';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) throw new ApiInputError('Sign in to view your agent dashboard.', 401);
    const identity = await verifyFirebaseIdToken(token);
    if (!identity.email_verified || !identity.email) throw new ApiInputError('Verify your email address to access the agent dashboard.', 403);
    const db = getAdminDb();
    const accounts = (await db.collection('referralCodes').where('loginEmail', '==', identity.email.trim().toLowerCase()).get()).docs
      .filter(doc => doc.data().kind === 'agent');
    const agents = accounts.map(doc => ({ code: doc.id, name: String(doc.data().name || 'Agent'), active: doc.data().active !== false && !doc.data().deletedAt }));
    if (request.nextUrl.searchParams.get('access') === '1') return NextResponse.json({ eligible: agents.length > 0 }, { headers: { 'Cache-Control': 'private, no-store' } });
    if (!agents.length) return NextResponse.json({ agents: [], referrals: [] }, { headers: { 'Cache-Control': 'private, no-store' } });
    const code = request.nextUrl.searchParams.get('code') || agents[0].code;
    const selected = accounts.find(doc => doc.id === code);
    if (!selected) throw new ApiInputError('This agent account is not linked to your login.', 403);
    const snapshot = await db.collection('agentReferralCustomers').where('code', '==', code).limit(2501).get();
    if (snapshot.size > 2500) throw new ApiInputError('This agent has more than 2,500 referrals. Contact support for the full account statement.', 409);
    // Verify only qualifying orders for this agent. Never fetch another agent's customer list.
    const orderIds = [...new Set(snapshot.docs.map(doc => doc.data().eligiblePaidOrderId).filter((id): id is string => typeof id === 'string' && !!id && !id.includes('/')))];
    const orders = new Map<string, { ownerUid?: string; paid: boolean; reference?: string }>();
    for (let offset = 0; offset < orderIds.length; offset += 100) {
      const batch = await db.getAll(...orderIds.slice(offset, offset + 100).map(id => db.collection('orders').doc(id)));
      batch.forEach(doc => orders.set(doc.id, { ownerUid: doc.data()?.ownerUid, paid: doc.data()?.payment?.status === 'Paid', reference: doc.data()?.publicReference }));
    }
    const rows = snapshot.docs.map(doc => {
      const record = doc.data(), paidOrder = orders.get(record.eligiblePaidOrderId);
      const row = { id: doc.id, name: String(record.name || 'Customer'), joinedAt: String(record.joinedAt || ''),
        hasPaidOrder: paidOrder?.paid === true && paidOrder.ownerUid === doc.id,
        rewardStatus: String(record.rewardStatus || ''),
        ...(typeof record.rewardAmount === 'number' ? { rewardAmount: record.rewardAmount } : {}),
        ...(typeof record.rewardPaidAmount === 'number' ? { rewardPaidAmount: record.rewardPaidAmount } : {}),
        ...(typeof record.rewardedAt === 'string' ? { rewardedAt: record.rewardedAt } : {}),
        ...(paidOrder?.ownerUid === doc.id && paidOrder.paid && paidOrder.reference ? { orderReference: paidOrder.reference } : {}),
      };
      return { ...row, stage: agentReferralStage(row) };
    }).sort((a, b) => b.joinedAt.localeCompare(a.joinedAt) || a.id.localeCompare(b.id));
    const filter = request.nextUrl.searchParams.get('stage') || 'All';
    if (!['All', 'Signed up', 'First order paid', 'Commission due', 'Commission paid'].includes(filter)) throw new ApiInputError('Choose a valid referral stage.', 400);
    const filtered = rows.filter(row => filter === 'All' || row.stage === filter);
    const page = Number(request.nextUrl.searchParams.get('page') || '1');
    if (!Number.isSafeInteger(page) || page < 1) throw new ApiInputError('Invalid page.', 400);
    const settings = selected.data();
    return NextResponse.json({ agents, code, agent: { name: settings.name, active: settings.active !== false && !settings.deletedAt,
      rewardAmount: settings.rewardAmount ?? 0, customerDiscountAmount: settings.customerDiscountAmount ?? settings.discountAmount ?? 0 },
      summary: agentDashboardTotals(rows), referrals: filtered.slice((page - 1) * 25, page * 25), page,
      total: filtered.length, hasNext: page * 25 < filtered.length,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const status = inputErrorStatus(error) || 500;
    return NextResponse.json({ error: status === 500 ? 'Could not load your agent dashboard. Please retry.' : (error as Error).message }, { status, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
