import type { ReactNode } from 'react';
import Link from 'next/link';
import { GRIEVANCE_PHONE, VENDOR_CONFIG } from '@/src/config/vendor';
import { SupportEmailLink } from '@/components/SupportEmailLink';

export function BusinessContact({ showOperator = true, showAddress = true }: { showOperator?: boolean; showAddress?: boolean }) {
  return (
    <address className="not-italic space-y-1 text-sm leading-relaxed">
      <p className="font-semibold">{showOperator ? `${VENDOR_CONFIG.name} - operator of AgreementPrint` : 'AgreementPrint Support'}</p>
      {showAddress && <p>{VENDOR_CONFIG.addressLine1}, {VENDOR_CONFIG.addressLine2}, {VENDOR_CONFIG.city} - {VENDOR_CONFIG.pincode}, {VENDOR_CONFIG.state}</p>}
      <p>Email: <SupportEmailLink className="text-amber-800 underline break-all" /></p>
      <p>Support hours: {VENDOR_CONFIG.workingHours}</p>
      <p>For order, refund or privacy concerns, email us at the address above. Include your order ID where applicable; never send passwords, PINs or OTPs.</p>
    </address>
  );
}

export function PolicyPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 text-sm leading-relaxed text-stone-700">
      <header className="border-b border-stone-200 pb-6 space-y-3">
        <h1 className="text-2xl sm:text-3xl font-black text-stone-900">{title}</h1>
        <p>Last updated: 16 October 2026</p>
        <p>AgreementPrint (agreementprint.in) is operated by {VENDOR_CONFIG.name}.</p>
      </header>
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
      <nav aria-label="Related policies" className="flex flex-wrap gap-x-5 gap-y-3 text-amber-800 underline">
        <Link href="/terms">Terms & Conditions</Link>
        <Link href="/privacy-policy">Privacy Policy</Link>
        <Link href="/refund-policy">Refund & Cancellation Policy</Link>
        <Link href="/return-policy">Return & Replacement Policy</Link>
        <Link href="/shipping-policy">Shipping & Delivery Policy</Link>
      </nav>
    </article>
  );
}

export function PolicySection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-3"><h2 className="text-lg font-bold text-stone-900">{title}</h2>{children}</section>;
}
