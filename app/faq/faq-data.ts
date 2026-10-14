export type FaqCategory = 'legality' | 'privacy' | 'delivery' | 'pricing' | 'payment';

export interface FaqItem {
  category: FaqCategory;
  q: string;
  a: string;
}

export const faqData: FaqItem[] = [
  {
    category: 'legality',
    q: 'Does this service provide legal advice or guarantee that my agreement will be accepted?',
    a: 'No. We provide a standard rental agreement drafting and stamping service, not legal advice or a guarantee of acceptance by a court, employer, bank, or government office. Requirements depend on your situation. Please review the agreement and consult an enrolled advocate or the relevant authority if you need legal advice or registration guidance.',
  },
  {
    category: 'legality',
    q: 'What agreement duration can I choose?',
    a: 'Enter the requested tenancy duration in the order form; 11 months is the default. Registration and other legal requirements can depend on the term and your circumstances, so confirm those requirements with an advocate or the relevant registration authority.',
  },
  {
    category: 'legality',
    q: 'Can I request notary service?',
    a: 'The order form includes an optional notary selection, and its current additional fee is shown in the price summary. If you need a particular type of notarization or have questions about what is included, contact support before paying.',
  },
  {
    category: 'privacy',
    q: 'Is Aadhaar information required, and what should I enter?',
    a: 'Providing Aadhaar information is optional. Enter only the information requested by the standard rental agreement form. Sample templates and photos are accepted separately for custom agreement requests; remove unnecessary sensitive information first.',
  },
  {
    category: 'privacy',
    q: 'Do I need to upload identity or property documents?',
    a: 'No identity or property proof uploads are required for standard rental agreements. Custom agreement requests separately accept PDF/DOCX templates and JPG/PNG sample photos for review.',
  },
  {
    category: 'pricing',
    q: 'How is my order price calculated?',
    a: 'The price depends on the selected ₹100 or ₹200 stamp-paper denomination, the delivery region (Within Chennai or Within Tamil Nadu), and whether you select the optional notary service. The current total is shown before you pay; the base package includes courier charges.',
  },
  {
    category: 'payment',
    q: 'Which payment methods are available, and how can I retry a payment?',
    a: 'Online payments are processed through secure checkout; the available payment methods are shown there. If checkout is cancelled, fails, or is not completed, your order remains saved. Sign in and use Pay / Retry Payment beside the order in My Orders.',
  },
  {
    category: 'pricing',
    q: 'Can I cancel an order or request a refund?',
    a: 'Cancellation and refund eligibility depends on the order’s processing stage. Read the Refund and Cancellation Policy and contact support with your order ID to request a cancellation or refund.',
  },
  {
    category: 'delivery',
    q: 'How long will delivery take?',
    a: 'Delivery time depends on order verification, drafting, dispatch, and the courier. We do not promise a fixed delivery date. Check My Orders for the current order status and courier details after dispatch.',
  },
  {
    category: 'delivery',
    q: 'How do I track my agreement after it has been dispatched?',
    a: 'Open My Orders and select Track Status for the order. Once dispatch details have been added, you can see the courier and consignment number there.',
  },
  {
    category: 'delivery',
    q: 'Which courier will deliver my agreement?',
    a: 'Your physical agreement is sent by courier. The assigned courier and tracking number are shown in My Orders after dispatch.',
  },
];
