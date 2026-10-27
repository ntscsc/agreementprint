import type { ReportSheet, ReportValue } from './admin-report-xlsx';
import type { ReportData } from './admin-reports';
import { reportDate } from './report-analytics';

type Row = Record<string, any>;
const amount = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const codeOf = (value: unknown) => String(value || '').trim().toUpperCase();
const date = reportDate;
const periodFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' });
const monthOf = (value: unknown) => {
  const parsed = date(value);
  if (!parsed) return 'Date unavailable';
  const parts = periodFormat.formatToParts(parsed);
  return `${parts.find(part => part.type === 'year')!.value}-${parts.find(part => part.type === 'month')!.value}`;
};

/** The default business export: eight operational, cash and agent reports. */
export function buildEssentialReportSheets(data: ReportData, generatedAt: Date): ReportSheet[] {
  const list = (name: string) => data[name] || [];
  const standard = list('orders'), custom = list('customAgreementRequests'), counter = list('counterOrders');
  const id = (row: Row) => row.orderId || row.requestId || row.id;
  const allOrders: Row[] = [...standard.map(row => ({ ...row, channel: 'Online' })), ...counter.map(row => ({ ...row, channel: 'Counter' }))];
  const orderById = new Map(allOrders.map(row => [id(row), row]));
  const customById = new Map(custom.map(row => [id(row), row]));
  const profiles = new Map(list('customerProfiles').map(row => [row.uid || row.id, row]));
  const reference = (row?: Row) => row ? row.publicReference || id(row) : '';
  const accountName = (uid?: string) => profiles.get(uid)?.name || '';
  const sheets: ReportSheet[] = [];
  const add = (name: string, note: string, headers: string[], rows: ReportValue[][], money: number[] = []) => {
    sheets.push({ name, note: `Exported ${generatedAt.toISOString()}. Dates display in India time. ${note}`, headers, rows, money });
  };

  const receipts = new Map<string, Row>();
  const hasReceipt = new Set<string>();
  function receipt(key: string, recordId: string, ref: string, customer: string, cash: unknown, at: unknown, channel: string, gateway: string) {
    const cashAmount = amount(cash);
    if (!key || receipts.has(key) || cashAmount === null || cashAmount <= 0) return;
    receipts.set(key, { key, ref, customer, amount: cashAmount, at: date(at), channel, gateway });
    hasReceipt.add(`${channel === 'Custom' ? 'custom' : 'order'}:${recordId}`);
  }
  for (const attempt of list('phonepePaymentAttempts')) if (attempt.state === 'COMPLETED') {
    const order = orderById.get(attempt.orderId);
    receipt(attempt.merchantOrderId || attempt.id, attempt.orderId, reference(order) || attempt.orderId, accountName(attempt.ownerUid), attempt.amount, attempt.completedAt || order?.payment?.paidAt || attempt.updatedAt, 'Online', attempt.gateway || order?.payment?.gateway || 'Not recorded');
  }
  for (const attempt of list('customPhonepeAttempts')) if (attempt.state === 'COMPLETED') {
    const request = customById.get(attempt.requestId);
    receipt(attempt.merchantOrderId || attempt.id, attempt.requestId, reference(request) || attempt.requestId, request?.name || accountName(attempt.ownerUid), attempt.amount, request?.payment?.paidAt || attempt.completedAt || attempt.updatedAt, 'Custom', attempt.gateway || request?.payment?.gateway || 'Not recorded');
  }
  for (const replacement of list('orderReplacements')) if (replacement.state === 'Completed') {
    const target = replacement.replacementOrderId || replacement.originalOrderId;
    receipt(replacement.requestId || replacement.id, target, reference(orderById.get(target)) || target, accountName(replacement.ownerUid), replacement.quote?.due, replacement.completedAt || replacement.updatedAt, 'Replacement', replacement.gateway || 'Not recorded');
  }
  for (const order of allOrders) if (['Paid', 'Refunded'].includes(order.payment?.status) && !hasReceipt.has(`order:${id(order)}`)) {
    const p = order.payment, carried = order.replacesOrderId || p.carriedFromOrderId;
    receipt(p.phonepeMerchantOrderId || p.merchantOrderId || p.razorpayPaymentId || `recorded:${id(order)}`, id(order), reference(order), order.channel === 'Counter' ? order.ownerDetails?.fullName || '' : accountName(order.ownerUid), carried ? p.additionalPayment ?? order.replacementAdjustment?.additionalPayment : p.amount, p.paidAt, carried ? 'Replacement' : order.channel, order.counterPaymentMethod || p.gateway || 'Not recorded');
  }
  for (const request of custom) if (['Paid', 'Refunded'].includes(request.payment?.status) && !hasReceipt.has(`custom:${id(request)}`)) {
    const p = request.payment;
    receipt(p.merchantOrderId || `custom:${id(request)}`, id(request), reference(request), request.name || '', p.amount, p.paidAt, 'Custom', p.gateway || 'Not recorded');
  }
  const payments = [...receipts.values()];
  const refundEvents = new Map<string, Row>();
  const refundRows: ReportValue[][] = [];
  for (const request of list('creditRefundRequests')) for (const leg of request.legs?.length ? request.legs : [{}]) {
    const key = leg.merchantRefundId || `${request.requestId || request.id}:${leg.originalMerchantOrderId || ''}`;
    if (leg.state === 'COMPLETED') refundEvents.set(key, { amount: amount(leg.amount), at: date(leg.updatedAt || request.updatedAt) });
    refundRows.push([request.requestId || request.id, reference(orderById.get(request.orderId)) || request.orderId, request.state, leg.state || '', amount(leg.amount), date(leg.updatedAt || request.updatedAt), leg.originalMerchantOrderId, leg.merchantRefundId, request.notes || request.statusMessage]);
  }
  for (const event of list('orderRefundHistory')) if (event.state === 'COMPLETED' && !refundEvents.has(event.merchantRefundId || event.id)) {
    const key = event.merchantRefundId || event.id;
    refundEvents.set(key, { amount: amount(event.amount), at: date(event.createdAt) });
    refundRows.push([event.requestId, reference(orderById.get(event.orderId)) || event.orderId, 'Completed', 'COMPLETED', amount(event.amount), date(event.createdAt), event.originalMerchantOrderId, key, '']);
  }

  const agents = list('referralCodes').filter(row => row.kind === 'agent');
  const agentByCode = new Map(agents.map(row => [codeOf(row.code || row.id), row]));
  const referrals: Row[] = list('agentReferralCustomers').map(row => {
    const uid = row.uid || row.id, eligibleOrder = orderById.get(row.eligiblePaidOrderId);
    const eligible = eligibleOrder?.ownerUid === uid && eligibleOrder?.payment?.status === 'Paid';
    return { ...row, uid, code: codeOf(row.code), name: row.name || accountName(uid), eligible, eligibleReference: reference(eligibleOrder), agent: agentByCode.get(codeOf(row.code)) };
  });
  const paidAgents = referrals.filter(row => row.rewardStatus === 'Rewarded');
  const dueAgents = referrals.filter(row => row.eligible && row.rewardStatus !== 'Rewarded');
  const total = (rows: Row[], field: string) => rows.reduce((sum, row) => sum + (amount(row[field]) ?? 0), 0);
  const cash = total(payments, 'amount'), refunded = total([...refundEvents.values()], 'amount');
  const agentPaid = total(paidAgents, 'rewardPaidAmount'), agentDue = total(dueAgents, 'rewardAmount');
  const unknownPayouts = paidAgents.filter(row => amount(row.rewardPaidAmount) === null).length;
  const unknownDue = dueAgents.filter(row => amount(row.rewardAmount) === null).length;
  const unknownRefunds = [...refundEvents.values()].filter(row => amount(row.amount) === null).length;
  const summary: ReportValue[][] = [
    ['Online orders', standard.length, 'All standard records, including replacements and cancellations'],
    ['Walk-in orders', counter.length, 'Counter records'], ['Custom requests', custom.length, 'All saved custom requests'],
    ['Open online orders and requests', standard.filter(row => !row.replacedByOrderId && !['Cancelled', 'Delivered'].includes(row.status)).length + custom.filter(row => !['Cancelled', 'Declined', 'Completed'].includes(row.status)).length, 'Online/custom pending workload; walk-in orders are separate'],
    ['Cash received (INR)', cash, 'Confirmed receipts; carried replacement balances and credits are not new cash'],
    ['Confirmed refunds (INR)', refunded, 'Completed refunds only'],
    ['Agent commissions paid (INR)', agentPaid, 'Known recorded payouts only; not the configured reward rate'],
    ['Agent commissions due (INR)', agentDue, 'Verified first paid orders with known saved commission amounts'],
    ['Net cash after refunds and agent payments (INR)', unknownPayouts || unknownRefunds ? null : cash - refunded - agentPaid, 'Not profit; other costs excluded. Blank if refund or recorded payout amounts are missing'],
    ['Agents', agents.length, 'Includes inactive agents for history'], ['Referred customers', referrals.length, 'Saved sign-up attribution'],
    ['Payout records missing an amount', unknownPayouts, 'Review payment notes; amounts are not inferred'], ['Eligible commissions missing an amount', unknownDue, 'Requires reconciliation before payment'], ['Completed refunds missing an amount', unknownRefunds, 'Net cash is unavailable until reconciled'],
  ];
  add('Summary', 'Eight essential reports. Blank money amounts mean unavailable, not zero.', ['Metric', 'Value', 'Basis'], summary);
  sheets[0].moneyRows = summary.flatMap((row, index) => String(row[0]).includes('(INR)') ? [index] : []);
  const months = new Map<string, { orders: number; cash: number; refunds: number; payouts: number; missing: number }>();
  const month = (at: unknown) => { const key = monthOf(at); if (!months.has(key)) months.set(key, { orders: 0, cash: 0, refunds: 0, payouts: 0, missing: 0 }); return months.get(key)!; };
  for (const order of [...allOrders, ...custom]) month(order.createdAt).orders++;
  for (const payment of payments) month(payment.at).cash += payment.amount;
  for (const refund of refundEvents.values()) { const row = month(refund.at); row.refunds += refund.amount ?? 0; if (refund.amount === null) row.missing++; }
  for (const payout of paidAgents) { const row = month(payout.rewardedAt); row.payouts += amount(payout.rewardPaidAmount) ?? 0; if (amount(payout.rewardPaidAmount) === null) row.missing++; }
  add('Monthly Totals', 'Cash by saved payment/refund/payout dates. Net cash is not profit. Unknown dates remain separate.', ['Month (IST)', 'Orders and requests', 'Cash received (INR)', 'Refunds (INR)', 'Agent payments (INR)', 'Net cash (INR)', 'Amounts missing'], [...months.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([key, row]) => [key, row.orders, row.cash, row.refunds, row.payouts, row.missing ? null : row.cash - row.refunds - row.payouts, row.missing]), [2, 3, 4, 5]);
  add('Orders', 'Online, walk-in and custom records. Order value is not a new cash receipt. Replaced originals are marked as history.', ['Reference', 'Channel', 'Created (IST)', 'Customer', 'Agreement type', 'Work status', 'Payment status', 'Order or quote value (INR)'], [
    ...allOrders.map(row => [reference(row), row.channel, date(row.createdAt), row.channel === 'Counter' ? row.ownerDetails?.fullName : accountName(row.ownerUid), row.agreementTerms?.agreementType || 'Rental', row.channel === 'Counter' ? row.collectedAt ? 'Collected' : 'Saved' : row.replacedByOrderId ? 'Replaced' : row.status, row.payment?.status, amount(row.counterAmount ?? row.payment?.totalBeforeCredits ?? row.payment?.amount)]),
    ...custom.map(row => [reference(row), 'Custom', date(row.createdAt), row.name, row.agreementType, row.status, row.payment?.status || 'Not paid', amount(row.quoteAmount)]),
  ], [7]);
  add('Payments', 'Confirmed receipts only. Replacement payments include only additional cash; referral credits are excluded.', ['Payment reference', 'Order or request', 'Customer', 'Paid (IST)', 'Channel', 'Payment method', 'Cash received (INR)'], payments.map(row => [row.key, row.ref, row.customer, row.at, row.channel, row.gateway, row.amount]), [6]);
  add('Refunds', 'Pending and completed refund records. Only completed transactions reduce cash totals.', ['Refund request', 'Order', 'Request status', 'Transaction status', 'Amount (INR)', 'Updated (IST)', 'Original payment', 'Refund reference', 'Notes'], refundRows, [4]);
  const codes = [...new Set([...agentByCode.keys(), ...referrals.map(row => row.code)])].sort();
  add('Agents', 'Commission due uses verified paid orders and the saved commission. Payouts use the amount actually recorded as paid. Unknown amounts remain flagged.', ['Agent code', 'Agent', 'Contact', 'Status', 'Referred customers', 'First paid orders', 'Commission due (INR)', 'Commission paid (INR)', 'Due amounts missing', 'Paid amounts missing'], codes.map(code => { const agent = agentByCode.get(code), customers = referrals.filter(row => row.code === code), due = dueAgents.filter(row => row.code === code), paid = paidAgents.filter(row => row.code === code); return [code, agent?.name || 'Historical agent', agent?.contact, agent?.deletedAt ? 'Removed' : agent?.active === false ? 'Inactive' : agent ? 'Active' : 'Historical', customers.length, customers.filter(row => row.eligible).length, due.some(row => amount(row.rewardAmount) === null) ? null : total(due, 'rewardAmount'), paid.some(row => amount(row.rewardPaidAmount) === null) ? null : total(paid, 'rewardPaidAmount'), due.filter(row => amount(row.rewardAmount) === null).length, paid.filter(row => amount(row.rewardPaidAmount) === null).length]; }), [6, 7]);
  add('Agent Referrals', 'One row per attributed customer. Sign-up alone does not earn commission; the first qualifying payment must be confirmed.', ['Agent code', 'Agent', 'Customer', 'Customer mobile', 'Customer email', 'Referred (IST)', 'First paid order', 'Eligibility', 'Commission status', 'Commission (INR)'], referrals.map(row => [row.code, row.agent?.name || '', row.name, profiles.get(row.uid)?.phone || '', row.email || '', date(row.joinedAt), row.eligibleReference, row.eligible ? 'First payment confirmed' : 'Awaiting qualifying payment', row.rewardStatus === 'Rewarded' ? 'Payment recorded' : row.eligible ? amount(row.rewardAmount) === 0 ? 'No commission due' : amount(row.rewardAmount) === null ? 'Commission amount needs review' : 'Commission due' : 'Not yet earned', amount(row.rewardAmount)]), [9]);
  add('Agent Payments', 'Recorded payments to agents only. These are admin-recorded transfers, not automatic gateway payouts. Missing historical amounts are left blank.', ['Agent code', 'Agent', 'Referred customer', 'Qualifying order', 'Commission earned (INR)', 'Amount paid (INR)', 'Paid (IST)', 'Transfer reference or notes'], paidAgents.map(row => [row.code, row.agent?.name || '', row.name, row.eligibleReference || row.eligiblePaidOrderId, amount(row.rewardAmount), amount(row.rewardPaidAmount), date(row.rewardedAt), row.rewardNotes]), [4, 5]);
  return sheets;
}
