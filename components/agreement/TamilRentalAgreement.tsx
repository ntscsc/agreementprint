import type { ReactNode } from 'react';
import type { AgreementDocumentData } from './RentalAgreementDocument';
import { formatLegalDate, calculateAgreementEndDate, formatPropertyAddress } from '@/lib/agreement-formatter';
import { tamilAmountInWords } from '@/lib/tamil-number-to-words';
import source from '@/src/content/tamil-rental-template.json';
import shop from '@/src/content/tamil-shop-template.json';

function tamilDate(value: string): string {
  const months: Record<string, string> = { January: 'ஜனவரி', February: 'பிப்ரவரி', March: 'மார்ச்', April: 'ஏப்ரல்', May: 'மே', June: 'ஜூன்', July: 'ஜூலை', August: 'ஆகஸ்ட்', September: 'செப்டம்பர்', October: 'அக்டோபர்', November: 'நவம்பர்', December: 'டிசம்பர்' };
  return value.replace(/(\d+)(st|nd|rd|th)\b/, '$1').replace(/January|February|March|April|May|June|July|August|September|October|November|December/g, month => months[month]);
}

const blank = '________________';
const money = (amount?: number) => typeof amount === 'number' ? amount.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : blank;
const address = (value?: string, pin?: string) => value ? `${value}${pin && !value.includes(pin) ? ` - ${pin}` : ''}` : blank;
const relationshipLabels: Record<string, string> = { 'Son of': 'தந்தையின் பெயர்', 'Daughter of': 'தந்தையின் பெயர்', 'Wife of': 'கணவரின் பெயர்', 'Husband of': 'மனைவியின் பெயர்', 'Child of': 'பெற்றோரின் பெயர்', 'Spouse of': 'வாழ்க்கைத்துணையின் பெயர்' };
const relationship = (value?: string) => relationshipLabels[value || ''] || 'பெற்றோர் / வாழ்க்கைத்துணையின் பெயர்';

