'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  CheckCircle2, 
  FileText, 
  Clock, 
  Truck, 
  ArrowRight, 
  MapPin, 
  PhoneCall,
  Eye,
  ArrowLeft
} from 'lucide-react';
import { Order } from '@/lib/types';
import { VENDOR_CONFIG } from '@/src/config/vendor';
import { RentalAgreementDocument } from '@/components/agreement/RentalAgreementDocument';

interface OrderConfirmationProps {
  order: Order;
  onStartNew?: () => void;
}

export const OrderConfirmation: React.FC<OrderConfirmationProps> = ({ order, onStartNew }) => {
  const [showAgreementPreview, setShowAgreementPreview] = useState<boolean>(false);

  if (showAgreementPreview) {
    return (
      <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
        <RentalAgreementDocument
          data={{
            ownerDetails: order.ownerDetails,
            tenantDetails: order.tenantDetails,
            propertyDetails: order.propertyDetails,
            agreementTerms: order.agreementTerms,
            orderId: order.orderId,
            createdAt: order.createdAt,
          }}
          onBack={() => setShowAgreementPreview(false)}
          title={`Rental Agreement Draft (Order #${order.orderId})`}
          customerPreview
        />
        <div className="flex justify-center no-print">
          <button
            type="button"
            onClick={() => setShowAgreementPreview(false)}
            className="px-6 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Order Confirmation & Receipt</span>
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 space-y-8 animate-in fade-in duration-200">
      {/* Success Badge Banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 sm:p-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-inner">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
            Application Submitted Successfully
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight pt-2">
            Order Reference: <span className="font-mono text-emerald-900">{order.orderId}</span>
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 max-w-lg mx-auto leading-relaxed">
            Your rental agreement application has been registered. Documents are now queued for verification.
          </p>
        </div>
      </div>

      {/* Order Summary & Next Steps Card */}
      <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-stone-200 gap-2">
          <div>
            <h2 className="text-base font-bold text-stone-900">Application Receipt</h2>
            <p className="text-xs text-stone-500">Submitted on {new Date(order.createdAt).toLocaleString()}</p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-semibold">
            <Clock className="w-3.5 h-3.5" />
            <span>Status: {order.status}</span>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {(order.payment.totalBeforeCredits !== undefined || (order.payment.referralCreditApplied ?? 0) > 0) && (
            <div className="space-y-1 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:col-span-2">
              <span className="block text-xs font-bold text-emerald-900">Payment summary</span>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-stone-700">
                <span>Order total: ₹{(order.payment.totalBeforeCredits ?? order.payment.amount ?? 0).toLocaleString('en-IN')}</span>
                {(order.payment.referralCreditApplied ?? 0) > 0 && (
                  <span>Referral credit: −₹{order.payment.referralCreditApplied?.toLocaleString('en-IN')}</span>
                )}
                <strong>Paid: ₹{(order.payment.amount ?? 0).toLocaleString('en-IN')}</strong>
              </div>
            </div>
          )}

          <div className="space-y-1 bg-stone-50 p-4 rounded-xl border border-stone-200/80">
            <span className="font-bold text-stone-800 block text-xs">Landlord (Owner)</span>
            <p className="text-stone-600">{order.ownerDetails.fullName}</p>
            {order.ownerDetails.aadhaarLast4 && (
              <p className="text-stone-500 font-mono">Aadhaar: {order.ownerDetails.aadhaarLast4}</p>
            )}
            <p className="text-stone-500">{order.ownerDetails.phone}</p>
          </div>

          <div className="space-y-1 bg-stone-50 p-4 rounded-xl border border-stone-200/80">
            <span className="font-bold text-stone-800 block text-xs">Tenant (Occupant)</span>
            <p className="text-stone-600">{order.tenantDetails.fullName}</p>
            {order.tenantDetails.aadhaarLast4 && (
              <p className="text-stone-500 font-mono">Aadhaar: {order.tenantDetails.aadhaarLast4}</p>
            )}
            <p className="text-stone-500">{order.tenantDetails.phone}</p>
          </div>

          <div className="space-y-1 bg-stone-50 p-4 rounded-xl border border-stone-200/80 sm:col-span-2">
            <span className="font-bold text-stone-800 block text-xs">Premises Address</span>
            <p className="text-stone-600">{order.propertyDetails.fullAddress}</p>
            <p className="text-stone-500">{order.propertyDetails.city} - {order.propertyDetails.pincode}</p>
          </div>

          <div className="space-y-1 bg-stone-50 p-4 rounded-xl border border-stone-200/80 sm:col-span-2">
            <span className="font-bold text-stone-800 block text-xs">Tenancy Terms</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-stone-600 pt-1">
              <div>Monthly Rent: <strong>₹{order.agreementTerms.monthlyRent?.toLocaleString('en-IN')}</strong></div>
              <div>Advance: <strong>₹{order.agreementTerms.securityDeposit?.toLocaleString('en-IN')}</strong></div>
              <div>Tenure: <strong>{order.agreementTerms.tenureMonths} Months</strong></div>
              {order.agreementTerms.deliveryRecipient && (
                <div className="col-span-2 sm:col-span-3">
                  Courier delivery to <strong>{order.agreementTerms.deliveryRecipient}</strong>:{' '}
                  {order.agreementTerms.deliveryRecipient === 'Owner'
                    ? order.ownerDetails.address
                    : order.tenantDetails.address}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 4 Steps Timeline for Customer */}
        <div className="border-t border-stone-200 pt-6 space-y-4">
          <h3 className="font-bold text-stone-900 text-sm">What Happens Next?</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/70 space-y-1">
              <span className="font-bold text-amber-900 block">1. Agreement Details Check</span>
              <p className="text-stone-600 leading-relaxed">
                Our drafting team reviews the submitted landlord, tenant, property and agreement details.
              </p>
            </div>
            <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/70 space-y-1">
              <span className="font-bold text-amber-900 block">2. Stamp Paper Drafting</span>
              <p className="text-stone-600 leading-relaxed">
                The agreement is drafted directly on non-judicial stamp paper bearing genuine serial numbers.
              </p>
            </div>
            <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/70 space-y-1">
              <span className="font-bold text-amber-900 block">3. Courier Dispatch</span>
              <p className="text-stone-600 leading-relaxed">
                1 physical original document is sent to your address with courier tracking details.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-stone-200 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setShowAgreementPreview(true)}
            className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-stone-900 font-semibold py-3 px-6 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
          >
            <Eye className="w-4 h-4" />
            <span>View Agreement Draft</span>
          </button>

          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            <Link
              href={`/track?orderId=${order.orderId}&phone=${order.ownerDetails.phone}`}
              className="w-full sm:w-auto bg-stone-900 hover:bg-stone-800 text-white font-semibold py-3 px-6 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Truck className="w-4 h-4" />
              <span>Track Delivery</span>
            </Link>

            <Link
              href="/my-orders"
              className="w-full sm:w-auto border border-stone-300 hover:bg-stone-50 text-stone-700 font-semibold py-3 px-6 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span>My Orders</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
