'use client';

import React, { useState } from 'react';
import { 
  Printer, 
  FileCheck, 
  ArrowLeft,
  Sparkles,
  Layers,
} from 'lucide-react';
import { PersonDetails, PropertyDetails, AgreementTerms } from '@/lib/types';
import { amountInWords } from '@/lib/number-to-words';
import { 
  formatExecutionDate, 
  formatLegalDate, 
  calculateAgreementEndDate, 
  formatNoticePeriodMonths, 
  formatPropertyDescription,
  getOrdinal 
} from '@/lib/agreement-formatter';

export interface AgreementDocumentData {
  ownerDetails?: Partial<PersonDetails>;
  tenantDetails?: Partial<PersonDetails>;
  propertyDetails?: Partial<PropertyDetails>;
  agreementTerms?: Partial<AgreementTerms>;
  orderId?: string;
  createdAt?: string;
}

interface RentalAgreementDocumentProps {
  data: AgreementDocumentData;
  onBack?: () => void;
  title?: string;
  customerPreview?: boolean;
}

const SampleDraftWatermark: React.FC = () => (
  <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden">
    <span className="rotate-[-30deg] whitespace-nowrap text-5xl font-black uppercase text-rose-800/15 sm:text-6xl">
      SAMPLE DRAFT
    </span>
  </div>
);

