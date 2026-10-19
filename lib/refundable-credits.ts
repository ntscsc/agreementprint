import { getAdminDb } from '@/lib/firebase-admin';
import type { DocumentData, Transaction } from 'firebase-admin/firestore';

export interface CreditSource { merchantOrderId: string; fundedAmount: number; originalOrderId: string; amount: number }
export interface RefundableLot extends CreditSource { lotId: string }
const validMoney = (amount: unknown): amount is number => typeof amount === 'number' && Number.isSafeInteger(amount) && amount >= 0;
function sliceSources(sources: CreditSource[], skip: number, amount: number): CreditSource[] {
  const result: CreditSource[] = [];
  for (const source of sources) {
    const skipped = Math.min(skip, source.amount); skip -= skipped;
    const selected = Math.min(amount, source.amount - skipped); amount -= selected;
    if (selected > 0) result.push({ ...source, amount: selected });
  }
  return result;
}

// Reconstruct source lots from the immutable ledger, including existing downgrade
// credits. Spending consumes cash-backed lots first; rewards never create lots.
// Reading the account in the same transaction serializes this with checkout spend.
export async function refundableCredits(uid: string, tx?: Transaction) {
  const db = getAdminDb();
  const read = (query: FirebaseFirestore.Query) => tx ? tx.get(query) : query.get();
  const [ledger, replacements, orders] = await Promise.all([
    read(db.collection('referralLedger').where('ownerUid', '==', uid)),
    read(db.collection('orderReplacements').where('ownerUid', '==', uid)),
    read(db.collection('orders').where('ownerUid', '==', uid)),
  ]);
  const orderMap = new Map(orders.docs.map(doc => [doc.id, doc.data()]));
  const replacementMap = new Map(replacements.docs.map(doc => [doc.id, doc.data()]));
  function cashSources(id: string, seen = new Set<string>()): CreditSource[] {
    if (seen.has(id)) return []; seen.add(id);
    const order = orderMap.get(id), p = order?.payment;
    if (!p || p.status !== 'Paid' || !validMoney(p.amount)) return [];
    if (p.carriedFromOrderId) {
      if (!validMoney(p.carriedCash) || !validMoney(p.additionalPayment)) return [];
      const carried = sliceSources(cashSources(p.carriedFromOrderId, seen), 0, p.carriedCash);
      if (p.additionalPayment > 0 && typeof p.phonepeMerchantOrderId === 'string') carried.push({ merchantOrderId: p.phonepeMerchantOrderId, fundedAmount: p.additionalPayment, originalOrderId: id, amount: p.additionalPayment });
      return carried.reduce((sum, source) => sum + source.amount, 0) === p.amount ? carried : [];
    }
    return ['PhonePe', 'Razorpay'].includes(p.gateway) && typeof p.phonepeMerchantOrderId === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(p.phonepeMerchantOrderId)
      ? [{ merchantOrderId: p.phonepeMerchantOrderId, fundedAmount: p.amount, originalOrderId: id, amount: p.amount }] : [];
  }
  const lots = new Map<string, RefundableLot>();
  const spentOnOrder = new Map<string, CreditSource[]>();
  function creditSources(id: string, seen = new Set<string>()): CreditSource[] {
    if (seen.has(id)) return []; seen.add(id);
    if (spentOnOrder.has(id)) return spentOnOrder.get(id)!;
    const payment = orderMap.get(id)?.payment;
    return payment?.carriedFromOrderId && validMoney(payment.carriedCredit)
      ? sliceSources(creditSources(payment.carriedFromOrderId, seen), 0, payment.carriedCredit) : [];
  }
  const debit = (amount: number) => {
    const used: CreditSource[] = [];
    for (const lot of lots.values()) {
      const take = Math.min(lot.amount, amount); amount -= take; lot.amount -= take;
      if (take > 0) used.push({ ...lot, amount: take });
    }
    return used;
  };
  const entries = ledger.docs.map(doc => ({ ...doc.data(), id: doc.id } as DocumentData));
  const priority = (type: string) => type === 'replacement_credit' || type === 'cancellation_credit' ? 0 : type === 'reserve' ? 1 : type === 'refund_reserve' ? 2 : 3;
  entries.sort((a, b) => (a.sequence || b.sequence ? (a.sequence || 0) - (b.sequence || 0) : String(a.createdAt).localeCompare(String(b.createdAt))) || priority(a.type) - priority(b.type) || a.id.localeCompare(b.id));
  for (const entry of entries) {
    if (!validMoney(entry.amount)) continue;
    if (entry.type === 'replacement_credit') {
      const replacement = replacementMap.get(entry.id.replace(/^replacement_/, ''));
      const q = replacement?.quote;
      if (replacement?.state !== 'Completed' || !q || !validMoney(q.excessCash) || !validMoney(q.excessCredits) || !validMoney(q.cashUsed) || !validMoney(q.creditsUsed) || replacement.creditReturned !== entry.amount) continue;
      const inherited = creditSources(replacement.originalOrderId);
      spentOnOrder.set(replacement.replacementOrderId, sliceSources(inherited, 0, q.creditsUsed));
      const cash = replacement.surplusChoice === 'credit' ? sliceSources(cashSources(replacement.originalOrderId), q.cashUsed, q.excessCash) : [];
      const returned = [...cash, ...sliceSources(inherited, q.creditsUsed, q.excessCredits)];
      if (returned.reduce((sum, source) => sum + source.amount, 0) > entry.amount) continue;
      returned.forEach((source, index) => lots.set(`${entry.id}_${index}`, { ...source, lotId: `${entry.id}_${index}` }));
    } else if (entry.type === 'cancellation_credit' && orderMap.get(entry.orderId)?.status === 'Cancelled' && validMoney(entry.refundableAmount) && entry.refundableAmount <= entry.amount) {
      sliceSources(cashSources(entry.orderId), 0, entry.refundableAmount).forEach((source, index) => lots.set(`${entry.id}_${index}`, { ...source, lotId: `${entry.id}_${index}` }));
    } else if (entry.type === 'reserve') {
      spentOnOrder.set(entry.orderId, debit(entry.amount));
    } else if (entry.type === 'release') {
      for (const source of spentOnOrder.get(entry.orderId) || []) {
        const lot = lots.get((source as RefundableLot).lotId); if (lot) lot.amount += source.amount;
      }
      spentOnOrder.delete(entry.orderId);
    } else if (entry.type === 'refund_reserve' || entry.type === 'refund_release') {
      for (const allocation of entry.allocations || []) {
        const lot = lots.get(allocation.lotId);
        if (lot && validMoney(allocation.amount)) lot.amount = Math.max(0, lot.amount + (entry.type === 'refund_reserve' ? -allocation.amount : allocation.amount));
      }
    }
  }
  const available = [...lots.values()].filter(lot => lot.amount > 0);
  return { lots: available, refundableBalance: available.reduce((sum, lot) => sum + lot.amount, 0), cashOnOrder: cashSources, creditsOnOrder: creditSources };
}
