import type { Metadata } from 'next';
import { PolicyPage, PolicySection } from '@/components/PolicyPage';

export const metadata: Metadata = { title: 'Shipping & Delivery Policy | AgreementPrint', description: 'Shipping & Delivery Policy for AgreementPrint rental and custom agreement services.' };

export default function Page() {
  return (
    <PolicyPage title="Shipping & Delivery Policy">
      <PolicySection title="Delivery area and method">
        <p>We deliver physical agreements to serviceable addresses within Tamil Nadu through domestic courier or Speed Post. Enter a complete address, valid PIN code and reachable recipient contact number. Serviceability and available delivery options depend on the destination.</p>
      </PolicySection>
      <PolicySection title="Preparation and dispatch">
        <p>Our dispatch target is the same day or next day after receiving successful payment and complete, usable agreement details, unless a different date is agreed at order confirmation. This is a dispatch estimate, not a delivery guarantee. Missing details, requested corrections, holidays or custom drafting can affect preparation; support will communicate a revised estimate when needed. Custom agreement dispatch is agreed as part of the accepted quote.</p>
      </PolicySection>
      <PolicySection title="Transit and tracking">
        <p>After dispatch, delivery takes 1 to 2 days within Chennai, with a maximum of 2 days, and 3 to 4 days elsewhere in Tamil Nadu, with a maximum of 4 days. These delivery periods are counted from dispatch, separately from preparation time, and also apply to replacement shipments.</p>
        <p>Once dispatched, the courier name and available tracking details appear in My Orders or Track Order. If delivery exceeds the applicable maximum, tracking is missing or the parcel appears lost, contact support. We will investigate with the carrier, provide an update and discuss a replacement or applicable refund. Any unavoidable delay will be communicated; your rights under applicable law remain unaffected.</p>
      </PolicySection>
      <PolicySection title="Shipping charges">
        <p>The applicable courier charge is shown before payment and depends on the selected delivery address and package. For change-of-mind cancellations, courier charges are refundable if they have not been incurred. An incurred shipping charge is not refundable for a change of mind. Remedies for our error, damage or non-delivery are handled under our Refund & Cancellation and Return & Replacement policies.</p>
      </PolicySection>
      <PolicySection title="Address changes and failed delivery">
        <p>Contact support immediately for an address correction. Changes are subject to whether preparation or dispatch has occurred and carrier availability. If delivery fails because the supplied address is incorrect or the recipient is unavailable, any reshipment charge will be explained before you agree to it. Carrier delays do not prevent you from contacting us for help or exercising rights under applicable law.</p>
      </PolicySection>
    </PolicyPage>
  );
}
