'use client';

import React, { useState, useEffect, useRef } from 'react';
import Script from 'next/script';
import { 
  CheckCircle2, 
  Edit3, 
  AlertCircle, 
  ShieldCheck, 
  CreditCard, 
  FileText, 
  Lock,
  RefreshCw,
  PhoneCall,
  Eye,
  ArrowLeft
} from 'lucide-react';
import { PersonDetails, PropertyDetails, AgreementTerms, ProofUploads } from '@/lib/types';
import { VENDOR_CONFIG } from '@/src/config/vendor';
import { RentalAgreementDocument } from '@/components/agreement/RentalAgreementDocument';
import { useAuth } from '@/lib/auth-context';

interface ReviewStepProps {
  ownerData: Partial<PersonDetails>;
  tenantData: Partial<PersonDetails>;
  propertyData: Partial<PropertyDetails>;
  termsData: Partial<AgreementTerms>;
  proofData?: Partial<ProofUploads>;
  referralCode: string;
  onReferralCodeChange: (code: string) => void;
  onEditStep: (stepNumber: number) => void;
  onSubmitOrder: (referralCode: string, creditAmount: number, reviewedTotal: number) => Promise<void>;
  submitting: boolean;
  submissionError: string | null;
  paymentPending: boolean;
  phonePeCheckout: {
    redirectUrl: string;
    merchantOrderId: string;
    initiatedAt: number;
  } | null;
  paymentOrderId: string | null;
  onCheckoutCancelled: () => void;
}

declare global {
  interface Window {
    PhonePeCheckout?: {
      transact: (options: {
        tokenUrl: string;
        type: 'IFRAME';
        callback: (response: string) => void;
      }) => void;
    };
  }
}

interface FeeState {
  loading: boolean;
  feesConfigured: boolean;
  stampDuty: number | null;
  serviceFee: number | null;
  courierFee: number | null;
  stampPaperDenomination?: 100 | 200;
  deliveryLocation?: 'Within Chennai' | 'Within Tamil Nadu';
  includeNotary?: boolean;
  basePackagePrice?: number;
  notaryFee?: number;
  totalPayable: number | null;
  statusMessage: string;
  paymentAllowed: boolean;
  description?: string;
  error?: string;
  quoteKey?: string;
}

