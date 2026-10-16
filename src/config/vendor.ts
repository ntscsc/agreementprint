/**
 * Single source of truth for vendor identity, credentials, contact, and fees.
 * No real-looking facts or numbers are invented.
 * Placeholders are marked clearly with bracket notation [PLACEHOLDER - DESCRIPTION].
 */

export { ADMIN_EMAIL, isUserAdmin } from './admin';

export interface VendorFees {
  stampDuty: {
    amount: number | null;
    displayLabel: string;
    description: string;
  };
  serviceFee: {
    amount: number | null;
    displayLabel: string;
    description: string;
  };
  courierFee: {
    amount: number | null;
    displayLabel: string;
    description: string;
  };
}

export interface VendorConfig {
  name: string;
  tradeName: string;
  licenceNumber: string;
  issuingAuthority: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  pincode: string;
  state: string;
  phone: string;
  whatsappNumber: string;
  whatsappPrefilledMessage: string;
  email: string;
  workingHours: string;
  courierPartner: string;
  fees: VendorFees;
  placeholdersTodoList: Array<{
    field: string;
    currentValue: string;
    description: string;
  }>;
}

export const VENDOR_CONFIG: VendorConfig = {
  name: 'Net Time Systems',
  tradeName: 'AgreementPrint',
  licenceNumber: '',
  issuingAuthority: '',
  addressLine1: '32, 13 First Main Road',
  addressLine2: 'Nanganallur',
  city: 'Chennai',
  pincode: '600061',
  state: 'Tamil Nadu, India',
  phone: '',
  whatsappNumber: '',
  whatsappPrefilledMessage: '',
  email: 'pradeep1992@official.com',
  workingHours: 'Monday to Friday, 9:00 AM to 6:00 PM IST',
  courierPartner: 'Courier Partner',
  fees: {
    stampDuty: {
      amount: 100,
      displayLabel: 'Stamp Duty',
      description: 'Tamil Nadu Non-Judicial Stamp Paper duty for 11-month agreement',
    },
    serviceFee: {
      amount: 299,
      displayLabel: 'Drafting & Stamping Fee',
      description: 'Custom legal agreement formatting and stamp paper printing',
    },
    courierFee: {
      amount: 100,
      displayLabel: 'Courier Delivery',
      description: 'Original physical stamp paper agreement dispatched with tracking',
    },
  },
  placeholdersTodoList: [],
};

export const VENDOR_SERVICE_TITLE = 'Authorised Non-Judicial Stamp Paper & e-Stamp Vendor';

// Used only in grievance-officer sections, separate from general support.
export const GRIEVANCE_PHONE = '8248555629';
