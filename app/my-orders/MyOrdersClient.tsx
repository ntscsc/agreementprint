'use client';

import { requestReviewedCheckout } from '@/lib/checkout-client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  FileText, 
  Clock, 
  Truck, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight, 
  LogIn, 
  ShieldAlert,
  Eye,
  ArrowLeft,
  CreditCard,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Order, OrderStatus } from '@/lib/types';
import { submitDocumentCorrection } from '@/lib/order-service';
import { RentalAgreementDocument } from '@/components/agreement/RentalAgreementDocument';

export function MyOrdersClient() {
  const { user, loading: authLoading, signInWithGoogle, authError } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [localSignInError, setLocalSignInError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startingPaymentOrderId, setStartingPaymentOrderId] = useState<string | null>(null);
  const [paymentRetryError, setPaymentRetryError] = useState<{ orderId: string; message: string } | null>(null);

  // Correction handling
  const [activeCorrectionOrderId, setActiveCorrectionOrderId] = useState<string | null>(null);
  const [correctionNote, setCorrectionNote] = useState('');
  const [submittingCorrection, setSubmittingCorrection] = useState(false);
  const [correctionSuccess, setCorrectionSuccess] = useState<string | null>(null);

  // Agreement Document View State
  const [selectedAgreementOrder, setSelectedAgreementOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;

    let isMounted = true;
    async function fetchUserOrders() {
      try {
        setOrdersLoading(true);
        const q = query(
          collection(db, 'orders'),
          where('ownerUid', '==', uid)
        );
        const snap = await getDocs(q);
        if (!isMounted) return;

        const list: Order[] = [];
        snap.forEach((doc) => {
          list.push(doc.data() as Order);
        });
        // Sort client-side by createdAt descending
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setOrders(list);
      } catch (err: unknown) {
        if (isMounted) {
          console.error('Error fetching user orders:', err);
          setError('Could not load your orders. Please check your internet connection.');
        }
      } finally {
        if (isMounted) {
          setOrdersLoading(false);
        }
      }
    }

    fetchUserOrders();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleCorrectionSubmit = async (orderId: string) => {
    if (!user) return;
    setSubmittingCorrection(true);
    try {
      await submitDocumentCorrection(orderId, {});
      setCorrectionSuccess('Correction submitted successfully. Your order is now under verification.');
      setActiveCorrectionOrderId(null);
      // Update local status
      setOrders((prev) =>
        prev.map((o) => (o.orderId === orderId ? { ...o, status: 'Under verification' } : o))
      );
    } catch (err) {
      console.error('Correction submission failed:', err);
      alert('Could not submit correction. Please try again.');
    } finally {
      setSubmittingCorrection(false);
    }
  };

  const handlePaymentRetry = async (orderId: string) => {
    if (!user) return;
    setStartingPaymentOrderId(orderId);
    setPaymentRetryError(null);

    try {
      const idToken = await user.getIdToken();
      const response = await requestReviewedCheckout({ orderId }, idToken);
      const result = await response.json();
      if (response.ok && result.paid) {
        setOrders((previous) => previous.map((order) => order.orderId === orderId ? result.order as Order : order));
        setStartingPaymentOrderId(null);
        return;
      }
      if (!response.ok || !result.available || !result.redirectUrl) {
        throw new Error(result.error || 'Unable to start online payment. Please try again.');
      }

      window.location.assign(result.redirectUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to start online payment.';
      setPaymentRetryError({ orderId, message });
      setStartingPaymentOrderId(null);
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'Submitted':
        return <span className="bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full text-xs font-semibold">Submitted</span>;
      case 'Under verification':
        return <span className="bg-sky-100 text-sky-800 px-2.5 py-0.5 rounded-full text-xs font-semibold">Under Verification</span>;
      case 'Documents needed':
        return <span className="bg-rose-100 text-rose-800 px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Correction Needed</span>;
      case 'Drafting':
        return <span className="bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-full text-xs font-semibold">Drafting on Stamp Paper</span>;
      case 'Dispatched':
        return <span className="bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1"><Truck className="w-3 h-3" /> Dispatched</span>;
      case 'Delivered':
        return <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Delivered</span>;
      case 'Cancelled':
        return <span className="bg-stone-200 text-stone-700 px-2.5 py-0.5 rounded-full text-xs font-semibold">Cancelled</span>;
      default:
        return <span className="bg-stone-100 text-stone-700 px-2.5 py-0.5 rounded-full text-xs font-semibold">{status}</span>;
    }
  };

  if (authLoading) {
    return (
      <div className="max-w-4xl mx-auto py-20 px-4 text-center space-y-4">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-xs text-stone-500 font-medium">Checking authentication...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-16 px-4">
        <div className="bg-white border border-stone-200 rounded-3xl p-8 shadow-sm text-center space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto">
            <LogIn className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-stone-900">Sign in to View Your Orders</h1>
            <p className="text-xs text-stone-600">
              Sign in with your Google account to view your past rental agreements, tracking numbers, and correction requests.
            </p>
          </div>
          { (authError || localSignInError) && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl text-left">
              {authError || localSignInError}
            </div>
          )}
          <button
            onClick={async () => {
              setLocalSignInError(null);
              setSigningIn(true);
              try {
                await signInWithGoogle();
              } catch (err: unknown) {
                const message = (err as { message?: string })?.message || 'Failed to sign in. Please verify popups are allowed.';
                setLocalSignInError(message);
              } finally {
                setSigningIn(false);
              }
            }}
            disabled={signingIn}
            className="w-full bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer"
          >
            {signingIn ? 'Opening Google Sign-In...' : 'Sign In with Google'}
          </button>
        </div>
      </div>
    );
  }

  if (selectedAgreementOrder) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <RentalAgreementDocument
          data={{
            ownerDetails: selectedAgreementOrder.ownerDetails,
            tenantDetails: selectedAgreementOrder.tenantDetails,
            propertyDetails: selectedAgreementOrder.propertyDetails,
            agreementTerms: selectedAgreementOrder.agreementTerms,
            orderId: selectedAgreementOrder.orderId,
            createdAt: selectedAgreementOrder.createdAt,
          }}
          onBack={() => setSelectedAgreementOrder(null)}
          title={`Rental Agreement Draft (Order #${selectedAgreementOrder.orderId})`}
          customerPreview
        />
        <div className="flex justify-center no-print">
          <button
            type="button"
            onClick={() => setSelectedAgreementOrder(null)}
            className="px-6 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to My Orders List</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-stone-900">
            My Rental Agreements
          </h1>
          <p className="text-xs text-stone-600 mt-0.5">
            Logged in as <span className="font-semibold">{user.email}</span>
          </p>
        </div>

        <Link
          href="/order"
          className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider shadow-sm transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <FileText className="w-4 h-4 text-stone-950" />
          <span>New Agreement</span>
        </Link>
      </div>

      {correctionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{correctionSuccess}</span>
          </div>
          <button
            onClick={() => setCorrectionSuccess(null)}
            className="font-bold underline text-emerald-800 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {ordersLoading ? (
        <div className="py-16 text-center space-y-3">
          <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-stone-500">Loading your applications...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-3 text-xs text-rose-800">
          <AlertCircle className="w-6 h-6 text-rose-600 mx-auto" />
          <p>{error}</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-3xl p-10 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
            <FileText className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-stone-800">No Orders Found</h2>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              You haven&apos;t placed any rental agreement orders with this account yet.
            </p>
          </div>
          <Link
            href="/order"
            className="inline-flex items-center gap-1.5 bg-stone-900 hover:bg-stone-800 text-white font-semibold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer"
          >
            <span>Start Your First Agreement</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((ord) => (
            <div
              key={ord.orderId}
              className="bg-white border border-stone-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4 hover:border-stone-300 transition-colors"
            >
              {/* Top row: Order ID, Date, Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-stone-900">{ord.orderId}</span>
                    {getStatusBadge(ord.status)}
                  </div>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    Ordered on {new Date(ord.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedAgreementOrder(ord)}
                    className="text-xs font-semibold text-stone-700 hover:text-stone-900 px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-amber-700" />
                    <span>View Agreement Draft</span>
                  </button>

                  <Link
                    href={`/track?orderId=${ord.orderId}&phone=${ord.ownerDetails.phone}`}
                    className="text-xs font-semibold text-amber-800 hover:text-amber-900 px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 transition-colors flex items-center gap-1"
                  >
                    <span>Track Status</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {/* Order Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-stone-600">
                <div>
                  <span className="block text-stone-400 text-[11px]">Landlord & Tenant</span>
                  <strong className="text-stone-900">{ord.ownerDetails.fullName}</strong>
                  <p className="text-stone-500">Tenant: {ord.tenantDetails.fullName}</p>
                </div>

                <div>
                  <span className="block text-stone-400 text-[11px]">Premises</span>
                  <p className="text-stone-800 truncate">{ord.propertyDetails.fullAddress}</p>
                  <p className="text-stone-500">{ord.propertyDetails.city} ({ord.propertyDetails.propertyType})</p>
                </div>

                <div>
                  <span className="block text-stone-400 text-[11px]">Tenancy Terms</span>
                  <strong className="text-stone-900">₹{ord.agreementTerms.monthlyRent?.toLocaleString('en-IN')} / mo</strong>
                  <p className="text-stone-500">Deposit: ₹{ord.agreementTerms.securityDeposit?.toLocaleString('en-IN')}</p>
                </div>
              </div>

              {(ord.payment.totalBeforeCredits !== undefined || (ord.payment.referralCreditApplied ?? 0) > 0) && (
                <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-xs text-emerald-950">
                  <span>Order total: ₹{(ord.payment.totalBeforeCredits ?? ord.payment.amount ?? 0).toLocaleString('en-IN')}</span>
                  {(ord.payment.referralCreditApplied ?? 0) > 0 && (
                    <span>Referral credit: −₹{ord.payment.referralCreditApplied?.toLocaleString('en-IN')}</span>
                  )}
                  <strong>Paid: ₹{(ord.payment.amount ?? 0).toLocaleString('en-IN')}</strong>
                </div>
              )}

              {(ord.payment?.status === 'Pending' || ord.payment?.status === 'Failed') &&
                ord.status !== 'Cancelled' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <CreditCard className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block">
                          {ord.payment.status === 'Failed' ? 'Payment failed' : 'Payment not completed'}
                        </strong>
                        <p className="mt-0.5 text-amber-800">
                          Your order is saved. Resume checkout here whenever you are ready.
                        </p>
                        {paymentRetryError?.orderId === ord.orderId && (
                          <p className="mt-2 text-rose-700" role="alert">{paymentRetryError.message}</p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handlePaymentRetry(ord.orderId)}
                      disabled={startingPaymentOrderId !== null}
                      className="inline-flex items-center justify-center gap-2 self-start sm:self-auto bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-stone-950 font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      {startingPaymentOrderId === ord.orderId
                        ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        : <CreditCard className="w-3.5 h-3.5" />}
                      <span>{startingPaymentOrderId === ord.orderId ? 'Opening secure checkout...' : 'Pay / Retry Payment'}</span>
                    </button>
                  </div>
                )}

              {/* Courier tracking strip if dispatched */}
              {ord.courier && (
                <div className="bg-sky-50 border border-sky-200 rounded-2xl p-3.5 text-xs text-sky-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-sky-700 shrink-0" />
                    <div>
                      <span>Dispatched via <strong>{ord.courier.courierName}</strong></span>
                      <span className="mx-2">•</span>
                      <span>Consignment: <strong className="font-mono">{ord.courier.trackingNumber}</strong></span>
                    </div>
                  </div>
                </div>
              )}

              {/* Vendor correction message banner if documents needed */}
              {ord.status === 'Documents needed' && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-950 space-y-3">
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold text-rose-900 block">Vendor Correction Notice:</strong>
                      <p className="mt-0.5 leading-relaxed text-rose-800">
                        {ord.correctionMessage || 'Please review the requested corrections to your agreement details.'}
                      </p>
                    </div>
                  </div>

                  {activeCorrectionOrderId === ord.orderId ? (
                    <div className="bg-white p-4 rounded-xl border border-rose-200 space-y-3">
                      <p className="text-[11px] text-stone-600">
                        Provide your clarification note to the vendor desk:
                      </p>
                      <textarea
                        rows={2}
                        value={correctionNote}
                        onChange={(e) => setCorrectionNote(e.target.value)}
                        placeholder="Explain any document clarification or changes..."
                        className="w-full p-2.5 rounded-lg border border-stone-300 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveCorrectionOrderId(null)}
                          className="px-3 py-1.5 rounded-lg border border-stone-300 text-stone-600 text-xs font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={submittingCorrection}
                          onClick={() => handleCorrectionSubmit(ord.orderId)}
                          className="bg-stone-900 hover:bg-stone-800 text-white px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                        >
                          {submittingCorrection ? 'Submitting...' : 'Submit Clarification'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveCorrectionOrderId(ord.orderId)}
                      className="bg-rose-700 hover:bg-rose-800 text-white font-semibold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      Respond to Correction Request
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
