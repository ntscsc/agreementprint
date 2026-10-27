'use client';

import { CourierTrackingButton } from '@/components/order/CourierTrackingButton';
import { openPaymentCheckout } from '@/lib/open-payment-checkout';
import { WorkflowProgress } from '@/components/ui/WorkflowProgress';
import { ListFilters, DateFilterFields, useListDates } from '@/components/ui/ListFilters';
import { OrderReference } from '@/components/order/OrderReference';
import { useCourierTrackingLinks } from '@/components/order/useCourierTrackingLinks';
import { courierTrackingUrl } from '@/lib/courier-tracking';
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
  ClipboardCheck,
  PenLine,
  Stamp,
  PackageCheck,
  ChevronRight,
  LogIn,
  ShieldAlert,
  Eye,
  ArrowLeft,
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

function paymentSummary(order: Order) {
  const payment = order.payment;
  if (payment.status === 'Paid' && payment.amount === 0) {
    if ((payment.carriedCash || 0) > 0) return 'Earlier payment applied';
    if (payment.gateway === 'ReferralCredit' || (payment.referralCreditApplied || 0) > 0 || (payment.carriedCredit || 0) > 0) return 'Paid using credits';
    if (payment.gateway === 'Coupon' || (payment.couponDiscount || 0) > 0) return 'Covered by discount';
    return 'No payment due';
  }
  const amount = payment.amount ?? payment.totalBeforeCredits;
  const value = amount === undefined ? '' : `\u20b9${amount.toLocaleString('en-IN', { minimumFractionDigits: amount % 1 ? 2 : 0, maximumFractionDigits: 2 })} `;
  return `${value}${payment.status === 'Paid' ? 'Paid' : payment.retryAvailable || payment.status === 'Failed' ? 'Not paid' : payment.status === 'Pending' ? 'Payment pending' : payment.status}`;
}

function orderUpdate(order: Order): { message: string; actionNeeded?: boolean } {
  if (order.replacedByOrderId) return { message: 'This order was replaced. See your new order for updates.' };
  if (order.status === 'Cancelled') return { message: order.cancellationRefundId ? 'This order is cancelled. Refund updates are shown below.' : 'This order is cancelled.' };
  if (order.replacementPendingId) return { message: 'Check your replacement payment below.', actionNeeded: true };
  if (order.modificationReviewId) return { message: 'Our team is reviewing your change request.' };
  if (['Pending', 'Failed'].includes(order.payment.status)) return { message: order.payment.retryAvailable || order.payment.status === 'Failed' ? 'Your order is saved. Retry payment when you are ready.' : 'Check your payment to confirm whether it was completed.', actionNeeded: true };
  if (order.status === 'Documents needed') return { message: 'Review the requested corrections below.', actionNeeded: true };
  if (order.status === 'Drafting') return { message: 'We are preparing your agreement on stamp paper.' };
  if (order.status === 'Dispatched') return { message: 'Your agreement is on its way. Courier details are below.' };
  if (order.status === 'Delivered') return { message: 'Your agreement has been delivered.' };
  return { message: order.status === 'Submitted' ? 'Your order is received and waiting for review.' : 'We are reviewing your agreement details.' };
}

function OrderProgress({ status }: { status: OrderStatus }) {
  if (status === 'Cancelled') return null;
  const steps = [
    { label: 'Submitted', icon: FileText },
    { label: 'Review', icon: ClipboardCheck },
    { label: 'Preparing', icon: Stamp },
    { label: 'Dispatched', icon: Truck },
    { label: 'Delivered', icon: PackageCheck },
  ];
  const current = status === 'Delivered' ? 4 : status === 'Dispatched' ? 3 : status === 'Drafting' ? 2 : ['Under verification', 'Documents needed'].includes(status) ? 1 : 0;
  return <WorkflowProgress steps={steps} current={current} complete={status === 'Delivered'} attention={status === 'Documents needed'} label="Order progress" />;
}

