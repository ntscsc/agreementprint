import type { Metadata } from 'next';
import { PolicyPage, PolicySection } from '@/components/PolicyPage';

export const metadata: Metadata = { title: 'Terms & Conditions | AgreementPrint', description: 'Terms & Conditions for AgreementPrint rental and custom agreement services.' };

export default function Page() {
  return (
    <PolicyPage title="Terms & Conditions">
      <PolicySection title="Our service">
        <p>AgreementPrint provides rental agreement preparation, stamp paper procurement, printing and physical delivery within Tamil Nadu. Custom agreement requests are reviewed separately and quoted before paid work begins. We are not a government website. Our preparation service does not include legal advice, property title verification or government registration. Any optional notary service and its charge are shown separately.</p>
      </PolicySection>
      <PolicySection title="Ordering and customer responsibilities">
        <p>Provide accurate party names, addresses, rental amounts, dates and delivery details, and review them before submitting. You must have authority to share information about other parties and permission to use any sample template you upload. Do not use the service for unlawful purposes or submit forged information. Keep your sign-in account secure and contact us if you suspect misuse.</p>
      </PolicySection>
      <PolicySection title="Prices and payments">
        <p>Prices are in Indian rupees. The applicable package, stamp duty, courier charge, optional services, discounts and final payable total are shown for review before payment. Online payments are handled through PhonePe. A payment attempt alone does not confirm a successful payment; check your order status. Custom agreement work is subject to the scope and price you accept.</p>
      </PolicySection>
      <PolicySection title="Preparation, delivery and corrections">
        <p>Preparation depends on receiving payment and complete, usable details. Dispatch estimates, tracking and address issues are covered by our Shipping & Delivery Policy. Cancellation, refund and replacement requests are handled under the linked policies. Contact us promptly if you discover an error; changes may require new stamp paper once printing has occurred.</p>
      </PolicySection>
      <PolicySection title="Website use and third parties">
        <p>Use the website only for lawful purposes. Do not interfere with its security or misuse another customer?s account or information. Website content does not grant ownership rights in our branding or software. External payment and courier services have their own terms and privacy practices.</p>
      </PolicySection>
      <PolicySection title="Service issues and changes to these terms">
        <p>If we cannot fulfil an order, we will contact you about an alternative or an applicable refund. Events outside our reasonable control may affect preparation or delivery; contact support for an update. Updated terms will be published with a revised date. Changes will not retrospectively remove commitments made for an existing order. Nothing in these policies limits rights available under applicable law. These terms are governed by the laws of India; disputes may be raised before the competent court or consumer forum.</p>
      </PolicySection>
    </PolicyPage>
  );
}
