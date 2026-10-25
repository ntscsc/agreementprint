import PDFDocument from 'pdfkit';
import path from 'node:path';
import { VENDOR_CONFIG } from '@/src/config/vendor';
import type { OrderBill } from './order-bill';

export async function renderOrderBill(bill: OrderBill, supportEmail: string): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4', margin: 48,
    font: path.join(process.cwd(), 'public/fonts/NotoSans-Regular.ttf'),
    info: { Title: `Order bill ${bill.reference}`, Author: 'AgreementPrint' },
  });
  const chunks: Buffer[] = [];
  const output = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  // Keep customer-entered control characters out of the document.
  const clean = (value: string) => value.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 500);
  const text = (value: string, size = 10, color = '#334155') => {
    doc.fontSize(size).fillColor(color).text(clean(value), 48, doc.y, { width: 499, lineGap: 4 });
  };
  const date = (value?: string) => {
    if (!value || !Number.isFinite(Date.parse(value))) return 'Not recorded';
    return new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) + ' IST';
  };
  text('AgreementPrint', 25, '#172343');
  text('ORDER BILL / PAYMENT RECEIPT', 12, '#166534');
  doc.moveDown();
  text(`Operated by ${VENDOR_CONFIG.name}`);
  text(`Support email: ${supportEmail}`);
  doc.moveDown();
  text(`Bill reference: ${bill.reference}`, 12, '#172343');
  text(`Order reference: ${bill.reference}`);
  text(`Ordered: ${date(bill.orderDate)}`);
  text(`Payment confirmed: ${date(bill.paidAt)}`);
  doc.moveDown();
  text('BILLED TO', 10, '#172343');
  text(bill.customerEmail || 'Customer account associated with this order');
  doc.moveDown();
  text('SERVICE', 10, '#172343');
  text(bill.description);
  doc.moveDown();
  const amount = (label: string, value: number, emphasis = false) => {
    if (doc.y > doc.page.height - 100) doc.addPage();
    const y = doc.y;
    doc.fontSize(emphasis ? 13 : 11).fillColor(emphasis ? '#166534' : '#334155');
    doc.text(label, 48, y, { width: 330 });
    doc.text(`Rs. ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 390, y, { width: 157, align: 'right' });
    doc.y = Math.max(doc.y, y + 25);
  };
  amount('Package total', bill.subtotal);
  if (bill.discount) amount(`Coupon discount${bill.couponCode ? ` (${bill.couponCode})` : ''}`, -bill.discount);
  if (bill.credits) amount('Referral credits used', -bill.credits);
  amount('Amount paid', bill.paid, true);
  text('Balance due: Rs. 0.00');
  doc.moveDown();
  text(`Payment method: ${bill.gateway}`);
  if (bill.transaction) text(`Transaction reference: ${bill.transaction}`);
  text('Payment status: Paid', 10, '#166534');
  doc.moveDown();
  text('This bill acknowledges the recorded payment for this order. It is not a GST tax invoice or a receipt for rent or security deposit. No additional tax has been calculated on this bill.', 9);
  text('System-generated document. Contact support with your order reference for billing questions.', 9);
  doc.end();
  return output;
}
