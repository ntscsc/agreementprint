'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  Search, 
  Truck, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import { OrderStatus } from '@/lib/types';

interface TrackedOrder {
  orderId: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  propertyCity?: string;
  propertyType?: string;
  ownerName?: string;
  tenantName?: string;
  courier?: {
    courierName: string;
    trackingNumber: string;
    dispatchedAt: string;
  };
  correctionMessage?: string;
}

export function TrackClient() {
  const searchParams = useSearchParams();
  const [orderId, setOrderId] = useState(() => searchParams.get('orderId') || '');
  const [phone, setPhone] = useState(() => searchParams.get('phone') || '');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderData, setOrderData] = useState<TrackedOrder | null>(null);

  const handleLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!orderId.trim() || !phone.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/orders/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderId.trim(),
          phone: phone.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Order lookup failed.');
      }

      setOrderData(data.order);
    } catch (err: unknown) {
      setOrderData(null);
      setError(err instanceof Error ? err.message : 'Unable to find order details.');
    } finally {
      setLoading(false);
    }
  };

  // Auto trigger lookup if query params are present initially
  useEffect(() => {
    const qOrderId = searchParams.get('orderId');
    const qPhone = searchParams.get('phone');
    if (!qOrderId || !qPhone) return;

    const targetOrderId = qOrderId.trim();
    const targetPhone = qPhone.trim();

    let isMounted = true;
    async function autoFetch() {
      try {
        setLoading(true);
        const res = await fetch('/api/orders/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: targetOrderId,
            phone: targetPhone,
          }),
        });
        const data = await res.json();
        if (!isMounted) return;
        if (data.success) {
          setOrderData(data.order);
        } else {
          setError(data.error || 'Order lookup failed.');
        }
      } catch {
        if (isMounted) setError('Unable to find order details.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    autoFetch();
    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  const timelineSteps: { key: OrderStatus; label: string; desc: string }[] = [
    { key: 'Submitted', label: '1. Application Submitted', desc: 'Received at certified vendor desk.' },
    { key: 'Under verification', label: '2. Under Verification', desc: 'Vendor reviewing the submitted agreement details.' },
    { key: 'Drafting', label: '3. Stamping & Drafting', desc: 'Printed on non-judicial stamp paper.' },
    { key: 'Dispatched', label: '4. Dispatched via Courier', desc: 'Handed over for doorstep delivery.' },
    { key: 'Delivered', label: '5. Delivered', desc: 'Received and signed by customer.' },
  ];

  const getStepStatus = (stepKey: OrderStatus, currentStatus: OrderStatus) => {
    const orderProgression: OrderStatus[] = [
      'Submitted',
      'Under verification',
      'Drafting',
      'Dispatched',
      'Delivered',
    ];

    if (currentStatus === 'Cancelled') return 'cancelled';
    if (currentStatus === 'Documents needed' && stepKey === 'Under verification') return 'attention';

    const currentIndex = orderProgression.indexOf(currentStatus);
    const stepIndex = orderProgression.indexOf(stepKey);

    if (currentIndex > stepIndex) return 'completed';
    if (currentIndex === stepIndex) return 'current';
    return 'pending';
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Title Banner */}
      <div className="text-center max-w-xl mx-auto space-y-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-3 py-1 rounded-full">
          Consignment Tracking
        </span>
        <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
          Track Rental Agreement Order
        </h1>
        <p className="text-xs sm:text-sm text-stone-600">
          Enter your Order Reference ID and registered mobile number to check verification progress and postal delivery.
        </p>
      </div>

      {/* Lookup Card */}
      <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm max-w-2xl mx-auto">
        <form onSubmit={handleLookup} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="track-orderId" className="block text-xs font-semibold text-stone-700 mb-1">
                Order Reference ID *
              </label>
              <input
                id="track-orderId"
                type="text"
                required
                value={orderId}
                onChange={(e) => setOrderId(e.target.value.toUpperCase())}
                placeholder="e.g. TNR_123456_ABCD"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs font-mono text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase"
              />
            </div>

            <div>
              <label htmlFor="track-phone" className="block text-xs font-semibold text-stone-700 mb-1">
                Registered Mobile Number *
              </label>
              <input
                id="track-phone"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="10-digit mobile number"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-stone-900 hover:bg-stone-800 disabled:bg-stone-400 text-white font-semibold py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Checking Status...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Track Application Status</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Result Section */}
      {orderData && (
        <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 max-w-2xl mx-auto animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-4">
            <div>
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Order Reference</span>
              <h2 className="text-xl font-black font-mono text-stone-900">{orderData.orderId}</h2>
              <p className="text-xs text-stone-500">
                Registered for: {orderData.ownerName} & {orderData.tenantName} ({orderData.propertyCity})
              </p>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-semibold self-start sm:self-auto">
              <Clock className="w-3.5 h-3.5" />
              <span>Status: {orderData.status}</span>
            </div>
          </div>

          {/* Special Attention Notice if documents needed */}
          {orderData.status === 'Documents needed' && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-950 space-y-1">
              <div className="flex items-center gap-2 font-bold text-rose-900">
                <ShieldAlert className="w-4 h-4 text-rose-700" />
                <span>Document Clarification Required</span>
              </div>
              <p className="text-rose-800 leading-relaxed">
                {orderData.correctionMessage || 'Please sign in to your account to review the requested corrections.'}
              </p>
            </div>
          )}

          {/* Courier Details Card if Dispatched */}
          {orderData.courier && (
            <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl text-xs text-sky-950 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sky-900">
                <Truck className="w-4 h-4 text-sky-700" />
                <span>Consignment Dispatched</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sky-900">
                <div>
                  <span className="text-sky-700">Courier Partner:</span> <strong>{orderData.courier.courierName}</strong>
                </div>
                <div>
                  <span className="text-sky-700">Consignment Number:</span> <strong className="font-mono">{orderData.courier.trackingNumber}</strong>
                </div>
              </div>
              {orderData.courier.courierName.includes('India Post') && (
                <div className="pt-1">
                  <a
                    href="https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sky-800 font-bold hover:underline"
                  >
                    <span>Track on India Post Portal</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Timeline */}
          <div className="space-y-4 pt-2">
            <h3 className="font-bold text-stone-900 text-sm">Fulfillment Stages</h3>
            <ol className="relative border-l border-stone-200 ml-3 space-y-6">
              {timelineSteps.map((st) => {
                const stepState = getStepStatus(st.key, orderData.status);
                return (
                  <li key={st.key} className="ml-6">
                    <span
                      className={`absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full ring-4 ring-white ${
                        stepState === 'completed'
                          ? 'bg-emerald-600 text-white'
                          : stepState === 'current'
                          ? 'bg-amber-500 text-stone-950 ring-amber-100'
                          : stepState === 'attention'
                          ? 'bg-rose-600 text-white'
                          : 'bg-stone-200 text-stone-400'
                      }`}
                    >
                      {stepState === 'completed' ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-current"></span>
                      )}
                    </span>
                    <h4
                      className={`font-semibold text-xs ${
                        stepState === 'current'
                          ? 'text-amber-900 font-bold'
                          : stepState === 'completed'
                          ? 'text-stone-900'
                          : 'text-stone-400'
                      }`}
                    >
                      {st.label}
                    </h4>
                    <p className="text-[11px] text-stone-500 mt-0.5">{st.desc}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
