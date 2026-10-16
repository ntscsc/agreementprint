import type { Metadata } from 'next';
import { PolicyPage, PolicySection } from '@/components/PolicyPage';

export const metadata: Metadata = { title: 'Refund & Cancellation Policy | AgreementPrint', description: 'Refund & Cancellation Policy for AgreementPrint rental and custom agreement services.' };

export default function Page() {
  return (
    <PolicyPage title="Refund & Cancellation Policy">
      <PolicySection title="How to request cancellation">
        <p>Email support with your order ID and cancellation reason as soon as possible, preferably within one day of placing the order. We review cancellation and refund requests within one day of receipt and communicate the decision or any further information needed. We assess cancellation against the actual work completed, not the order status label alone. A request within one day does not guarantee cancellation if personalised stamp paper has already been printed. We will confirm the outcome and any refund breakdown.</p>
      </PolicySection>
      <PolicySection title="Before personalised printing">
        <p>If no personalised stamp paper has been printed, cancellation of a standard rental agreement order qualifies for a full refund of the amount paid, including service and unspent courier charges. If we cannot fulfil your order, we will offer a full refund for the unfulfilled order.</p>
      </PolicySection>
      <PolicySection title="After personalised printing or dispatch">
        <p>For change-of-mind cancellations after personalised printing, the cost of stamp paper already used and preparation or printing already completed is not refundable through our service. Unperformed optional services and courier charges not yet incurred remain refundable. Once dispatched, an incurred courier charge is not refundable for a change of mind. We will explain any deduction; an order status alone is not proof that these costs were incurred. These terms do not exclude remedies for our errors, damaged or incorrect delivery, or rights under applicable law.</p>
      </PolicySection>
      <PolicySection title="Custom agreements">
        <p>Submitting a custom sample is a request for review and a quote, not a paid order. The accepted quote must identify the work and any cancellation charges before paid work begins. For a paid custom request, contact us for a breakdown based on the agreed scope and work completed; we will not impose undisclosed cancellation charges.</p>
      </PolicySection>
      <PolicySection title="Refund processing">
        <p>Approved refunds are initiated to the original payment method within 3 business days of approval. After initiation, the refund is expected to reach your original payment method within 3 to 4 working days, subject to bank or payment-provider processing. We will share the available refund reference for tracking. If the credit has not appeared after this period, contact support with your order ID and refund reference so we can investigate. Referral credits used for an order are restored as credits for the refundable portion and are not paid out in cash. Report duplicate debits or a debit with no confirmed order to support with the transaction reference. Never send an OTP or PIN.</p>
      </PolicySection>
      <PolicySection title="Errors, damage and replacements">
        <p>For incorrect details printed by us, damaged delivery or missing items, see the Return & Replacement Policy. Do not reject a parcel at the doorstep as a cancellation method: contact support so we can record and resolve the issue. This policy does not limit rights available under applicable law.</p>
      </PolicySection>
    </PolicyPage>
  );
}
