'use client';

import { useState, type FormEvent } from 'react';
import { Download, Printer, ReceiptText } from 'lucide-react';
import { numberToWordsIndian } from '@/lib/number-to-words';

interface ReceiptFormData {
  landlordName: string;
  tenantName: string;
  propertyAddress: string;
  monthlyRent: string;
  paymentDate: string;
  months: string;
}

interface RentReceiptData {
  landlordName: string;
  tenantName: string;
  propertyAddress: string;
  monthlyRent: number;
  paymentDate: Date;
  periodEndDate: Date;
}

const initialFormData: ReceiptFormData = {
  landlordName: '',
  tenantName: '',
  propertyAddress: '',
  monthlyRent: '',
  paymentDate: '',
  months: '1',
};

const amountFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

function formatReceiptDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function addMonthsClamped(date: Date, months: number) {
  const targetMonth = date.getMonth() + months;
  const lastDayOfTargetMonth = new Date(date.getFullYear(), targetMonth + 1, 0).getDate();

  return new Date(
    date.getFullYear(),
    targetMonth,
    Math.min(date.getDate(), lastDayOfTargetMonth),
  );
}

export function RentReceiptGenerator() {
  const [formData, setFormData] = useState(initialFormData);
  const [receipts, setReceipts] = useState<RentReceiptData[]>([]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const [year, month, day] = formData.paymentDate.split('-').map(Number);
    const firstPaymentDate = new Date(year, month - 1, day);
    const receiptCount = Number(formData.months);
    const receiptData: RentReceiptData = {
      landlordName: formData.landlordName.trim(),
      tenantName: formData.tenantName.trim(),
      propertyAddress: formData.propertyAddress.trim(),
      monthlyRent: Number(formData.monthlyRent),
      paymentDate: firstPaymentDate,
      periodEndDate: addMonthsClamped(firstPaymentDate, 1),
    };

    setReceipts(
      Array.from({ length: receiptCount }, (_, index) => ({
        ...receiptData,
        paymentDate: addMonthsClamped(firstPaymentDate, index),
        periodEndDate: addMonthsClamped(firstPaymentDate, index + 1),
      })),
    );
  }

  function updateField(field: keyof ReceiptFormData, value: string) {
    setFormData((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={handleSubmit}
        className="no-print rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8"
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-stone-700">
            Monthly rent amount (₹)
            <input
              type="number"
              min="1"
              step="1"
              required
              value={formData.monthlyRent}
              onChange={(event) => updateField('monthlyRent', event.target.value)}
              placeholder="e.g. 15000"
              className="mt-1.5 w-full rounded-xl border border-stone-300 px-3.5 py-3 text-sm text-stone-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            />
          </label>

          <label className="block text-sm font-semibold text-stone-700">
            Property address
            <textarea
              required
              rows={2}
              value={formData.propertyAddress}
              onChange={(event) => updateField('propertyAddress', event.target.value)}
              placeholder="Full address of the rented property"
              className="mt-1.5 w-full resize-y rounded-xl border border-stone-300 px-3.5 py-3 text-sm text-stone-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            />
          </label>

          <label className="block text-sm font-semibold text-stone-700">
            Landlord name
            <input
              type="text"
              required
              maxLength={120}
              value={formData.landlordName}
              onChange={(event) => updateField('landlordName', event.target.value)}
              autoComplete="name"
              className="mt-1.5 w-full rounded-xl border border-stone-300 px-3.5 py-3 text-sm text-stone-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            />
          </label>

          <label className="block text-sm font-semibold text-stone-700">
            Tenant name
            <input
              type="text"
              required
              maxLength={120}
              value={formData.tenantName}
              onChange={(event) => updateField('tenantName', event.target.value)}
              autoComplete="name"
              className="mt-1.5 w-full rounded-xl border border-stone-300 px-3.5 py-3 text-sm text-stone-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            />
          </label>

          <label className="block text-sm font-semibold text-stone-700">
            First rent period start date
            <input
              type="date"
              required
              value={formData.paymentDate}
              onChange={(event) => updateField('paymentDate', event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-stone-300 px-3.5 py-3 text-sm text-stone-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            />
            <span className="mt-1 block text-xs font-normal text-stone-500">
              The start and end dates for each monthly receipt are generated automatically.
            </span>
          </label>

          <label className="block text-sm font-semibold text-stone-700">
            Number of monthly receipts
            <input
              type="number"
              min="1"
              max="12"
              step="1"
              required
              value={formData.months}
              onChange={(event) => updateField('months', event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-stone-300 px-3.5 py-3 text-sm text-stone-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            />
          </label>

        </div>

        <button
          type="submit"
          className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3.5 text-sm font-bold text-stone-950 transition-colors hover:bg-amber-400 sm:w-auto"
        >
          <ReceiptText className="h-4 w-4" />
          Generate receipts
        </button>
      </form>

      {receipts.length > 0 && (
        <section aria-live="polite" className="space-y-5">
          <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-stone-900">
                {receipts.length} {receipts.length === 1 ? 'receipt' : 'receipts'} ready
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                Use Print or choose “Save as PDF” in your browser&apos;s print dialog.
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-stone-700"
            >
              <Printer className="h-4 w-4" />
              Print / Save as PDF
              <Download className="h-4 w-4" />
            </button>
          </div>

          <div className="rent-receipt-print-area space-y-5">
            {receipts.map((receipt, index) => (
              <article
                key={`${receipt.paymentDate.toISOString()}-${index}`}
                className="rent-receipt-page mx-auto max-w-3xl rounded-xl border border-stone-200 bg-white p-6 shadow-sm sm:p-10"
              >
                <div className="rent-receipt-top-rule" aria-hidden="true">
                  <span />
                  <span />
                </div>

                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-2xl font-bold tracking-tight text-black">
                    House Rent Receipt
                  </h2>
                  <p className="shrink-0 text-lg font-semibold text-black">
                    Dated: {formatReceiptDate(receipt.paymentDate)}
                  </p>
                </div>

                <p className="mt-20 text-lg leading-relaxed text-black sm:mt-24">
                  This is to acknowledge receipt from <strong>{receipt.tenantName}</strong> the sum
                  of <strong>Rs. {amountFormatter.format(receipt.monthlyRent)}/-</strong>{' '}
                  <strong>
                    ({numberToWordsIndian(receipt.monthlyRent)} Rupees)
                  </strong>{' '}
                  towards rent payment for the period from{' '}
                  <strong>{formatReceiptDate(receipt.paymentDate)}</strong> to{' '}
                  <strong>{formatReceiptDate(receipt.periodEndDate)}</strong> towards the property
                  at <strong>{receipt.propertyAddress}</strong>.
                </p>

                <div className="mt-20 flex items-start justify-between gap-8 text-lg text-black sm:mt-24">
                  <div>
                    <h3 className="font-bold">Landlord Details</h3>
                    <p className="mt-8">{receipt.landlordName}</p>
                  </div>
                  <div className="text-right">
                    <h3 className="font-bold">Signature</h3>
                    <p className="mt-8">({receipt.landlordName})</p>
                  </div>
                </div>

                <p className="mt-20 text-center text-base text-stone-400 sm:mt-24">
                  This is a system-generated rent receipt from StampSure.
                </p>
                <div className="rent-receipt-bottom-rule mt-12" aria-hidden="true" />
              </article>
            ))}
          </div>
          <p className="no-print text-center text-xs leading-relaxed text-stone-500">
            Generate a receipt only for rent you have actually received. Review the details before
            signing; this tool does not verify payment or provide tax or legal advice.
          </p>
        </section>
      )}
    </div>
  );
}
