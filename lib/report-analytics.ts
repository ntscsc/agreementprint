import type { ReportSheet, ReportValue } from './admin-report-xlsx';

type Row = Record<string, any>;
type Data = Record<string, Row[]>;
export function reportDate(value: any): Date | null {
  try {
    if (value === undefined || value === null || value === '') return null;
    const parsed = value?.toDate ? value.toDate() : new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  } catch { return null; }
}
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : 0;
const amount = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const monthFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' });
const month = (value: unknown) => {
  const time = reportDate(value);
  if (!time) return 'Date unavailable';
  const parts = monthFormat.formatToParts(time);
  return `${parts.find(part => part.type === 'year')!.value}-${parts.find(part => part.type === 'month')!.value}`;
};
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : 'Not recorded';

export function buildAnalyticsSheets(data: Data, payments: Row[], refunds: Row[], generatedAt: Date): ReportSheet[] {
  const sheets: ReportSheet[] = [];
  const add = (name: string, note: string, headers: string[], rows: ReportValue[][], money: number[] = [], percent: number[] = []) => sheets.push({ name, note: `As of ${generatedAt.toISOString()}. ${note}`, headers, rows, money, percent });
  const facts = [...data.orders.map(order => {
    const isActive = !order.replacedByOrderId && order.status !== 'Cancelled';
    const isPaid = order.payment?.status === 'Paid';
    const value = amount(order.payment?.totalBeforeCredits) ?? (amount(order.payment?.amount) !== null ? number(order.payment.amount) + number(order.payment.referralCreditApplied) : null);
    return { reference: order.orderId || order.id, uid: order.ownerUid, source: 'Standard order', created: reportDate(order.createdAt), updated: reportDate(order.updatedAt), paidAt: reportDate(order.payment?.paidAt), status: order.replacedByOrderId ? 'Replaced' : text(order.status), payment: text(order.payment?.status), service: order.agreementTerms?.agreementType || 'Rental', city: text(order.propertyDetails?.city).toUpperCase(), language: order.agreementTerms?.language || 'English', denomination: amount(order.agreementTerms?.stampPaperDenomination), notary: order.agreementTerms?.includeNotary === true, copies: 1 + number(order.agreementTerms?.extraCopies), replacement: Boolean(order.replacesOrderId), active: isActive, activePaid: isActive && isPaid, value, discount: amount(order.payment?.couponDiscount), credits: amount(order.payment?.referralCreditApplied), test: /\bQA\s+TEST\b|\bTEST\s+ONLY\b/i.test([order.ownerDetails?.fullName, order.tenantDetails?.fullName, order.propertyDetails?.fullAddress].join(' ')), original: order };
  }), ...data.customAgreementRequests.map(request => {
    const isActive = !['Cancelled', 'Declined'].includes(request.status);
    return { reference: request.requestId || request.id, uid: request.ownerUid, source: 'Custom agreement', created: reportDate(request.createdAt), updated: reportDate(request.updatedAt), paidAt: reportDate(request.payment?.paidAt), status: text(request.status), payment: text(request.payment?.status), service: `Custom: ${text(request.agreementType)}`, city: 'Not recorded', language: text(request.language), denomination: amount(request.stampPaperDenomination), notary: request.includeNotary === true, copies: 1 + number(request.extraCopies), replacement: false, active: isActive, activePaid: isActive && request.payment?.status === 'Paid', value: amount(request.payment?.amount), discount: null, credits: null, test: /\bQA\s+TEST\b|\bTEST\s+ONLY\b/i.test([request.name, request.agreementType, request.purpose].join(' ')), original: request };
  })];
  const byRef = new Map(facts.map(row => [row.reference, row]));
  const valueOf = (row: typeof facts[number]) => row.activePaid ? row.value : null;
  const age = (value: unknown) => { const time = reportDate(value); return time ? Math.max(0, Math.floor((generatedAt.getTime() - time.getTime()) / 86400000)) : null; };

  add('Order Analytics', 'One row per standard order or custom request, including replaced/cancelled records. Use Active paid = Yes for current sales; replacement rows are revisions, not new acquisitions. Possible test flags use explicit QA TEST / TEST ONLY labels and never exclude data. Blank amounts mean unavailable, not zero. Dates are native Excel dates in India time.', ['Order or request reference', 'Customer ID', 'Source', 'Created (IST)', 'Created month', 'Paid (IST)', 'Paid month', 'Updated (IST)', 'Status', 'Payment status', 'Agreement type', 'City', 'Language', 'Stamp denomination', 'Notary', 'Total copies', 'Replacement', 'Active', 'Active paid', 'Recorded order value (INR)', 'Active sales value (INR)', 'Coupon discount (INR)', 'Credits applied (INR)', 'Days since update', 'Possible test record'], facts.map(row => [row.reference, row.uid, row.source, row.created, month(row.created), row.paidAt, row.paidAt ? month(row.paidAt) : '', row.updated, row.status, row.payment, row.service, row.city, row.language, row.denomination, row.notary, row.copies, row.replacement, row.active, row.activePaid, row.value, valueOf(row), row.discount, row.credits, age(row.updated), row.test]), [19, 20, 21, 22]);

  const periods = new Map<string, { originals: number; revisions: number; custom: number; cash: number; refunds: number; paid: number; sales: number; missing: number; flaggedCash: number }>();
  const period = (value: unknown) => { const key = month(value); if (!periods.has(key)) periods.set(key, { originals: 0, revisions: 0, custom: 0, cash: 0, refunds: 0, paid: 0, sales: 0, missing: 0, flaggedCash: 0 }); return periods.get(key)!; };
  for (const fact of facts) {
    const created = period(fact.created);
    if (fact.source === 'Custom agreement') created.custom++; else if (fact.replacement) created.revisions++; else created.originals++;
    if (fact.activePaid) { const paid = period(fact.paidAt); paid.paid++; paid.sales += number(fact.value); if (fact.value === null) paid.missing++; }
  }
  for (const row of payments) { const bucket = period(row.at); bucket.cash += row.amount; if (byRef.get(row.reference)?.test) bucket.flaggedCash += row.amount; }
  for (const row of refunds) period(row.at).refunds += number(row.amount);
  add('Monthly Trends', 'Created counts use creation month; receipts/refunds use recorded transaction dates. Sales use payment month for currently active paid agreements, so historical sales can change after replacement/cancellation. Blank average means zero paid agreements or missing values. Unknown dates stay in a separate bucket. Flagged cash is included in total cash. No gateway fees/costs are available; net cash is not profit.', ['Month (IST)', 'New standard orders', 'Replacement records', 'Custom requests', 'Active paid agreements', 'Active sales (INR)', 'Average agreement value (INR)', 'Cash received (INR)', 'Confirmed refunds (INR)', 'Net cash (INR)', 'Possible test cash (INR)', 'Paid values missing'], [...periods.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, row]) => [key, row.originals, row.revisions, row.custom, row.paid, row.sales, row.paid && !row.missing ? row.sales / row.paid : null, row.cash, row.refunds, row.cash - row.refunds, row.flaggedCash, row.missing]), [5, 6, 7, 8, 9, 10]);

  const eligible = facts.filter(row => row.activePaid);
  const salesTotal = eligible.reduce((sum, row) => sum + number(row.value), 0);
  const salesComplete = eligible.every(row => row.value !== null);
  const performance: ReportValue[][] = [];
  for (const dimension of ['Source', 'Agreement type', 'City', 'Language'] as const) {
    const groups = new Map<string, typeof facts>();
    for (const row of eligible) { const key = dimension === 'Source' ? row.source : dimension === 'Agreement type' ? row.service : dimension === 'City' ? row.city : row.language; if (!groups.has(key)) groups.set(key, []); groups.get(key)!.push(row); }
    for (const [key, rows] of groups) {
      const sales = rows.reduce((sum, row) => sum + number(row.value), 0), missing = rows.filter(row => row.value === null).length;
      performance.push([dimension, key, rows.length, new Set(rows.map(row => row.uid).filter(Boolean)).size, sales, missing ? null : sales / rows.length, salesTotal && salesComplete ? sales / salesTotal : null, rows.filter(row => row.notary).length, rows.reduce((sum, row) => sum + row.copies, 0), rows.filter(row => row.test).length, missing]);
    }
  }
  add('Sales Breakdown', 'Current active paid agreements only. Each dimension is an independent breakdown of the same sales; do not sum across dimensions. City is trimmed and case-normalised, not geographically inferred. Unknown values are shown explicitly. Shares are unavailable when any sales value is missing.', ['Dimension', 'Category', 'Paid agreements', 'Unique customers', 'Known sales (INR)', 'Average agreement value (INR)', 'Sales share', 'Notarised agreements', 'Printed copies', 'Possible test agreements', 'Paid values missing'], performance, [4, 5], [6]);

  const pipeline = new Map<string, typeof facts>();
  for (const row of facts) { const key = JSON.stringify([row.source, row.status, row.payment]); if (!pipeline.has(key)) pipeline.set(key, []); pipeline.get(key)!.push(row); }
  add('Status Pipeline', 'Current status snapshot, not a historical conversion funnel. Replaced/cancelled records are retained in separate groups. Age is days since last update; it is not a promised SLA.', ['Source', 'Status', 'Payment status', 'Records', 'Active records', 'Active paid records', 'Known active sales (INR)', 'Oldest update age (days)', 'Updates missing', 'Possible test records'], [...pipeline.values()].map(rows => { const ages = rows.map(row => age(row.updated)).filter((value): value is number => value !== null); return [rows[0].source, rows[0].status, rows[0].payment, rows.length, rows.filter(row => row.active).length, rows.filter(row => row.activePaid).length, rows.reduce((sum, row) => sum + number(valueOf(row)), 0), ages.length ? Math.max(...ages) : null, rows.length - ages.length, rows.filter(row => row.test).length]; }), [6]);

  const ids = new Set([...data.customerProfiles.map(row => row.id), ...data.referralAccounts.map(row => row.id), ...facts.map(row => row.uid)].filter(Boolean));
  const byCustomer = new Map<string, typeof facts>();
  for (const row of facts) { if (!byCustomer.has(row.uid)) byCustomer.set(row.uid, []); byCustomer.get(row.uid)!.push(row); }
  const customerCash = new Map<string, number>(), customerRefunds = new Map<string, number>();
  for (const row of payments) customerCash.set(row.uid, (customerCash.get(row.uid) || 0) + number(row.amount));
  for (const row of refunds) customerRefunds.set(row.uid, (customerRefunds.get(row.uid) || 0) + number(row.amount));
  add('Customer Value', 'Ranked by confirmed cash received less completed refunds. Repeat means at least two current active paid agreements; replacement history does not count as repeat business. Cash includes historical cancelled/replaced payments. Refunds are confirmed only; net cash is not profit. Creation dates measure agreement/request activity, not logins. Unknown account IDs are excluded from this customer view and flagged in Data Quality.', ['Customer ID', 'Segment', 'First agreement created (IST)', 'Latest agreement created (IST)', 'Days since latest agreement', 'Active paid agreements', 'Active sales (INR)', 'Confirmed cash (INR)', 'Confirmed refunds (INR)', 'Net cash (INR)', 'Open work', 'Possible test records'], [...ids].map(uid => {
    const owned = byCustomer.get(uid) || [], paid = owned.filter(row => row.activePaid);
    const dates = owned.map(row => row.created).filter((value): value is Date => value !== null).sort((a, b) => a.getTime() - b.getTime());
    const cash = customerCash.get(uid) || 0, refunded = customerRefunds.get(uid) || 0;
    return [uid, paid.length > 1 ? 'Repeat paid customer' : paid.length === 1 ? 'One active paid agreement' : 'No active paid agreement', dates[0] || null, dates.at(-1) || null, age(dates.at(-1)), paid.length, paid.reduce((sum, row) => sum + number(row.value), 0), cash, refunded, cash - refunded, owned.filter(row => row.active && !['Delivered', 'Completed'].includes(row.status)).length, owned.filter(row => row.test).length];
  }).sort((a, b) => Number(b[9]) - Number(a[9])), [6, 7, 8, 9]);

  const queue: ReportValue[][] = [];
  for (const row of facts.filter(row => row.active && !['Delivered', 'Completed'].includes(row.status))) {
    const action = row.original.replacementPendingId ? 'Review pending replacement' : /Clarification|Documents needed/.test(row.status) ? 'Follow up with customer' : row.payment === 'Failed' ? 'Follow up on failed payment' : row.payment !== 'Paid' ? 'Confirm quote/payment status' : row.status === 'Dispatched' ? 'Check delivery progress' : 'Review and prepare agreement';
    queue.push([row.reference, row.uid, row.source, row.status, row.payment, action, row.updated, age(row.updated), row.test, '', null]);
  }
  for (const request of data.creditRefundRequests || []) if (['Awaiting approval', 'Processing'].includes(request.state)) {
    const pending = (request.legs || []).filter((leg: Row) => !['COMPLETED', 'FAILED', 'REJECTED'].includes(leg.state));
    queue.push([request.orderId || '', request.ownerUid, 'Refund', request.state, 'Refund unconfirmed', request.state === 'Awaiting approval' ? 'Review refund approval' : 'Check existing refund status before retrying', reportDate(request.updatedAt), age(request.updatedAt), byRef.get(request.orderId)?.test ?? null, request.id, pending.length ? pending.reduce((sum: number, leg: Row) => sum + number(leg.amount), 0) : null]);
  }
  add('Action Queue', 'Open standard/custom work and pending refund requests, oldest update first. Suggested actions prompt staff review, not automated decisions or SLA breaches. Completed/cancelled/replaced agreements are excluded; their pending refunds may still appear. Pending refund amounts are not deducted from confirmed net cash.', ['Order or request reference', 'Customer ID', 'Source', 'Status', 'Payment status', 'Suggested next action', 'Updated (IST)', 'Days since update', 'Possible test record', 'Refund reference', 'Unconfirmed refund (INR)'], queue.sort((a, b) => Number(b[7] ?? -1) - Number(a[7] ?? -1)), [10]);

  const issues: ReportValue[][] = [];
  const issue = (ref: string, uid: string, kind: string, detail: string) => issues.push([ref, uid, kind, detail]);
  const profiles = new Map(data.customerProfiles.map(row => [row.id, row]));
  for (const row of facts) {
    if (!row.uid) issue(row.reference, '', 'Missing customer ID', 'Record cannot be linked to a customer account.');
    if (!row.created) issue(row.reference, row.uid, 'Missing/invalid creation date', 'Creation month is unavailable.');
    if (!row.updated) issue(row.reference, row.uid, 'Missing/invalid update date', 'Age and follow-up ordering are incomplete.');
    if (row.activePaid && !row.paidAt) issue(row.reference, row.uid, 'Missing payment date', 'Active sales appear under Date unavailable.');
    if (row.activePaid && row.value === null) issue(row.reference, row.uid, 'Missing paid value', 'Known sales totals exclude this unknown value; averages are suppressed.');
    if (row.test) issue(row.reference, row.uid, 'Possible test record', 'Explicit QA TEST / TEST ONLY label found. Included in all totals; confirm before business use.');
  }
  for (const uid of ids) if (!profiles.get(uid)?.name || !profiles.get(uid)?.phone) issue('', uid, 'Incomplete account profile', 'Saved account name/mobile missing. Agreement parties are not substituted.');
  for (const row of payments) if (!byRef.has(row.reference)) issue(row.reference, row.uid, 'Unlinked payment', 'Cash is included, but service/test classification cannot be established.');
  add('Data Quality', 'Review these exceptions before business decisions. No records are silently excluded or corrected. An empty sheet means no checks here flagged an exception, not that every business rule has been audited.', ['Order or request reference', 'Customer ID', 'Issue', 'Explanation'], issues);
  return sheets;
}
