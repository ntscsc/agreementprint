import type { ReactNode } from 'react';
import type { AgreementDocumentData } from './RentalAgreementDocument';
import { formatAgreementAmount, printablePaintingDeduction, formatLegalDate, calculateAgreementEndDate, formatPropertyAddress } from '@/lib/agreement-formatter';
import { tamilAmountInWords } from '@/lib/tamil-number-to-words';
import source from '@/src/content/tamil-rental-template.json';
import shop from '@/src/content/tamil-shop-template.json';

export function tamilDate(value: string): string {
  const months: Record<string, string> = { January: 'ஜனவரி', February: 'பிப்ரவரி', March: 'மார்ச்', April: 'ஏப்ரல்', May: 'மே', June: 'ஜூன்', July: 'ஜூலை', August: 'ஆகஸ்ட்', September: 'செப்டம்பர்', October: 'அக்டோபர்', November: 'நவம்பர்', December: 'டிசம்பர்' };
  return value.replace(/(\d+)(st|nd|rd|th)\b/, '$1').replace(/January|February|March|April|May|June|July|August|September|October|November|December/g, month => months[month]);
}

const blank = '________________';
const money = (amount?: number) => typeof amount === 'number' ? formatAgreementAmount(amount) : blank;
const address = (value?: string, pin?: string) => value ? `${value}${pin && !value.includes(pin) ? ` - ${pin}` : ''}` : blank;
/** Keep field values bold without treating customer-entered text as markup. */
function boldFields(parts: TemplateStringsArray, ...fields: ReactNode[]): ReactNode {
  return parts.flatMap((part, index) => index < fields.length
    ? [part, <strong key={index} data-agreement-field>{fields[index]}</strong>]
    : [part]);
}
const relationshipLabels: Record<string, string> = { 'Son of': 'தந்தையின் பெயர் (மகன்)', 'Daughter of': 'தந்தையின் பெயர் (மகள்)', 'Wife of': 'கணவரின் பெயர்', 'Husband of': 'மனைவியின் பெயர்', 'Child of': 'பெற்றோரின் பெயர்', 'Spouse of': 'வாழ்க்கைத்துணையின் பெயர்' };
export const tamilRelationship = (value?: string) => relationshipLabels[value || ''] || 'பெற்றோர் / வாழ்க்கைத்துணையின் பெயர்';

