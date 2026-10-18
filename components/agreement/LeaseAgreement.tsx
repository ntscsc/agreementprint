import React from 'react';
import type { AgreementDocumentData } from './RentalAgreementDocument';
import { amountInWords } from '@/lib/number-to-words';
import { formatLegalDate, calculateAgreementEndDate, formatPropertyAddress, formatPropertyDescription } from '@/lib/agreement-formatter';

/** English residential lease, based on LEASE AGREEMENT BLANK for website.doc. */
export function LeaseAgreement({ data, stampPaperSpace, stampMargin, watermark, highlightFields }: {
  data: AgreementDocumentData;
  stampPaperSpace: boolean;
  stampMargin: (page: 1 | 2) => React.ReactNode;
  watermark?: React.ReactNode;
  highlightFields: boolean;
}) {
  const owner = data.ownerDetails || {};
  const tenant = data.tenantDetails || {};
  const property = data.propertyDetails || {};
  const terms = data.agreementTerms || {};
  const field = (value: React.ReactNode) => <strong className={highlightFields ? 'agreement-field-highlight bg-amber-100 px-1' : ''}>{value === undefined || value === '' ? '________________' : value}</strong>;
  const address = (person: typeof owner) => [person.address, person.pincode && !person.address?.includes(person.pincode) ? person.pincode : ''].filter(Boolean).join(' - ');
  const advance = <>{field(terms.securityDeposit?.toLocaleString('en-IN'))}/- ({field(amountInWords(terms.securityDeposit))} only)</>;
  const tenure = terms.tenureMonths ?? 11;
  const notice = terms.noticePeriodDays ?? 90;
  const city = property.city || 'Chennai';
  const signatures = <div className="mt-8 grid grid-cols-2 gap-10 text-sm"><div><div className="border-b border-stone-400 pt-8" /><p className="mt-2 font-bold">LESSOR</p><p>{owner.fullName}</p></div><div className="text-right"><div className="border-b border-stone-400 pt-8" /><p className="mt-2 font-bold">LESSEE</p><p>{tenant.fullName}</p></div></div>;
  const clauses: React.ReactNode[] = [
    <>The premises shall be leased with no separate monthly rent payable from {field(formatLegalDate(terms.startDate))}.</>,
    <>The LESSEE shall deposit in advance ₹ {advance} with the LESSOR and occupy the premises for {field(tenure)} months. At the end of the term, unless renewed, the advance shall be refunded without interest, after adjusting amounts due from the LESSEE. Interest on the deposited advance of ₹ {advance} shall be taken as rent by the LESSOR.</>,
    <>The lease period shall be {field(tenure)} months, from {field(formatLegalDate(terms.startDate))} to {field(calculateAgreementEndDate(terms.startDate, tenure))}. Extension shall be by mutual agreement of both parties.</>,
    <>The LESSOR shall pay property tax, conservancy charges and other property levies. The LESSEE shall pay electricity consumption charges and monthly maintenance of ₹ {field((terms.maintenanceCharges ?? 0).toLocaleString('en-IN'))}/-, apart from the agreed lease advance.</>,
    <>The premises shall be used only for residential purposes.</>,
    <>The premises shall not be used for any purpose other than that mentioned in clause 5.</>,
    <>The LESSEE shall not sublet or share the premises with any other person and shall not carry on any business in the premises.</>,
    <>The LESSOR shall have access to inspect the premises whenever considered necessary.</>,
    <>The LESSEE shall not carry out any repair, modification or construction without the LESSOR&apos;s prior approval.</>,
    <>The LESSEE shall keep the premises clean and well lit.</>,
    <>Either party may terminate this agreement by giving {field(notice)} days&apos; notice to the other.</>,
    <>The LESSEE shall hand over vacant possession in the condition in which the premises were let out.</>,
    <>The LESSEE shall not remove electrical fittings without the LESSOR&apos;s prior permission.</>,
    <>If any of the above conditions is breached by the LESSEE, the LESSOR may take appropriate action.</>,
    <>If the LESSOR is unable to refund the advance immediately, the LESSEE may arrange a new tenant and take the rent / lease amount from the new tenant until the LESSOR pays the advance amount.</>,
  ];
  const renderClauses = (start: number, end: number) => clauses.slice(start, end).map((clause, index) => <p key={start + index} className="break-inside-avoid"><strong>{start + index + 1}.</strong> {clause}</p>);
  // The second stamp sheet needs its own headroom for the ₹200 package.
  const split = terms.stampPaperDenomination === 200 ? 6 : 12;
  const pageClass = 'agreement-page lease-agreement-page relative mx-auto flex min-h-[297mm] max-w-[210mm] flex-col justify-between rounded-2xl border border-stone-200 bg-white p-8 text-[14px] leading-[1.65] text-stone-900 shadow-sm sm:p-14';
  return <>
    <section className={pageClass} style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", serif' }}>
      {watermark}
      <div className="space-y-5 text-justify">
        {stampPaperSpace && stampMargin(1)}
        <h1 className="text-center text-xl font-bold underline">LEASE AGREEMENT</h1>
        <p>This deed of lease is executed at {field(city)} on {field(formatLegalDate(terms.startDate))}.</p>
        <p className="text-center font-bold">BETWEEN</p>
        <p>{field(owner.fullName)}, {owner.relativeName?.trim() && <>{owner.relationship || 'Parent / spouse:'} {field(owner.relativeName)}, </>} residing at {field(address(owner))}, hereinafter called the &quot;LESSOR&quot;, which expression includes the LESSOR&apos;s legal heirs, agents, representatives, executors, administrators and assigns;</p>
        <p className="text-center font-bold">AND</p>
        <p>{field(tenant.fullName)}, {tenant.relativeName?.trim() && <>{tenant.relationship || 'Parent / spouse:'} {field(tenant.relativeName)}, </>} residing at {field(address(tenant))}, hereinafter called the &quot;LESSEE&quot;, which expression includes the LESSEE&apos;s legal heirs, agents, representatives, executors, administrators and assigns.</p>
      </div>
      {signatures}
      <p className="mt-6 text-center text-xs text-stone-400 print:hidden">Page 1 of 3 — Lease Agreement</p>
    </section>
    <section className={pageClass} style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", serif' }}>
      {watermark}
      <div className="space-y-3 text-justify">
        {stampPaperSpace && terms.stampPaperDenomination === 200 && stampMargin(2)}
        <p>WHEREAS the LESSEE approached the LESSOR to lease the {field(formatPropertyDescription(property.propertyType, property.furnishing))} at {field(formatPropertyAddress(property.fullAddress, property.city, property.pincode))}, and the LESSOR accepted on the following terms and conditions.</p>
        <p className="font-bold">NOW THIS DEED WITNESSETH AS FOLLOWS:</p>
        {renderClauses(0, split)}
      </div>
      {signatures}
      <p className="mt-6 text-center text-xs text-stone-400 print:hidden">Page 2 of 3 — Lease Terms</p>
    </section>
    <section className={pageClass} style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", serif' }}>
      {watermark}
      <div className="space-y-3 text-justify">
        {renderClauses(split, clauses.length)}
        <p className="pt-6">IN WITNESS WHEREOF the parties have signed this agreement at {field(city)} on the date first written above.</p>
        <div className="pt-6"><p className="font-bold">WITNESSES:</p><p className="mt-10">1. ______________________________</p><p className="mt-12">2. ______________________________</p></div>
      </div>
      {signatures}
      <p className="mt-6 text-center text-xs text-stone-400 print:hidden">Page 3 of 3 — Witnesses &amp; Signatures</p>
    </section>
  </>;
}
