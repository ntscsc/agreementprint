'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Truck, 
  FileText, 
  Eye, 
  Send, 
  RefreshCw, 
  Lock, 
  UserCheck, 
  X,
  ExternalLink,
  ChevronRight,
  Printer,
  IndianRupee,
  Save,
  RotateCcw,
  Check,
  Mail,
  Package,
  Gift,
  MessageSquare,
  Phone,
  MapPin
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { CustomRequests } from '@/components/custom-agreements/CustomRequests';
import { db } from '@/lib/firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  setDoc
} from 'firebase/firestore';
import { Order, OrderStatus } from '@/lib/types';
import { checkIsAdmin } from '@/lib/order-service';
import { ADMIN_EMAIL, isUserAdmin } from '@/src/config/admin';
import { RentalAgreementDocument } from '@/components/agreement/RentalAgreementDocument';
import { DEFAULT_PRICING, PricingConfig } from '@/src/config/pricing';
import { getPricingConfig, savePricingConfig } from '@/lib/pricing-service';

import { DEFAULT_SUPPORT_EMAIL, getSupportEmail, saveSupportEmail } from '@/lib/support-email';
import { DEFAULT_COURIER_PARTNERS, getCourierPartners, saveCourierPartners } from '@/lib/courier-service';

interface Enquiry {
  enquiryId: string;
  name: string;
  phone: string;
  district: string;
  message: string;
  status: 'New' | 'In Progress' | 'Resolved';
  createdAt: string;
  updatedAt?: string;
}

