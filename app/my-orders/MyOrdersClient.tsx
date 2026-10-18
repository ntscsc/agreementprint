'use client';

import { OrderReference } from '@/components/order/OrderReference';
import { readApiResponse } from '@/lib/api-response';
import { Celebration, paidOrderCelebrationKey } from '@/components/Celebration';

import { requestReviewedCheckout } from '@/lib/checkout-client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  FileText, 
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
import { RentalAgreementDocument } from '@/components/agreement/RentalAgreementDocument';
import { DownloadBillButton } from '@/components/order/DownloadBillButton';
import { OrderCorrectionHistory } from '@/components/order/OrderCorrectionHistory';
import { ModifyReplaceOrder } from '@/components/order/ModifyReplaceOrder';

export function MyOrdersClient() {
  const { user } = useAuth();
  return <MyOrdersBody key={user?.uid ?? 'guest'} />;
}

function MyOrdersBody() {
  const { user, loading: authLoading, signInWithGoogle, authError } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [localSignInError, setLocalSignInError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderFilter, setOrderFilter] = useState('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [celebratedOrderId, setCelebratedOrderId] = useState<string | null>(null);
  const [startingPaymentOrderId, setStartingPaymentOrderId] = useState<string | null>(null);
  const [paymentRetryError, setPaymentRetryError] = useState<{ orderId: string; message: string } | null>(null);

  const [correctionSuccess, setCorrectionSuccess] = useState<string | null>(null);

  // Agreement Document View State
  const [selectedAgreementOrder, setSelectedAgreementOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [correctionMode, setCorrectionMode] = useState(false);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;

    let isMounted = true;
    async function fetchUserOrders() {
      try {
        setOrdersLoading(true);
        const params = new URLSearchParams(window.location.search);
        if (params.get('replacement') && params.get('orderId')) {
          try {
            const response = await fetch('/api/orders/replace', { method: 'POST', headers: { Authorization: `Bearer ${await user!.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'status', orderId: params.get('orderId'), requestId: params.get('replacement') }) });
            const result = await readApiResponse(response);
            if (isMounted) setCorrectionSuccess(result.completed ? 'Your replacement payment is confirmed. The new order is under verification.' : result.failed ? result.message : 'Your replacement payment is awaiting confirmation. Check its status below.');
          } catch (reason) { if (isMounted) setCorrectionSuccess(reason instanceof Error ? reason.message : 'Please check replacement payment status below.'); }
          window.history.replaceState({}, '', '/my-orders');
        }
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

  const handlePaymentRetry = async (orderId: string) => {
    if (!user) return;
    setStartingPaymentOrderId(orderId);
    setPaymentRetryError(null);

    try {
      const idToken = await user.getIdToken();
      const response = await requestReviewedCheckout({ orderId }, idToken);
      const result = await readApiResponse(response);
      if (response.ok && result.paid) {
        setCelebratedOrderId(orderId);
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

  const needsPayment = (order: Order) => ['Pending', 'Failed'].includes(order.payment.status) && order.status !== 'Cancelled';
  const isCompleted = (order: Order) => ['Delivered', 'Cancelled'].includes(order.status);
  const matchesFilter = (order: Order, filter: string) => filter === 'all' || (filter === 'payment' ? needsPayment(order) : filter === 'completed' ? isCompleted(order) : !isCompleted(order) && !needsPayment(order));
  const visibleOrders = orders.filter(order => matchesFilter(order, orderFilter) && [order.orderId, order.ownerDetails.fullName, order.tenantDetails.fullName, order.propertyDetails.fullAddress, order.propertyDetails.city].some(value => value.toLowerCase().includes(orderSearch.trim().toLowerCase())));
  const actionClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600';

  const handleOrderCancellation = async (order: Order) => {
    if (!user || startingPaymentOrderId || !window.confirm('Cancel this order and request a refund to the original payment method? Refunds require admin approval and cannot be processed in test mode. Place a new order separately for a cheaper package.')) return;
    setStartingPaymentOrderId(order.orderId); setPaymentRetryError(null);
    try {
      const result = await readApiResponse(await fetch('/api/orders/cancel', { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: order.orderId, updatedAt: order.updatedAt }) }));
      setOrders(previous => previous.map(item => item.orderId === order.orderId ? result.order as Order : item));
      setCorrectionSuccess('Order cancelled. Its refund is recorded for admin approval and returns to the original payment method in production. You can place a new order separately.');
    } catch (reason) { setPaymentRetryError({ orderId: order.orderId, message: reason instanceof Error ? reason.message : 'Unable to cancel this order.' }); }
    finally { setStartingPaymentOrderId(null); }
  };

  const handleReplacementResume = async (order: Order, action: 'resume' | 'status') => {
    if (!user) return;
    setStartingPaymentOrderId(order.orderId); setPaymentRetryError(null);
    try {
      const response = await fetch('/api/orders/replace', { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action, orderId: order.orderId, requestId: order.replacementPendingId }) });
      const result = await readApiResponse(response);
      if (result.redirectUrl) { window.location.assign(result.redirectUrl); return; }
      if (result.completed) { setOrders(previous => [result.order as Order, ...previous.filter(item => item.orderId !== result.order.orderId).map(item => item.orderId === order.orderId ? result.original as Order : item)]); setCorrectionSuccess('Replacement completed. The original order and payment history remain linked.'); }
      else if (result.failed) { window.alert(result.message); window.location.assign('/my-orders'); }
      else setPaymentRetryError({ orderId: order.orderId, message: 'Payment is awaiting confirmation. Please check again shortly.' });
    } catch (reason) { setPaymentRetryError({ orderId: order.orderId, message: reason instanceof Error ? reason.message : 'Unable to check replacement payment.' }); }
    finally { setStartingPaymentOrderId(null); }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'Submitted':
        return <span className="bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full text-sm font-semibold">Submitted</span>;
      case 'Under verification':
        return <span className="bg-sky-100 text-sky-800 px-2.5 py-0.5 rounded-full text-sm font-semibold">Under Verification</span>;
      case 'Documents needed':
        return <span className="bg-rose-100 text-rose-800 px-2.5 py-0.5 rounded-full text-sm font-semibold flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Correction Needed</span>;
      case 'Drafting':
        return <span className="bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-full text-sm font-semibold">Drafting on Stamp Paper</span>;
      case 'Dispatched':
        return <span className="bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full text-sm font-semibold flex items-center gap-1"><Truck className="w-3 h-3" /> Dispatched</span>;
      case 'Delivered':
        return <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-sm font-semibold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Delivered</span>;
      case 'Cancelled':
        return <span className="bg-stone-200 text-stone-700 px-2.5 py-0.5 rounded-full text-sm font-semibold">Cancelled</span>;
      default:
        return <span className="bg-stone-100 text-stone-700 px-2.5 py-0.5 rounded-full text-sm font-semibold">{status}</span>;
    }
  };

  if (authLoading) {
    return (
      <div className="max-w-4xl mx-auto py-20 px-4 text-center space-y-4">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-sm text-stone-600 font-medium">Checking authentication...</p>
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
            <p className="text-sm text-stone-600">
              Sign in with your Google account to view your past rental agreements, tracking numbers, and correction requests.
            </p>
          </div>
          { (authError || localSignInError) && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm p-3 rounded-xl text-left">
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
            className="w-full bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl text-sm uppercase tracking-wider transition-colors cursor-pointer"
          >
            {signingIn ? 'Opening Google Sign-In...' : 'Sign In with Google'}
          </button>
        </div>
      </div>
    );
  }

  if (editingOrder) return <div className="mx-auto max-w-4xl px-4 py-8"><ModifyReplaceOrder correctionMode={correctionMode} key={`${editingOrder.orderId}-${correctionMode}`} order={editingOrder} onCancel={() => window.location.assign('/my-orders')} onSaved={(updated, original) => {
    setOrders(previous => [updated, ...previous.filter(order => order.orderId !== updated.orderId).map(order => original && order.orderId === original.orderId ? original : order)]);
    setEditingOrder(null);
    setCorrectionSuccess(correctionMode ? 'Customer corrections submitted. The same order is Under Verification; your payment is unchanged.' : 'Replacement submitted for verification. Your original order and payment history are preserved.');
  }} /></div>;

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
          title={`${selectedAgreementOrder.agreementTerms.agreementType === 'Lease' ? 'Lease' : 'Rental'} Agreement Draft (Order #${selectedAgreementOrder.orderId})`}
          customerPreview
        />
        <div className="flex justify-center no-print">
          <button
            type="button"
            onClick={() => setSelectedAgreementOrder(null)}
            className="px-6 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-sm font-bold transition flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to My Orders List</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6">
      <Celebration eventKey={user && celebratedOrderId ? paidOrderCelebrationKey(user.uid, celebratedOrderId) : null} message="Payment confirmed! Your order is ready for our team." />
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-sm font-bold uppercase tracking-widest text-brand-700">Your account</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">My Orders</h1><p className="mt-2 text-sm text-stone-600">Track your agreements, manage details and find your payment records.</p><p className="mt-1 break-all text-sm text-stone-600">{user.email}</p></div>
        <Link href="/order" className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-800"><FileText className="h-4 w-4" />New Agreement</Link>
      </header>
      {!ordersLoading && !error && orders.length > 0 && <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter orders">{[{ id: 'all', label: 'All orders' }, { id: 'active', label: 'In progress' }, { id: 'payment', label: 'Payment needed' }, { id: 'completed', label: 'Closed' }].map(filter => <button key={filter.id} type="button" aria-pressed={orderFilter === filter.id} onClick={() => setOrderFilter(filter.id)} className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${orderFilter === filter.id ? 'bg-brand-800 text-white ring-2 ring-brand-800 ring-offset-2 shadow-sm' : 'border border-stone-300 bg-white text-stone-700 hover:bg-stone-100'}`}>{filter.label}<span className={`rounded-md px-1.5 py-0.5 text-sm ${orderFilter === filter.id ? 'bg-white/15' : 'bg-white'}`}>{orders.filter(order => matchesFilter(order, filter.id)).length}</span></button>)}</div>
          <label className="block lg:w-72"><span className="sr-only">Search orders</span><input type="search" value={orderSearch} onChange={event => setOrderSearch(event.target.value)} placeholder="Search reference, name or address" className="min-h-11 w-full rounded-xl border border-stone-300 bg-stone-50 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600" /></label>
        </div>
        <p aria-live="polite" className="text-sm text-stone-600">{visibleOrders.length} of {orders.length} orders shown · Most recent first</p>
      </div>}

      <Link href="/reviews" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 underline">Share feedback or write a review</Link>
      {correctionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-sm text-emerald-900 flex items-center justify-between gap-3">
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
          <p className="text-sm text-stone-600">Loading your applications...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-3 text-sm text-rose-800">
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
            <p className="text-sm text-stone-600 max-w-sm mx-auto">
              You haven&apos;t placed any rental agreement orders with this account yet.
            </p>
          </div>
          <Link
            href="/order"
            className="inline-flex items-center gap-1.5 bg-stone-900 hover:bg-stone-800 text-white font-semibold px-5 py-2.5 rounded-xl text-sm uppercase tracking-wider transition-colors cursor-pointer"
          >
            <span>Start Your First Agreement</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {!visibleOrders.length && <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center"><p className="font-semibold text-stone-800">No matching orders</p><p className="mt-1 text-sm text-stone-600">Try a different search or filter.</p><button type="button" onClick={() => { setOrderSearch(''); setOrderFilter('all'); }} className="mt-4 text-sm font-semibold text-brand-700 underline">Show all orders</button></div>}
          {visibleOrders.map((ord) => (
            <details
              open={!isCompleted(ord)}
              key={ord.orderId}
              className="group/order overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
            >
              <summary className="flex cursor-pointer list-none flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0"><p className="text-sm font-semibold uppercase tracking-wide text-stone-600">{ord.agreementTerms.agreementType === 'Lease' ? 'Lease agreement' : 'Rental agreement'}</p><h2 className="mt-1 break-all font-mono text-base font-bold text-stone-900"><OrderReference reference={ord.orderId} /></h2><p className="mt-1 text-sm text-stone-600">Placed {new Date(ord.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p></div>
                <div className="flex flex-wrap items-center gap-2">{ord.replacedByOrderId ? <span className="rounded-full bg-stone-100 px-3 py-1 text-sm font-semibold text-stone-600">Replaced</span> : getStatusBadge(ord.status)}<span className={`rounded-full px-3 py-1 text-sm font-semibold ${ord.payment.status === 'Paid' ? 'bg-emerald-50 text-emerald-800' : ord.payment.status === 'Failed' ? 'bg-rose-50 text-rose-800' : 'bg-stone-100 text-stone-600'}`}>Payment: {ord.payment.status}</span>{ord.cancellationRefundId && <span className="rounded-full bg-stone-100 px-3 py-1 text-sm font-semibold text-stone-600">Refund: {ord.cancellationRefundStatus}</span>}<ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-stone-400 transition-transform group-open/order:rotate-90" /></div>
              </summary>
              <div className="space-y-5 border-t border-stone-100 p-5 sm:p-6">

              {(ord.replacesOrderId || ord.replacedByOrderId || ord.replacementAdjustment) && <details className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3"><summary className="cursor-pointer text-sm font-semibold text-stone-600">Replacement &amp; payment history</summary><div className="mt-3 space-y-2 break-words text-sm text-stone-600">              {(ord.replacesOrderId || ord.replacedByOrderId) && <div className="rounded-xl bg-stone-50 p-3 text-sm text-stone-600">{ord.replacedByOrderId ? 'Replaced by ' : 'Replacement for '}<OrderReference reference={ord.replacedByOrderId || ord.replacesOrderId!} /><p className="mt-2">{ord.replacedByOrderId ? 'This original record is retained for payment history.' : 'Earlier payments were carried forward.'}</p></div>}
              {ord.replacementAdjustment && <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"><p>Additional payment collected: ₹{ord.replacementAdjustment.additionalPayment.toLocaleString('en-IN')}</p>{ord.replacementAdjustment.creditReturned > 0 && <p>Account credit returned: ₹{ord.replacementAdjustment.creditReturned.toLocaleString('en-IN')}</p>}{ord.replacementAdjustment.refundAmount > 0 && <p>Refund: ₹{ord.replacementAdjustment.refundAmount.toLocaleString('en-IN')} ({ord.replacementAdjustment.refundStatus === 'Refunded' ? 'processed' : 'awaiting admin processing'})</p>}</div>}
</div></details>}
              {ord.modificationReviewOutcome && <p className="rounded-xl bg-sky-50 p-3 text-sm text-sky-800">Admin review: {ord.modificationReviewOutcome}</p>}
              {ord.cancellationRefundId && <div className="space-y-2 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm"><p className="font-semibold">Cancellation refund: ₹{(ord.cancellationRefundAmount || 0).toLocaleString('en-IN')} · {ord.cancellationRefundStatus}</p><p>Refund to original payment method, subject to admin approval and the refund policy. Refunds are unavailable in test mode.</p>{(ord.cancellationRewardCreditsReturned || 0) > 0 && <p>Original referral rewards returned for orders: ₹{ord.cancellationRewardCreditsReturned}</p>}{ord.cancellationRefundNote && <p>{ord.cancellationRefundNote}</p>}<Link href="/order" className="inline-block font-semibold text-brand-700 underline">Place a New Order</Link></div>}
              {ord.modificationReviewId && <p className="rounded-xl bg-sky-50 p-3 text-sm text-sky-800">Your change request has been sent for admin review.</p>}
              {ord.replacementPendingId && <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"><p className="font-semibold">Replacement payment pending</p><p>Preparation is on hold while the additional payment is confirmed. Your original payment remains recorded.</p><div className="flex flex-wrap gap-2"><button type="button" disabled={startingPaymentOrderId !== null} onClick={() => void handleReplacementResume(ord, 'resume')} className={actionClass}>Resume Replacement Payment</button><button type="button" disabled={startingPaymentOrderId !== null} onClick={() => void handleReplacementResume(ord, 'status')} className={actionClass}>Check Payment Status</button></div>{paymentRetryError?.orderId === ord.orderId && <p role="alert" className="text-rose-700">{paymentRetryError.message}</p>}</div>}
              <p className="text-sm font-semibold text-stone-700">Printed copies: {1 + (ord.agreementTerms.extraCopies ?? 0)} total ({ord.agreementTerms.extraCopies ?? 0} extra), on ₹{ord.agreementTerms.stampPaperDenomination ?? 100} stamp paper.</p>
              {/* Order Info Grid */}
              <div className="grid grid-cols-1 gap-5 text-sm text-stone-600 sm:grid-cols-3">
                <div>
                  <span className="mb-1.5 block text-sm font-semibold text-stone-600">Owner & tenant</span>
                  <strong className="text-stone-900">{ord.ownerDetails.fullName}</strong>
                  <p className="text-stone-600">Tenant: {ord.tenantDetails.fullName}</p>
                </div>

                <div>
                  <span className="mb-1.5 block text-sm font-semibold text-stone-600">Premises</span>
                  <p className="break-words text-stone-800">{ord.propertyDetails.fullAddress}</p>
                  <p className="text-stone-600">{ord.propertyDetails.city} ({ord.propertyDetails.propertyType})</p>
                </div>

                <div>
                  <span className="mb-1.5 block text-sm font-semibold text-stone-600">Agreement terms</span>
                  <strong className="text-stone-900">{ord.agreementTerms.agreementType === 'Lease' ? 'Lease — no separate monthly rent' : `₹${ord.agreementTerms.monthlyRent?.toLocaleString('en-IN')} / mo`}</strong>
                  <p className="text-stone-600">{ord.agreementTerms.agreementType === 'Lease' ? 'Refundable advance' : 'Deposit'}: ₹{ord.agreementTerms.securityDeposit?.toLocaleString('en-IN')}</p>
                </div>
              </div>

              {(ord.payment.amount !== undefined || ord.payment.totalBeforeCredits !== undefined || ord.payment.subtotal !== undefined) && <details className="group rounded-xl border border-stone-200 bg-stone-50">
                <summary className="flex min-h-12 cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-stone-700"><span className="inline-flex items-center gap-2"><ChevronRight aria-hidden="true" className="h-4 w-4 transition-transform group-open:rotate-90" />Payment breakdown</span><span>{ord.payment.status === 'Paid' ? 'Paid' : 'Payment amount'}: ₹{(ord.payment.amount ?? ord.payment.totalBeforeCredits ?? 0).toLocaleString('en-IN')}</span></summary>
                <dl className="grid gap-3 border-t border-stone-200 px-4 py-4 text-sm sm:grid-cols-3"><div><dt className="text-sm text-stone-600">Package total</dt><dd className="mt-1 font-semibold text-stone-800">₹{(ord.payment.subtotal ?? ord.payment.totalBeforeCredits ?? ord.payment.amount ?? 0).toLocaleString('en-IN')}</dd></div><div><dt className="text-sm text-stone-600">Coupon discount{ord.payment.couponCode ? ` (${ord.payment.couponCode})` : ''}</dt><dd className="mt-1 font-semibold text-stone-800">₹{(ord.payment.couponDiscount ?? 0).toLocaleString('en-IN')}</dd></div><div><dt className="text-sm text-stone-600">Referral credit</dt><dd className="mt-1 font-semibold text-stone-800">₹{(ord.payment.referralCreditApplied ?? 0).toLocaleString('en-IN')}</dd></div></dl>
              </details>}

              {(ord.payment?.status === 'Pending' || ord.payment?.status === 'Failed') &&
                ord.status !== 'Cancelled' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                      className="inline-flex items-center justify-center gap-2 self-start sm:self-auto bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-stone-950 font-bold px-4 py-2 rounded-xl text-sm transition-colors cursor-pointer"
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
                <div className="bg-sky-50 border border-sky-200 rounded-2xl p-3.5 text-sm text-sky-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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

              {ord.correctionStatus === 'Submitted' && ord.status === 'Under verification' && <p className="rounded-xl bg-sky-50 p-3 text-sm font-semibold text-sky-800">Customer corrections submitted. Your order is Under Verification.</p>}
              {(ord.correctionRequestId || ord.correctionMessage) && <OrderCorrectionHistory orderId={ord.orderId} updatedAt={ord.updatedAt} />}
              {/* Vendor correction message banner if documents needed */}
              {ord.status === 'Documents needed' && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-sm text-rose-950 space-y-3">
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold text-rose-900 block">Vendor Correction Notice:</strong>
                      <p className="mt-0.5 leading-relaxed text-rose-800">
                        {ord.correctionMessage || 'Please review the requested corrections to your agreement details.'}
                      </p>
                    </div>
                  </div>

                  {ord.payment.status === 'Paid' && !ord.preparationStartedAt && !ord.courier && !ord.replacementPendingId && !ord.replacedByOrderId && !ord.cancellationRefundId && !ord.modificationReviewId ? <button type="button" onClick={() => { setCorrectionMode(true); setEditingOrder(ord); }} className="min-h-11 rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white">Correct &amp; Resubmit</button> : <p className="text-sm text-rose-800">Online corrections are locked for this order. Contact the admin team for assistance.</p>}

                </div>
              )}
              <footer className="space-y-3 border-t border-stone-100 pt-5">
                {paymentRetryError?.orderId === ord.orderId && !ord.replacementPendingId && ord.payment.status === 'Paid' && <p role="alert" className="text-sm text-rose-700">{paymentRetryError.message}</p>}


                <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setSelectedAgreementOrder(ord)} className={actionClass}><Eye className="h-4 w-4" />View agreement</button><Link href={`/track?orderId=${encodeURIComponent(ord.orderId)}&phone=${encodeURIComponent(ord.ownerDetails.phone)}`} className={actionClass}><Truck className="h-4 w-4" />Track order</Link>{ord.payment.status === 'Paid' && <DownloadBillButton orderId={ord.orderId} />}</div>
                  {ord.payment.status === 'Paid' && !ord.replacedByOrderId && ord.status !== 'Cancelled' && !ord.replacementPendingId && !ord.modificationReviewId && (['Submitted', 'Under verification', 'Documents needed', 'Drafting', 'Dispatched', 'Delivered'].includes(ord.status) || ord.preparationStartedAt) && <div className="sm:max-w-64 sm:text-right"><button type="button" onClick={() => { setCorrectionMode(false); setEditingOrder(ord); }} className="min-h-11 w-full rounded-xl bg-brand-700 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">Modify / Replace Order</button><p className="mt-2 text-sm leading-relaxed text-stone-600">{ord.preparationStartedAt || ['Drafting', 'Dispatched', 'Delivered'].includes(ord.status) ? 'Changes require admin review after preparation begins.' : 'Change details or package before preparation begins.'}</p></div>}

                </div>
                {ord.payment.status === 'Paid' && ['Submitted', 'Under verification', 'Documents needed'].includes(ord.status) && !ord.preparationStartedAt && !ord.courier && !ord.replacedByOrderId && !ord.replacementPendingId && !ord.modificationReviewId && <details className="rounded-xl border border-stone-200 px-4 py-3"><summary className="cursor-pointer text-sm font-medium text-stone-600">Cancellation options</summary><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-stone-600">Need a cheaper package? Cancel before preparation begins, then place a new order.</p><button type="button" disabled={startingPaymentOrderId !== null} onClick={() => void handleOrderCancellation(ord)} className="min-h-11 rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50">Cancel &amp; Request Refund</button></div></details>}
              </footer>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