export function TamilRentalAgreement({ data, stampPaperSpace, customerPreview, watermark, stampMargin }: {
  data: AgreementDocumentData;
  stampPaperSpace: boolean;
  customerPreview: boolean;
  watermark: ReactNode;
  stampMargin: (page: 1 | 2) => ReactNode;
}) {
  const owner = data.ownerDetails ?? {}, tenant = data.tenantDetails ?? {}, property = data.propertyDetails ?? {}, terms = data.agreementTerms ?? {};
  const painting = printablePaintingDeduction(terms.paintingDeduction);
  const p = source.paragraphs;
  const city = property.city?.trim() || 'Chennai';
  const executionLocation = /^chennai$/i.test(city) ? 'சென்னை' : city;
  const period = terms.noticePeriodDays ?? (property.propertyType === 'Commercial Shop' ? 90 : 30);
  const notice = period > 0 && period % 30 === 0 ? `${period / 30} மாத` : `${period} நாள்`;
  const isShop = property.propertyType === 'Commercial Shop';
  const propertyTypes: Record<string, string> = { House: 'தனி வீடு', Flat: 'அடுக்குமாடிக் குடியிருப்பு', 'Commercial Shop': 'வணிகக் கடை / அலுவலகம்' };
  const residentialPages: ReactNode[][] = [
    [
      boldFields`${address(owner.address, owner.pincode)}, என்ற முகவரியில் வசிக்கும் ${owner.fullName || blank}${owner.relativeName?.trim() ? ` (${tamilRelationship(owner.relationship)}: ${owner.relativeName.trim()})` : ''}, வயது ${owner.age || blank}, முதல் தரப்பினராகவும்,`,
      boldFields`${address(tenant.address, tenant.pincode)}, என்ற முகவரியில் வசிக்கும் ${tenant.fullName || blank}${tenant.relativeName?.trim() ? ` (${tamilRelationship(tenant.relationship)}: ${tenant.relativeName.trim()})` : ''}, வயது ${tenant.age || blank}, இரண்டாம் தரப்பினராகவும், ஆகிய நாம் இருவரும் சம்மதித்துச் செய்துகொள்ளும் வாடகை ஒப்பந்தப் பத்திரம் பின்வருமாறு:`,
      boldFields`${formatPropertyAddress(property.fullAddress, property.city, property.pincode) || blank}, என்ற முகவரியில் அமைந்துள்ள வீடு முதல் தரப்பினருக்குச் சொந்தமானதாகும். மேற்படி வீட்டைக் குடியிருப்பிற்காக வாடகைக்குக் கேட்ட இரண்டாம் தரப்பினருக்கு, முதல் தரப்பினர் சம்மதித்துக் கீழ்க்கண்ட நிபந்தனைகளின் பேரில் இந்த வாடகை ஒப்பந்தத்தைச் செய்துகொள்கிறோம். வாடகைக் காலம் ${tamilDate(formatLegalDate(terms.startDate)) || blank} முதல் ${tamilDate(calculateAgreementEndDate(terms.startDate, terms.tenureMonths || 11)) || blank} வரை ${terms.tenureMonths || 11} மாதம்.`,
    ],
    [
      boldFields`மேற்படி வீட்டிற்கு அட்வான்ஸ் தொகை ரூ.${money(terms.securityDeposit)}/- (எழுத்தால் ${tamilAmountInWords(terms.securityDeposit) || blank} மட்டும்) பெற்றுக் கொண்டதற்கு இதுவே ரசீதாகும்.`,
      boldFields`மேற்படி வீட்டிற்கு மாத வாடகையாக வாடகைதாரர் உரிமையாளருக்கு ரூ.${money(terms.monthlyRent)}/- (எழுத்தால் ${tamilAmountInWords(terms.monthlyRent) || blank} மட்டும்) ஒவ்வொரு மாதமும் வரும் ஆங்கில தேதி ${terms.paymentDueDay || 5}-க்குள் வீட்டின் உரிமையாளரிடம் செலுத்துகிறார்.`,
      ...p.slice(7, 12),
      boldFields`மாதாந்திர பராமரிப்புக் கட்டணம் ரூ.${money(terms.maintenanceCharges ?? 0)}/- ஆகும்.`,
    ],
    [
      ...p.slice(13, 15),
      ...(painting === undefined ? [] : [boldFields`மேலும் வாடகைதாரர் வீட்டைக் காலி செய்யும்போது பெயிண்ட் செலவிற்காக அட்வான்ஸ் தொகையிலிருந்து ரூ.${money(painting)}/- பிடித்துக்கொள்ள வாடகைதாரர் சம்மதிக்கிறார்.`]),
      ...p.slice(16, 18),
      boldFields`ஆண்டு வாடகை உயர்வு ${terms.rentIncreasePct ?? 0}% ஆகும்.`,
      boldFields`இரண்டாம் தரப்பினர் வீட்டைக் காலி செய்ய விரும்பினால் ${notice} முன் அறிவிப்பு அளித்துவிட்டுக் காலி செய்யலாம். அதேபோல் முதல் தரப்பினர் வீட்டைக் காலி செய்யக் கோர விரும்பினால் ${notice} முன் அறிவிப்பு அளிக்க வேண்டும்.`,
      p[19],
    ],
  ];
  const shopPages: ReactNode[][] = [
    [
      ...residentialPages[0].slice(0, 2),
    ],
    [
      boldFields`${formatPropertyAddress(property.fullAddress, property.city, property.pincode) || blank}, என்ற முகவரியில் அமைந்துள்ள கடை முதல் தரப்பினருக்குச் சொந்தமானதாகும். மேற்படி கடையை இரண்டாம் தரப்பினர் “${property.businessName || blank}” என்ற பெயரில் கடை நடத்துவதற்கு வாடகைக்குக் கேட்டதற்கு முதல் தரப்பினர் சம்மதித்துக் கீழ்க்கண்ட நிபந்தனைகளின் பேரில் இந்த வாடகை ஒப்பந்தத்தைச் செய்துகொள்கிறோம். வாடகைக் காலம் ${tamilDate(formatLegalDate(terms.startDate)) || blank} முதல் ${tamilDate(calculateAgreementEndDate(terms.startDate, terms.tenureMonths || 11)) || blank} வரை ${terms.tenureMonths || 11} மாதம்.`,
      boldFields`கடைக்கு அட்வான்ஸ் தொகை ரூ.${money(terms.securityDeposit)}/- (எழுத்தால் ${tamilAmountInWords(terms.securityDeposit) || blank} மட்டும்) பெற்றுக்கொண்டதற்கு இதுவே ரசீதாகும். இதற்கு வட்டி ஏதும் கிடையாது.`,
      boldFields`கடையின் மாத வாடகையாக வாடகைதாரர் உரிமையாளருக்கு ரூ.${money(terms.monthlyRent)}/- (எழுத்தால் ${tamilAmountInWords(terms.monthlyRent) || blank} மட்டும்) ஒவ்வொரு மாதமும் வரும் ஆங்கில தேதி ${terms.paymentDueDay || 5}-க்குள் கடையின் உரிமையாளரிடம் செலுத்த வேண்டும்.`,
      shop.electricity, shop.propertyTax, shop.permittedUse, shop.handover, shop.alterations,
      boldFields`மாதாந்திர பராமரிப்புக் கட்டணம் ரூ.${money(terms.maintenanceCharges ?? 0)}/- ஆகும்.`,
    ],
    [
      shop.noSublet, shop.depositRefund, shop.refundPromise, shop.renewal,
      boldFields`ஆண்டு வாடகை உயர்வு ${terms.rentIncreasePct ?? 0}% ஆகும்.`,
      boldFields`முதல் தரப்பினருக்குக் கடை தேவைப்பட்டால் ${notice} முன்னறிவிப்பு அளித்துவிட்டுக் கடையைக் காலி செய்யக் கோர வேண்டும். அதேபோல் இரண்டாம் தரப்பினருக்குக் கடை தேவைப்படாத பட்சத்தில் ${notice} முன்னறிவிப்பு அளித்துவிட்டுக் காலி செய்ய வேண்டும்.`,
      ...(painting === undefined ? [] : [boldFields`கடையைக் காலி செய்யும்போது பெயிண்ட் செலவிற்காக அட்வான்ஸ் தொகையிலிருந்து ரூ.${money(painting)}/- பிடித்துக்கொள்ள வாடகைதாரர் சம்மதிக்கிறார்.`]),
      shop.signing,
    ],
  ];
  const pages = isShop ? shopPages : residentialPages;
  let clauseNumber = 0;
  const numberedPages = pages.map((paragraphs, pageIndex) => paragraphs.map((text, paragraphIndex) => {
    const isClause = pageIndex > 0
      && !(isShop && pageIndex === 1 && paragraphIndex === 0)
      && !(pageIndex === 2 && paragraphIndex === paragraphs.length - 1);
    return { text, number: isClause ? ++clauseNumber : undefined };
  }));
  const renderParagraph = (paragraph: { text: ReactNode; number?: number }, key: number) => <p key={key} className="break-words" data-agreement-clause={paragraph.number}>{paragraph.number !== undefined && <><strong>{paragraph.number}.</strong>{' '}</>}{paragraph.text}</p>;
  return <>{numberedPages.map((paragraphs, index) => <section key={index} lang="ta" className="agreement-page tamil-agreement-page relative mx-auto flex min-h-[297mm] max-w-[210mm] flex-col justify-between rounded-2xl border border-stone-200 bg-white p-8 text-[14px] leading-[1.9] text-stone-900 shadow-sm sm:p-12">
    {customerPreview && watermark}
    <div>
      {stampPaperSpace && (index === 0 || (index === 1 && terms.stampPaperDenomination === 200)) && stampMargin((index + 1) as 1 | 2)}
      {index === 0 && <h1 className="mb-8 text-center text-lg font-bold underline">{isShop ? shop.title : p[0]}</h1>}
      {index === 0 && <p className="tamil-execution-location">இடம்: {executionLocation}</p>}
      {index === 0 && <p className="tamil-execution-date">{source.executionDateLabel} <strong data-agreement-field>{tamilDate(formatLegalDate(terms.executionDate || terms.startDate || data.createdAt)) || blank}</strong></p>}
      <div className="space-y-4 tamil-agreement-body">
        {index === 0 && <div data-agreement-introductions className="space-y-4">{paragraphs.slice(0, 2).map(renderParagraph)}</div>}
        {paragraphs.slice(index === 0 ? 2 : 0, index === 2 ? -1 : undefined).map(renderParagraph)}
      </div>
      {index === 0 && property.propertyType && <p className="mt-4">சொத்து வகை: <strong data-agreement-field>{propertyTypes[property.propertyType] || property.propertyType}</strong>. </p>}
      {index === 2 && <div data-agreement-closing><p>{paragraphs[paragraphs.length - 1].text}</p><div className="mt-8 space-y-9"><h2 className="font-bold">{p[22]}</h2><p>1. ________________________________</p><p>2. ________________________________</p></div></div>}
    </div>
    <div className="agreement-signatures mt-12 grid grid-cols-2 gap-6 text-center text-xs"><div><div className="mb-3 border-b border-stone-700 pt-6" />{index === 2 && <p>முதல் தரப்பு</p>}<p>{isShop ? '(கடை உரிமையாளர்)' : '(வீட்டின் உரிமையாளர்)'}</p><p><strong data-agreement-field>{owner.fullName}</strong></p></div><div><div className="mb-3 border-b border-stone-700 pt-6" />{index === 2 && <p>இரண்டாம் தரப்பு</p>}<p>(வாடகைதாரர்)</p><p><strong data-agreement-field>{tenant.fullName}</strong></p></div></div>
    <p className="mt-6 text-center text-xs text-stone-600 agreement-page-number">பக்கம் {index + 1} / 3</p>
  </section>)}</>;
}
