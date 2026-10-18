import { canonicalUrl, socialImage } from '@/lib/seo';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PolicyPage, PolicySection } from '@/components/PolicyPage';

export const metadata: Metadata = {
  alternates: { canonical: canonicalUrl('/disclaimer') },
  title: 'Disclaimer | AgreementPrint',
  description: 'Service scope, customer responsibilities and legal advice limitations for AgreementPrint.',
  openGraph: {
    images: [socialImage],
    title: 'Disclaimer | AgreementPrint',
    description: 'Understand the scope of our agreement preparation, stamp paper procurement, printing and delivery service.',
  },
};

export default function DisclaimerPage() {
  return (
    <PolicyPage title="Disclaimer">
      <PolicySection title="Service scope and independent status">
        <p>AgreementPrint provides agreement preparation, stamp paper procurement, printing and physical delivery. Custom agreement samples are reviewed for a separate scope and quote. We are an independent service, not a government website, government department or government registration portal.</p>
      </PolicySection>
      <PolicySection title="No legal advice or representation">
        <p>Our document preparation service is not a law firm or advocate service. Preparing or formatting an agreement does not create an advocate-client relationship. We do not provide personalised legal opinions, property title verification, litigation representation or guarantees about the outcome of a dispute. Consult an independent qualified advocate if you need advice on your rights, obligations or suitability of particular clauses.</p>
      </PolicySection>
      <PolicySection title="Stamping, signatures and registration">
        <p>Purchasing stamp paper or receiving a printed agreement does not itself complete signatures, government registration or Rent Authority formalities. Optional notary service, where selected, does not mean that government registration is included. Check the requirements for your particular agreement with the relevant authority or an independent qualified adviser. A selected stamp-paper denomination or an 11-month term is not a guarantee that all applicable requirements have been met.</p>
        <p>For official tenancy information, see the <a href="https://tenancy.tn.gov.in/Home/FAQ" target="_blank" rel="noopener noreferrer" className="text-amber-800 underline">Tamil Nadu tenancy portal FAQs</a>. Official requirements may change; confirm the requirements applicable when you execute your agreement.</p>
      </PolicySection>
      <PolicySection title="Review your details and documents">
        <p>Review party names, property and delivery addresses, rent, deposit, dates and clauses before submitting an order and before signing the completed agreement. You must have permission to share other parties? information and use any sample you provide. We do not independently verify property ownership or the truth of customer-supplied information. Contact support promptly if you find an error; corrections are handled under our published policies.</p>
      </PolicySection>
      <PolicySection title="No guarantee of acceptance or legal outcomes">
        <p>We cannot guarantee that an agreement will satisfy a particular bank, employer, government office or other third party, or guarantee enforceability or a court outcome. Confirm any organisation-specific document requirements before ordering. General website information and sample wording may not address your individual circumstances.</p>
      </PolicySection>
      <PolicySection title="Payments, delivery and customer remedies">
        <p>Payment processing and courier transit involve external providers. Dispatch estimates, tracking, cancellations, refunds and replacements follow our published policies. This disclaimer does not remove our responsibility for our own preparation errors, override an accepted order commitment, or limit rights and remedies available under applicable law.</p>
        <p>Read our <Link href="/terms" className="text-amber-800 underline">Terms & Conditions</Link> and the related policies below before ordering. For questions about service scope, stamp paper or a received document, contact us using the details below.</p>
      </PolicySection>
    </PolicyPage>
  );
}