export function TamilRentalAgreement({ data, stampPaperSpace, customerPreview, watermark, stampMargin }: {
  data: AgreementDocumentData;
  stampPaperSpace: boolean;
  customerPreview: boolean;
  watermark: ReactNode;
  stampMargin: (page: 1 | 2) => ReactNode;
}) {
  const owner = data.ownerDetails ?? {}, tenant = data.tenantDetails ?? {}, property = data.propertyDetails ?? {}, terms = data.agreementTerms ?? {};
  const p = source.paragraphs;
  const period = terms.noticePeriodDays ?? 30;
  const notice = period > 0 && period % 30 === 0 ? `${period / 30} மாத` : `${period} நாள்`;
  const isShop = property.propertyType === 'Commercial Shop';
  const propertyTypes: Record<string, string> = { House: 'தனி வீடு', Flat: 'அடுக்குமாடிக் குடியிருப்பு', 'Commercial Shop': 'வணிகக் கடை / அலுவலகம்' };
  const furnishingTypes: Record<string, string> = { Unfurnished: 'தளபாடங்கள் இல்லாதது', 'Semi-Furnished': 'பகுதியளவு தளபாடங்கள் கொண்டது', 'Fully Furnished': 'முழுமையான தளபாடங்கள் கொண்டது' };
  const residentialPages: string[][] = [
    [
      `${address(owner.address, owner.pincode)}, என்ற முகவரியில் வசிக்கும் ${owner.fullName || blank}${owner.relativeName?.trim() ? ` (${relationship(owner.relationship)}: ${owner.relativeName.trim()})` : ''}, வயது ${owner.age || blank}, முதல் தரப்பினராகவும்,`,
      `${address(tenant.address, tenant.pincode)}, என்ற முகவரியில் வசிக்கும் ${tenant.fullName || blank}${tenant.relativeName?.trim() ? ` (${relationship(tenant.relationship)}: ${tenant.relativeName.trim()})` : ''}, வயது ${tenant.age || blank}, இரண்டாம் தரப்பினராகவும், ஆகிய நாம் இருவரும் சம்மதித்துச் செய்துகொள்ளும் வாடகை ஒப்பந்தப் பத்திரம் பின்வருமாறு:`,
      `${formatPropertyAddress(property.fullAddress, property.city, property.pincode) || blank}, என்ற முகவரியில் அமைந்துள்ள வீடு முதல் தரப்பினருக்குச் சொந்தமானதாகும். மேற்படி வீட்டைக் குடியிருப்பிற்காக வாடகைக்குக் கேட்ட இரண்டாம் தரப்பினருக்கு, முதல் தரப்பினர் சம்மதித்துக் கீழ்க்கண்ட நிபந்தனைகளின் பேரில் இந்த வாடகை ஒப்பந்தத்தைச் செய்துகொள்கிறோம். வாடகைக் காலம் ${tamilDate(formatLegalDate(terms.startDate)) || blank} முதல் ${tamilDate(calculateAgreementEndDate(terms.startDate, terms.tenureMonths || 11)) || blank} வரை ${terms.tenureMonths || 11} மாதம்.`,
    ],
    [
      `மேற்படி வீட்டிற்கு அட்வான்ஸ் தொகை ரூ.${money(terms.securityDeposit)}/- (எழுத்தால் ${tamilAmountInWords(terms.securityDeposit) || blank} மட்டும்) பெற்றுக் கொண்டதற்கு இதுவே ரசீதாகும்.`,
      `மேற்படி வீட்டிற்கு மாத வாடகையாக வாடகைதாரர் உரிமையாளருக்கு ரூ.${money(terms.monthlyRent)}/- (எழுத்தால் ${tamilAmountInWords(terms.monthlyRent) || blank} மட்டும்) ஒவ்வொரு மாதமும் வரும் ஆங்கில தேதி ${terms.paymentDueDay || 5}-க்குள் வீட்டின் உரிமையாளரிடம் செலுத்துகிறார்.`,
      ...p.slice(7, 12),
      `மாதாந்திர பராமரிப்புக் கட்டணம் ரூ.${money(terms.maintenanceCharges ?? 0)}/- ஆகும்.`,
    ],
    [
      ...p.slice(13, 15),
      ...(terms.paintingDeduction === 0 ? [] : [`மேலும் வாடகைதாரர் வீட்டைக் காலி செய்யும்போது பெயிண்ட் செலவிற்காக அட்வான்ஸ் தொகையிலிருந்து ரூ.${money(terms.paintingDeduction)}/- பிடித்துக்கொள்ள வாடகைதாரர் சம்மதிக்கிறார்.`]),
      ...p.slice(16, 18),
      `ஆண்டு வாடகை உயர்வு ${terms.rentIncreasePct ?? 0}% ஆகும்.`,
      `இரண்டாம் தரப்பினர் வீட்டைக் காலி செய்ய விரும்பினால் ${notice} முன் அறிவிப்பு அளித்துவிட்டுக் காலி செய்யலாம். அதேபோல் முதல் தரப்பினர் வீட்டைக் காலி செய்யக் கோர விரும்பினால் ${notice} முன் அறிவிப்பு அளிக்க வேண்டும்.`,
      p[19],
    ],
  ];
  const shopPages: string[][] = [
    [
      ...residentialPages[0].slice(0, 2),
      `${formatPropertyAddress(property.fullAddress, property.city, property.pincode) || blank}, என்ற முகவரியில் அமைந்துள்ள கடை முதல் தரப்பினருக்குச் சொந்தமானதாகும். மேற்படி கடையை இரண்டாம் தரப்பினர் “${property.businessName || blank}” என்ற பெயரில் கடை நடத்துவதற்கு வாடகைக்குக் கேட்டதற்கு முதல் தரப்பினர் சம்மதித்துக் கீழ்க்கண்ட நிபந்தனைகளின் பேரில் இந்த வாடகை ஒப்பந்தத்தைச் செய்துகொள்கிறோம். வாடகைக் காலம் ${tamilDate(formatLegalDate(terms.startDate)) || blank} முதல் ${tamilDate(calculateAgreementEndDate(terms.startDate, terms.tenureMonths || 11)) || blank} வரை ${terms.tenureMonths || 11} மாதம்.`,
    ],
    [
      `கடைக்கு அட்வான்ஸ் தொகை ரூ.${money(terms.securityDeposit)}/- (எழுத்தால் ${tamilAmountInWords(terms.securityDeposit) || blank} மட்டும்) பெற்றுக்கொண்டதற்கு இதுவே ரசீதாகும். இதற்கு வட்டி ஏதும் கிடையாது.`,
      `கடையின் மாத வாடகையாக வாடகைதாரர் உரிமையாளருக்கு ரூ.${money(terms.monthlyRent)}/- (எழுத்தால் ${tamilAmountInWords(terms.monthlyRent) || blank} மட்டும்) ஒவ்வொரு மாதமும் வரும் ஆங்கில தேதி ${terms.paymentDueDay || 5}-க்குள் கடையின் உரிமையாளரிடம் செலுத்த வேண்டும்.`,
      shop.electricity, shop.propertyTax, shop.permittedUse, shop.handover, shop.alterations,
      `மாதாந்திர பராமரிப்புக் கட்டணம் ரூ.${money(terms.maintenanceCharges ?? 0)}/- ஆகும்.`,
    ],
    [
      shop.noSublet, shop.depositRefund, shop.refundPromise, shop.renewal,
      `ஆண்டு வாடகை உயர்வு ${terms.rentIncreasePct ?? 0}% ஆகும்.`,
      `முதல் தரப்பினருக்குக் கடை தேவைப்பட்டால் ${notice} முன்னறிவிப்பு அளித்துவிட்டுக் கடையைக் காலி செய்யக் கோர வேண்டும். அதேபோல் இரண்டாம் தரப்பினருக்குக் கடை தேவைப்படாத பட்சத்தில் ${notice} முன்னறிவிப்பு அளித்துவிட்டுக் காலி செய்ய வேண்டும்.`,
      shop.signing,
    ],
  ];
  const pages = isShop ? shopPages : residentialPages;
  return <>{pages.map((paragraphs, index) => <section key={index} lang="ta" className="agreement-page tamil-agreement-page relative mx-auto flex min-h-[297mm] max-w-[210mm] flex-col justify-between rounded-2xl border border-stone-200 bg-white p-8 text-[14px] leading-[1.9] text-stone-900 shadow-sm sm:p-12">
    {customerPreview && watermark}
    <div>
      {stampPaperSpace && (index === 0 || (index === 1 && terms.stampPaperDenomination === 200)) && stampMargin((index + 1) as 1 | 2)}
      {index === 0 && <h1 className="mb-8 text-center text-lg font-bold underline">{isShop ? shop.title : p[0]}</h1>}
      <div className="space-y-4">{paragraphs.map((paragraph, number) => <p key={number} className="break-words">{paragraph}</p>)}</div>
      {index === 0 && property.propertyType && <p className="mt-4">சொத்து வகை: {propertyTypes[property.propertyType] || property.propertyType}. {property.furnishing && <>தளபாட நிலை: {furnishingTypes[property.furnishing] || property.furnishing}.</>}</p>}
      {index === 2 && <div className="mt-8 space-y-9"><h2 className="font-bold">{p[22]}</h2><p>1. ________________________________</p><p>2. ________________________________</p></div>}
    </div>
    <div className="mt-12 grid grid-cols-2 gap-6 text-center text-xs"><div><div className="mb-3 border-b border-stone-400 pt-6" />{index === 2 && <p>முதல் தரப்பு</p>}<p>{isShop ? '(கடை உரிமையாளர்)' : '(வீட்டின் உரிமையாளர்)'}</p><p>{owner.fullName}</p></div><div><div className="mb-3 border-b border-stone-400 pt-6" />{index === 2 && <p>இரண்டாம் தரப்பு</p>}<p>(வாடகைதாரர்)</p><p>{tenant.fullName}</p></div></div>
    <p className="mt-6 text-center text-xs text-stone-400 print:hidden">பக்கம் {index + 1} / 3</p>
  </section>)}</>;
}
