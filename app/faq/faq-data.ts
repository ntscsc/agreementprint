export type FaqCategory = 'legality' | 'privacy' | 'delivery' | 'pricing' | 'payment' | 'custom' | 'rewards';

export interface FaqItem {
  category: FaqCategory;
  q: string;
  a: string;
}

export const faqData: FaqItem[] = [
  { category: 'legality', q: 'Do you provide both stamp paper and e-Stamp services?', a: 'Yes. We are an authorised non-judicial stamp paper and e-Stamp vendor. Contact our team for stamp paper or e-Stamp enquiries. Our online rental agreement package provides a printed agreement on physical stamp paper.' },
  { category: 'legality', q: 'What does AgreementPrint do?', a: 'We prepare rental agreements, print them on Tamil Nadu stamp paper and send them by courier. You can also ask for a custom agreement or create a free rent receipt.' },
  { category: 'legality', q: 'Should I choose ₹200 stamp paper for my rental agreement?', a: 'Eventhough the government prefers ₹200 stamp paper, it is not a fixed government requirement for every rental agreement. Official Tamil Nadu guidance says the stamp duty depends on the rent, other amounts and length of the agreement.' },
  { category: 'legality', q: 'Is an 11-month agreement exempt from registration?', a: 'The Tamil Nadu government FAQ says tenancy agreements must be registered with the Rent Authority even when they are for less than 12 months. Preparing or notarising your agreement does not complete this registration. Check the official guidance for your next steps.' },
  { category: 'legality', q: 'Can I choose how long the rental agreement lasts?', a: 'Yes. Enter the rental period agreed between the owner and tenant. The form starts with 11 months, and you can change it.' },
  { category: 'legality', q: 'Can I add a notary signature?', a: 'Yes. Choose notary service when placing a rental agreement order. The extra price is shown before payment. For a custom agreement, select Yes under the notary question and our team will include it in your quote.' },
  { category: 'legality', q: 'Will my agreement be accepted by every office?', a: 'Different offices may ask for different wording, stamp duty or registration. Check with the office where you plan to use the agreement. We help with preparing and printing the document; we do not provide legal advice or promise acceptance.' },
  { category: 'privacy', q: 'What details should I keep ready?', a: 'Keep the owner and tenant names, ages, phone numbers, permanent addresses and PIN codes ready. You will also need the property address, rent, deposit and agreed rental dates.' },
  { category: 'privacy', q: 'Is Aadhaar compulsory?', a: 'No. Aadhaar and PAN details are optional in the rental agreement form. Only share information you want included and that is needed for your request.' },
  { category: 'privacy', q: 'Do I need to send identity or property documents?', a: 'You do not need to upload identity or property documents to start a standard rental agreement. For a custom agreement, share a sample document or photo to explain what you need. Remove personal information that is not needed.' },
  { category: 'privacy', q: 'Can I finish my rental agreement form later?', a: 'Yes. Sign in with Google and your form progress is saved. Return using the same account to continue your draft.' },
  { category: 'pricing', q: 'What is included in the price?', a: 'The agreement price includes preparation, stamp paper and printing. Courier delivery and any notary service are shown separately. You can see the full total before paying.' },
  { category: 'delivery', q: 'Can you deliver to the owner or tenant?', a: 'Yes. Choose the owner or tenant when placing the order. We use that person\'s permanent address and PIN code for delivery.' },
  { category: 'delivery', q: 'How much is courier delivery?', a: 'Courier delivery costs ₹50 within Chennai and ₹100 elsewhere in Tamil Nadu. The PIN code of the person receiving the agreement decides the delivery charge.' },
  { category: 'delivery', q: 'When will my agreement arrive?', a: 'The time needed depends on preparing the agreement and the courier journey. Check My Orders for updates and courier details once your agreement has been sent.' },
  { category: 'delivery', q: 'How can I track my order?', a: 'Open My Orders or Track Order. Once your agreement is sent, the courier name and tracking details will be available with your order.' },
  { category: 'payment', q: 'How do I pay for a rental agreement?', a: 'Pay online after checking your agreement details and total. The available payment options are shown when you pay.' },
  { category: 'payment', q: 'What if my payment fails or I close the payment window?', a: 'Your order stays saved. Sign in, open My Orders and choose Pay or Retry Payment for that order.' },
  { category: 'pricing', q: 'Can I cancel my order or get a refund?', a: 'This depends on how far your order has progressed. Read our Refund and Cancellation Policy, then contact our team with your order number for help.' },
  { category: 'custom', q: 'How do I ask for a custom agreement?', a: 'Open Custom Agreement, describe what you need and share a sample. Add your contact details and choose whether you need a notary signature. Our team will contact you with a price and expected completion date.' },
  { category: 'custom', q: 'Do I pay when sending a custom request?', a: 'No. Sending a custom agreement request is free. Our team will discuss the price and payment arrangements with you before starting work.' },
  { category: 'custom', q: 'What sample files can I attach?', a: 'You can attach one to three PDF or Word documents, or JPG or PNG photos. Each file can be up to 10 MB. Choose clear, readable samples.' },
  { category: 'custom', q: 'Can I remove a wrong attachment?', a: 'Yes. Before submitting, click Remove beside the file and choose the correct one.' },
  { category: 'custom', q: 'Where can I see my custom request?', a: 'Open My Account and choose My Requests. You can see updates, the price shared by our team and any questions that need your reply.' },
  { category: 'rewards', q: 'How do I earn referral credits?', a: 'Open Referral Credits and share your link with a friend. When a new customer uses it for their first paid order, you earn the reward shown on your referral page.' },
  { category: 'rewards', q: 'Can I use a referral code on every order?', a: 'No. A referral code is valid only for your first paid order. After that, the code box no longer appears. You can still use credits you have earned on later orders.' },
  { category: 'rewards', q: 'How do I spend my referral credits?', a: 'Use the Apply referral credit option when reviewing your rental agreement order. Your credits reduce the amount you need to pay, up to the order total.' },
  { category: 'rewards', q: 'Are rent receipts free?', a: 'Yes. Open Rent Receipt, enter the details and create your receipt. Print it or save it as a PDF. The receipt details stay on your device.' },
];
