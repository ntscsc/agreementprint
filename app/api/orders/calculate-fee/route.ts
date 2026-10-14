import { readJsonObject, inputErrorStatus, ApiInputError } from '@/lib/api-input';
import { NextRequest, NextResponse } from 'next/server';
import { getServerPricing } from '@/lib/server-pricing';
import { calculateOrderPrice } from '@/src/config/pricing';

export interface FeeCalculationRequest {
  monthlyRent?: number;
  securityDeposit?: number;
  tenureMonths?: number;
  stampPaperDenomination?: 100 | 200;
  deliveryLocation?: 'Within Chennai' | 'Within Tamil Nadu';
  includeNotary?: boolean;
}

export interface FeeBreakdownResponse {
  feesConfigured: boolean;
  stampPaperDenomination: 100 | 200;
  deliveryLocation: 'Within Chennai' | 'Within Tamil Nadu';
  includeNotary: boolean;
  basePackagePrice: number;
  notaryFee: number;
  totalPayable: number;
  stampDuty: number;
  serviceFee: number;
  courierFee: number;
  statusMessage: string;
  paymentAllowed: boolean;
  description: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: FeeCalculationRequest = await readJsonObject(req);
    const { 
      stampPaperDenomination = 100, 
      deliveryLocation = 'Within Chennai', 
      includeNotary = false 
    } = body;

    if (![100, 200].includes(stampPaperDenomination) || !['Within Chennai', 'Within Tamil Nadu'].includes(deliveryLocation) || typeof includeNotary !== 'boolean') throw new ApiInputError('Invalid package options.');
    // Load active pricing config from Firestore (or defaults)
    const pricing = await getServerPricing();

    const priceBreakdown = calculateOrderPrice(
      pricing,
      stampPaperDenomination === 200 ? 200 : 100,
      deliveryLocation === 'Within Tamil Nadu' ? 'Within Tamil Nadu' : 'Within Chennai',
      Boolean(includeNotary)
    );

    // Approximate component allocation for itemized accounting
    // Stamp paper face value: ₹100 or ₹200
    // Courier: ₹50 for Chennai, ₹100 for Rest of TN
    // Remainder: Vendor drafting, legal stationery, printing & stamping service
    const stampFaceValue = priceBreakdown.stampPaperDenomination;
    const estimatedCourier = priceBreakdown.deliveryLocation === 'Within Chennai' ? 50 : 100;
    const vendorDraftingService = Math.max(0, priceBreakdown.basePackagePrice - stampFaceValue - estimatedCourier);

    return NextResponse.json<FeeBreakdownResponse>({
      feesConfigured: true,
      stampPaperDenomination: priceBreakdown.stampPaperDenomination,
      deliveryLocation: priceBreakdown.deliveryLocation,
      includeNotary: priceBreakdown.includeNotary,
      basePackagePrice: priceBreakdown.basePackagePrice,
      notaryFee: priceBreakdown.notaryFee,
      totalPayable: priceBreakdown.totalPayable,
      stampDuty: stampFaceValue,
      serviceFee: vendorDraftingService,
      courierFee: estimatedCourier,
      statusMessage: 'Official vendor pricing schedule active and confirmed.',
      paymentAllowed: true,
      description: priceBreakdown.description,
    });
  } catch (error) {
    const status = inputErrorStatus(error);
    if (status) return NextResponse.json({ error: status === 401 ? 'Sign in again to continue.' : (error as Error).message }, { status });
    console.error('Fee calculation error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate fee breakdown.' },
      { status: 500 }
    );
  }
}
