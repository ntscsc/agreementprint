import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { customIdentity, customError } from '@/lib/custom-request-server';
import { ApiInputError } from '@/lib/api-input';
import { buildWorkQueue, indiaDay } from '@/lib/admin-work-queue';
import type { Order } from '@/lib/types';
import type { Query } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  try {
    if (!(await customIdentity(req)).admin) throw new ApiInputError('Administrator access required.', 403);
    const db = getAdminDb(), now = new Date();
    const read = async (query: Query, label: string) => {
      const snapshot = await query.limit(2501).get();
      if (snapshot.size > 2500) throw new ApiInputError(`The ${label} queue exceeds 2,500 records. Refine the server queue before showing totals; no partial totals are displayed.`, 409);
      return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, requestId: doc.data().requestId || doc.id }));
    };
    const statuses = ['Submitted', 'Under verification', 'Documents needed', 'Drafting', 'Dispatched'];
    const start = new Date(`${indiaDay(now)}T00:00:00+05:30`).toISOString();
    const end = new Date(Date.parse(start) + 86400000).toISOString();
    const results = await Promise.all([
      read(db.collection('orders').where('status', 'in', statuses), 'online orders'),
      read(db.collection('orderReplacements').where('state', '==', 'Review required'), 'change reviews'),
      read(db.collection('orderReplacements').where('refundStatus', '==', 'Requested'), 'replacement refunds'),
      read(db.collection('creditRefundRequests').where('state', 'in', ['Awaiting approval', 'Processing']), 'refunds'),
      read(db.collection('customAgreementRequests').where('status', 'in', ['Submitted', 'Under Review', 'Clarification Required', 'Quote Sent', 'Quoted / Awaiting Payment', 'Accepted', 'In Progress', 'Awaiting Approval', 'Ready', 'Dispatched']), 'custom requests'),
      read(db.collection('counterOrders').where('payment.paidAt', '>=', start).where('payment.paidAt', '<', end), 'today’s counter collections'),
      read(db.collection('orders').where('payment.paidAt', '>=', start).where('payment.paidAt', '<', end), 'today’s online receipts'),
      read(db.collection('customAgreementRequests').where('payment.paidAt', '>=', start).where('payment.paidAt', '<', end), 'today’s custom receipts'),
    ]);
    const changes = [...new Map([...results[1], ...results[2]].map(row => [row.id, row])).values()];
    const asOrders = (rows: typeof results[0]) => rows.map(row => ({ ...row, orderId: (row as Record<string, any>).orderId || row.id })) as unknown as Order[];
    const data = buildWorkQueue({ orders: asOrders(results[0]), changes,
      refunds: results[3], custom: results[4], todayCollections: results[5], todayOnlineOrders: results[6], todayCustomPayments: results[7] }, now);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return customError(error); }
}
