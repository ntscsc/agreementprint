export type OrderStatus = 
  | 'Submitted'
  | 'Under verification'
  | 'Documents needed'
  | 'Drafting'
  | 'Dispatched'
  | 'Delivered'
  | 'Cancelled';

export type PaymentStatus = 'Pending' | 'Paid' | 'Failed' | 'Refunded';

export interface PersonDetails {
  fullName: string;
  relativeName: string; // Father's or spouse's name
  age: number | string;
  address: string;
  phone: string;
  email?: string;
  aadhaarLast4?: string; // Optional Aadhaar or ID proof number
  pan?: string;
}

export interface PropertyDetails {
  fullAddress: string;
  city: string;
  pincode: string;
  propertyType: 'House' | 'Flat' | 'Commercial Shop';
  furnishing: 'Unfurnished' | 'Semi-Furnished' | 'Fully Furnished';
  businessName?: string;
}

export interface AgreementTerms {
  monthlyRent: number;
  securityDeposit: number;
  maintenanceCharges: number;
  startDate: string;
  tenureMonths: number; // typically 11 months
  noticePeriodDays: number;
  rentIncreasePct: number;
  paymentDueDay?: number; // e.g. 5th of every month
  stampPaperDenomination?: 100 | 200; // 100 or 200 stamp paper
  deliveryRecipient?: 'Owner' | 'Tenant';
  deliveryLocation?: 'Within Chennai' | 'Within Tamil Nadu';
  includeNotary?: boolean;
}

export type { PricingConfig } from '@/src/config/pricing';

export interface ProofUploads {
  ownerIdProofUrl?: string;
  ownerIdProofFileName?: string;
  tenantIdProofUrl?: string;
  tenantIdProofFileName?: string;
  propertyProofUrl?: string;
  propertyProofFileName?: string;
}

export interface OrderPayment {
  status: PaymentStatus;
  amount?: number;
  totalBeforeCredits?: number;
  referralCreditApplied?: number;
  reservationKey?: string;
  gateway?: 'PhonePe' | 'ReferralCredit' | 'Razorpay';
  phonepeMerchantOrderId?: string;
  phonepeMerchantOrderIds?: string[];
  phonepePaymentAttempts?: Array<{
    merchantOrderId: string;
    amount: number;
    initiatedAt: number;
  }>;
  phonepeInitiatedAt?: number;
  phonepeReturnUrl?: string;
  phonepeTransactionId?: string;
  phonepeRedirectUrl?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  paidAt?: string;
}

export interface OrderCourier {
  courierName: string;
  trackingNumber: string;
  dispatchedAt: string;
  estimatedDelivery?: string;
}

export interface Order {
  orderId: string;
  ownerUid: string;
  referralCode?: string;
  customerEmail: string;
  customerPhone?: string;
  ownerDetails: PersonDetails;
  tenantDetails: PersonDetails;
  propertyDetails: PropertyDetails;
  agreementTerms: AgreementTerms;
  proofUploads: ProofUploads;
  status: OrderStatus;
  payment: OrderPayment;
  courier?: OrderCourier;
  correctionMessage?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Draft {
  ownerUid: string;
  currentStep: number;
  formData: Partial<Order>;
  updatedAt: string;
}

export interface AdminLog {
  logId: string;
  orderId: string;
  adminUid: string;
  adminEmail?: string;
  action: string;
  previousStatus?: OrderStatus;
  newStatus?: OrderStatus;
  notes?: string;
  timestamp: string;
}
