import React from 'react';
import type { AgreementDocumentData } from './RentalAgreementDocument';
import ta from '@/src/content/tamil-lease-template.json';
import { tamilDate, tamilRelationship } from '@/components/agreement/TamilRentalAgreement';
import { tamilAmountInWords } from '@/lib/tamil-number-to-words';
import { amountInWords } from '@/lib/number-to-words';
import { formatAgreementAmount, printablePaintingDeduction, formatLegalDate, calculateAgreementEndDate, formatPropertyAddress, formatPropertyDescription } from '@/lib/agreement-formatter';

/** Home and shop leases in English and Tamil. */
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
  const tamil = terms.language === 'Tamil';
  const shop = property.propertyType === 'Commercial Shop';
  const date = (value?: string) => tamil ? tamilDate(formatLegalDate(value)) : formatLegalDate(value);
  const field = (value: React.ReactNode) => <strong className={highlightFields ? 'agreement-field-highlight bg-amber-100 px-1' : ''}>{value === undefined || value === '' ? '________________' : value}</strong>;
  const address = (person: typeof owner) => [person.address, person.pincode && !person.address?.includes(person.pincode) ? person.pincode : ''].filter(Boolean).join(' - ');
  const advance = <>{field(formatAgreementAmount(terms.securityDeposit))}/- ({field((tamil ? tamilAmountInWords(terms.securityDeposit) : amountInWords(terms.securityDeposit)))} {tamil ? '' : 'only'})</>;
  const tenure = terms.tenureMonths ?? 11;
  const notice = terms.noticePeriodDays ?? 90;
  const painting = printablePaintingDeduction(terms.paintingDeduction);
  const city = property.city || 'Chennai';
  const signatures = <div className="agreement-signatures mt-8 grid grid-cols-2 gap-10 text-sm"><div><div className="border-b border-stone-700 pt-8" /><p className="mt-2 font-bold">{tamil ? ta.lessor : 'LESSOR'}</p><p><strong>{owner.fullName}</strong></p></div><div className="text-right"><div className="border-b border-stone-700 pt-8" /><p className="mt-2 font-bold">{tamil ? ta.lessee : 'LESSEE'}</p><p><strong>{tenant.fullName}</strong></p></div></div>;
  const clauses: React.ReactNode[] = [
    <>The premises shall be leased with no separate monthly rent payable from {field(formatLegalDate(terms.startDate))}.</>,
    <>The LESSEE shall deposit in advance ₹ {advance} with the LESSOR and occupy the premises for {field(tenure)} months. At the end of the term, unless renewed, the advance shall be refunded without interest, after adjusting amounts due from the LESSEE. Interest on the deposited advance of ₹ {advance} shall be taken as rent by the LESSOR.</>,
    <>The lease period shall be {field(tenure)} months, from {field(formatLegalDate(terms.startDate))} to {field(calculateAgreementEndDate(terms.startDate, tenure))}. Extension shall be by mutual agreement of both parties.</>,
    <>The LESSOR shall pay property tax, conservancy charges and other property levies. The LESSEE shall pay electricity consumption charges and monthly maintenance of ₹ {field(formatAgreementAmount(terms.maintenanceCharges ?? 0))}/-, apart from the agreed lease advance.</>,
    <>The premises shall be used only for {shop ? <>the business {field(property.businessName)}</> : 'residential purposes'}.</>,
    <>The premises shall not be used for any purpose other than that mentioned in clause 5.</>,
    <>The LESSEE shall not sublet or share the premises with any other person {!shop && 'and shall not carry on any business in the premises.'}</>,
    <>The LESSOR shall have access to inspect the premises whenever considered necessary.</>,
    <>The LESSEE shall not carry out any repair, modification or construction without the LESSOR&apos;s prior approval.</>,
    <>The LESSEE shall keep the premises clean and well lit.</>,
    <>Either party may terminate this agreement by giving {field(notice)} days&apos; notice to the other.</>,
    <>The LESSEE shall hand over vacant possession in the condition in which the premises were let out.</>,
    <>The LESSEE shall not remove electrical fittings without the LESSOR&apos;s prior permission.</>,
    <>If any of the above conditions is breached by the LESSEE, the LESSOR may take appropriate action.</>,
    <>If the LESSOR is unable to refund the advance immediately, the LESSEE may arrange a new tenant and take the rent / lease amount from the new tenant until the LESSOR pays the advance amount.</>,
  ];
  const translate = (text: string, fields: Record<string, React.ReactNode>) => text.split(/(\{\w+\})/g).map((part, i) => <React.Fragment key={i}>{part.startsWith('{') ? fields[part.slice(1, -1)] : part}</React.Fragment>);
  const translated = ta.clauses.map(text => translate(text, {
    startDate: field(date(terms.startDate)), endDate: field(tamilDate(calculateAgreementEndDate(terms.startDate, tenure))),
    advance, tenure: field(tenure), maintenance: field(formatAgreementAmount(terms.maintenanceCharges ?? 0)),
    use: shop ? translate(ta.commercialUse, { business: field(property.businessName) }) : ta.residentialUse,
    noBusiness: shop ? '' : ta.noBusiness, notice: field(notice),
  }));
  const selectedClauses = tamil ? translated : clauses;
  const party = (person: typeof owner, role: string) => translate(ta.party, {
    name: field(person.fullName), relative: person.relativeName?.trim() ? <>{tamilRelationship(person.relationship)}: {field(person.relativeName)},</> : '',
    address: field(address(person)), role: <strong>{role}</strong>,
  });
  const renderClauses = (start: number, end: number) => selectedClauses.slice(start, end).map((clause, index) => <p key={start + index} data-agreement-clause={start + index + 1} className="break-inside-avoid"><strong>{start + index + 1}.</strong> {clause}</p>);
  // The second stamp sheet needs its own headroom for the ₹200 package.
  const split = terms.stampPaperDenomination === 200 ? 3 : 8;
  const pageClass = 'agreement-page lease-agreement-page relative mx-auto flex min-h-[297mm] max-w-[210mm] flex-col justify-between rounded-2xl border border-stone-200 bg-white p-8 text-[14px] leading-[1.65] text-stone-900 shadow-sm sm:p-14';
  return <>
    <section lang={tamil ? 'ta' : 'en'} className={`${pageClass} ${tamil ? 'tamil-agreement-page' : ''}`} style={{ fontFamily: tamil ? '"Agreement Tamil", sans-serif' : '"Agreement Symbols", Georgia, Cambria, "Times New Roman", serif' }}>
      {watermark}
      <div className="space-y-5 text-justify">
        {stampPaperSpace && stampMargin(1)}
        <h1 className="text-center text-xl font-bold underline">{tamil ? ta.title : 'LEASE AGREEMENT'}</h1>
        <p>{tamil ? translate(ta.execution, { city: field(city), executionDate: field(date(terms.executionDate || terms.startDate || data.createdAt)) }) : <>This deed of lease is executed at {field(city)} on {field(date(terms.executionDate || terms.startDate || data.createdAt))}.</>}</p>
        <div data-agreement-introductions>
        <p className="text-center font-bold">{tamil ? ta.between : 'BETWEEN'}</p>
        <p>{tamil ? party(owner, ta.lessor) : <>{field(owner.fullName)}, {owner.relativeName?.trim() && <>{owner.relationship || 'Parent / spouse:'} {field(owner.relativeName)}, </>} residing at {field(address(owner))}, hereinafter called the &quot;LESSOR&quot;;</>}</p>
        <p className="text-center font-bold">{tamil ? ta.and : 'AND'}</p>
        <p>{tamil ? party(tenant, ta.lessee) : <>{field(tenant.fullName)}, {tenant.relativeName?.trim() && <>{tenant.relationship || 'Parent / spouse:'} {field(tenant.relativeName)}, </>} residing at {field(address(tenant))}, hereinafter called the &quot;LESSEE&quot;.</>}</p>
        </div>
      </div>
      {signatures}
      <p className="mt-6 text-center text-xs text-stone-600 agreement-page-number">Page 1 of 3 — Lease Agreement</p>
    </section>
    <section lang={tamil ? 'ta' : 'en'} className={`${pageClass} ${tamil ? 'tamil-agreement-page' : ''}`} style={{ fontFamily: tamil ? '"Agreement Tamil", sans-serif' : '"Agreement Symbols", Georgia, Cambria, "Times New Roman", serif' }}>
      {watermark}
      <div className="space-y-3 text-justify">
        {stampPaperSpace && terms.stampPaperDenomination === 200 && stampMargin(2)}
        <p>{tamil ? ta.partyScope : 'The expressions LESSOR and LESSEE include their respective legal heirs, agents, representatives, executors, administrators and assigns.'}</p>
        <p>{tamil ? translate(ta.premises, { propertyAddress: field(formatPropertyAddress(property.fullAddress, property.city, property.pincode)), propertyType: shop ? ta.shop : ta.home, business: shop ? field(property.businessName) : '' }) : <>WHEREAS the LESSEE approached the LESSOR to lease the {field(formatPropertyDescription(property.propertyType, property.furnishing, property.businessName))} at {field(formatPropertyAddress(property.fullAddress, property.city, property.pincode))}, and the LESSOR accepted on the following terms and conditions.</>}</p>
        <p className="font-bold">{tamil ? ta.terms : 'NOW THIS DEED WITNESSETH AS FOLLOWS:'}</p>
        {renderClauses(0, split)}
      </div>
      {signatures}
      <p className="mt-6 text-center text-xs text-stone-600 agreement-page-number">Page 2 of 3 — Lease Terms</p>
    </section>
    <section lang={tamil ? 'ta' : 'en'} className={`${pageClass} ${tamil ? 'tamil-agreement-page' : ''}`} style={{ fontFamily: tamil ? '"Agreement Tamil", sans-serif' : '"Agreement Symbols", Georgia, Cambria, "Times New Roman", serif' }}>
      {watermark}
      <div className="space-y-3 text-justify">
        {renderClauses(split, clauses.length)}
        {painting !== undefined && <p data-agreement-clause={tamil ? clauses.length + 1 : undefined}>{tamil && <><strong>{clauses.length + 1}.</strong>{' '}</>}{tamil
          ? <>இடத்தைக் காலி செய்யும்போது பெயிண்ட் செலவிற்காக குத்தகை முன்பணத்திலிருந்து ரூ.{field(formatAgreementAmount(painting))}/- பிடித்துக்கொள்ள குத்தகைக்கு எடுப்பவர் சம்மதிக்கிறார்.</>
          : <>The LESSEE agrees that ₹ {field(formatAgreementAmount(painting))}/- towards painting charges shall be deducted from the lease advance when vacating the premises.</>}</p>}
        <div data-agreement-closing>
        <p className="pt-6">{tamil ? translate(ta.signing, { city: field(city) }) : <>IN WITNESS WHEREOF the parties have signed this agreement at {field(city)} on the date first written above.</>}</p>
        <div className="pt-6"><p className="font-bold">{tamil ? ta.witnesses : 'WITNESSES:'}</p><p className="mt-10">1. ______________________________</p><p className="mt-12">2. ______________________________</p></div>
        </div>
      </div>
      {signatures}
      <p className="mt-6 text-center text-xs text-stone-600 agreement-page-number">Page 3 of 3 — Witnesses &amp; Signatures</p>
    </section>
  </>;
}
