import { Children, isValidElement, type ReactNode } from 'react';
import { GRIEVANCE_PHONE, VENDOR_CONFIG, WHATSAPP_URL } from '@/src/config/vendor';
import { SupportEmailLink } from '@/components/SupportEmailLink';
import { PolicyNavigation } from '@/components/PolicyNavigation';

export function BusinessContact({ showOperator = true, showAddress = true }: { showOperator?: boolean; showAddress?: boolean }) {
  return (
    <address className="not-italic space-y-1 text-sm leading-relaxed">
      <p className="font-semibold">{showOperator ? `${VENDOR_CONFIG.name} - operator of AgreementPrint` : 'AgreementPrint Support'}</p>
      {showAddress && <p>{VENDOR_CONFIG.addressLine1}, {VENDOR_CONFIG.addressLine2}, {VENDOR_CONFIG.city} - {VENDOR_CONFIG.pincode}, {VENDOR_CONFIG.state}</p>}
      <p>Email: <SupportEmailLink className="text-amber-800 underline break-all" /></p>
      <p>WhatsApp only: <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="text-amber-800 underline">{VENDOR_CONFIG.whatsappNumber}</a></p>
      <p>Support hours: {VENDOR_CONFIG.workingHours}</p>
      <p>For order, refund or privacy concerns, email us at the address above. Include your order ID where applicable; never send passwords, PINs or OTPs.</p>
    </address>
  );
}

export function PolicyPage({ title, children }: { title: string; children: ReactNode }) {
  const sections = Children.toArray(children).filter(isValidElement<{ title?: string }>).map(child => child.props.title).filter((value): value is string => Boolean(value));
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8"><article className="space-y-8 rounded-2xl border border-stone-200 bg-white p-5 text-base leading-8 text-stone-700 shadow-sm sm:p-9">
      <header className="border-b border-stone-200 pb-6 space-y-3">
        <h1 className="text-2xl sm:text-3xl font-black text-stone-900">{title}</h1>
        <p>Last updated: 16 October 2026</p>
        <p>AgreementPrint (agreementprint.in) is operated by {VENDOR_CONFIG.name}.</p>
      </header>
      <nav aria-label="On this page" className="rounded-xl bg-stone-50 p-4 text-sm leading-6"><h2 className="mb-3 font-bold text-stone-900">On this page</h2><ul className="flex flex-wrap gap-x-5 gap-y-2 text-brand-800">{sections.map(section => <li key={section}><a href={`#${sectionId(section)}`} className="underline underline-offset-4">{section}</a></li>)}</ul></nav>
      {children}
      <section className="rounded-2xl border border-stone-200 bg-stone-50 p-5 space-y-3">
        <h2 className="text-lg font-bold text-stone-900">Contact and concerns</h2>
        <BusinessContact showOperator={false} />
        <div className="space-y-2 border-t border-stone-200 pt-3">
          <h3 className="font-semibold text-stone-900">Grievance officer</h3>
          <p>Name: Mr. Sai Ram<br />Designation: Grievance Officer</p>
          <p>Grievance phone: <a href={`tel:+91${GRIEVANCE_PHONE}`} className="text-amber-800 underline">+91 {GRIEVANCE_PHONE}</a></p>
          <p>Email: <SupportEmailLink className="text-amber-800 underline break-all" /></p>
          <p>Send complaints to the grievance officer using the email above, with your order ID and a description of the issue. We acknowledge complaints within 48 hours of receipt and resolve them within one month of receipt.</p>
        </div>
      </section>
    </article><PolicyNavigation current="/disclaimer" /></div>
  );
}

export function PolicySection({ title, children }: { title: string; children: ReactNode }) {
  return <section id={sectionId(title)} className="scroll-mt-24 space-y-3"><h2 className="text-xl font-bold text-stone-900">{title}</h2>{children}</section>;
}

function sectionId(title: string) { return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
