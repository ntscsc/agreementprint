'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { 
  Printer, 
  FileCheck, 
  ArrowLeft,
  Sparkles,
  Layers,
} from 'lucide-react';
import { PersonDetails, PropertyDetails, AgreementTerms } from '@/lib/types';
import { amountInWords } from '@/lib/number-to-words';
import { TamilRentalAgreement } from '@/components/agreement/TamilRentalAgreement';
import { LeaseAgreement } from '@/components/agreement/LeaseAgreement';
import { 
  formatExecutionDate, 
  formatLegalDate, 
  calculateAgreementEndDate, 
  formatPropertyDescription,
  formatPropertyAddress,
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
  blankStampSpace?: boolean;
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
  title,
  customerPreview = false,
  blankStampSpace = false,
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
  const ownerAddress = cleanAddress(owner.address) + (owner.pincode && !owner.address?.includes(owner.pincode) ? ` - ${owner.pincode}` : '');

  const tenantName = tenant.fullName || '';
  const tenantFather = tenant.relativeName || '';
  const tenantAge = tenant.age ? `${tenant.age}` : '';
  const tenantAddress = cleanAddress(tenant.address) + (tenant.pincode && !tenant.address?.includes(tenant.pincode) ? ` - ${tenant.pincode}` : '');

  const propertyDesc = formatPropertyDescription(prop.propertyType, prop.furnishing, prop.businessName);
  const propertyFullAddress = formatPropertyAddress(prop.fullAddress, prop.city, prop.pincode);

  const rentAmount = terms.monthlyRent ? terms.monthlyRent.toLocaleString('en-IN') : '';
  const rentWords = amountInWords(terms.monthlyRent);
  const dueDay = terms.paymentDueDay ? getOrdinal(terms.paymentDueDay) : '5th';

  const depositAmount = terms.securityDeposit !== undefined && terms.securityDeposit !== null 
    ? terms.securityDeposit.toLocaleString('en-IN') 
    : '';
  const depositWords = terms.securityDeposit === 0 ? 'Zero Rupees' : amountInWords(terms.securityDeposit);

  const validFrom = formatLegalDate(terms.startDate);
  const validTo = calculateAgreementEndDate(terms.startDate, terms.tenureMonths || 11);

  const isEnglish200 = terms.stampPaperDenomination === 200;
  const noticeDays = terms.noticePeriodDays ?? 30;
  const noticePeriod = noticeDays > 0 && noticeDays % 30 === 0
    ? `${noticeDays / 30} month${noticeDays === 30 ? '' : 's'}`
    : `${noticeDays} days`;
  const showSecondPageStampPaperSpace =
    stampPaperSpace && terms.stampPaperDenomination === 200;

  const renderStampPaperAllowance = (pageNumber: 1 | 2) => (
    <div className="stamp-paper-allowance w-full">
      {!blankStampSpace && <Image src="/images/stamp-paper-100.png" alt={`₹100 non-judicial stamp reference image — page ${pageNumber}`} width={1119} height={563} unoptimized className="h-full w-full object-contain" />}
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

  const partySignatures = (
    <div className="mt-8 grid grid-cols-2 gap-8 text-sm">
      <div><div className="mb-2 border-b border-stone-400 pt-8" /><p className="font-bold">OWNER</p><p className="text-xs">{ownerName}</p></div>
      <div className="text-right"><div className="mb-2 border-b border-stone-400 pt-8" /><p className="font-bold">TENANT</p><p className="text-xs">{tenantName}</p></div>
    </div>
  );

  const propertyPreamble = (
    <p className="leading-loose">
              The &quot;OWNER&quot; is the absolute owner of the{' '}
              {renderBlank(propertyDesc, !!prop.propertyType, 'w-56')}
              <br />
              situated at {renderBlank(propertyFullAddress, !!propertyFullAddress, 'w-80')}.
              <br />
              The &quot;TENANT&quot; has approached the OWNER to rent the premises described above, and both parties have agreed to the following terms and conditions.
            </p>
  );

  const validityClauses = (<>
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
              notice to each other.
            </p>
  </>);

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
              <span>{title || `${terms.agreementType === 'Lease' ? 'Lease' : 'Rental'} Agreement Draft Preview`}</span>
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Highlight Inputs Toggle */}
          {terms.language !== 'Tamil' && (
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
          )}

          {/* Stamp Margin Toggle */}
          {blankStampSpace ? <span className="text-sm font-medium text-stone-700">Blank space reserved for stamp paper</span> : <button
            type="button"
            onClick={() => setStampPaperSpace(!stampPaperSpace)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border cursor-pointer ${
              stampPaperSpace 
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300' 
                : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
            }`}
            title="Show the supplied ₹100 stamp image on page 1 and, for ₹200 orders, page 2"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Stamp Image &amp; Top Margin ({stampPaperSpace ? 'Active' : 'Off'})</span>
          </button>}

          {/* Print Action */}
          {!customerPreview && !!terms.extraCopies && <span className="text-sm font-semibold text-stone-800">Print {1 + terms.extraCopies} copies total on ₹{terms.stampPaperDenomination ?? 100} stamp paper. Set the copy count in the print dialog.</span>}
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
        {terms.agreementType === 'Lease' ? (
          <LeaseAgreement data={data} stampPaperSpace={stampPaperSpace} stampMargin={renderStampPaperAllowance} watermark={customerPreview ? <SampleDraftWatermark /> : undefined} highlightFields={highlightFields} />
        ) : terms.language === 'Tamil' ? (
          <TamilRentalAgreement data={data} stampPaperSpace={stampPaperSpace} customerPreview={customerPreview} watermark={<SampleDraftWatermark />} stampMargin={renderStampPaperAllowance} />
        ) : (<>
        
        {/* ================= PAGE 1 ================= */}
        <section 
          className="agreement-page relative bg-white border border-stone-200 rounded-2xl shadow-sm p-8 sm:p-14 text-stone-900 font-serif leading-relaxed text-[15px] max-w-[210mm] mx-auto min-h-[297mm] flex flex-col justify-between"
          style={{ fontFamily: '"Agreement Symbols", Georgia, Cambria, "Times New Roman", Times, serif' }}
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
            <div className={isEnglish200 ? "space-y-4 text-justify text-[14px] [&_.leading-loose]:leading-[1.6]" : "space-y-6 text-justify"}>
              <p className="leading-loose">
                This Rental Agreement is executed on the{' '}
                {renderBlank(executionDate, !!executionDate, 'w-48')}
              </p>

              {/* Owner Clause */}
              <div>
                <p className="leading-loose">
                  Between {renderBlank(ownerName, !!owner.fullName, 'w-48')}{' '}
                  {owner.relativeName?.trim() && <>{owner.relationship || 'Parent / spouse:'} {renderBlank(ownerFather, true, 'w-44')}{' '}</>}
                  aged about {renderBlank(ownerAge ? `${ownerAge} years` : '', !!owner.age, 'w-20')}{' '}
                  residing at {renderBlank(ownerAddress, !!owner.address, 'w-72')}, India, hereinafter called the &quot;OWNER&quot;
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
                  {tenant.relativeName?.trim() && <>{tenant.relationship || 'Parent / spouse:'} {renderBlank(tenantFather, true, 'w-44')}{' '}</>}
                  aged about {renderBlank(tenantAge ? `${tenantAge} years` : '', !!tenant.age, 'w-20')}{' '}
                  residing at {renderBlank(tenantAddress, !!tenant.address, 'w-72')}, India, hereinafter called the &quot;TENANT&quot;
                </p>
              </div>
            </div>
          </div>

          {isEnglish200 && <div className="mt-4 text-justify text-[14px] [&_.leading-loose]:leading-[1.6]">{propertyPreamble}</div>}
          {partySignatures}
          <div className="text-center pt-8 border-t border-stone-100 text-xs text-stone-400 font-sans print:hidden">
            Page 1 of 3 (Tamil Nadu Non-Judicial Stamping Format)
          </div>
        </section>

        {/* ================= PAGE 2 ================= */}
        <section 
          className="agreement-page relative bg-white border border-stone-200 rounded-2xl shadow-sm p-8 sm:p-14 text-stone-900 font-serif leading-relaxed text-[15px] max-w-[210mm] mx-auto min-h-[297mm] flex flex-col justify-between"
          style={{ fontFamily: '"Agreement Symbols", Georgia, Cambria, "Times New Roman", Times, serif' }}
        >
          {customerPreview && <SampleDraftWatermark />}
          {showSecondPageStampPaperSpace && (
            <div>{renderStampPaperAllowance(2)}</div>
          )}
          <div className="space-y-6 text-justify">
            {!isEnglish200 && propertyPreamble}

            {/* Clause 1: Monthly Rent */}
            <p className="leading-loose">
              <strong>1.</strong> The TENANT has agreed to pay monthly rent of ₹{' '}
              {renderBlank(rentAmount ? `${rentAmount}/-` : '', !!terms.monthlyRent, 'w-24')}{' '}
              ({' '}
              {renderBlank(rentWords, !!rentWords, 'w-64')}{' '}
              only) on or before the{' '}
              {renderBlank(dueDay, true, 'w-16')}{' '}
              of every month.
              {' '}The TENANT shall also pay monthly maintenance of ₹ {renderBlank((terms.maintenanceCharges ?? 0).toLocaleString('en-IN'), true)}/-.
            </p>

            {/* Clause 2: Security Deposit */}
            <p className="leading-loose">
              <strong>2.</strong> The TENANT has paid on this date the sum of ₹{' '}
              {renderBlank(depositAmount !== '' ? `${depositAmount}/-` : '', terms.securityDeposit !== undefined, 'w-28')}{' '}
              ({' '}
              {renderBlank(depositWords, !!depositWords, 'w-64')}{' '}
              only) as an interest-free security deposit and advance to the OWNER. When the TENANT vacates the premises, the OWNER shall refund the balance after deducting the cost of any damage and any other amounts due from the TENANT.
              {prop.propertyType !== 'Commercial Shop' && typeof terms.paintingDeduction === 'number' && terms.paintingDeduction > 0 && <>{' '}The TENANT agrees that ₹ {renderBlank(terms.paintingDeduction.toLocaleString('en-IN'), true)}/- towards painting charges shall be deducted from the security deposit when vacating the premises.</>}
            </p>

            {/* Clause 3: Structural maintenance */}
            <p className="leading-loose">
              <strong>3.</strong> The TENANT shall keep the premises clean, shall not alter the main structure of the building, and shall be liable for damage caused by the TENANT.
            </p>

            {!isEnglish200 && validityClauses}
          </div>

          {partySignatures}
          <div className="text-center pt-8 border-t border-stone-100 text-xs text-stone-400 font-sans print:hidden">
            Page 2 of 3 (Terms & Conditions)
          </div>
        </section>

        {/* ================= PAGE 3 ================= */}
        <section 
          className="agreement-page relative bg-white border border-stone-200 rounded-2xl shadow-sm p-8 sm:p-14 text-stone-900 font-serif leading-relaxed text-[15px] max-w-[210mm] mx-auto min-h-[297mm] flex flex-col justify-between"
          style={{ fontFamily: '"Agreement Symbols", Georgia, Cambria, "Times New Roman", Times, serif' }}
        >
          {customerPreview && <SampleDraftWatermark />}
          <div className={isEnglish200 ? "space-y-3 text-justify text-[14px] [&_.leading-loose]:leading-[1.6]" : "space-y-6 text-justify"}>
            {isEnglish200 && validityClauses}
            {/* Clause 7 */}
            <p className="leading-loose">
              <strong>7.</strong> The TENANT shall not use the premises for any unlawful purpose and shall be liable for damage caused by the TENANT.
            </p>

            {/* Clause 8 */}
            <p className="leading-loose">
              <strong>8.</strong> The OWNER or the OWNER&apos;s representative may inspect the premises after informing the TENANT.
            </p>

            {/* Clause 9 */}
            <p className="leading-loose">
              <strong>9.</strong> The annual rent increase shall be {renderBlank(`${terms.rentIncreasePct ?? 0}%`, true)}.
            </p>

            {/* Clause 10 */}
            <p className="leading-loose">
              <strong>10.</strong> The TENANT shall not tamper with or remove any fittings or fixtures in the premises.
            </p>

            {/* Clause 11 */}
            <p className="leading-loose">
              <strong>11.</strong> The portion let out shall be kept in good and tenantable condition.
            </p>

            {/* In Witness Whereof */}
            <p className="leading-loose">
              <strong>12.</strong> If the TENANT fails to pay rent for two consecutive months, the OWNER may ask the TENANT to vacate the premises immediately and deduct the unpaid rent from the advance.
            </p>

            <div className="pt-6">
              <p className="leading-loose">
                IN WITNESS WHEREOF the parties have signed this Rental Agreement on the day, month and year first written above in the presence of:
              </p>
            </div>

            {/* Witness & Signature Block */}
            <div className={`${isEnglish200 ? 'pt-6' : 'pt-10'} grid grid-cols-2 gap-8 text-sm`}>
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
              <div className={`${isEnglish200 ? 'space-y-10' : 'space-y-16'} text-right sm:pr-8`}>
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

        </>)}
      </div>
    </div>
  );
};
