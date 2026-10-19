import { createHash } from 'node:crypto';
import type { ReportSheet, ReportValue } from './admin-report-xlsx';

type Row = Record<string, any>;

// Export aliases are deterministic across downloads, independent of row order.
// Original references remain available for support and payment reconciliation.
export function presentReportSheets(sheets: ReportSheet[], profiles: Row[], custom: Row[], orders: Row[]): ReportSheet[] {
  const customers = new Map<string, Row>();
  const mergeCustomer = (uid: string, values: Row) => {
    const saved = customers.get(uid) || {};
    for (const key of ['name', 'phone', 'email']) if (typeof values[key] === 'string' && values[key].trim()) saved[key] = values[key];
    customers.set(uid, saved);
  };
  for (const row of orders) if (row.ownerUid) mergeCustomer(row.ownerUid, { email: row.customerEmail });
  for (const row of custom) if (row.ownerUid) mergeCustomer(row.ownerUid, row);
  for (const row of profiles) mergeCustomer(row.id, row);
  const orderOwners = new Map(orders.map(row => [String(row.orderId || row.id), row.ownerUid]));
  const requestOwners = new Map(custom.map(row => [String(row.requestId || row.id), row.ownerUid]));
  const aliases = new Map<string, string>();
  const alias = (kind: string, value: ReportValue): string => {
    if (value === null || value === undefined || value === '') return '';
    const source = `${kind}:${value}`;
    const digest = createHash('sha256').update(source).digest('hex');
    // Ten decimal digits, with no leading zero. Never silently merge collisions.
    const number = BigInt(1_000_000_000) + BigInt(`0x${digest}`) % BigInt(9_000_000_000);
    const result = `${kind}-${number}`;
    if (aliases.has(result) && aliases.get(result) !== source) throw new Error('Report reference collision. Please contact support.');
    aliases.set(result, source);
    return result;
  };
  return sheets.map(sheet => {
    const uidColumn = sheet.headers.indexOf('Customer ID');
    const accountColumn = sheet.headers.indexOf('Account ID');
    const customerColumn = uidColumn >= 0 ? uidColumn : accountColumn;
    const inferredOrderColumn = ['Printing & Fulfilment', 'Courier & Delivery'].includes(sheet.name) ? sheet.headers.indexOf('Order reference') : -1;
    const hasCustomer = customerColumn >= 0 || inferredOrderColumn >= 0;
    const references = sheet.headers.flatMap((header, index) => {
      const kind = /^(Order reference|Replaces order|Replaced by|Original order|Replacement order)$/.test(header) ? 'ORD'
        : header === 'Request reference' && ['Custom Quotes', 'Admin Activity'].includes(sheet.name) ? 'REQ'
        : /^(Order or request reference|Order or request|Reference)$/.test(header) && ['Payments', 'Sales & Revenue', 'Order Analytics', 'Action Queue', 'Data Quality'].includes(sheet.name) ? 'AUTO'
        : /^(Order or request)$/.test(header) && sheet.name === 'Payment Attempts' ? 'AUTO'
        : /^(Payment reference|Original payment reference)$/.test(header) || header === 'Reference' && sheet.name === 'Payment Attempts' ? 'PAY'
        : /^(Refund reference|Refund request)$/.test(header) ? 'RFD'
        : header === 'Refund transaction reference' ? 'RFT'
        : header === 'Replacement reference' ? 'REP'
        : header === 'Event reference' ? 'EVT'
        : header === 'Log reference' ? 'LOG'
        : header === 'Review reference' ? 'REV' : '';
      return kind ? [{ index, kind, header: /Order or request/.test(header) || header === 'Reference' && kind === 'AUTO' ? 'Report reference' : `${header} (readable)` }] : [];
    });
    const technical = (header: string) => /reference|\bID\b|^Replaces order$|^Replaced by$|^Original order$|^Replacement order$|^Order or request$/.test(header);
    const columns = sheet.headers.map((_, index) => index).sort((a, b) => Number(technical(sheet.headers[a])) - Number(technical(sheet.headers[b])));
    const prefix = [...(hasCustomer ? ['Customer reference', 'Customer name', 'Customer mobile', 'Customer email'] : []), ...references.map(ref => ref.header)];
    return {
      ...sheet,
      note: sheet.note + (prefix.length ? ' Readable references are report-only aliases, stable across exports. Original system references are retained in the final columns. Missing account details are not inferred from Owner/Tenant details.' : ''),
      headers: [...prefix, ...columns.map(index => {
        const header = sheet.headers[index];
        if (header === 'Customer ID') return 'Internal customer ID';
        if (sheet.name === 'Custom Quotes' && ['Customer name', 'Mobile', 'Email'].includes(header)) return `Request contact ${header === 'Customer name' ? 'name' : header.toLowerCase()}`;
        return header;
      })],
      money: sheet.money?.map(index => prefix.length + columns.indexOf(index)),
      percent: sheet.percent?.map(index => prefix.length + columns.indexOf(index)),
      rows: sheet.rows.map(row => {
        const uid = String(customerColumn >= 0 ? row[customerColumn] ?? '' : inferredOrderColumn >= 0 ? orderOwners.get(String(row[inferredOrderColumn])) ?? '' : '');
        const person = customers.get(uid);
        const customer: ReportValue[] = hasCustomer ? [alias('CUS', uid), person?.name || 'Not recorded', person?.phone || 'Not recorded', person?.email || 'Not recorded'] : [];
        return [...customer, ...references.map(ref => {
          const value = row[ref.index];
          const kind = ref.kind === 'AUTO' ? requestOwners.has(String(value)) ? 'REQ' : orderOwners.has(String(value)) ? 'ORD' : 'REF' : ref.kind;
          return alias(kind, value);
        }), ...columns.map(index => row[index])];
      }),
    };
  });
}