export const RentalAgreementDocument: React.FC<RentalAgreementDocumentProps> = ({
  data,
  onBack,
  title = 'Rental Agreement Draft Preview',
  customerPreview = false,
}) => {
  const [highlightFields, setHighlightFields] = useState<boolean>(true);
  const [stampPaperSpace, setStampPaperSpace] = useState<boolean>(true);

  const owner = data.ownerDetails || {};
  const tenant = data.tenantDetails || {};
  const prop = data.propertyDetails || {};
  const terms = data.agreementTerms || {};

  const cleanAddress = (addr?: string) => {
    if (!addr) return '';
    return addr.trim().replace(/,\s*India$/i, '').trim();
  };

  const executionDate = formatExecutionDate(terms.startDate || data.createdAt);
  const ownerName = owner.fullName || '';
  const ownerFather = owner.relativeName || '';
  const ownerAge = owner.age ? `${owner.age}` : '';
  const ownerAddress = cleanAddress(owner.address);

  const tenantName = tenant.fullName || '';
  const tenantFather = tenant.relativeName || '';
  const tenantAge = tenant.age ? `${tenant.age}` : '';
  const tenantAddress = cleanAddress(tenant.address);

  const propertyDesc = formatPropertyDescription(prop.propertyType, prop.furnishing, prop.businessName);
  const propertyFullAddress = prop.fullAddress 
    ? `${prop.fullAddress}${prop.city ? `, ${prop.city}` : ''}${prop.pincode ? ` - ${prop.pincode}` : ''}`
    : '';

  const rentAmount = terms.monthlyRent ? terms.monthlyRent.toLocaleString('en-IN') : '';
  const rentWords = amountInWords(terms.monthlyRent);
  const dueDay = terms.paymentDueDay ? getOrdinal(terms.paymentDueDay) : '5th';

  const depositAmount = terms.securityDeposit !== undefined && terms.securityDeposit !== null 
    ? terms.securityDeposit.toLocaleString('en-IN') 
    : '';
  const depositWords = amountInWords(terms.securityDeposit);

  const validFrom = formatLegalDate(terms.startDate);
  const validTo = calculateAgreementEndDate(terms.startDate, terms.tenureMonths || 11);

  const noticePeriod = formatNoticePeriodMonths(terms.noticePeriodDays);
  const showSecondPageStampPaperSpace =
    stampPaperSpace && terms.stampPaperDenomination === 200;

  const renderStampPaperAllowance = (pageNumber: 1 | 2) => (
    <div className="stamp-paper-allowance h-64 sm:h-72 border border-dashed border-stone-300 bg-stone-50/50 rounded-xl mb-8 flex flex-col items-center justify-center text-center p-4 print:border-none print:bg-transparent">
      <span className="no-print text-xs font-sans font-semibold text-stone-400 uppercase tracking-widest">
        [Space Reserved for Government ₹{terms.stampPaperDenomination || 100} Non-Judicial Stamp Paper / E-Stamp Certificate]
      </span>
      <span className="no-print text-[11px] font-sans text-stone-400 mt-1 max-w-sm">
        Page {pageNumber} text begins below this margin so it prints seamlessly on official ₹{terms.stampPaperDenomination || 100} Non-Judicial Tamil Nadu Stamp Paper.
      </span>
    </div>
  );

  const renderBlank = (value: React.ReactNode, isFilled: boolean, emptyWidthClass = 'w-36') => {
    if (!isFilled || !value) {
      return (
        <span className={`inline-block border-b-2 border-stone-400 ${emptyWidthClass} h-4 align-bottom mx-1`}></span>
      );
    }
    return (
      <span 
        className={
          highlightFields 
            ? 'agreement-field-highlight bg-amber-100/90 text-stone-900 font-bold px-1.5 py-0.5 rounded transition-colors border-b-2 border-amber-400'
            : 'text-stone-900 font-bold'
        }
      >
        {value}
      </span>
    );
  };

  const handlePrint = () => {
    try {
      window.print();
    } catch (err) {
      console.error('Print trigger error:', err);
    }
  };

  return (
    <div
      className={`w-full max-w-4xl mx-auto space-y-6 ${customerPreview ? 'customer-agreement-preview select-none' : ''}`}
      onContextMenu={customerPreview ? (event) => event.preventDefault() : undefined}
      onCopy={customerPreview ? (event) => event.preventDefault() : undefined}
      onCut={customerPreview ? (event) => event.preventDefault() : undefined}
    >
      {/* Top Toolbar (Hidden when printing) */}
      <div className="no-print bg-white border border-stone-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition cursor-pointer"
              title="Go Back"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-emerald-600" />
              <span>{title}</span>
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Highlight Inputs Toggle */}
          <button
            type="button"
            onClick={() => setHighlightFields(!highlightFields)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border cursor-pointer ${
              highlightFields 
                ? 'bg-amber-50 text-amber-900 border-amber-300' 
                : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Highlight Form Inputs</span>
          </button>

          {/* Stamp Margin Toggle */}
          <button
            type="button"
            onClick={() => setStampPaperSpace(!stampPaperSpace)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border cursor-pointer ${
              stampPaperSpace 
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300' 
                : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
            }`}
            title="Leave top space on Page 1 and, for ₹200 stamp paper, Page 2 for physical stamp paper execution"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Stamp Paper Top Margin ({stampPaperSpace ? 'Active' : 'Off'})</span>
          </button>

          {/* Print Action */}
          {!customerPreview && (
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition active:scale-95"
              title="Open browser print dialog"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
          )}
        </div>
      </div>

      {/* DOCUMENT CONTAINER */}
      <div id="printable-agreement-doc" className={`agreement-document-wrapper space-y-8 print:space-y-0 ${customerPreview ? 'customer-agreement-document' : ''}`}>
        
        {/* ================= PAGE 1 ================= */}
        <section 
          className="agreement-page relative bg-white border border-stone-200 rounded-2xl shadow-sm p-8 sm:p-14 text-stone-900 font-serif leading-relaxed text-[15px] max-w-[210mm] mx-auto min-h-[297mm] flex flex-col justify-between"
          style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}
        >
          {customerPreview && <SampleDraftWatermark />}
          <div>
            {/* Stamp Paper Allowance (Page 1 Header) */}
            {stampPaperSpace && (
              renderStampPaperAllowance(1)
            )}

            {/* Title */}
            <div className="text-center mb-8">
              <h1 className="text-lg sm:text-xl font-bold tracking-wider underline uppercase text-stone-900">
                RENTAL AGREEMENT
              </h1>
            </div>

            {/* Execution Clause */}
            <div className="space-y-6 text-justify">
              <p className="leading-loose">
                This Rental Agreement executed on this day of{' '}
                {renderBlank(executionDate, !!executionDate, 'w-48')}
              </p>

              {/* Owner Clause */}
              <div>
                <p className="leading-loose">
                  Between {renderBlank(ownerName, !!owner.fullName, 'w-48')}{' '}
                  S/o {renderBlank(ownerFather, !!owner.relativeName, 'w-44')}{' '}
                  aged about {renderBlank(ownerAge ? `${ownerAge} yrs.` : '', !!owner.age, 'w-20')}{' '}
                  residing at No. {renderBlank(ownerAddress, !!owner.address, 'w-72')}, India, hereafter called the &quot;OWNER&quot;
                </p>
              </div>

              {/* Conjunction */}
              <div className="text-center py-2">
                <span className="font-bold tracking-widest uppercase">AND</span>
              </div>

              {/* Tenant Clause */}
              <div>
                <p className="leading-loose">
                  {renderBlank(tenantName, !!tenant.fullName, 'w-48')}{' '}
                  S/o {renderBlank(tenantFather, !!tenant.relativeName, 'w-44')}{' '}
                  aged about {renderBlank(tenantAge ? `${tenantAge} yrs.` : '', !!tenant.age, 'w-20')}{' '}
                  residing at No. {renderBlank(tenantAddress, !!tenant.address, 'w-72')}, India, hereafter called the &quot;TENANT&quot;
                </p>
              </div>
            </div>
          </div>

          <div className="text-center pt-8 border-t border-stone-100 text-xs text-stone-400 font-sans print:hidden">
            Page 1 of 3 (Tamil Nadu Non-Judicial Stamping Format)
          </div>
        </section>

        {/* ================= PAGE 2 ================= */}
        <section 
          className="agreement-page relative bg-white border border-stone-200 rounded-2xl shadow-sm p-8 sm:p-14 text-stone-900 font-serif leading-relaxed text-[15px] max-w-[210mm] mx-auto min-h-[297mm] flex flex-col justify-between"
          style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}
        >
          {customerPreview && <SampleDraftWatermark />}
          {showSecondPageStampPaperSpace && (
            <div>{renderStampPaperAllowance(2)}</div>
          )}
          <div className="space-y-6 text-justify">
            {/* Preamble / Recital */}
            <p className="leading-loose">
              Whereas the &quot;OWNER&quot; is the absolute owner of the{' '}
              {renderBlank(propertyDesc, !!prop.propertyType, 'w-56')}
              <br />
              Which at No: {renderBlank(propertyFullAddress, !!propertyFullAddress, 'w-80')}
              <br />
              and more particulars described in the schedule hereunder written whereas the &quot;TENANT&quot; approached the OWNER for taking on rent the schedule mentioned property and both parties have agreed under the following terms and conditions.
            </p>

            {/* Clause 1: Monthly Rent */}
            <p className="leading-loose">
              <strong>1.</strong> The Tenant has agreed to pay monthly rent of Rs.{' '}
              {renderBlank(rentAmount ? `${rentAmount}/-` : '', !!terms.monthlyRent, 'w-24')}{' '}
              only (Rupees{' '}
              {renderBlank(rentWords, !!rentWords, 'w-64')}{' '}
              only) on or before the{' '}
              {renderBlank(dueDay, true, 'w-16')}{' '}
              of every month.
            </p>

            {/* Clause 2: Security Deposit */}
            <p className="leading-loose">
              <strong>2.</strong> The Tenant has paid on this date the sum of Rs.{' '}
              {renderBlank(depositAmount !== '' ? `${depositAmount}/-` : '', terms.securityDeposit !== undefined, 'w-28')}{' '}
              only (Rupees{' '}
              {renderBlank(depositWords, !!depositWords, 'w-64')}{' '}
              only) as security cum advance to the OWNER without interest. At the time of vacating, subject to any damages or any other amounts due to the OWNER by the TENANT will be deducted and refunded to the Tenant.
            </p>

            {/* Clause 3: Structural maintenance */}
            <p className="leading-loose">
              <strong>3.</strong> The TENANT shall be liable to keep the premises clear and without any alteration to the main structure of the building and shall be liable for any damages.
            </p>

            {/* Clause 4: Validity & Tenure */}
            <p className="leading-loose">
              <strong>4.</strong> This Rental Agreement is valid from{' '}
              {renderBlank(validFrom, !!validFrom, 'w-36')}{' '}
              to{' '}
              {renderBlank(validTo, !!validTo, 'w-36')}.
            </p>

            {/* Clause 5: Sub-letting */}
            <p className="leading-loose">
              <strong>5.</strong> The TENANT shall not transfer, sub-let or under-let the tenanted portions to anybody else and misuse of the same for any other purpose shall lead to termination of the tenancy by the OWNER.
            </p>

            {/* Clause 6: Notice Period & Determination */}
            <p className="leading-loose">
              <strong>6.</strong> The OWNER and TENANT shall have the right to determine this rental agreement for any breach of conditions by giving{' '}
              {renderBlank(noticePeriod, !!noticePeriod, 'w-20')}{' '}
              month notice to each other.
            </p>
          </div>

          <div className="text-center pt-8 border-t border-stone-100 text-xs text-stone-400 font-sans print:hidden">
            Page 2 of 3 (Terms & Conditions)
          </div>
        </section>

        {/* ================= PAGE 3 ================= */}
        <section 
          className="agreement-page relative bg-white border border-stone-200 rounded-2xl shadow-sm p-8 sm:p-14 text-stone-900 font-serif leading-relaxed text-[15px] max-w-[210mm] mx-auto min-h-[297mm] flex flex-col justify-between"
          style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}
        >
          {customerPreview && <SampleDraftWatermark />}
          <div className="space-y-6 text-justify">
            {/* Clause 7 */}
            <p className="leading-loose">
              <strong>7.</strong> The TENANT shall not use the demised premises for any unlawful and illegal purpose and shall be liable for any damages.
            </p>

            {/* Clause 8 */}
            <p className="leading-loose">
              <strong>8.</strong> The OWNER or his representative can Inspect the tenanted portions after intimation to the TENANT.
            </p>

            {/* Clause 9 */}
            <p className="leading-loose">
              <strong>9.</strong> The OWNER have to give the proper receipt for the Rental amount received from the TENANT.
            </p>

            {/* Clause 10 */}
            <p className="leading-loose">
              <strong>10.</strong> The TENANT shall not use the rental premises for any unlawful and illegal purpose and shall be liable for any damages.
            </p>

            {/* Clause 11 */}
            <p className="leading-loose">
              <strong>11.</strong> The Tenant shall not tamper or remove any of the fitting and fixtures in the said portion.
            </p>

            {/* Clause 12 */}
            <p className="leading-loose">
              <strong>12.</strong> The portion let out shall be kept in good and tenantable condition.
            </p>

            {/* In Witness Whereof */}
            <div className="pt-6">
              <p className="leading-loose">
                IN WITNESS WHERE THE PARTIES herein signed this Rental Agreement on the day, month and year first above written in the presence of:
              </p>
            </div>

            {/* Witness & Signature Block */}
            <div className="pt-10 grid grid-cols-2 gap-8 text-sm">
              {/* Left Column: Witness */}
              <div className="space-y-12">
                <div className="font-bold underline tracking-wider uppercase">
                  Witness
                </div>
                <div className="space-y-8">
                  <div>
                    <span className="font-bold">1.</span>
                    <div className="mt-8 border-b border-stone-400 w-4/5"></div>
                  </div>
                  <div>
                    <span className="font-bold">2.</span>
                    <div className="mt-8 border-b border-stone-400 w-4/5"></div>
                  </div>
                </div>
              </div>

              {/* Right Column: Owner & Tenant Signatures */}
              <div className="space-y-16 text-right sm:pr-8">
                <div>
                  <div className="mt-8 border-b border-stone-400 w-3/4 ml-auto"></div>
                  <p className="font-bold tracking-wider uppercase mt-2">
                    OWNER
                  </p>
                  <p className="text-xs text-stone-500 font-sans mt-0.5">
                    ({owner.fullName || 'Landlord Signature'})
                  </p>
                </div>

                <div>
                  <div className="mt-8 border-b border-stone-400 w-3/4 ml-auto"></div>
                  <p className="font-bold tracking-wider uppercase mt-2">
                    TENANT
                  </p>
                  <p className="text-xs text-stone-500 font-sans mt-0.5">
                    ({tenant.fullName || 'Tenant Signature'})
                  </p>
                </div>
              </div>
            </div>

          </div>

          <div className="text-center pt-8 border-t border-stone-100 text-xs text-stone-400 font-sans print:hidden">
            Page 3 of 3 (Witness & Signatures)
          </div>
        </section>

      </div>
    </div>
  );
};