export const ReviewStep: React.FC<ReviewStepProps> = ({
  ownerData,
  tenantData,
  propertyData,
  termsData,
  proofData,
  referralCode,
  onReferralCodeChange,
  onEditStep,
  onSubmitOrder,
  submitting,
  submissionError,
  paymentPending,
  phonePeCheckout,
  paymentOrderId,
  onCheckoutCancelled,
}) => {
  const { user } = useAuth();
  const [showAgreementPreview, setShowAgreementPreview] = useState<boolean>(false);
  const [referralBalance, setReferralBalance] = useState(0);
  const [referralEligibility, setReferralEligibility] = useState<{ uid: string; eligible: boolean } | null>(null);
  const canApplyReferralCode = Boolean(user && referralEligibility?.uid === user.uid && referralEligibility.eligible);
  const [referralBalanceLoading, setReferralBalanceLoading] = useState(false);
  const [creditAmount, setCreditAmount] = useState('0');
  const [phonePeSdkReady, setPhonePeSdkReady] = useState(false);
  const [phonePeSdkError, setPhonePeSdkError] = useState<string | null>(null);
  const checkoutAttemptRef = useRef<string | null>(null);
  const [feeReload, setFeeReload] = useState(0);
  const quoteKey = JSON.stringify([termsData.stampPaperDenomination, termsData.deliveryLocation, termsData.includeNotary, submissionError, feeReload]);
  const [feeState, setFeeState] = useState<FeeState>({
    loading: true,
    feesConfigured: false,
    stampDuty: null,
    serviceFee: null,
    courierFee: null,
    basePackagePrice: 350,
    notaryFee: 0,
    totalPayable: null,
    statusMessage: '',
    paymentAllowed: false,
  });

  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    async function loadReferralBalance() {
      try {
        setReferralBalanceLoading(true);
        const idToken = await user!.getIdToken();
        const response = await fetch('/api/referrals/me', {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load referral credit.');
        if (isMounted) {
          setReferralBalance(Number(data.balance || 0));
          setReferralEligibility({ uid: user!.uid, eligible: data.canApplyReferralCode === true });
        }
      } catch (error) {
        console.error('Could not load referral credit for checkout:', error);
      } finally {
        if (isMounted) setReferralBalanceLoading(false);
      }
    }

    void loadReferralBalance();
    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    let isMounted = true;
    async function fetchFeeBreakdown() {
      await Promise.resolve();
      if (!isMounted) return;
      setFeeState((prev) => ({ ...prev, loading: true, paymentAllowed: false, feesConfigured: false, error: undefined }));
      try {
        const res = await fetch('/api/orders/calculate-fee', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            monthlyRent: termsData.monthlyRent || 0,
            securityDeposit: termsData.securityDeposit || 0,
            tenureMonths: termsData.tenureMonths || 11,
            stampPaperDenomination: termsData.stampPaperDenomination || 100,
            deliveryLocation: termsData.deliveryLocation || 'Within Chennai',
            includeNotary: Boolean(termsData.includeNotary),
          }),
        });

        if (!res.ok) throw new Error('Could not calculate fee');
        const data = await res.json();
        if (isMounted) {
          setFeeState({
            loading: false,
            quoteKey,
            feesConfigured: data.feesConfigured,
            stampDuty: data.stampDuty,
            serviceFee: data.serviceFee,
            courierFee: data.courierFee,
            stampPaperDenomination: data.stampPaperDenomination,
            deliveryLocation: data.deliveryLocation,
            includeNotary: data.includeNotary,
            basePackagePrice: data.basePackagePrice,
            notaryFee: data.notaryFee,
            totalPayable: data.totalPayable,
            statusMessage: data.statusMessage,
            paymentAllowed: data.paymentAllowed,
            description: data.description,
          });
        }
      } catch (err) {
        if (isMounted) {
          setFeeState((prev) => ({
            ...prev,
            loading: false,
            paymentAllowed: false,
            feesConfigured: false,
            error: 'Failed to retrieve server fee schedule.',
          }));
        }
      }
    }

    fetchFeeBreakdown();
    return () => {
      isMounted = false;
    };
  }, [
    quoteKey,
    termsData.monthlyRent, 
    termsData.securityDeposit, 
    termsData.tenureMonths,
    termsData.stampPaperDenomination,
    termsData.deliveryLocation,
    termsData.includeNotary
  ]);

  useEffect(() => {
    if (!phonePeSdkReady || !phonePeCheckout) return;
    if (checkoutAttemptRef.current === phonePeCheckout.merchantOrderId) return;

    const checkout = window.PhonePeCheckout;
    checkoutAttemptRef.current = phonePeCheckout.merchantOrderId;
    const launchTimer = window.setTimeout(() => {
      if (!checkout?.transact) {
        setPhonePeSdkError('Secure checkout could not load. Use the payment link below.');
        return;
      }

      try {
        checkout.transact({
          tokenUrl: phonePeCheckout.redirectUrl,
          type: 'IFRAME',
          callback: (response) => {
            if (response === 'USER_CANCEL') {
              checkoutAttemptRef.current = null;
              onCheckoutCancelled();
              return;
            }

            if (response === 'CONCLUDED' && paymentOrderId) {
              const returnUrl = new URL('/payment/phonepe/return', window.location.origin);
              returnUrl.searchParams.set('orderId', paymentOrderId);
              returnUrl.searchParams.set('paymentStartedAt', String(phonePeCheckout.initiatedAt));
              returnUrl.searchParams.set('merchantOrderId', phonePeCheckout.merchantOrderId);
              window.location.assign(returnUrl.toString());
            }
          },
        });
      } catch (error) {
        checkoutAttemptRef.current = null;
        console.error('PhonePe iframe checkout failed to open:', error);
        setPhonePeSdkError('Secure checkout could not open. Use the payment link below.');
      }
    }, 0);

    return () => window.clearTimeout(launchTimer);
  }, [phonePeSdkReady, phonePeCheckout, paymentOrderId, onCheckoutCancelled]);

  useEffect(() => {
    if (!phonePeCheckout || phonePeSdkReady || phonePeSdkError) return;

    const timeout = window.setTimeout(() => {
      setPhonePeSdkError('Secure checkout is taking longer than expected. Use the payment link below.');
    }, 12_000);

    return () => window.clearTimeout(timeout);
  }, [phonePeCheckout, phonePeSdkReady, phonePeSdkError]);

  if (showAgreementPreview) {
    return (
      <div className="animate-in fade-in duration-200">
        <RentalAgreementDocument
          data={{
            ownerDetails: ownerData,
            tenantDetails: tenantData,
            propertyDetails: propertyData,
            agreementTerms: termsData,
          }}
          onBack={() => setShowAgreementPreview(false)}
          title="Rental Agreement Draft (Official 3-Page Format)"
          customerPreview
        />
        <div className="mt-6 flex justify-center no-print">
          <button
            type="button"
            onClick={() => setShowAgreementPreview(false)}
            className="px-6 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Order Review & Submission</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <Script
        src="https://mercury.phonepe.com/web/bundle/checkout.js"
        strategy="afterInteractive"
        onLoad={() => {
          if (window.PhonePeCheckout?.transact) {
            setPhonePeSdkReady(true);
          } else {
            setPhonePeSdkError('Secure checkout could not load. Use the payment link below.');
          }
        }}
        onError={() => {
          setPhonePeSdkReady(false);
          setPhonePeSdkError('Secure checkout could not load. Use the payment link below.');
        }}
      />
      <div className="border-b border-stone-200 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-stone-900">Step 5: Review & Application Submission</h2>
              <p className="text-xs text-stone-500">
                Carefully review all submitted tenancy details before placing your order.
              </p>
            </div>
          </div>

          {/* Direct Agreement Preview Button */}
          <button
            type="button"
            onClick={() => setShowAgreementPreview(true)}
            className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer self-start sm:self-auto"
          >
            <Eye className="w-4 h-4 text-amber-700" />
            <span>Preview Agreement Document</span>
          </button>
        </div>
      </div>

      {/* Featured Preview Banner */}
      <div className="p-4 bg-gradient-to-r from-amber-50 via-stone-50 to-emerald-50 border border-amber-200/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-white rounded-xl shadow-xs border border-amber-200 text-amber-800 shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-stone-900">Official Non-Judicial Stamping Format</h4>
            <p className="text-[11px] text-stone-600 mt-0.5">
              Your inputs will be drafted into the exact 3-page Tamil Nadu stamping template (with stamp margin, rent in words, tenure, and witness clauses).
            </p>
          </div>
        </div>
      </div>

      {submissionError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="block font-bold">Submission Failed:</strong>
            <span>{submissionError}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 sm:grid-cols-2">
        {canApplyReferralCode && (
        <label className="block text-xs font-bold text-stone-800">
          Referral code <span className="font-normal text-stone-500">(optional)</span>
          <input
            type="text"
            maxLength={12}
            value={referralCode}
            onChange={(event) => onReferralCodeChange(event.target.value.toUpperCase().replace(/[\s-]/g, ''))}
            disabled={paymentPending || Boolean(phonePeCheckout)}
            placeholder="Enter a friend’s code"
            className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm uppercase text-stone-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 disabled:bg-stone-100"
          />
          <span className="mt-1 block font-normal text-stone-500">
            Referral codes can be used on your first paid order.
          </span>
        </label>
        )}

        <label className="block text-xs font-bold text-stone-800">
          Apply referral credit
          <input
            type="number"
            min="0"
            max={Math.min(referralBalance, feeState.totalPayable ?? 0)}
            step="1"
            value={creditAmount}
            onChange={(event) => setCreditAmount(event.target.value)}
            disabled={paymentPending || referralBalanceLoading || referralBalance === 0 || Boolean(phonePeCheckout)}
            className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 disabled:bg-stone-100"
          />
          <span className="mt-1 block font-normal text-stone-600">
            {referralBalanceLoading
              ? 'Loading your balance…'
              : `Available: ₹${referralBalance.toLocaleString('en-IN')}. Choose any whole-rupee amount up to the order total.`}
          </span>
        </label>
      </div>

      {/* Accordion / Summary Cards */}
      <div className="space-y-4">
        {/* 1. Owner Details */}
        <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
            <h3 className="font-bold text-stone-900 text-sm">1. Property Owner (Landlord)</h3>
            <button
              type="button"
              onClick={() => onEditStep(1)}
              className="text-xs font-semibold text-amber-800 hover:text-amber-900 flex items-center gap-1 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Step 1</span>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-700">
            <div><span className="text-stone-400">Full Name:</span> <strong className="text-stone-900">{ownerData.fullName}</strong></div>
            <div><span className="text-stone-400">Father/Spouse:</span> {ownerData.relativeName}</div>
            <div><span className="text-stone-400">Age:</span> {ownerData.age} Years</div>
            <div><span className="text-stone-400">Phone:</span> {ownerData.phone}</div>
            {ownerData.email && <div><span className="text-stone-400">Email:</span> {ownerData.email}</div>}
            {ownerData.aadhaarLast4 && (
              <div><span className="text-stone-400">Aadhaar:</span> <strong className="font-mono text-stone-900">{ownerData.aadhaarLast4}</strong></div>
            )}
            {ownerData.pan && <div><span className="text-stone-400">PAN:</span> <span className="font-mono">{ownerData.pan}</span></div>}
            <div className="sm:col-span-2"><span className="text-stone-400">Permanent Address:</span> {ownerData.address}</div>
          </div>
        </div>

        {/* 2. Tenant Details */}
        <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
            <h3 className="font-bold text-stone-900 text-sm">2. Tenant (Occupant)</h3>
            <button
              type="button"
              onClick={() => onEditStep(2)}
              className="text-xs font-semibold text-amber-800 hover:text-amber-900 flex items-center gap-1 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Step 2</span>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-700">
            <div><span className="text-stone-400">Full Name:</span> <strong className="text-stone-900">{tenantData.fullName}</strong></div>
            <div><span className="text-stone-400">Father/Spouse:</span> {tenantData.relativeName}</div>
            <div><span className="text-stone-400">Age:</span> {tenantData.age} Years</div>
            <div><span className="text-stone-400">Phone:</span> {tenantData.phone}</div>
            {tenantData.email && <div><span className="text-stone-400">Email:</span> {tenantData.email}</div>}
            {tenantData.aadhaarLast4 && (
              <div><span className="text-stone-400">Aadhaar:</span> <strong className="font-mono text-stone-900">{tenantData.aadhaarLast4}</strong></div>
            )}
            {tenantData.pan && <div><span className="text-stone-400">PAN:</span> <span className="font-mono">{tenantData.pan}</span></div>}
            <div className="sm:col-span-2"><span className="text-stone-400">Permanent Address:</span> {tenantData.address}</div>
          </div>
        </div>

        {/* 3. Property Details */}
        <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
            <h3 className="font-bold text-stone-900 text-sm">3. Rental Premises</h3>
            <button
              type="button"
              onClick={() => onEditStep(3)}
              className="text-xs font-semibold text-amber-800 hover:text-amber-900 flex items-center gap-1 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Step 3</span>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-700">
            <div><span className="text-stone-400">Type:</span> {propertyData.propertyType}</div>
            <div><span className="text-stone-400">Furnishing:</span> {propertyData.furnishing}</div>
            {propertyData.businessName && (
              <div className="sm:col-span-2">
                <span className="text-stone-400">Business / Commercial Name:</span>{' '}
                <strong className="text-stone-900">{propertyData.businessName}</strong>
              </div>
            )}
            <div><span className="text-stone-400">City / Taluk:</span> {propertyData.city}</div>
            <div><span className="text-stone-400">Pincode:</span> {propertyData.pincode}</div>
            <div className="sm:col-span-2"><span className="text-stone-400">Premises Address:</span> {propertyData.fullAddress}</div>
          </div>
        </div>

        {/* 4. Agreement Terms */}
        <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
            <h3 className="font-bold text-stone-900 text-sm">4. Tenancy Agreement Terms</h3>
            <button
              type="button"
              onClick={() => onEditStep(4)}
              className="text-xs font-semibold text-amber-800 hover:text-amber-900 flex items-center gap-1 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Step 4</span>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-700">
            <div><span className="text-stone-400">Monthly Rent:</span> <strong className="text-stone-900">₹{termsData.monthlyRent?.toLocaleString('en-IN')}</strong></div>
            <div><span className="text-stone-400">Security Advance:</span> <strong className="text-stone-900">₹{termsData.securityDeposit?.toLocaleString('en-IN')}</strong></div>
            <div><span className="text-stone-400">Maintenance Charges:</span> ₹{(termsData.maintenanceCharges || 0).toLocaleString('en-IN')} / mo</div>
            <div><span className="text-stone-400">Commencement Date:</span> {termsData.startDate}</div>
            <div><span className="text-stone-400">Tenure:</span> {termsData.tenureMonths} Months</div>
            <div><span className="text-stone-400">Notice Period:</span> {termsData.noticePeriodDays} Days</div>
            <div><span className="text-stone-400">Rent Increase %:</span> {termsData.rentIncreasePct}% per annum</div>
            <div><span className="text-stone-400">Stamp Paper:</span> <strong>In Rs.{termsData.stampPaperDenomination || 100} Stamp Paper</strong></div>
            <div><span className="text-stone-400">Courier Region:</span> <strong>{termsData.deliveryLocation || 'Within Chennai'}</strong></div>
            <div><span className="text-stone-400">Delivery Recipient:</span> <strong>{termsData.deliveryRecipient || 'Not selected'}</strong></div>
            {termsData.deliveryRecipient && (
              <div className="sm:col-span-2">
                <span className="text-stone-400">Delivery Address:</span>{' '}
                {termsData.deliveryRecipient === 'Owner' ? ownerData.address : tenantData.address}
              </div>
            )}
            <div className="sm:col-span-2">
              <span className="text-stone-400">Notary Public Attestation:</span>{' '}
              <strong className={termsData.includeNotary ? 'text-amber-700' : 'text-stone-700'}>
                {termsData.includeNotary ? 'With Notary Signature & Seal (+₹200)' : 'Without Notary Signature'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Transparent Fee Breakdown & Gateway Notice */}
      <div className="bg-stone-900 text-white rounded-2xl p-6 border border-stone-800 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Itemized Fee Summary</h3>
            <p className="text-xs text-stone-400">
              Government stamp duty, drafting fee, and courier dispatch charges are calculated separately.
            </p>
          </div>
          <ShieldCheck className="w-6 h-6 text-amber-400" />
        </div>

        {feeState.loading ? (
          <div className="flex items-center justify-center py-6 text-xs text-stone-400 gap-2">
            <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
            <span>Calculating server fee breakdown...</span>
          </div>
        ) : feeState.feesConfigured && feeState.totalPayable !== null ? (
          <div className="space-y-3 border-t border-stone-800 pt-3 text-xs">
            <div className="flex justify-between text-stone-300">
              <span>
                Stamping & Delivery Base Package (In Rs.{feeState.stampPaperDenomination || 100} paper, {feeState.deliveryLocation || 'Within Chennai'} with courier):
              </span>
              <span className="font-mono font-semibold text-white">₹{feeState.basePackagePrice?.toLocaleString('en-IN') ?? 350}</span>
            </div>
            <div className="flex justify-between text-stone-300">
              <span>Notary Public Verification & Signature:</span>
              <span className={`font-mono font-semibold ${feeState.includeNotary ? 'text-amber-400' : 'text-stone-400'}`}>
                {feeState.includeNotary ? `+₹${(feeState.notaryFee ?? 200).toLocaleString('en-IN')}` : 'Not selected (₹0)'}
              </span>
            </div>
            <div className="border-t border-stone-800 pt-3 flex justify-between text-sm font-bold text-amber-400">
              <span>Total Payable Amount:</span>
              <span className="font-mono text-base">₹{feeState.totalPayable?.toLocaleString('en-IN')}</span>
            </div>
            {Number(creditAmount) > 0 && (
              <>
                <div className="flex justify-between text-emerald-300">
                  <span>Referral credit applied:</span>
                  <span className="font-mono">−₹{Number(creditAmount).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between border-t border-stone-800 pt-2 text-sm font-bold text-white">
                  <span>Amount due:</span>
                  <span className="font-mono">
                    ₹{Math.max(0, (feeState.totalPayable ?? 0) - Number(creditAmount)).toLocaleString('en-IN')}
                  </span>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="bg-stone-100 rounded-xl p-4 border border-stone-300 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-amber-800 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Order Review & Submission</span>
            </div>
            <p className="text-stone-300 leading-relaxed">
              Your rental agreement details will be submitted for verification and printing on authentic non-judicial stamp paper.
            </p>
          </div>
        )}

        {feeState.error && (
          <div role="alert" className="rounded-xl border border-stone-300 bg-white p-4 text-sm text-stone-800">
            <p>Pricing could not be loaded. Please try again before paying.</p>
            <button type="button" onClick={() => setFeeReload((value) => value + 1)} className="mt-2 font-semibold text-brand-700 underline">Retry pricing</button>
          </div>
        )}

        {phonePeCheckout && phonePeSdkError && (
          <div className="space-y-2 rounded-xl border border-amber-700 bg-stone-800 p-4 text-xs text-stone-200" role="status">
            <p>{phonePeSdkError}</p>
            <a
              href={phonePeCheckout.redirectUrl}
              className="inline-flex items-center gap-2 font-semibold text-amber-300 underline underline-offset-2"
            >
              Continue to secure checkout
            </a>
          </div>
        )}

        {phonePeCheckout && !phonePeSdkReady && !phonePeSdkError && (
          <p className="text-center text-xs text-stone-300" role="status">Loading secure checkout...</p>
        )}

        <div className="pt-2">
          <button
            type="button"
            disabled={submitting || feeState.loading || feeState.quoteKey !== quoteKey || !feeState.paymentAllowed || Boolean(feeState.error) || (Boolean(phonePeCheckout) && !phonePeSdkError)}
            onClick={() => void onSubmitOrder(canApplyReferralCode ? referralCode : '', Number(creditAmount || 0), feeState.totalPayable ?? 0)}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-stone-600 text-stone-950 font-bold py-3.5 px-6 rounded-xl text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-stone-950 border-t-transparent rounded-full animate-spin"></div>
                <span>Starting secure checkout...</span>
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                <span>{phonePeCheckout && !phonePeSdkError ? 'Secure checkout is open' : paymentPending ? 'Retry Payment' : 'Submit & Pay'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
