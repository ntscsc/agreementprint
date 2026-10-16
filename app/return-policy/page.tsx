import type { Metadata } from 'next';
import { PolicyPage, PolicySection } from '@/components/PolicyPage';

export const metadata: Metadata = { title: 'Return & Replacement Policy | AgreementPrint', description: 'Return & Replacement Policy for AgreementPrint rental and custom agreement services.' };

export default function Page() {
  return (
    <PolicyPage title="Return & Replacement Policy">
      <PolicySection title="Personalised agreements">
        <p>Rental agreements are prepared using customer-specific details. We do not offer change-of-mind exchanges or reuse personalised stamp paper for another customer after printing. Cancellation and any refundable charges are covered by our Refund & Cancellation Policy.</p>
      </PolicySection>
      <PolicySection title="Incorrect, damaged or incomplete delivery">
        <p>Please report damage, missing pages or an incorrect agreement as soon as possible, preferably within one day of delivery, with the order ID and photos of the issue and packaging where available. We will review the submitted details and the delivered document. This reporting target does not remove rights available under applicable law.</p>
      </PolicySection>
      <PolicySection title="Our error">
        <p>If the details you submitted correctly were printed incorrectly by us, we will prepare and dispatch a corrected agreement on fresh stamp paper at no additional charge. Contact support for a replacement or applicable refund if the parcel is damaged, incomplete or the wrong order. Any return we require for a confirmed error on our side will be arranged at our cost. Do not send original documents back until we provide instructions.</p>
      </PolicySection>
      <PolicySection title="Changes to submitted details">
        <p>If the printed agreement matches incorrect information you supplied, contact us for a correction quote. New stamp duty and courier costs may apply; any additional charge will be disclosed before proceeding. We cannot promise a change to a parcel already dispatched.</p>
      </PolicySection>
      <PolicySection title="Resolution and refunds">
        <p>We review return and replacement requests within one day of receipt and communicate the decision or any further information needed. Support will confirm whether a return is needed, the return address and the proposed replacement or refund. Keep the original agreement and packaging until the issue is resolved. Approved refunds follow the timing and original-payment-method process in our Refund & Cancellation Policy.</p>
      </PolicySection>
      <PolicySection title="Replacement dispatch and delivery">
        <p>Approved replacements follow the same dispatch target as original orders: the same day or next day after approval and receipt of complete, usable corrected details. After dispatch, replacement delivery takes 1 to 2 days within Chennai, with a maximum of 2 days, and 3 to 4 days elsewhere in Tamil Nadu, with a maximum of 4 days. Contact support if delivery exceeds the applicable maximum so we can investigate and resolve the issue.</p>
      </PolicySection>
    </PolicyPage>
  );
}