export function MyOrdersClient() {
  const { user } = useAuth();
  return <MyOrdersBody key={user?.uid ?? 'guest'} />;
}

function MyOrdersBody() {
  const courierLinks = useCourierTrackingLinks();
  const { user, loading: authLoading, signIn, authError } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [localSignInError, setLocalSignInError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderFilter, setOrderFilter] = useState('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [celebratedOrderId, setCelebratedOrderId] = useState<string | null>(null);
  const [startingPaymentOrderId, setStartingPaymentOrderId] = useState<string | null>(null);
  const dates = useListDates();
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
        setError(null);
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
  }, [user, refreshRevision]);

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

      await openPaymentCheckout(result.redirectUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to start online payment.';
      setPaymentRetryError({ orderId, message });
      setStartingPaymentOrderId(null);
    }
  };

  const needsPayment = (order: Order) => ['Pending', 'Failed'].includes(order.payment.status) && order.status !== 'Cancelled';
  const isCompleted = (order: Order) => ['Delivered', 'Cancelled'].includes(order.status);
  const matchesFilter = (order: Order, filter: string) => filter === 'all' || (filter === 'payment' ? needsPayment(order) : filter === 'completed' ? isCompleted(order) : !isCompleted(order) && !needsPayment(order));
  const visibleOrders = orders.filter(order => dates.matches(order.createdAt) && matchesFilter(order, orderFilter) && [order.orderId, order.publicReference ?? '', order.ownerDetails.fullName, order.tenantDetails.fullName, order.propertyDetails.fullAddress, order.propertyDetails.city].some(value => value.toLowerCase().includes(orderSearch.trim().toLowerCase())));
  const actionClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600';

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

  const handleReplacementResume = async (order: Order, action: 'resume' | 'status' | 'abandon') => {
    if (!user) return;
    if (action === 'abandon' && !window.confirm('Abandon this replacement and keep your original paid order? Any late replacement payment will require refund review.')) return;
    setStartingPaymentOrderId(order.orderId); setPaymentRetryError(null);
    try {
      const response = await fetch('/api/orders/replace', { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action, orderId: order.orderId, requestId: order.replacementPendingId }) });
      const result = await readApiResponse(response);
      if (result.redirectUrl) { await openPaymentCheckout(result.redirectUrl); return; }
      if (result.abandoned) { setOrders(previous => previous.map(item => item.orderId === order.orderId ? result.order as Order : item)); setCorrectionSuccess('Replacement abandoned. You can continue with the original paid order or cancel it to request a refund.'); return; }
      if (result.completed) { setOrders(previous => [result.order as Order, ...previous.filter(item => item.orderId !== result.order.orderId).map(item => item.orderId === order.orderId ? result.original as Order : item)]); setCorrectionSuccess('Replacement completed. The original order and payment history remain linked.'); }
      else if (result.failed) { window.alert(result.message); window.location.assign('/my-orders'); }
      else setPaymentRetryError({ orderId: order.orderId, message: 'Payment is awaiting confirmation. Please check again shortly.' });
    } catch (reason) { setPaymentRetryError({ orderId: order.orderId, message: reason instanceof Error ? reason.message : 'Unable to check replacement payment.' }); }
    finally { setStartingPaymentOrderId(null); }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'Submitted':
        return <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full text-xs font-semibold">Submitted</span>;
      case 'Under verification':
        return <span className="bg-sky-100 text-sky-800 px-2.5 py-1 rounded-full text-xs font-semibold">Under Verification</span>;
      case 'Documents needed':
        return <span className="bg-rose-100 text-rose-800 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Correction Needed</span>;
      case 'Drafting':
        return <span className="bg-purple-100 text-purple-800 px-2.5 py-1 rounded-full text-xs font-semibold">Preparing</span>;
      case 'Dispatched':
        return <span className="bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1"><Truck className="w-3 h-3" /> Dispatched</span>;
      case 'Delivered':
        return <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Delivered</span>;
      case 'Cancelled':
        return <span className="bg-red-50 text-red-800 px-2.5 py-1 rounded-full text-xs font-semibold">Cancelled</span>;
      default:
        return <span className="bg-stone-100 text-stone-700 px-2.5 py-1 rounded-full text-xs font-semibold">{status}</span>;
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
              Sign in with email and password or Google to view your past rental agreements, tracking numbers, and correction requests.
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
                await signIn();
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
            {signingIn ? 'Opening sign-in...' : 'Sign In'}
          </button>
        </div>
      </div>
    );
  }

  if (editingOrder) return <div className="mx-auto max-w-4xl px-4 py-8"><ModifyReplaceOrder correctionMode={correctionMode} key={`${editingOrder.orderId}-${correctionMode}`} order={editingOrder} onCancel={() => window.location.assign('/my-orders')} onSaved={(updated, original) => {
    setOrders(previous => [updated, ...previous.filter(order => order.orderId !== updated.orderId).map(order => original && order.orderId === original.orderId ? original : order)]);
    setEditingOrder(null);
    setCorrectionSuccess(correctionMode || !original ? 'Customer corrections submitted. The same order is Under Verification; your payment is unchanged.' : 'Replacement submitted for verification. Your original order and payment history are preserved.');
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
          title={`${selectedAgreementOrder.agreementTerms.agreementType === 'Lease' ? 'Lease' : 'Rental'} agreement preview${selectedAgreementOrder.publicReference ? ` ? ${selectedAgreementOrder.publicReference}` : ''}`}
          customerPreview
        />
        <div className="flex justify-center no-print">
          <button
            type="button"
            onClick={() => setSelectedAgreementOrder(null)}
            className="px-6 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-sm font-bold transition flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to orders</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4">
      <Celebration eventKey={user && celebratedOrderId ? paidOrderCelebrationKey(user.uid, celebratedOrderId) : null} message="Payment confirmed! Your order is ready for our team." />
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight text-stone-900">My Orders</h1><p className="mt-1 text-sm text-stone-500">Your agreements, payments and delivery updates.</p></div>
        <div className="flex items-center gap-2"><button type="button" onClick={() => setRefreshRevision(value => value + 1)} disabled={ordersLoading} aria-label="Refresh orders" title="Refresh orders" className={`${actionClass} disabled:opacity-50`}><RefreshCw aria-hidden="true" className={`h-4 w-4 ${ordersLoading ? 'animate-spin' : ''}`} /></button><Link href="/order" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white transition hover:bg-brand-800"><FileText className="h-4 w-4" />New agreement</Link></div>
      </header>
      {!ordersLoading && !error && orders.length > 0 && <div className="space-y-2">
        <div className="flex items-center gap-2"><label className="min-w-0 flex-1"><span className="sr-only">Search orders</span><input type="search" value={orderSearch} onChange={event => setOrderSearch(event.target.value)} placeholder="Search reference, name or address" className="min-h-11 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" /></label><ListFilters activeCount={dates.activeCount + Number(orderFilter !== 'all')} onClear={() => { dates.clear(); setOrderFilter('all'); }}><label className="block text-sm font-semibold">Order status<select value={orderFilter} onChange={event => setOrderFilter(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-stone-300 px-3">{[{ id: 'all', label: 'All orders' }, { id: 'active', label: 'In progress' }, { id: 'payment', label: 'Payment needed' }, { id: 'completed', label: 'Closed' }].map(filter => <option key={filter.id} value={filter.id}>{filter.label}</option>)}</select></label><DateFilterFields {...dates} /></ListFilters></div>
        <p aria-live="polite" className="text-sm text-stone-600">{visibleOrders.length} of {orders.length} orders shown · Most recent first</p>
      </div>}


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
          <p className="text-sm text-stone-600">Loading your orders...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-3 text-sm text-rose-800">
          <AlertCircle className="w-6 h-6 text-rose-600 mx-auto" />
          <p>{error}</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-6 text-center space-y-3 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
            <FileText className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-stone-800">No orders yet</h2>
            <p className="text-sm text-stone-600 max-w-sm mx-auto">
              You haven&apos;t placed any rental agreement orders with this account yet.
            </p>
          </div>
          <Link
            href="/order"
            className="inline-flex items-center gap-1.5 bg-brand-700 hover:bg-brand-800 text-white font-bold px-5 py-3 rounded-xl text-sm transition-colors cursor-pointer"
          >
            <span>Start Your First Agreement</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {!visibleOrders.length && <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center"><p className="font-semibold text-stone-800">No matching orders</p><p className="mt-1 text-sm text-stone-600">Try a different search or filter.</p><button type="button" onClick={() => { setOrderSearch(''); setOrderFilter('all'); dates.clear(); }} className="mt-4 text-sm font-semibold text-brand-700 underline">Show all orders</button></div>}
          {visibleOrders.map((ord) => (
            <article
              key={ord.orderId}
              className="group/order overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
            >
              <div className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-mono text-sm font-semibold text-stone-900"><OrderReference reference={ord.publicReference || ord.orderId} compact /></h2>{ord.replacedByOrderId ? <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-semibold text-stone-600">Replaced</span> : getStatusBadge(ord.status)}</div>
                <div><p className="break-words text-sm font-semibold text-stone-900">{ord.ownerDetails.fullName} <span className="font-normal text-stone-400">&amp;</span> {ord.tenantDetails.fullName}</p><dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4"><div><dt className="text-stone-500">Agreement Type</dt><dd className="mt-0.5 font-medium text-stone-800">{ord.agreementTerms.agreementType === 'Lease' ? 'Lease agreement' : 'Rental agreement'}</dd></div><div><dt className="text-stone-500">Language</dt><dd className="mt-0.5 font-medium text-stone-800">{ord.agreementTerms.language || 'Not specified'}</dd></div><div><dt className="text-stone-500">Property city</dt><dd className="mt-0.5 break-words font-medium text-stone-800">{ord.propertyDetails.city || 'Not provided'}</dd></div><div><dt className="text-stone-500">Ordered on</dt><dd className="mt-0.5 font-medium text-stone-800">{new Date(ord.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}</dd></div></dl></div>
                {!ord.replacedByOrderId && <OrderProgress status={ord.status} />}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">{orderUpdate(ord).actionNeeded && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900"><AlertCircle aria-hidden="true" className="h-3.5 w-3.5" />Action needed</span>}<p className="text-xs leading-5 text-stone-600">{orderUpdate(ord).message}</p></div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-3"><div className="text-sm"><span className={`font-semibold ${ord.payment.status === 'Paid' ? 'text-emerald-700' : 'text-stone-800'}`}>{paymentSummary(ord)}</span>{ord.cancellationRefundId && <p className="mt-1 text-xs text-stone-500">Refund: {ord.cancellationRefundStatus}</p>}</div><div className="flex flex-wrap items-center gap-2" role="group" aria-label="Order actions">{needsPayment(ord) && !ord.replacedByOrderId && <button type="button" disabled={startingPaymentOrderId !== null} onClick={() => void handlePaymentRetry(ord.orderId)} className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">{startingPaymentOrderId === ord.orderId ? 'Checking…' : ord.payment.retryAvailable || ord.payment.status === 'Failed' ? 'Retry payment' : 'Pay / check payment'}</button>}<button type="button" aria-label="Preview agreement" title="Preview agreement" onClick={() => setSelectedAgreementOrder(ord)} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-sky-200 px-3 text-xs font-semibold bg-sky-50 text-sky-700 transition hover:bg-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"><Eye aria-hidden="true" className="h-3.5 w-3.5" />Preview</button>{ord.payment.status === 'Paid' && !ord.replacedByOrderId && !['Cancelled', 'Drafting', 'Dispatched', 'Delivered'].includes(ord.status) && !ord.preparationStartedAt && !ord.courier && !ord.replacementPendingId && !ord.modificationReviewId && ['Submitted', 'Under verification', 'Documents needed'].includes(ord.status) && <button type="button" aria-label="Edit order" title="Edit order" onClick={() => { setCorrectionMode(false); setEditingOrder(ord); }} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-amber-200 px-3 text-xs font-semibold bg-amber-50 text-amber-800 transition hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"><PenLine aria-hidden="true" className="h-3.5 w-3.5" />Edit</button>}{ord.payment.status === 'Paid' && <DownloadBillButton orderId={ord.orderId} compact />}{ord.payment.status === 'Paid' && ['Submitted', 'Under verification', 'Documents needed'].includes(ord.status) && !ord.preparationStartedAt && !ord.courier && !ord.replacedByOrderId && !ord.replacementPendingId && !ord.modificationReviewId && <div className="ml-2 border-l border-stone-200 pl-3"><button type="button" disabled={startingPaymentOrderId !== null} onClick={() => void handleOrderCancellation(ord)} aria-label="Cancel order and request a refund" title="Cancel order and request a refund" className="inline-flex h-9 items-center justify-center rounded-lg border border-red-200 px-3 text-xs font-semibold bg-red-50 text-red-700 transition hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-50">Cancel order</button></div>}</div></div>
                {paymentRetryError?.orderId === ord.orderId && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{paymentRetryError.message}</p>}

              </div>
              <div className="space-y-3 px-4 pb-4">
              {ord.modificationReviewOutcome && <p className="rounded-xl bg-sky-50 p-3 text-sm text-sky-800">Admin review: {ord.modificationReviewOutcome}</p>}
              {ord.cancellationRefundId && <div className="space-y-2 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm"><p className="font-semibold">Cancellation refund: ₹{(ord.cancellationRefundAmount || 0).toLocaleString('en-IN')} · {ord.cancellationRefundStatus}</p><p>Refund to original payment method, subject to admin approval and the refund policy. Refunds are unavailable in test mode.</p>{(ord.cancellationRewardCreditsReturned || 0) > 0 && <p>Original referral rewards returned for orders: ₹{ord.cancellationRewardCreditsReturned}</p>}{ord.cancellationRefundNote && <p>{ord.cancellationRefundNote}</p>}<Link href="/order" className="inline-block font-semibold text-brand-700 underline">Place a New Order</Link></div>}
              {ord.modificationReviewId && <p className="rounded-xl bg-sky-50 p-3 text-sm text-sky-800">Your change request has been sent for admin review.</p>}
              {ord.replacementPendingId && <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"><p className="font-semibold">Replacement payment pending</p><p>Preparation is on hold while the additional payment is confirmed. Your original payment remains recorded.</p><div className="flex flex-wrap gap-2"><button type="button" disabled={startingPaymentOrderId !== null} onClick={() => void handleReplacementResume(ord, 'resume')} className={actionClass}>Resume Replacement Payment</button><button type="button" disabled={startingPaymentOrderId !== null} onClick={() => void handleReplacementResume(ord, 'status')} className={actionClass}>Check Payment Status</button><button type="button" disabled={startingPaymentOrderId !== null} onClick={() => void handleReplacementResume(ord, 'abandon')} className={actionClass}>Abandon Replacement / Keep Original Order</button></div>{paymentRetryError?.orderId === ord.orderId && <p role="alert" className="text-rose-700">{paymentRetryError.message}</p>}</div>}


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
                  {courierTrackingUrl(ord.courier.courierName, ord.courier.trackingNumber, courierLinks) && <CourierTrackingButton className="ml-auto" href={courierTrackingUrl(ord.courier.courierName, ord.courier.trackingNumber, courierLinks)!} courierName={ord.courier.courierName} trackingNumber={ord.courier.trackingNumber} />}
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
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="border-t border-stone-200 pt-4"><Link href="/reviews" className="text-sm text-stone-600 underline hover:text-brand-700">Share feedback</Link></div>
    </div>
  );
}
