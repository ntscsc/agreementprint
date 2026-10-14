'use client';

import { validateAgreement } from '@/lib/agreement-validation';

import { requestReviewedCheckout } from '@/lib/checkout-client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  ArrowRight, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  LogIn, 
  Clock, 
  FileCheck2,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { ProgressIndicator } from './ProgressIndicator';
import { OwnerStep } from './OwnerStep';
import { TenantStep } from './TenantStep';
import { PropertyStep } from './PropertyStep';
import { AgreementTermsStep } from './AgreementTermsStep';
import { ReviewStep } from './ReviewStep';
import { OrderConfirmation } from './OrderConfirmation';
import { 
  PersonDetails, 
  PropertyDetails, 
  AgreementTerms, 
  ProofUploads, 
  Order 
} from '@/lib/types';
import { saveDraft, getDraft, deleteDraft, createOrder } from '@/lib/order-service';
import { extractPincode } from '@/lib/pincode-utils';

function getReferralCodeFromUrl() {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('ref')?.toUpperCase().replace(/[\s-]/g, '').slice(0, 12) || '';
}

export function OrderIntakeWizard() {
  const { user, loading: authLoading, signInWithGoogle, authError } = useAuth();
  const [signingIn, setSigningIn] = useState<boolean>(false);
  const [localSignInError, setLocalSignInError] = useState<string | null>(null);

  // Wizard state
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [maxAccessibleStep, setMaxAccessibleStep] = useState<number>(1);
  const [draftLoading, setDraftLoading] = useState<boolean>(false);
  const [draftLoadError, setDraftLoadError] = useState<string | null>(null);

  // Form State
  const [ownerData, setOwnerData] = useState<Partial<PersonDetails>>({
    fullName: '',
    relativeName: '',
    age: '',
    phone: '',
    email: '',
    aadhaarLast4: '',
    pan: '',
    address: '',
  });

  const [tenantData, setTenantData] = useState<Partial<PersonDetails>>({
    fullName: '',
    relativeName: '',
    age: '',
    phone: '',
    email: '',
    aadhaarLast4: '',
    pan: '',
    address: '',
  });

  const [propertyData, setPropertyData] = useState<Partial<PropertyDetails>>({
    fullAddress: '',
    city: '',
    pincode: '',
    propertyType: 'Flat',
    furnishing: 'Semi-Furnished',
  });

  const [termsData, setTermsData] = useState<Partial<AgreementTerms>>({
    monthlyRent: undefined,
    securityDeposit: undefined,
    maintenanceCharges: 0,
    startDate: '',
    tenureMonths: 11,
    noticePeriodDays: 30,
    rentIncreasePct: 5,
    paymentDueDay: 5,
    stampPaperDenomination: 100,
    deliveryRecipient: undefined,
    includeNotary: false,
  });

  const [proofData, setProofData] = useState<Partial<ProofUploads>>({});
  const [referralCode, setReferralCode] = useState('');

  // Submission & Confirmed Order State
  const [submittingOrder, setSubmittingOrder] = useState<boolean>(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [pendingPaymentOrderId, setPendingPaymentOrderId] = useState<string | null>(null);
  const [phonePeCheckout, setPhonePeCheckout] = useState<{
    redirectUrl: string;
    merchantOrderId: string;
    initiatedAt: number;
  } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setReferralCode(getReferralCodeFromUrl()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Validation Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Autosave Status
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [draftRestoredBanner, setDraftRestoredBanner] = useState<boolean>(false);
  const [draftActionError, setDraftActionError] = useState<string | null>(null);

  // References for robust debouncing and race-condition prevention
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const saveSequenceRef = useRef<number>(0);
  const previousUidRef = useRef<string | null>(null);
  const isDraftLoadedRef = useRef<boolean>(false);

  // Latest snapshot of all form data for timer callbacks
  const latestDataRef = useRef({
    ownerData,
    tenantData,
    propertyData,
    termsData,
    proofData,
    currentStep,
  });

  useEffect(() => {
    latestDataRef.current = {
      ownerData,
      tenantData,
      propertyData,
      termsData,
      proofData,
      currentStep,
    };
  }, [ownerData, tenantData, propertyData, termsData, proofData, currentStep]);

  // Clean form state helper
  const resetAllFormState = useCallback(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    saveSequenceRef.current += 1;
    isDraftLoadedRef.current = false;

    setOwnerData({
      fullName: '',
      relativeName: '',
      age: '',
      phone: '',
      email: '',
      aadhaarLast4: '',
      pan: '',
      address: '',
    });
    setTenantData({
      fullName: '',
      relativeName: '',
      age: '',
      phone: '',
      email: '',
      aadhaarLast4: '',
      pan: '',
      address: '',
    });
    setPropertyData({
      fullAddress: '',
      city: '',
      pincode: '',
      propertyType: 'Flat',
      furnishing: 'Semi-Furnished',
    });
    setTermsData({
      monthlyRent: undefined,
      securityDeposit: undefined,
      maintenanceCharges: 0,
      startDate: '',
      tenureMonths: 11,
      noticePeriodDays: 30,
      rentIncreasePct: 5,
    });
    setProofData({});
    setReferralCode(getReferralCodeFromUrl());
    setCurrentStep(1);
    setMaxAccessibleStep(1);
    setErrors({});
    setSaveStatus('idle');
    setLastSavedTime(null);
    setDraftRestoredBanner(false);
    setDraftActionError(null);
    setDraftLoadError(null);
    setSubmissionError(null);
    setConfirmedOrder(null);
    setPendingPaymentOrderId(null);
    setPhonePeCheckout(null);
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  // Account change detection & clean draft loading
  useEffect(() => {
    const currentUid = user?.uid || null;

    // Detect account switch or logout
    if (previousUidRef.current !== currentUid) {
      resetAllFormState();
      previousUidRef.current = currentUid;
    }

    if (!user) return;
    const uid = user.uid;
    const userEmail = user.email || '';

    let isSubscribed = true;
    async function loadAccountDraft() {
      setDraftLoading(true);
      setDraftLoadError(null);
      try {
        const draft = await getDraft(uid);
        if (!isSubscribed) return;

        if (draft && draft.formData) {
          const fd = draft.formData;
          if (fd.ownerDetails) setOwnerData(fd.ownerDetails);
          else if (userEmail) setOwnerData((prev) => ({ ...prev, email: userEmail }));

          if (fd.tenantDetails) setTenantData(fd.tenantDetails);
          if (fd.propertyDetails) setPropertyData(fd.propertyDetails);
          if (fd.agreementTerms) setTermsData(fd.agreementTerms);
          if (fd.proofUploads) setProofData(fd.proofUploads);

          if (draft.currentStep && draft.currentStep >= 1 && draft.currentStep <= 6) {
            setCurrentStep(draft.currentStep);
            setMaxAccessibleStep(Math.max(draft.currentStep, 1));
          }

          if (draft.updatedAt) {
            setLastSavedTime(
              new Date(draft.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            );
            setDraftRestoredBanner(true);
          }
        } else {
          // If no previous draft, seed owner email with current Google account email
          if (userEmail) {
            setOwnerData((prev) => ({ ...prev, email: userEmail }));
          }
        }
        isDraftLoadedRef.current = true;
      } catch (err) {
        if (isSubscribed) {
          console.error('Failed to load user draft:', err);
          setDraftLoadError('Could not load your saved draft. You can continue or retry.');
        }
      } finally {
        if (isSubscribed) {
          setDraftLoading(false);
        }
      }
    }

    loadAccountDraft();

    return () => {
      isSubscribed = false;
    };
  }, [user, resetAllFormState]);

  // Robust Save Function with Sequence Guard
  const performSave = useCallback(
    async (stepToSave: number) => {
      if (!user || !isDraftLoadedRef.current) return;

      const currentSeq = ++saveSequenceRef.current;
      setSaveStatus('saving');

      try {
        const { ownerData: o, tenantData: t, propertyData: p, termsData: tm, proofData: pr } =
          latestDataRef.current;

        const draftPayload: Partial<Order> = {
          ownerDetails: o as PersonDetails,
          tenantDetails: t as PersonDetails,
          propertyDetails: p as PropertyDetails,
          agreementTerms: tm as AgreementTerms,
          proofUploads: pr as ProofUploads,
        };

        await saveDraft(user.uid, stepToSave, draftPayload);

        // Only update status if no newer save occurred while this request was flying
        if (saveSequenceRef.current === currentSeq) {
          setSaveStatus('saved');
          setLastSavedTime(
            new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          );
        }
      } catch (err) {
        if (saveSequenceRef.current === currentSeq) {
          setSaveStatus('error');
          // Important: Clear last saved time on error to prevent displaying misleading earlier status
          setLastSavedTime(null);
        }
      }
    },
    [user]
  );

  // Debounced autosave scheduler
  const scheduleAutosave = useCallback(() => {
    if (!user || !isDraftLoadedRef.current) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      performSave(latestDataRef.current.currentStep);
    }, 1200);
  }, [user, performSave]);

  // Step 1 Validation (Owner)
  const validateOwner = (): boolean => {
    const errs: Record<string, string> = {};
    if (!ownerData.fullName?.trim() || ownerData.fullName.trim().length < 2) {
      errs.fullName = 'Owner full legal name is required (minimum 2 characters)';
    }
    if (!ownerData.relativeName?.trim() || ownerData.relativeName.trim().length < 2) {
      errs.relativeName = "Father's or spouse's name is required";
    }
    if (!ownerData.age || Number(ownerData.age) < 18 || Number(ownerData.age) > 120) {
      errs.age = 'Owner must be at least 18 years of age';
    }
    if (!ownerData.phone || !/^[6-9]\d{9}$/.test(ownerData.phone)) {
      errs.phone = 'Valid 10-digit Indian mobile number required (starting with 6-9)';
    }
    if (ownerData.email && ownerData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerData.email)) {
      errs.email = 'Valid email address required';
    }
    if (ownerData.aadhaarLast4 && ownerData.aadhaarLast4.trim()) {
      const cleanAadhaar = ownerData.aadhaarLast4.replace(/[\s-]/g, '');
      if (!/^\d{4,12}$/.test(cleanAadhaar)) {
        errs.aadhaarLast4 = 'Please enter a valid numeric identification or Aadhaar number';
      }
    }
    if (ownerData.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(ownerData.pan)) {
      errs.pan = 'Invalid PAN format (e.g. ABCDE1234F)';
    }
    if (!ownerData.address?.trim() || ownerData.address.trim().length < 10) {
      errs.address = 'Complete permanent address required (at least 10 characters)';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Step 2 Validation (Tenant)
  const validateTenant = (): boolean => {
    const errs: Record<string, string> = {};
    if (!tenantData.fullName?.trim() || tenantData.fullName.trim().length < 2) {
      errs.fullName = 'Tenant full legal name is required (minimum 2 characters)';
    }
    if (!tenantData.relativeName?.trim() || tenantData.relativeName.trim().length < 2) {
      errs.relativeName = "Father's or spouse's name is required";
    }
    if (!tenantData.age || Number(tenantData.age) < 18 || Number(tenantData.age) > 120) {
      errs.age = 'Tenant must be at least 18 years of age';
    }
    if (!tenantData.phone || !/^[6-9]\d{9}$/.test(tenantData.phone)) {
      errs.phone = 'Valid 10-digit Indian mobile number required (starting with 6-9)';
    }
    if (tenantData.email && tenantData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tenantData.email)) {
      errs.email = 'Valid email address required';
    }
    if (tenantData.aadhaarLast4 && tenantData.aadhaarLast4.trim()) {
      const cleanAadhaar = tenantData.aadhaarLast4.replace(/[\s-]/g, '');
      if (!/^\d{4,12}$/.test(cleanAadhaar)) {
        errs.aadhaarLast4 = 'Please enter a valid numeric identification or Aadhaar number';
      }
    }
    if (tenantData.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(tenantData.pan)) {
      errs.pan = 'Invalid PAN format (e.g. ABCDE1234F)';
    }
    if (!tenantData.address?.trim() || tenantData.address.trim().length < 10) {
      errs.address = 'Complete permanent address required (at least 10 characters)';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Step 3 Validation (Property)
  const validateProperty = (): boolean => {
    const errs: Record<string, string> = {};
    if (!propertyData.propertyType) errs.propertyType = 'Select property type';
    if (propertyData.propertyType === 'Commercial Shop') {
      if (!propertyData.businessName?.trim() || propertyData.businessName.trim().length < 2) {
        errs.businessName = 'Business or commercial enterprise name is required';
      }
    }
    if (!propertyData.furnishing) errs.furnishing = 'Select furnishing status';
    if (!propertyData.city?.trim() || propertyData.city.trim().length < 2) {
      errs.city = 'City or Taluk in Tamil Nadu is required';
    }
    if (!propertyData.pincode || !/^\d{6}$/.test(propertyData.pincode)) {
      errs.pincode = 'Valid 6-digit Indian pincode required';
    }
    if (!propertyData.fullAddress?.trim() || propertyData.fullAddress.trim().length < 12) {
      errs.fullAddress = 'Complete premises address required (at least 12 characters)';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Step 4 Validation (Agreement Terms)
  const validateTerms = (): boolean => {
    const errs: Record<string, string> = {};
    if (!termsData.monthlyRent || Number(termsData.monthlyRent) <= 0) {
      errs.monthlyRent = 'Monthly rent must be a positive amount';
    }
    if (termsData.securityDeposit === undefined || Number(termsData.securityDeposit) < 0) {
      errs.securityDeposit = 'Security advance/deposit is required (enter 0 if none)';
    }
    if (!termsData.startDate) {
      errs.startDate = 'Please select agreement commencement date';
    }
    if (!termsData.tenureMonths || Number(termsData.tenureMonths) < 1) {
      errs.tenureMonths = 'Select tenancy tenure';
    }
    if (!termsData.deliveryRecipient) {
      errs.deliveryRecipient = 'Choose whether delivery should go to the owner or tenant.';
    } else {
      const deliveryAddress = termsData.deliveryRecipient === 'Owner'
        ? ownerData.address
        : tenantData.address;
      if (!extractPincode(deliveryAddress)) {
        errs.deliveryRecipient = 'Add a six-digit Tamil Nadu PIN code to the selected address in Step 1 or Step 2.';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (!validateOwner()) return;
      const next = 2;
      setCurrentStep(next);
      setMaxAccessibleStep((prev) => Math.max(prev, next));
      performSave(next);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (currentStep === 2) {
      if (!validateTenant()) return;
      const next = 3;
      setCurrentStep(next);
      setMaxAccessibleStep((prev) => Math.max(prev, next));
      performSave(next);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (currentStep === 3) {
      if (!validateProperty()) return;
      const next = 4;
      setCurrentStep(next);
      setMaxAccessibleStep((prev) => Math.max(prev, next));
      performSave(next);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (currentStep === 4) {
      if (!validateTerms()) return;
      const next = 5;
      setCurrentStep(next);
      setMaxAccessibleStep((prev) => Math.max(prev, next));
      performSave(next);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      const prev = currentStep - 1;
      setCurrentStep(prev);
      setErrors({});
      performSave(prev);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleClearDraft = async () => {
    if (!user) return;
    if (window.confirm('Are you sure you want to discard your saved draft and start fresh?')) {
      try {
        if (autosaveTimerRef.current) {
          clearTimeout(autosaveTimerRef.current);
          autosaveTimerRef.current = null;
        }
        await deleteDraft(user.uid);
        resetAllFormState();
        if (user.email) {
          setOwnerData((prev) => ({ ...prev, email: user.email || '' }));
        }
      } catch (err) {
        setDraftActionError('Failed to delete draft. Please check your internet connection.');
      }
    }
  };

  // Final Order Submission
  const handleSubmitOrder = async (submittedReferralCode: string, creditAmount: number, reviewedTotal: number) => {
    if (!user || submittingOrder) return;
    setSubmissionError(null);

    // Validate all sections before creating order
    if (!validateOwner()) {
      setCurrentStep(1);
      return;
    }
    if (!validateTenant()) {
      setCurrentStep(2);
      return;
    }
    if (!validateProperty()) {
      setCurrentStep(3);
      return;
    }
    if (!validateTerms()) {
      setCurrentStep(4);
      return;
    }

    setSubmittingOrder(true);
    try {
      validateAgreement({ ownerDetails: ownerData, tenantDetails: tenantData, propertyDetails: propertyData, agreementTerms: termsData });
      const normalizedReferralCode = submittedReferralCode.trim().toUpperCase();
      if (normalizedReferralCode) {
        const idToken = await user.getIdToken();
        const validationResponse = await fetch('/api/referrals/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ code: normalizedReferralCode }),
        });
        const validationResult = await validationResponse.json();
        if (!validationResponse.ok || !validationResult.valid) {
          throw new Error(validationResult.error || 'That referral code is not valid for this order.');
        }
      }

      let orderId = pendingPaymentOrderId;
      if (!orderId) {
        orderId = `TNR_${Date.now().toString().slice(-6)}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        await createOrder({
          orderId,
          ownerUid: user.uid,
          customerEmail: user.email || ownerData.email || '',
          customerPhone: ownerData.phone,
          ownerDetails: ownerData as PersonDetails,
          tenantDetails: tenantData as PersonDetails,
          propertyDetails: propertyData as PropertyDetails,
          agreementTerms: termsData as AgreementTerms,
          proofUploads: proofData as ProofUploads,
          ...(normalizedReferralCode ? { referralCode: normalizedReferralCode } : {}),
        });
        setPendingPaymentOrderId(orderId);
      }

      const idToken = await user.getIdToken();
      const paymentResponse = await requestReviewedCheckout({ orderId, creditAmount, reviewedTotal, orderDetails: {
          customerEmail: user.email || ownerData.email || '',
          customerPhone: ownerData.phone || '',
          ownerDetails: ownerData,
          tenantDetails: tenantData,
          propertyDetails: propertyData,
          agreementTerms: termsData,
          proofUploads: proofData,
          referralCode: normalizedReferralCode,
        } }, idToken);
      const paymentResult = await paymentResponse.json();
      if (paymentResult.paid) {
        setConfirmedOrder(paymentResult.order as Order);
        return;
      }
      if (!paymentResponse.ok || !paymentResult.available || !paymentResult.redirectUrl) {
        throw new Error(paymentResult.error || 'Unable to start online payment. Your order is saved and you can retry.');
      }

      setPhonePeCheckout({
        redirectUrl: paymentResult.redirectUrl,
        merchantOrderId: paymentResult.merchantOrderId,
        initiatedAt: paymentResult.initiatedAt,
      });
    } catch (err: unknown) {
      console.error('Order creation failed:', err);
      setSubmissionError(
        err instanceof Error ? err.message : 'Unable to register order. Please verify details and retry.'
      );
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handlePhonePeCheckoutCancelled = useCallback(() => {
    setPhonePeCheckout(null);
    setSubmissionError('Checkout was cancelled. You can retry payment when ready.');
  }, []);

  // If order was confirmed, show the receipt confirmation screen
  if (confirmedOrder) {
    return <OrderConfirmation order={confirmedOrder} onStartNew={() => resetAllFormState()} />;
  }

  // Auth Loading
  if (authLoading || draftLoading) {
    return (
      <div className="max-w-3xl mx-auto py-20 px-4 text-center space-y-4">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-xs text-stone-600 font-medium">
          {authLoading ? 'Verifying authentication...' : 'Loading your saved application...'}
        </p>
      </div>
    );
  }

  // Google Sign-In Gate
  if (!user) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4">
        <div className="bg-white border border-stone-200 rounded-3xl p-8 sm:p-10 shadow-sm text-center space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto shadow-inner">
            <LogIn className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-3 py-1 rounded-full">
              Customer Sign-In
            </span>
            <h1 className="text-2xl font-black text-stone-900 tracking-tight">
              Sign In to Start Your Rental Agreement
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              Sign in with your Google account. Your application details are automatically autosaved to your private account so you never lose your progress.
            </p>
          </div>

          {(authError || localSignInError) && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl text-left">
              {authError || localSignInError}
            </div>
          )}

          <div className="pt-2">
            <button
              type="button"
              disabled={signingIn}
              onClick={async () => {
                setLocalSignInError(null);
                setSigningIn(true);
                try {
                  await signInWithGoogle();
                } catch (err: unknown) {
                  const message = (err as { message?: string })?.message || 'Google sign-in popup was blocked or failed.';
                  setLocalSignInError(message);
                } finally {
                  setSigningIn(false);
                }
              }}
              className="w-full flex items-center justify-center gap-3 bg-white border border-stone-300 hover:bg-stone-50 disabled:opacity-50 text-stone-800 font-bold py-3.5 px-6 rounded-2xl shadow-sm hover:shadow transition-all text-sm cursor-pointer"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{signingIn ? 'Connecting to Google...' : 'Continue with Google'}</span>
            </button>
          </div>

          <div className="pt-2 text-[11px] text-stone-500">
            <span>By signing in, you agree to our </span>
            <Link href="/terms" className="text-amber-800 underline">Terms</Link>
            <span> and </span>
            <Link href="/privacy-policy" className="text-amber-800 underline">Privacy Policy</Link>.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-stone-900">
            Rental Agreement Application
          </h1>
        </div>

        {/* Live Autosave Status Indicator */}
        <div className="flex items-center gap-2 self-start sm:self-auto text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-100 border border-stone-200 text-stone-600">
            {saveStatus === 'saving' ? (
              <>
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></div>
                <span className="font-medium text-[11px]">Saving draft...</span>
              </>
            ) : saveStatus === 'saved' && lastSavedTime ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-medium text-[11px]">Draft autosaved at {lastSavedTime}</span>
              </>
            ) : saveStatus === 'error' ? (
              <div className="flex items-center gap-1.5 text-rose-600">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="font-medium text-[11px]">Save failed</span>
                <button
                  type="button"
                  onClick={() => performSave(currentStep)}
                  className="font-bold underline text-[11px] text-rose-800 hover:text-rose-900 cursor-pointer ml-1"
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 text-stone-400" />
                <span className="font-medium text-[11px]">Autosave active</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={handleClearDraft}
            title="Discard saved draft and start fresh"
            className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-stone-100 transition-colors cursor-pointer"
            aria-label="Discard draft"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Draft Restored Banner */}
      {draftRestoredBanner && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs text-amber-950">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-700 shrink-0" />
            <span>Resumed your saved draft. Your previous entries have been restored.</span>
          </div>
          <button
            type="button"
            onClick={() => setDraftRestoredBanner(false)}
            className="text-amber-800 font-bold hover:underline shrink-0 text-xs cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Action / Load Error Banners */}
      {(draftActionError || draftLoadError) && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs text-rose-900">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{draftActionError || draftLoadError}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setDraftActionError(null);
              setDraftLoadError(null);
            }}
            className="text-rose-800 font-bold hover:underline shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Progress Indicator */}
      <ProgressIndicator
        currentStep={currentStep}
        onStepClick={(s) => {
          if (s <= maxAccessibleStep) {
            setCurrentStep(s);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
        maxAccessibleStep={maxAccessibleStep}
      />

      {/* Main Step Body Card */}
      <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm">
        {/* Step 1: Owner */}
        {currentStep === 1 && (
          <OwnerStep
            data={ownerData}
            onChange={(fields) => {
              setOwnerData((prev) => ({ ...prev, ...fields }));
              setErrors({});
              scheduleAutosave();
            }}
            errors={errors}
          />
        )}

        {/* Step 2: Tenant */}
        {currentStep === 2 && (
          <TenantStep
            data={tenantData}
            onChange={(fields) => {
              setTenantData((prev) => ({ ...prev, ...fields }));
              setErrors({});
              scheduleAutosave();
            }}
            errors={errors}
          />
        )}

        {/* Step 3: Property */}
        {currentStep === 3 && (
          <PropertyStep
            data={propertyData}
            onChange={(fields) => {
              setPropertyData((prev) => ({ ...prev, ...fields }));
              setErrors({});
              scheduleAutosave();
            }}
            errors={errors}
          />
        )}

        {/* Step 4: Agreement Terms */}
        {currentStep === 4 && (
          <AgreementTermsStep
            data={termsData}
            ownerAddress={ownerData.address}
            ownerName={ownerData.fullName}
            tenantAddress={tenantData.address}
            tenantName={tenantData.fullName}
            onChange={(fields) => {
              setTermsData((prev) => ({ ...prev, ...fields }));
              setErrors({});
              scheduleAutosave();
            }}
            errors={errors}
          />
        )}

        {/* Step 5: Review & Final Submission */}
        {currentStep === 5 && (
          <ReviewStep
            ownerData={ownerData}
            tenantData={tenantData}
            propertyData={propertyData}
            termsData={termsData}
            proofData={proofData}
            referralCode={referralCode}
            onReferralCodeChange={setReferralCode}
            onEditStep={(s) => {
              setCurrentStep(s);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onSubmitOrder={handleSubmitOrder}
            submitting={submittingOrder}
            submissionError={submissionError}
            paymentPending={Boolean(pendingPaymentOrderId)}
            phonePeCheckout={phonePeCheckout}
            paymentOrderId={pendingPaymentOrderId}
            onCheckoutCancelled={handlePhonePeCheckoutCancelled}
          />
        )}

        {/* Wizard Navigation Buttons (for Steps 1 to 4) */}
        {currentStep < 5 && (
          <div className="mt-8 pt-6 border-t border-stone-200 flex items-center justify-between gap-4">
            <div>
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-5 py-2.5 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-700 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
              )}
            </div>

            <div>
              <button
                type="button"
                onClick={handleNext}
                className="bg-stone-900 hover:bg-stone-800 text-white font-bold py-3 px-6 rounded-xl text-xs uppercase tracking-wider shadow-sm transition-all flex items-center gap-2 cursor-pointer active:translate-y-0.5"
              >
                <span>
                  {currentStep === 1 && 'Next: Tenant Details'}
                  {currentStep === 2 && 'Next: Property Details'}
                  {currentStep === 3 && 'Next: Agreement Terms'}
                  {currentStep === 4 && 'Next: Review & Confirm'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