export function AdminClient() {
  const { user, loading: authLoading, signInWithGoogle, authError } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [checkingRole, setCheckingRole] = useState<boolean>(true);
  const [signingIn, setSigningIn] = useState<boolean>(false);
  const [localSignInError, setLocalSignInError] = useState<string | null>(null);

  // Active Admin Console tab
  const [activeTab, setActiveTab] = useState<'orders' | 'enquiries' | 'pricing' | 'support' | 'couriers' | 'referrals' | 'custom'>('orders');

  // Pricing State
  const [pricingConfig, setPricingConfig] = useState<PricingConfig>(DEFAULT_PRICING);
  const [savingPricing, setSavingPricing] = useState<boolean>(false);
  const [pricingSavedToast, setPricingSavedToast] = useState<boolean>(false);
  const [supportEmail, setSupportEmail] = useState(DEFAULT_SUPPORT_EMAIL);
  const [savingSupportEmail, setSavingSupportEmail] = useState<boolean>(false);
  const [supportEmailSavedToast, setSupportEmailSavedToast] = useState<boolean>(false);
  const [courierPartners, setCourierPartners] = useState<string[]>(DEFAULT_COURIER_PARTNERS);
  const [newCourierPartner, setNewCourierPartner] = useState('');
  const [savingCourierPartners, setSavingCourierPartners] = useState(false);
  const [courierPartnersSavedToast, setCourierPartnersSavedToast] = useState(false);
  const [referralRewardAmount, setReferralRewardAmount] = useState(100);
  const [referralStats, setReferralStats] = useState({ rewardedReferrals: 0, totalCreditsIssued: 0 });
  const [savingReferralSettings, setSavingReferralSettings] = useState(false);
  const [referralSettingsSavedToast, setReferralSettingsSavedToast] = useState(false);

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(false);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loadingEnquiries, setLoadingEnquiries] = useState<boolean>(false);
  const [enquiriesError, setEnquiriesError] = useState<string | null>(null);
  const [enquirySearch, setEnquirySearch] = useState('');
  const [enquiryStatusFilter, setEnquiryStatusFilter] = useState<'ALL' | Enquiry['status']>('ALL');
  const [updatingEnquiryId, setUpdatingEnquiryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Selected Order Detail Modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Status Change State
  const [newStatus, setNewStatus] = useState<OrderStatus>('Under verification');
  const [statusNotes, setStatusNotes] = useState<string>('');
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);

  // Correction Request State
  const [correctionMsg, setCorrectionMsg] = useState<string>('');
  const [showCorrectionForm, setShowCorrectionForm] = useState<boolean>(false);

  // Courier Dispatch State
  const [courierName, setCourierName] = useState(DEFAULT_COURIER_PARTNERS[0]);
  const [trackingNumber, setTrackingNumber] = useState<string>('');
  const [showCourierForm, setShowCourierForm] = useState<boolean>(false);

  // Stamping Agreement View State
  const [showAgreementPrint, setShowAgreementPrint] = useState<boolean>(false);

  const fetchOrderList = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const snap = await getDocs(collection(db, 'orders'));
      const list: Order[] = [];
      snap.forEach((d) => list.push(d.data() as Order));
      // Sort newest first
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(list);
    } catch (err) {
      console.error('Error loading orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  const fetchEnquiries = useCallback(async () => {
    setLoadingEnquiries(true);
    setEnquiriesError(null);
    try {
      const snap = await getDocs(collection(db, 'enquiries'));
      const list: Enquiry[] = [];
      snap.forEach((enquiryDoc) => {
        list.push(enquiryDoc.data() as Enquiry);
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setEnquiries(list);
    } catch (error) {
      console.error('Error loading enquiries:', error);
      setEnquiriesError('Could not load enquiries. Check your admin access and try again.');
    } finally {
      setLoadingEnquiries(false);
    }
  }, []);

  const handleUpdateEnquiryStatus = async (enquiry: Enquiry, status: Enquiry['status']) => {
    if (status === enquiry.status || updatingEnquiryId) return;

    setUpdatingEnquiryId(enquiry.enquiryId);
    setEnquiriesError(null);
    const updatedAt = new Date().toISOString();
    try {
      await updateDoc(doc(db, 'enquiries', enquiry.enquiryId), { status, updatedAt });
      setEnquiries((current) => current.map((item) =>
        item.enquiryId === enquiry.enquiryId ? { ...item, status, updatedAt } : item
      ));
    } catch (error) {
      console.error('Error updating enquiry status:', error);
      setEnquiriesError(`Could not update the status for enquiry ${enquiry.enquiryId}. Please try again.`);
    } finally {
      setUpdatingEnquiryId(null);
    }
  };

  // Verify Admin Role on Auth Ready and fetch orders asynchronously
  useEffect(() => {
    if (!user) {
      return;
    }

    let isMounted = true;
    async function verifyAndInit() {
      try {
        const hasClaim = await checkIsAdmin();
        if (!isMounted) return;
        setIsAdmin(hasClaim);
        setCheckingRole(false);

        if (hasClaim) {
          await fetchOrderList();
          await fetchEnquiries();
          try {
            const cfg = await getPricingConfig();
            if (isMounted) setPricingConfig(cfg);
          } catch (e) {
            console.warn('Could not load pricing settings:', e);
          }
          const configuredSupportEmail = await getSupportEmail();
          if (isMounted) setSupportEmail(configuredSupportEmail);
          try {
            const configuredCourierPartners = await getCourierPartners();
            if (isMounted) {
              setCourierPartners(configuredCourierPartners);
              setCourierName(configuredCourierPartners[0] ?? DEFAULT_COURIER_PARTNERS[0]);
            }
          } catch (error) {
            console.warn('Could not load courier partner settings:', error);
          }
          try {
            const idToken = await user!.getIdToken();
            const response = await fetch('/api/admin/referrals', {
              headers: { Authorization: `Bearer ${idToken}` },
            });
            if (!response.ok) throw new Error('Referral settings request failed.');
            const referralData = await response.json();
            if (isMounted) {
              setReferralRewardAmount(referralData.rewardAmount);
              setReferralStats({
                rewardedReferrals: referralData.rewardedReferrals,
                totalCreditsIssued: referralData.totalCreditsIssued,
              });
            }
          } catch (error) {
            console.error('Could not load referral settings:', error);
          }
        }
      } catch (err) {
        console.error('Role verification error:', err);
        if (isMounted) {
          setIsAdmin(false);
          setCheckingRole(false);
        }
      }
    }

    verifyAndInit();

    return () => {
      isMounted = false;
    };
  }, [user, fetchOrderList, fetchEnquiries]);

  // Handle Status Update
  const handleUpdateStatus = async () => {
    if (!selectedOrder || !user) return;
    setUpdatingStatus(true);
    const nowIso = new Date().toISOString();
    const trimmedStatusNote = statusNotes.trim();
    const statusUpdate: {
      status: OrderStatus;
      updatedAt: string;
      notes?: string;
    } = {
      status: newStatus,
      updatedAt: nowIso,
    };

    if (trimmedStatusNote) {
      statusUpdate.notes = `${selectedOrder.notes || ''}\n[${nowIso}] ${trimmedStatusNote}`.trim();
    }

    try {
      const orderRef = doc(db, 'orders', selectedOrder.orderId);
      await updateDoc(orderRef, statusUpdate);
    } catch (err) {
      console.error('Status update error:', err);
      alert('Failed to update order status. Please verify the deployed Firestore rules and try again.');
      setUpdatingStatus(false);
      return;
    }

    const updated = {
      ...selectedOrder,
      status: newStatus,
      updatedAt: nowIso,
      ...(trimmedStatusNote ? { notes: statusUpdate.notes } : {}),
    };
    setSelectedOrder(updated);
    setOrders((prev) => prev.map((o) => (o.orderId === updated.orderId ? updated : o)));
    setStatusNotes('');

    try {
      const logId = `LOG_${Date.now()}`;
      await setDoc(doc(db, 'adminLogs', logId), {
        logId,
        orderId: selectedOrder.orderId,
        adminUid: user.uid,
        adminEmail: user.email || 'admin',
        action: 'STATUS_CHANGE',
        previousStatus: selectedOrder.status,
        newStatus,
        notes: trimmedStatusNote || 'Status updated from admin console',
        timestamp: nowIso,
      });
      alert(`Status updated to ${newStatus}`);
    } catch (err) {
      console.error('Status updated but audit log write failed:', err);
      alert(`Status updated to ${newStatus}, but the audit log could not be saved. Please check admin log permissions.`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handle Request Correction
  const handleSendCorrectionRequest = async () => {
    if (!selectedOrder || !user || !correctionMsg.trim()) return;
    setUpdatingStatus(true);
    try {
      const orderRef = doc(db, 'orders', selectedOrder.orderId);
      const nowIso = new Date().toISOString();

      await updateDoc(orderRef, {
        status: 'Documents needed' as OrderStatus,
        correctionMessage: correctionMsg.trim(),
        updatedAt: nowIso,
      });

      // Admin log
      const logId = `LOG_${Date.now()}`;
      await setDoc(doc(db, 'adminLogs', logId), {
        logId,
        orderId: selectedOrder.orderId,
        adminUid: user.uid,
        adminEmail: user.email || 'admin',
        action: 'CORRECTION_REQUESTED',
        previousStatus: selectedOrder.status,
        newStatus: 'Documents needed',
        notes: `Correction request: ${correctionMsg.trim()}`,
        timestamp: nowIso,
      });

      const updated = {
        ...selectedOrder,
        status: 'Documents needed' as OrderStatus,
        correctionMessage: correctionMsg.trim(),
        updatedAt: nowIso,
      };
      setSelectedOrder(updated);
      setOrders((prev) => prev.map((o) => (o.orderId === updated.orderId ? updated : o)));
      setShowCorrectionForm(false);
      setCorrectionMsg('');
      alert('Correction message successfully sent to customer.');
    } catch (err) {
      console.error('Error sending correction request:', err);
      alert('Failed to send correction request.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handle Courier Dispatch
  const handleDispatchCourier = async () => {
    if (!selectedOrder || !user || !trackingNumber.trim()) return;
    setUpdatingStatus(true);
    try {
      const orderRef = doc(db, 'orders', selectedOrder.orderId);
      const nowIso = new Date().toISOString();

      const courierData = {
        courierName,
        trackingNumber: trackingNumber.trim(),
        dispatchedAt: nowIso,
      };

      await updateDoc(orderRef, {
        status: 'Dispatched' as OrderStatus,
        courier: courierData,
        updatedAt: nowIso,
      });

      // Admin log
      const logId = `LOG_${Date.now()}`;
      await setDoc(doc(db, 'adminLogs', logId), {
        logId,
        orderId: selectedOrder.orderId,
        adminUid: user.uid,
        adminEmail: user.email || 'admin',
        action: 'COURIER_DISPATCHED',
        previousStatus: selectedOrder.status,
        newStatus: 'Dispatched',
        notes: `Dispatched with ${courierName}, Tracking: ${trackingNumber.trim()}`,
        timestamp: nowIso,
      });

      const updated = {
        ...selectedOrder,
        status: 'Dispatched' as OrderStatus,
        courier: courierData,
        updatedAt: nowIso,
      };
      setSelectedOrder(updated);
      setOrders((prev) => prev.map((o) => (o.orderId === updated.orderId ? updated : o)));
      setShowCourierForm(false);
      setTrackingNumber('');
      alert('Order marked as Dispatched with tracking code.');
    } catch (err) {
      console.error('Courier dispatch error:', err);
      alert('Failed to update courier tracking.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handle Save Pricing Rates
  const handleSavePricing = async () => {
    if (!user) return;
    setSavingPricing(true);
    setPricingSavedToast(false);
    try {
      await savePricingConfig(pricingConfig, user.email || ADMIN_EMAIL);
      // Administrative Audit Log
      const logId = `LOG_${Date.now()}`;
      await setDoc(doc(db, 'adminLogs', logId), {
        logId,
        orderId: 'PRICING_CONFIG',
        adminUid: user.uid,
        adminEmail: user.email || 'admin',
        action: 'PRICING_UPDATED',
        notes: `Updated prices: 100 Chennai: ₹${pricingConfig.stamp100Chennai}, 100 TN: ₹${pricingConfig.stamp100TamilNadu}, 200 Chennai: ₹${pricingConfig.stamp200Chennai}, 200 TN: ₹${pricingConfig.stamp200TamilNadu}, Notary: ₹${pricingConfig.notaryExtraFee}`,
        timestamp: new Date().toISOString(),
      });
      setPricingSavedToast(true);
      setTimeout(() => setPricingSavedToast(false), 4000);
    } catch (err) {
      console.error('Failed to save pricing config:', err);
      alert(err instanceof Error ? err.message : 'Failed to save pricing changes. Please check permissions.');
    } finally {
      setSavingPricing(false);
    }
  };

  const handleSaveReferralSettings = async () => {
    if (!user) return;
    setSavingReferralSettings(true);
    setReferralSettingsSavedToast(false);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/referrals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ rewardAmount: referralRewardAmount }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save referral settings.');

      const logId = `LOG_${Date.now()}`;
      await setDoc(doc(db, 'adminLogs', logId), {
        logId,
        orderId: 'REFERRAL_CONFIG',
        adminUid: user.uid,
        adminEmail: user.email || 'admin',
        action: 'REFERRAL_REWARD_UPDATED',
        notes: `Referral reward amount set to ₹${referralRewardAmount}.`,
        timestamp: new Date().toISOString(),
      });
      setReferralSettingsSavedToast(true);
      setTimeout(() => setReferralSettingsSavedToast(false), 4000);
    } catch (error) {
      console.error('Failed to save referral settings:', error);
      alert(error instanceof Error ? error.message : 'Failed to save referral settings.');
    } finally {
      setSavingReferralSettings(false);
    }
  };

  const handleSaveSupportEmail = async () => {
    if (!user) return;
    const normalizedEmail = supportEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      alert('Enter a valid support email address.');
      return;
    }

    setSavingSupportEmail(true);
    setSupportEmailSavedToast(false);
    try {
      await saveSupportEmail(normalizedEmail, user.email || ADMIN_EMAIL);
      const logId = `LOG_${Date.now()}`;
      await setDoc(doc(db, 'adminLogs', logId), {
        logId,
        orderId: 'SUPPORT_SETTINGS',
        adminUid: user.uid,
        adminEmail: user.email || 'admin',
        action: 'SUPPORT_EMAIL_UPDATED',
        notes: `Updated support email to ${normalizedEmail}`,
        timestamp: new Date().toISOString(),
      });
      setSupportEmail(normalizedEmail);
      setSupportEmailSavedToast(true);
      setTimeout(() => setSupportEmailSavedToast(false), 4000);
    } catch (err) {
      console.error('Failed to save support email:', err);
      alert('Failed to save support email. Please check permissions and try again.');
    } finally {
      setSavingSupportEmail(false);
    }
  };

  const handleAddCourierPartner = () => {
    const partner = newCourierPartner.trim();
    if (!partner) return;
    if (courierPartners.some((existing) => existing.toLowerCase() === partner.toLowerCase())) {
      alert('That courier partner is already in the list.');
      return;
    }
    setCourierPartners((current) => [...current, partner]);
    setCourierName(partner);
    setNewCourierPartner('');
    setCourierPartnersSavedToast(false);
  };

  const handleRemoveCourierPartner = (partner: string) => {
    if (courierPartners.length <= 1) {
      alert('At least one courier partner must remain in the list.');
      return;
    }
    const nextPartners = courierPartners.filter((existing) => existing !== partner);
    setCourierPartners(nextPartners);
    if (courierName === partner) setCourierName(nextPartners[0]);
    setCourierPartnersSavedToast(false);
  };

  const handleSaveCourierPartners = async () => {
    if (!user) return;
    setSavingCourierPartners(true);
    setCourierPartnersSavedToast(false);
    try {
      await saveCourierPartners(courierPartners, user.email || ADMIN_EMAIL);
      const logId = `LOG_${Date.now()}`;
      await setDoc(doc(db, 'adminLogs', logId), {
        logId,
        orderId: 'COURIER_SETTINGS',
        adminUid: user.uid,
        adminEmail: user.email || 'admin',
        action: 'COURIER_PARTNERS_UPDATED',
        notes: `Updated courier partners: ${courierPartners.join(', ')}`,
        timestamp: new Date().toISOString(),
      });
      setCourierPartnersSavedToast(true);
      setTimeout(() => setCourierPartnersSavedToast(false), 4000);
    } catch (error) {
      console.error('Failed to save courier partners:', error);
      alert('Failed to save courier partners. Please check permissions and try again.');
    } finally {
      setSavingCourierPartners(false);
    }
  };

  // Handle Reset to Default Rates
  const handleResetPricing = () => {
    if (window.confirm('Reset all pricing rates to default values (Rs.350 / 400 / 450 / 500 / 200)?')) {
      setPricingConfig(DEFAULT_PRICING);
    }
  };

  // Filters
  const filteredOrders = orders.filter((o) => {
    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      o.orderId.toLowerCase().includes(q) ||
      o.ownerDetails.fullName.toLowerCase().includes(q) ||
      o.ownerDetails.phone.includes(q) ||
      o.tenantDetails.fullName.toLowerCase().includes(q) ||
      o.propertyDetails.city.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  // Daily Summary Calculations
  const submittedCount = orders.filter((o) => o.status === 'Submitted').length;
  const pendingVerificationCount = orders.filter(
    (o) => o.status === 'Under verification' || o.status === 'Documents needed'
  ).length;
  const draftingCount = orders.filter((o) => o.status === 'Drafting').length;
  const dispatchedCount = orders.filter((o) => o.status === 'Dispatched').length;
  const filteredEnquiries = enquiries.filter((enquiry) => {
    const query = enquirySearch.trim().toLowerCase();
    const matchesSearch = !query || [
      enquiry.name,
      enquiry.phone,
      enquiry.district,
      enquiry.message,
      enquiry.enquiryId,
    ].some((value) => value.toLowerCase().includes(query));
    return matchesSearch && (enquiryStatusFilter === 'ALL' || enquiry.status === enquiryStatusFilter);
  });

  if (authLoading || (user && checkingRole)) {
    return (
      <div className="max-w-4xl mx-auto py-20 px-4 text-center space-y-4">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-xs text-stone-500">Checking vendor authorization...</p>
      </div>
    );
  }

  // Unauthorized Screen
  if (!user || !isAdmin) {
    return (
      <div className="max-w-lg mx-auto py-16 px-4">
        <div className="bg-white border border-stone-200 rounded-3xl p-8 sm:p-10 shadow-sm text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800 bg-rose-100 px-3 py-1 rounded-full">
              Admin Role Required
            </span>
            <h1 className="text-2xl font-black text-stone-900 tracking-tight pt-2">
              Vendor Management Desk
            </h1>
          </div>

          {(authError || localSignInError) && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl text-left">
              {authError || localSignInError}
            </div>
          )}

          {!user ? (
            <button
              onClick={async () => {
                setLocalSignInError(null);
                setSigningIn(true);
                try {
                  await signInWithGoogle();
                } catch (err: unknown) {
                  const message = (err as { message?: string })?.message || 'Sign in popup was blocked or failed. Please check browser popups.';
                  setLocalSignInError(message);
                } finally {
                  setSigningIn(false);
                }
              }}
              disabled={signingIn}
              className="w-full bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              {signingIn ? 'Opening Google Sign-In...' : 'Sign In with Authorized Google Account'}
            </button>
          ) : (
            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 text-xs text-stone-700 text-left space-y-2">
              <p>
                Currently signed in as: <strong>{user.email}</strong>
              </p>
              <p className="text-stone-500 text-[11px] leading-relaxed">
                Your account is not authorized to access this administrator area.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
            Admin Console
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-stone-900 mt-1">
            Vendor Fulfillment Desk
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Admin: {user.email}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'orders'
                ? 'bg-stone-900 text-white shadow-sm'
                : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Fulfillment Queue ({orders.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('enquiries')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'enquiries'
                ? 'bg-indigo-700 text-white shadow-sm'
                : 'bg-white text-stone-700 hover:bg-indigo-50 border border-indigo-300'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Enquiries ({enquiries.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pricing')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'pricing'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-white text-stone-700 hover:bg-amber-50 border border-amber-300'
            }`}
          >
            <IndianRupee className="w-3.5 h-3.5 text-amber-500" />
            <span>Pricing & Rates Settings</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('support')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'support'
                ? 'bg-sky-700 text-white shadow-sm'
                : 'bg-white text-stone-700 hover:bg-sky-50 border border-sky-300'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Support Settings</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('couriers')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'couriers'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'bg-white text-stone-700 hover:bg-emerald-50 border border-emerald-300'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Courier Partners</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('referrals')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'referrals'
                ? 'bg-purple-700 text-white shadow-sm'
                : 'bg-white text-stone-700 hover:bg-purple-50 border border-purple-300'
            }`}
          >
            <Gift className="w-3.5 h-3.5" />
            <span>Referral Credits</span>
          </button>

          <button onClick={() => setActiveTab('custom')} className={`rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === 'custom' ? 'bg-stone-900 text-white' : 'bg-white text-stone-700 hover:bg-stone-100'}`}>Custom Requests</button>
          {(activeTab === 'orders' || activeTab === 'enquiries') && (
            <button
              type="button"
              onClick={activeTab === 'orders' ? fetchOrderList : fetchEnquiries}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-300 hover:bg-stone-100 text-xs font-semibold text-stone-700 transition-colors cursor-pointer"
              title={activeTab === 'orders' ? 'Refresh order queue' : 'Refresh enquiries'}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {activeTab === 'custom' ? <CustomRequests admin /> : activeTab === 'enquiries' ? (
        <section className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5 animate-in fade-in duration-200">
          <div className="border-b border-stone-200 pb-5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-800 bg-indigo-100 px-2.5 py-0.5 rounded-full">
              Customer Contact
            </span>
            <h2 className="text-xl font-bold text-stone-900 mt-1">Submitted Enquiries</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Contact form submissions, newest first.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                type="search"
                value={enquirySearch}
                onChange={(event) => setEnquirySearch(event.target.value)}
                placeholder="Search name, phone, district, message, or reference"
                aria-label="Search enquiries"
                className="w-full rounded-xl border border-stone-300 bg-white py-2.5 pl-9 pr-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <label className="relative block">
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <select
                value={enquiryStatusFilter}
                onChange={(event) => setEnquiryStatusFilter(event.target.value as typeof enquiryStatusFilter)}
                aria-label="Filter enquiries by status"
                className="w-full appearance-none rounded-xl border border-stone-300 bg-white py-2.5 pl-9 pr-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All statuses</option>
                <option value="New">New</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
              </select>
            </label>
          </div>

          {enquiriesError && (
            <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-sm text-rose-800" role="alert">
              {enquiriesError}
              <button
                type="button"
                onClick={fetchEnquiries}
                className="ml-2 font-bold underline"
              >
                Retry
              </button>
            </div>
          )}

          {loadingEnquiries ? (
            <div className="py-10 text-center text-sm text-stone-500">Loading enquiries...</div>
          ) : enquiries.length === 0 ? (
            <div className="py-10 text-center text-sm text-stone-500">
              {enquiriesError ? 'Enquiries are unavailable.' : 'No enquiries have been submitted yet.'}
            </div>
          ) : filteredEnquiries.length === 0 ? (
            <div className="py-10 text-center text-sm text-stone-500">
              No enquiries match your search and status filter.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEnquiries.map((enquiry) => (
                <article key={enquiry.enquiryId} className="rounded-2xl border border-stone-200 bg-stone-50 p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-stone-900">{enquiry.name}</h3>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
                        <a href={`tel:${enquiry.phone}`} className="inline-flex items-center gap-1 hover:text-amber-800">
                          <Phone className="h-3.5 w-3.5" />
                          {enquiry.phone}
                        </a>
                        {enquiry.district && enquiry.district !== 'Not specified' && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {enquiry.district}
                          </span>
                        )}
                        <a
                          href={`https://wa.me/${enquiry.phone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-900"
                        >
                          WhatsApp
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <label className="sr-only" htmlFor={`enquiry-status-${enquiry.enquiryId}`}>
                        Update status for {enquiry.name}
                      </label>
                      <select
                        id={`enquiry-status-${enquiry.enquiryId}`}
                        value={enquiry.status}
                        disabled={updatingEnquiryId !== null}
                        onChange={(event) => void handleUpdateEnquiryStatus(enquiry, event.target.value as Enquiry['status'])}
                        className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-800 disabled:cursor-wait disabled:opacity-60"
                      >
                        <option value="New">New</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                      </select>
                      {updatingEnquiryId === enquiry.enquiryId && (
                        <span className="text-[11px] text-stone-500" role="status">Saving…</span>
                      )}
                      <time className="w-full text-left text-[11px] text-stone-500 sm:text-right">
                        {new Date(enquiry.createdAt).toLocaleString()}
                      </time>
                    </div>
                  </div>
                  <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-stone-700">
                    {enquiry.message}
                  </p>
                  <p className="mt-3 text-[10px] font-mono text-stone-400">
                    Reference: {enquiry.enquiryId}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : activeTab === 'referrals' ? (
        <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="border-b border-stone-200 pb-5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800 bg-purple-100 px-2.5 py-0.5 rounded-full">
              Customer Rewards
            </span>
            <h2 className="text-xl font-bold text-stone-900 mt-1">Referral Credit Settings</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Set the reward issued to the referrer after a new customer’s first order is paid. Changes apply to future eligible payments.
            </p>
          </div>

          {referralSettingsSavedToast && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold" role="status">
              Referral reward settings saved.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Eligible referrals</p>
              <p className="mt-2 text-2xl font-black text-stone-900">{referralStats.rewardedReferrals}</p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Credits issued</p>
              <p className="mt-2 text-2xl font-black text-stone-900">₹{referralStats.totalCreditsIssued.toLocaleString('en-IN')}</p>
            </div>
          </div>

          <div className="max-w-md">
            <label htmlFor="referral-reward-amount" className="block text-xs font-bold text-stone-700">
              Reward per eligible referral (₹)
            </label>
            <input
              id="referral-reward-amount"
              type="number"
              min="0"
              max="100000"
              step="1"
              value={referralRewardAmount}
              onChange={(event) => setReferralRewardAmount(Number(event.target.value))}
              className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <p className="mt-1 text-xs text-stone-500">Use 0 to pause new rewards. Existing customer balances are not changed.</p>
          </div>

          <div className="flex justify-end border-t border-stone-200 pt-5">
            <button
              type="button"
              disabled={savingReferralSettings || !Number.isSafeInteger(referralRewardAmount) || referralRewardAmount < 0 || referralRewardAmount > 100000}
              onClick={() => void handleSaveReferralSettings()}
              className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
            >
              {savingReferralSettings
                ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                : <Save className="h-3.5 w-3.5" />}
              <span>{savingReferralSettings ? 'Saving…' : 'Save Referral Settings'}</span>
            </button>
          </div>
        </div>
      ) : activeTab === 'couriers' ? (
        <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="border-b border-stone-200 pb-5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
              Dispatch Options
            </span>
            <h2 className="text-xl font-bold text-stone-900 mt-1">Courier Partners</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Manage the courier choices available when dispatching an order. New options will be available after saving.
            </p>
          </div>

          {courierPartnersSavedToast && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 font-semibold" role="status">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Courier partners saved.</span>
            </div>
          )}

          <div className="max-w-xl space-y-4">
            <ul className="space-y-2">
              {courierPartners.map((partner) => (
                <li key={partner} className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm">
                  <span className="font-semibold text-stone-800">{partner}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCourierPartner(partner)}
                    className="text-xs font-semibold text-rose-700 hover:text-rose-900"
                    aria-label={`Remove ${partner}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newCourierPartner}
                onChange={(event) => setNewCourierPartner(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleAddCourierPartner();
                  }
                }}
                maxLength={80}
                placeholder="Enter courier partner name"
                aria-label="New courier partner name"
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="button"
                disabled={!newCourierPartner.trim()}
                onClick={handleAddCourierPartner}
                className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:bg-stone-400 text-white rounded-xl text-xs font-bold"
              >
                Add Courier
              </button>
            </div>
          </div>

          <div className="flex justify-end border-t border-stone-200 pt-5">
            <button
              type="button"
              disabled={savingCourierPartners || courierPartners.length === 0}
              onClick={() => void handleSaveCourierPartners()}
              className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm"
            >
              {savingCourierPartners
                ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Save className="w-3.5 h-3.5" />}
              <span>{savingCourierPartners ? 'Saving...' : 'Save Courier Partners'}</span>
            </button>
          </div>
        </div>
      ) : activeTab === 'support' ? (
        <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="border-b border-stone-200 pb-5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-800 bg-sky-100 px-2.5 py-0.5 rounded-full">
              Customer Contact
            </span>
            <h2 className="text-xl font-bold text-stone-900 mt-1">Support Email Address</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              This address appears on the Contact page, site footer, privacy policy, and refund policy.
            </p>
          </div>

          {supportEmailSavedToast && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 font-semibold" role="status">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Support email saved.</span>
            </div>
          )}

          <div className="max-w-xl space-y-2">
            <label htmlFor="support-email" className="block text-xs font-bold text-stone-700">
              Public support email
            </label>
            <input
              id="support-email"
              type="email"
              autoComplete="email"
              value={supportEmail}
              onChange={(event) => setSupportEmail(event.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="support@example.com"
            />
            <p className="text-[11px] text-stone-500">
              Customer enquiry forms are currently saved in the admin system; this setting changes the displayed email address, not automatic enquiry email delivery.
            </p>
          </div>

          <div className="flex justify-end border-t border-stone-200 pt-5">
            <button
              type="button"
              disabled={savingSupportEmail}
              onClick={() => void handleSaveSupportEmail()}
              className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm"
            >
              {savingSupportEmail
                ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Save className="w-3.5 h-3.5" />}
              <span>{savingSupportEmail ? 'Saving...' : 'Save Support Email'}</span>
            </button>
          </div>
        </div>
      ) : activeTab === 'pricing' ? (
        /* PRICING & RATES SETTINGS VIEW */
        <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-8 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-5">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                Rate Master
              </span>
              <h2 className="text-xl font-bold text-stone-900 mt-1">
                Official Stamping, Courier & Notary Rates
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Configure rates for the 3 customer dropboxes. Updates apply immediately across customer checkout.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetPricing}
                className="px-3.5 py-2 border border-stone-300 hover:bg-stone-100 rounded-xl text-xs font-semibold text-stone-700 transition flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Defaults</span>
              </button>

              <button
                type="button"
                disabled={savingPricing}
                onClick={handleSavePricing}
                className="px-5 py-2 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer"
              >
                {savingPricing ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Save All Rates</span>
              </button>
            </div>
          </div>

          {pricingSavedToast && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 font-semibold animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Pricing rates successfully saved and updated in Firestore!</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Box 1: Rs. 100 Stamp Paper Package */}
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                <div>
                  <h3 className="font-bold text-stone-900 text-sm">1. In Rs.100 Stamp Paper Package</h3>
                  <p className="text-xs text-stone-500">Standard 11-month tenancy stamp paper with courier charges</p>
                </div>
                <span className="text-xs font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">₹100</span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Within Chennai (₹) — Courier Included
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-stone-400 text-xs font-bold">₹</span>
                    <input
                      type="number"
                      min="100"
                      value={pricingConfig.stamp100Chennai}
                      onChange={(e) =>
                        setPricingConfig({ ...pricingConfig, stamp100Chennai: Number(e.target.value) })
                      }
                      className="w-full pl-7 pr-3 py-2 rounded-xl border border-stone-300 text-xs font-bold text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <span className="text-[10px] text-stone-500">Default: Rs. 350/-</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Within Tamilnadu (Other Districts) (₹) — Courier Included
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-stone-400 text-xs font-bold">₹</span>
                    <input
                      type="number"
                      min="100"
                      value={pricingConfig.stamp100TamilNadu}
                      onChange={(e) =>
                        setPricingConfig({ ...pricingConfig, stamp100TamilNadu: Number(e.target.value) })
                      }
                      className="w-full pl-7 pr-3 py-2 rounded-xl border border-stone-300 text-xs font-bold text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <span className="text-[10px] text-stone-500">Default: Rs. 400/-</span>
                </div>
              </div>
            </div>

            {/* Box 2: Rs. 200 Stamp Paper Package */}
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                <div>
                  <h3 className="font-bold text-stone-900 text-sm">2. In Rs.200 Stamp Paper Package</h3>
                  <p className="text-xs text-stone-500">Higher denomination stamp paper with courier charges</p>
                </div>
                <span className="text-xs font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">₹200</span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Within Chennai (₹) — Courier Included
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-stone-400 text-xs font-bold">₹</span>
                    <input
                      type="number"
                      min="200"
                      value={pricingConfig.stamp200Chennai}
                      onChange={(e) =>
                        setPricingConfig({ ...pricingConfig, stamp200Chennai: Number(e.target.value) })
                      }
                      className="w-full pl-7 pr-3 py-2 rounded-xl border border-stone-300 text-xs font-bold text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <span className="text-[10px] text-stone-500">Default: Rs. 450/-</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Within Tamilnadu (Other Districts) (₹) — Courier Included
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-stone-400 text-xs font-bold">₹</span>
                    <input
                      type="number"
                      min="200"
                      value={pricingConfig.stamp200TamilNadu}
                      onChange={(e) =>
                        setPricingConfig({ ...pricingConfig, stamp200TamilNadu: Number(e.target.value) })
                      }
                      className="w-full pl-7 pr-3 py-2 rounded-xl border border-stone-300 text-xs font-bold text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <span className="text-[10px] text-stone-500">Default: Rs. 500/-</span>
                </div>
              </div>
            </div>

            {/* Box 3: Notary Public Attestation Add-on */}
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 space-y-4 md:col-span-2">
              <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                <div>
                  <h3 className="font-bold text-stone-900 text-sm">3. With Notary Signature (Extra Charge)</h3>
                  <p className="text-xs text-stone-500">Advocate Notary Public attestation and official seal endorsement fee</p>
                </div>
                <span className="text-xs font-mono font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded">Notary Add-on</span>
              </div>

              <div className="max-w-md">
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Notary Attestation Additional Charge (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-stone-400 text-xs font-bold">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={pricingConfig.notaryExtraFee}
                    onChange={(e) =>
                      setPricingConfig({ ...pricingConfig, notaryExtraFee: Number(e.target.value) })
                    }
                    className="w-full pl-7 pr-3 py-2 rounded-xl border border-stone-300 text-xs font-bold text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <span className="text-[10px] text-stone-500">Default: Rs. 200/- extra</span>
              </div>
            </div>
          </div>

          {/* Pricing Matrix Preview */}
          <div className="border border-amber-200 bg-amber-50/50 rounded-2xl p-5 space-y-3">
            <h4 className="font-bold text-stone-900 text-xs uppercase tracking-wider text-amber-900">
              Customer Package Matrix (Live Rate Calculator)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-2xs space-y-1">
                <span className="text-stone-500 block">₹100 Paper • Chennai</span>
                <p className="text-base font-black text-stone-900">₹{pricingConfig.stamp100Chennai}/-</p>
                <span className="text-[11px] text-amber-800 block">With Notary: ₹{pricingConfig.stamp100Chennai + pricingConfig.notaryExtraFee}/-</span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-2xs space-y-1">
                <span className="text-stone-500 block">₹100 Paper • Tamil Nadu</span>
                <p className="text-base font-black text-stone-900">₹{pricingConfig.stamp100TamilNadu}/-</p>
                <span className="text-[11px] text-amber-800 block">With Notary: ₹{pricingConfig.stamp100TamilNadu + pricingConfig.notaryExtraFee}/-</span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-2xs space-y-1">
                <span className="text-stone-500 block">₹200 Paper • Chennai</span>
                <p className="text-base font-black text-stone-900">₹{pricingConfig.stamp200Chennai}/-</p>
                <span className="text-[11px] text-amber-800 block">With Notary: ₹{pricingConfig.stamp200Chennai + pricingConfig.notaryExtraFee}/-</span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-2xs space-y-1">
                <span className="text-stone-500 block">₹200 Paper • Tamil Nadu</span>
                <p className="text-base font-black text-stone-900">₹{pricingConfig.stamp200TamilNadu}/-</p>
                <span className="text-[11px] text-amber-800 block">With Notary: ₹{pricingConfig.stamp200TamilNadu + pricingConfig.notaryExtraFee}/-</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ORDERS FULFILLMENT QUEUE VIEW */
        <>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-stone-400">New Submitted</span>
          <p className="text-2xl font-black text-amber-600">{submittedCount}</p>
          <span className="text-[11px] text-stone-500">Awaiting initial review</span>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-stone-400">Under Verification</span>
          <p className="text-2xl font-black text-sky-600">{pendingVerificationCount}</p>
          <span className="text-[11px] text-stone-500">Checking ID / EB proofs</span>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-stone-400">Drafting on Stamp</span>
          <p className="text-2xl font-black text-purple-600">{draftingCount}</p>
          <span className="text-[11px] text-stone-500">Printing on stamp paper</span>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-stone-400">Dispatched Courier</span>
          <p className="text-2xl font-black text-emerald-600">{dispatchedCount}</p>
          <span className="text-[11px] text-stone-500">In postal transit</span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Order ID, Landlord name, Tenant name, phone, or city..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-300 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
        >
          <option value="ALL">All Statuses</option>
          <option value="Submitted">Submitted</option>
          <option value="Under verification">Under Verification</option>
          <option value="Documents needed">Documents Needed</option>
          <option value="Drafting">Drafting on Stamp</option>
          <option value="Dispatched">Dispatched</option>
          <option value="Delivered">Delivered</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      {/* Order List Table */}
      <div className="bg-white border border-stone-200 rounded-3xl shadow-sm overflow-hidden">
        {loadingOrders ? (
          <div className="py-16 text-center text-xs text-stone-500 space-y-2">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p>Loading application queue...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-16 text-center text-xs text-stone-500">
            No orders match the selected search or filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-600">
              <thead className="bg-stone-50 border-b border-stone-200 text-[11px] uppercase tracking-wider text-stone-500 font-semibold">
                <tr>
                  <th className="py-3 px-4">Order ID & Date</th>
                  <th className="py-3 px-4">Landlord & Tenant</th>
                  <th className="py-3 px-4">Premises City</th>
                  <th className="py-3 px-4">Monthly Rent</th>
                  <th className="py-3 px-4">Current Status</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredOrders.map((ord) => (
                  <tr key={ord.orderId} className="hover:bg-stone-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <strong className="font-mono text-stone-900">{ord.orderId}</strong>
                      <span className="block text-[11px] text-stone-400">
                        {new Date(ord.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-stone-900">{ord.ownerDetails.fullName}</span>
                      <span className="block text-stone-500">T: {ord.tenantDetails.fullName}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span>{ord.propertyDetails.city}</span>
                      <span className="block text-stone-400 text-[10px]">{ord.propertyDetails.propertyType}</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-stone-800">
                      ₹{ord.agreementTerms.monthlyRent?.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-stone-100 text-stone-800">
                        {ord.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          ord.payment?.status === 'Paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {ord.payment?.status || 'Pending'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedOrder(ord)}
                        className="bg-stone-900 hover:bg-stone-800 text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className={`fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto ${showAgreementPrint ? 'agreement-print-modal' : ''}`}>
          {showAgreementPrint ? (
            <div className="bg-white rounded-3xl max-w-5xl w-full p-6 sm:p-8 shadow-xl max-h-[95vh] overflow-y-auto space-y-4">
              <RentalAgreementDocument
                data={{
                  ownerDetails: selectedOrder.ownerDetails,
                  tenantDetails: selectedOrder.tenantDetails,
                  propertyDetails: selectedOrder.propertyDetails,
                  agreementTerms: selectedOrder.agreementTerms,
                  orderId: selectedOrder.orderId,
                  createdAt: selectedOrder.createdAt,
                }}
                onBack={() => setShowAgreementPrint(false)}
                title={`Rental Agreement for Stamping (Order #${selectedOrder.orderId})`}
              />
              <div className="flex justify-center pt-4 border-t border-stone-200 no-print">
                <button
                  type="button"
                  onClick={() => setShowAgreementPrint(false)}
                  className="px-6 py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl text-xs cursor-pointer"
                >
                  Return to Order Management Details
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-xl max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-stone-200 pb-4">
                <div>
                  <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                    Order Management
                  </span>
                  <h2 className="text-xl font-black font-mono text-stone-900">{selectedOrder.orderId}</h2>
                  <p className="text-xs text-stone-500">
                    Customer Email: {selectedOrder.customerEmail} • Created: {new Date(selectedOrder.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAgreementPrint(true)}
                    className="bg-amber-600 hover:bg-amber-700 text-stone-900 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                    title="Open agreement formatted for non-judicial stamp paper"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Agreement</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedOrder(null);
                      setShowCorrectionForm(false);
                      setShowCourierForm(false);
                    }}
                    className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

            {/* Application Data Tabs/Sections */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Landlord */}
              <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-1">
                <strong className="block font-bold text-stone-900">Landlord (Owner)</strong>
                <p>Name: {selectedOrder.ownerDetails.fullName}</p>
                <p>Father/Spouse: {selectedOrder.ownerDetails.relativeName}</p>
                <p>Age: {selectedOrder.ownerDetails.age} yrs • Phone: {selectedOrder.ownerDetails.phone}</p>
                <p className="font-mono text-emerald-800">Aadhaar Last 4: XXXX-XXXX-{selectedOrder.ownerDetails.aadhaarLast4}</p>
                {selectedOrder.ownerDetails.pan && <p className="font-mono">PAN: {selectedOrder.ownerDetails.pan}</p>}
                <p className="text-stone-500">Address: {selectedOrder.ownerDetails.address}</p>
              </div>

              {/* Tenant */}
              <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-1">
                <strong className="block font-bold text-stone-900">Tenant</strong>
                <p>Name: {selectedOrder.tenantDetails.fullName}</p>
                <p>Father/Spouse: {selectedOrder.tenantDetails.relativeName}</p>
                <p>Age: {selectedOrder.tenantDetails.age} yrs • Phone: {selectedOrder.tenantDetails.phone}</p>
                <p className="font-mono text-emerald-800">Aadhaar Last 4: XXXX-XXXX-{selectedOrder.tenantDetails.aadhaarLast4}</p>
                {selectedOrder.tenantDetails.pan && <p className="font-mono">PAN: {selectedOrder.tenantDetails.pan}</p>}
                <p className="text-stone-500">Address: {selectedOrder.tenantDetails.address}</p>
              </div>

              {/* Property */}
              <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-1 sm:col-span-2">
                <strong className="block font-bold text-stone-900">Rental Premises</strong>
                <p>Address: {selectedOrder.propertyDetails.fullAddress}</p>
                <p>City: {selectedOrder.propertyDetails.city} - {selectedOrder.propertyDetails.pincode} • Type: {selectedOrder.propertyDetails.propertyType} ({selectedOrder.propertyDetails.furnishing})</p>
              </div>

              {/* Terms */}
              <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-2 sm:col-span-2">
                <div className="flex justify-between items-center border-b border-stone-200/80 pb-1.5">
                  <strong className="block font-bold text-stone-900">Agreement Terms & Selected Stamping Package</strong>
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                    Order Total: ₹{(selectedOrder.payment?.totalBeforeCredits ?? selectedOrder.payment?.amount) || (selectedOrder.agreementTerms.stampPaperDenomination === 200 ? (selectedOrder.agreementTerms.deliveryLocation === 'Within Tamil Nadu' ? 500 : 450) : (selectedOrder.agreementTerms.deliveryLocation === 'Within Tamil Nadu' ? 400 : 350)) + (selectedOrder.agreementTerms.includeNotary ? 200 : 0)}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(selectedOrder.payment?.referralCreditApplied ?? 0) > 0 && (
                    <div>Referral credit: <strong>−₹{selectedOrder.payment.referralCreditApplied?.toLocaleString('en-IN')}</strong></div>
                  )}
                  <div>Rent: <strong>₹{selectedOrder.agreementTerms.monthlyRent?.toLocaleString('en-IN')}</strong></div>
                  <div>Advance: <strong>₹{selectedOrder.agreementTerms.securityDeposit?.toLocaleString('en-IN')}</strong></div>
                  <div>Tenure: <strong>{selectedOrder.agreementTerms.tenureMonths} Months</strong></div>
                  <div>Notice: <strong>{selectedOrder.agreementTerms.noticePeriodDays} Days</strong></div>
                  <div>Stamp Paper: <strong>In Rs.{selectedOrder.agreementTerms.stampPaperDenomination || 100} Stamp Paper</strong></div>
                  <div>Courier Delivery: <strong>{selectedOrder.agreementTerms.deliveryLocation || 'Within Chennai'}</strong></div>
                  <div className="col-span-2 sm:col-span-4">
                    Delivery Address:{' '}
                    {selectedOrder.agreementTerms.deliveryRecipient ? (
                      <>
                        <strong>{selectedOrder.agreementTerms.deliveryRecipient}</strong>{' '}
                        {selectedOrder.agreementTerms.deliveryRecipient === 'Owner'
                          ? selectedOrder.ownerDetails.address
                          : selectedOrder.tenantDetails.address}
                      </>
                    ) : (
                      'Not recorded on this order'
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    Notary Attestation:{' '}
                    <strong className={selectedOrder.agreementTerms.includeNotary ? 'text-amber-700' : 'text-stone-700'}>
                      {selectedOrder.agreementTerms.includeNotary ? 'With Notary Signature & Seal' : 'Without Notary'}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Status Change & Workflow Action Box */}
            <div className="border-t border-stone-200 pt-4 space-y-4">
              <h3 className="font-bold text-stone-900 text-xs">Fulfillment Workflow Actions</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Transition Order Status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as OrderStatus)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs text-stone-900 bg-white"
                  >
                    <option value="Under verification">Under verification</option>
                    <option value="Drafting">Drafting on Stamp Paper</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Administrative Note (Logged into audit trail)
                  </label>
                  <input
                    type="text"
                    value={statusNotes}
                    onChange={(e) => setStatusNotes(e.target.value)}
                    placeholder="e.g. EB bill verified, printing on stamp paper"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs text-stone-900 bg-white"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={updatingStatus}
                  onClick={handleUpdateStatus}
                  className="bg-stone-900 hover:bg-stone-800 text-white font-semibold px-4 py-2 rounded-xl text-xs cursor-pointer"
                >
                  {updatingStatus ? 'Updating...' : 'Apply Status Change'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowCorrectionForm(!showCorrectionForm);
                    setShowCourierForm(false);
                  }}
                  className="border border-rose-300 hover:bg-rose-50 text-rose-800 font-semibold px-4 py-2 rounded-xl text-xs cursor-pointer"
                >
                  Request Correction from Customer
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowCourierForm(!showCourierForm);
                    setShowCorrectionForm(false);
                  }}
                  className="border border-sky-300 hover:bg-sky-50 text-sky-800 font-semibold px-4 py-2 rounded-xl text-xs cursor-pointer"
                >
                  Dispatch & Assign Courier Tracking
                </button>
              </div>

              {/* Correction Form */}
              {showCorrectionForm && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-3">
                  <h4 className="font-bold text-rose-900 text-xs">Customer Correction Message</h4>
                  <textarea
                    rows={2}
                    value={correctionMsg}
                    onChange={(e) => setCorrectionMsg(e.target.value)}
                    placeholder="Specify what needs correction (e.g. Correct the landlord name or property address)..."
                    className="w-full p-2.5 rounded-xl border border-rose-300 bg-white text-xs text-stone-900"
                  />
                  <button
                    type="button"
                    disabled={updatingStatus}
                    onClick={handleSendCorrectionRequest}
                    className="bg-rose-700 hover:bg-rose-800 text-white font-semibold px-4 py-2 rounded-xl text-xs cursor-pointer"
                  >
                    Send Correction Request
                  </button>
                </div>
              )}

              {/* Courier Form */}
              {showCourierForm && (
                <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl space-y-3">
                  <h4 className="font-bold text-sky-900 text-xs">Consignment Courier Details</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-sky-900 mb-1">Courier Partner</label>
                      <select
                        value={courierName}
                        onChange={(e) => setCourierName(e.target.value)}
                        className="w-full p-2 rounded-xl border border-sky-300 bg-white text-xs text-stone-900"
                      >
                        {courierPartners.map((partner) => (
                          <option key={partner} value={partner}>{partner}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-sky-900 mb-1">Tracking Number</label>
                      <input
                        type="text"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        placeholder="e.g. EM123456789IN"
                        className="w-full p-2 rounded-xl border border-sky-300 bg-white text-xs text-stone-900 font-mono"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={updatingStatus}
                    onClick={handleDispatchCourier}
                    className="bg-sky-700 hover:bg-sky-800 text-white font-semibold px-4 py-2 rounded-xl text-xs cursor-pointer"
                  >
                    Confirm Dispatch
                  </button>
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      )}
    </div>
  );
}
