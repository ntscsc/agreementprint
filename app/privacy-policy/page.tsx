import type { Metadata } from 'next';
import { PolicyPage, PolicySection } from '@/components/PolicyPage';

export const metadata: Metadata = { title: 'Privacy Policy | AgreementPrint', description: 'Privacy Policy for AgreementPrint rental and custom agreement services.' };

export default function Page() {
  return (
    <PolicyPage title="Privacy Policy">
      <PolicySection title="Information we collect">
        <p>We collect sign-in details such as name, email and account identifier; order and enquiry contact details; owner and tenant information entered for the agreement; property and tenancy details; delivery addresses; and order, payment-status and referral records. Custom requests also include your instructions, contact preferences and uploaded PDF, DOCX, JPG or PNG samples. Aadhaar details are optional: avoid full Aadhaar numbers and share only the last four digits if needed. Redact unnecessary identity, bank and other sensitive information from samples.</p>
      </PolicySection>
      <PolicySection title="How we use information">
        <p>We use this information to prepare agreements, review samples, provide quotes, fulfil and track orders, respond to enquiries, verify payment status, manage referral credits and protect the service against misuse. Custom-request contact permission is used to discuss that request and does not itself authorise marketing.</p>
      </PolicySection>
      <PolicySection title="Service providers and sharing">
        <p>We use Google/Firebase for sign-in and application data, private Supabase storage for custom samples, PhonePe for payments, and courier providers for physical delivery. Relevant information is processed by these providers to deliver their services; courier providers receive delivery and contact details. PhonePe handles payment credentials; do not send us card PINs, banking passwords or OTPs. We do not sell or rent personal information to advertisers. We may disclose information where required by law or necessary to investigate fraud and protect rights.</p>
      </PolicySection>
      <PolicySection title="Storage and security">
        <p>Access controls restrict customer records to the relevant customer and authorised staff or service processes. Custom samples are stored privately. Providers may process data in locations covered by their infrastructure and terms; we do not promise that all data remains in India. No internet transmission or storage system can be guaranteed completely secure. Protect your sign-in credentials and report suspected unauthorised access.</p>
      </PolicySection>
      <PolicySection title="Retention and your requests">
        <p>We retain information needed for order fulfilment, customer support, payment reconciliation and applicable record-keeping obligations. Retention may continue while a dispute, pending order or fraud investigation remains unresolved. Email support to request access, correction, deletion or withdrawal of permission for processing. We may verify your identity before acting and explain any information that must be retained. Withdrawal may affect services requiring that information. This website does not currently offer a self-service account deletion control.</p>
      </PolicySection>
      <PolicySection title="Cookies, sign-in and updates">
        <p>Sign-in and related browser storage are used to maintain your authenticated session and service preferences. Third-party services apply their own privacy policies when you use them. We will publish changes to this policy with an updated date. Send privacy concerns through the contact details below; include only the information needed to identify your request.</p>
      </PolicySection>
    </PolicyPage>
  );
}
