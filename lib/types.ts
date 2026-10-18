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
  relationship?: 'Son of' | 'Daughter of' | 'Wife of' | 'Husband of' | 'Child of' | 'Spouse of';
  age: number | string;
  address: string;
  pincode?: string; // Separate permanent-address PIN; older orders may embed it in address.
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
  /** Missing on older orders means Rental. */
  agreementType?: 'Rental' | 'Lease';
  language?: 'English' | 'Tamil'; // Missing on legacy orders means English.
  paintingDeduction?: number; // Tamil residential template only; not used in the shop template.
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
  extraCopies?: number; // Additional copies on the same stamp denomination; legacy orders default to zero.
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
  carriedFromOrderId?: string;
  carriedCash?: number;
  carriedCredit?: number;
  additionalPayment?: number;
  status: PaymentStatus;
  amount?: number;
  totalBeforeCredits?: number;
  subtotal?: number;
  couponDiscount?: number;
  couponCode?: string;
  referralCreditApplied?: number;
  reservationKey?: string;
  gateway?: 'PhonePe' | 'ReferralCredit' | 'Coupon' | 'Razorpay';
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
  cancellationRefundId?: string;
  cancellationRefundAmount?: number;
  cancellationRefundStatus?: string;
  cancellationRefundNote?: string;
  cancellationRewardCreditsReturned?: number;
  replacementPendingId?: string | null;
  replacesOrderId?: string;
  replacedByOrderId?: string;
  replacementRequestId?: string;
  replacementAdjustment?: { additionalPayment: number; creditReturned: number; refundAmount: number; refundStatus: string };
  modificationReviewOutcome?: string;
  modificationReviewId?: string;
  preparationStartedAt?: string;
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
  correctionRequestId?: string;
  correctionStatus?: 'Requested' | 'Submitted';
  correctionSubmittedAt?: string | null;
  correctionChangedFields?: string[];
  customerClarification?: string;
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
