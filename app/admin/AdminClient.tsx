'use client';

import { PaymentGatewaySettings } from '@/components/admin/PaymentGatewaySettings';
import { AdminReportDownload } from '@/components/admin/AdminReportDownload';
import { EnvelopePrint } from '@/components/admin/EnvelopePrint';
import { CustomerReviewModeration } from '@/components/admin/CustomerReviewModeration';
import { OrderReference } from '@/components/order/OrderReference';
import { maskedAadhaar } from '@/lib/identity-display';
import { readApiResponse } from '@/lib/api-response';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  MapPin,
  Trash2
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { AgentReferralAdmin } from '@/components/referrals/AgentReferralAdmin';
import { SupportEmailLink } from '@/components/SupportEmailLink';
import { AdminMilestone } from '@/components/AdminMilestone';
import { CreditRefundRequests } from '@/components/admin/CreditRefundRequests';
import { OrderCorrectionHistory } from '@/components/order/OrderCorrectionHistory';
import { OrderReplacementRequests } from '@/components/admin/OrderReplacementRequests';
import { AdminVisitorStats } from '@/components/admin/AdminVisitorStats';
import { CustomRequests } from '@/components/custom-agreements/CustomRequests';
import { db } from '@/lib/firebase';
import { 
  collection, 
  getDocs,
  onSnapshot,
  deleteDoc,
  doc, 
  updateDoc, 
  setDoc
} from 'firebase/firestore';
import { Order, OrderStatus } from '@/lib/types';
import { checkIsAdmin } from '@/lib/order-service';
import { ADMIN_EMAIL, isUserAdmin } from '@/src/config/admin';
import { RentalAgreementDocument } from '@/components/agreement/RentalAgreementDocument';
import { DEFAULT_PRICING, PricingConfig, PRICING_MINIMUMS, MAX_PRICING_AMOUNT, PricingField, pricingFieldError } from '@/src/config/pricing';
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
  const { user } = useAuth();
  return <AdminBody key={user?.uid ?? 'guest'} />;
}

function AdminBody() {
  const { user, loading: authLoading, signInWithGoogle, authError } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [checkingRole, setCheckingRole] = useState<boolean>(true);
  const [signingIn, setSigningIn] = useState<boolean>(false);
  const [localSignInError, setLocalSignInError] = useState<string | null>(null);

  // Active Admin Console tab
  const [activeTab, setActiveTab] = useState<'orders' | 'enquiries' | 'pricing' | 'support' | 'couriers' | 'referrals' | 'custom' | 'reports' | 'reviews' | 'changes' | 'refunds' | 'payments'>('orders');

  // Pricing State
  const [pricingConfig, setPricingConfig] = useState<PricingConfig>(DEFAULT_PRICING);
  const pricingErrors = Object.fromEntries((Object.keys(PRICING_MINIMUMS) as PricingField[]).map(key => [key, pricingFieldError(key, pricingConfig[key])]));
  const pricingInvalid = Object.values(pricingErrors).some(Boolean);
  const [savingPricing, setSavingPricing] = useState<boolean>(false);
  const [pricingSavedToast, setPricingSavedToast] = useState<boolean>(false);
  const [supportEmail, setSupportEmail] = useState(DEFAULT_SUPPORT_EMAIL);
  const [savingSupportEmail, setSavingSupportEmail] = useState<boolean>(false);
  const [supportEmailSavedToast, setSupportEmailSavedToast] = useState<boolean>(false);
  const [courierPartners, setCourierPartners] = useState<string[]>(DEFAULT_COURIER_PARTNERS);
  const [newCourierPartner, setNewCourierPartner] = useState('');
  const [savingCourierPartners, setSavingCourierPartners] = useState(false);
  const [courierPartnersSavedToast, setCourierPartnersSavedToast] = useState(false);
  const [referralSection, setReferralSection] = useState<'customers' | 'agents'>('agents');
  const [referralRewardAmount, setReferralRewardAmount] = useState('');
  const [refereeDiscountAmount, setRefereeDiscountAmount] = useState('');
  const [referralStats, setReferralStats] = useState({ rewardedReferrals: 0, totalCreditsIssued: 0 });
  const [savingReferralSettings, setSavingReferralSettings] = useState(false);
  const [loadingReferralSettings, setLoadingReferralSettings] = useState(false);
  const [referralSettingsLoaded, setReferralSettingsLoaded] = useState(false);
  const [referralSettingsError, setReferralSettingsError] = useState<string | null>(null);
  const referralSaveBusy = useRef(false);
  const [referralSettingsSavedToast, setReferralSettingsSavedToast] = useState(false);

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loadingEnquiries, setLoadingEnquiries] = useState<boolean>(false);
  const [enquiriesError, setEnquiriesError] = useState<string | null>(null);
  const [enquirySearch, setEnquirySearch] = useState('');
  const [enquiryStatusFilter, setEnquiryStatusFilter] = useState<'ALL' | Enquiry['status']>('ALL');
  const [updatingEnquiryId, setUpdatingEnquiryId] = useState<string | null>(null);
  const [deletingEnquiryId, setDeletingEnquiryId] = useState<string | null>(null);
  const [enquiryNotice, setEnquiryNotice] = useState<string | null>(null);
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

  const selectedOrderId = selectedOrder?.orderId;
  const adminUserId = isAdmin ? user?.uid : undefined;
  const orderDialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selectedOrderId || !adminUserId) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    orderDialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedOrder(null); setShowAgreementPrint(false); setShowCorrectionForm(false); setShowCourierForm(false);
      }
      if (event.key !== 'Tab') return;
      const elements = Array.from(orderDialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') ?? []).filter((element) => element.getClientRects().length > 0);
      const first = elements[0], last = elements[elements.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === orderDialogRef.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === orderDialogRef.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, [selectedOrderId, showAgreementPrint, adminUserId]);

  const fetchOrderList = useCallback(async () => {
    setLoadingOrders(true);
    setOrdersError(null);
    try {
      const snap = await getDocs(collection(db, 'orders'));
      const list: Order[] = [];
      snap.forEach((d) => list.push(d.data() as Order));
      // Sort newest first
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(list);
    } catch (err) {
      console.error('Error loading orders:', err);
      setOrdersError('Orders could not be loaded. Please refresh to try again.');
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

  const handleDeleteEnquiry = async (enquiry: Enquiry) => {
    if (!user || !isAdmin || updatingEnquiryId || deletingEnquiryId) return;
    if (!window.confirm(`Delete the enquiry from ${enquiry.name} (${enquiry.enquiryId})? This cannot be undone.`)) return;
    setDeletingEnquiryId(enquiry.enquiryId);
    setEnquiriesError(null);
    setEnquiryNotice(null);
    try {
      await deleteDoc(doc(db, 'enquiries', enquiry.enquiryId));
      setEnquiries((current) => current.filter((item) => item.enquiryId !== enquiry.enquiryId));
      setEnquiryNotice(`Enquiry from ${enquiry.name} deleted.`);
    } catch (error) {
      console.error('Error deleting enquiry:', error);
      setEnquiriesError('Could not delete this enquiry. Please try again.');
    } finally {
      setDeletingEnquiryId(null);
    }
  };

  const handleUpdateEnquiryStatus = async (enquiry: Enquiry, status: Enquiry['status']) => {
    if (status === enquiry.status || updatingEnquiryId || deletingEnquiryId) return;

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

  const loadReferralSettings = useCallback(async () => {
    if (!user) return;
    setLoadingReferralSettings(true);
    setReferralSettingsError(null);
    setReferralSettingsSavedToast(false);
    try {
      const response = await fetch('/api/admin/referrals', { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: 'no-store' });
      const data = await readApiResponse(response);
      if (![data.rewardAmount, data.refereeDiscountAmount].every(value => Number.isSafeInteger(value) && value >= 0 && value <= 100000) ||
          !Number.isSafeInteger(data.rewardedReferrals) || data.rewardedReferrals < 0 ||
          !Number.isSafeInteger(data.totalCreditsIssued) || data.totalCreditsIssued < 0) throw new Error('The referral settings response is invalid. Please refresh.');
      setReferralRewardAmount(String(data.rewardAmount));
      setRefereeDiscountAmount(String(data.refereeDiscountAmount));
      setReferralStats({ rewardedReferrals: data.rewardedReferrals, totalCreditsIssued: data.totalCreditsIssued });
      setReferralSettingsLoaded(true);
    } catch (error) {
      setReferralSettingsLoaded(false);
      setReferralSettingsError(error instanceof Error ? error.message : 'Could not load referral settings.');
    } finally { setLoadingReferralSettings(false); }
  }, [user]);

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
          if (isMounted) await loadReferralSettings();
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
  }, [user, fetchEnquiries, loadReferralSettings]);

  // Live order updates also trigger paid-order milestone notifications.
  useEffect(() => {
    if (!user || !isAdmin) return;
    return onSnapshot(collection(db, 'orders'), snapshot => {
      const list = snapshot.docs.map(order => order.data() as Order);
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(list);
      setOrdersError(null);
      setLoadingOrders(false);
    }, error => {
      console.error('Live order updates failed:', error);
      setOrdersError('Orders could not be updated. Please refresh to try again.');
      setLoadingOrders(false);
    });
  }, [user, isAdmin]);

  // Handle Status Update
  const handleUpdateStatus = async () => {
    if (!selectedOrder || !user) return;
    if (selectedOrder.replacementPendingId || selectedOrder.replacedByOrderId) { alert('This order is on hold for replacement or has already been replaced.'); return; }
    if (newStatus === 'Cancelled' && selectedOrder.payment?.status === 'Paid') {
      if (!window.confirm('Cancel this paid order before preparation and request a refund to its original payment method?')) return;
      setUpdatingStatus(true);
      try {
        const result = await readApiResponse(await fetch('/api/orders/cancel', { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: selectedOrder.orderId, updatedAt: selectedOrder.updatedAt }) }));
        const updated = result.order as Order;
        setSelectedOrder(updated); setOrders(previous => previous.map(order => order.orderId === updated.orderId ? updated : order));
        alert('Order cancelled. The source-payment refund is awaiting admin approval; refunds are unavailable in test mode.');
      } catch (reason) { alert(reason instanceof Error ? reason.message : 'Unable to cancel this order.'); }
      finally { setUpdatingStatus(false); }
      return;
    }
    if (selectedOrder.payment?.status !== 'Paid' && ['Drafting', 'Dispatched', 'Delivered'].includes(newStatus)) {
      alert('Payment must be confirmed before fulfilment.');
      return;
    }
    setUpdatingStatus(true);
    const nowIso = new Date().toISOString();
    const trimmedStatusNote = statusNotes.trim();
    const statusUpdate: {
      status: OrderStatus;
      updatedAt: string;
      notes?: string;
      preparationStartedAt?: string;
    } = {
      status: newStatus,
      updatedAt: nowIso,
    };

    if (['Drafting', 'Dispatched', 'Delivered'].includes(newStatus) || ['Drafting', 'Dispatched', 'Delivered'].includes(selectedOrder.status)) {
      statusUpdate.preparationStartedAt = selectedOrder.preparationStartedAt || nowIso;
    }

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
      ...(statusUpdate.preparationStartedAt ? { preparationStartedAt: statusUpdate.preparationStartedAt } : {}),
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
      const result = await readApiResponse(await fetch('/api/orders/corrections', { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'request', orderId: selectedOrder.orderId, updatedAt: selectedOrder.updatedAt, message: correctionMsg.trim() }) }));
      const updated = result.order as Order;
      setSelectedOrder(updated); setOrders(previous => previous.map(order => order.orderId === updated.orderId ? updated : order));
      setShowCorrectionForm(false); setCorrectionMsg('');
      alert('Correction request sent. The customer can correct and resubmit the same order from My Orders.');
    } catch (reason) { alert(reason instanceof Error ? reason.message : 'Unable to send correction request.'); }
    finally { setUpdatingStatus(false); }
  };

  // Handle Courier Dispatch
  const handleDispatchCourier = async () => {
    if (!selectedOrder || !user || !trackingNumber.trim()) return;
    if (selectedOrder.replacementPendingId || selectedOrder.replacedByOrderId) { alert('This order is on hold for replacement or has already been replaced.'); return; }
    if (selectedOrder.payment?.status !== 'Paid') {
      alert('Payment must be confirmed before dispatch.');
      return;
    }
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
        preparationStartedAt: selectedOrder.preparationStartedAt || nowIso,
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
        preparationStartedAt: selectedOrder.preparationStartedAt || nowIso,
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
    if (!user || pricingInvalid) return;
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

  const validReferralAmounts = [referralRewardAmount, refereeDiscountAmount].every(value => /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) <= 100000);
  const handleSaveReferralSettings = async () => {
    if (!user || referralSaveBusy.current || !referralSettingsLoaded || loadingReferralSettings || !validReferralAmounts) return;
    referralSaveBusy.current = true;
    setSavingReferralSettings(true);
    setReferralSettingsSavedToast(false);
    setReferralSettingsError(null);
    try {
      const response = await fetch('/api/admin/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ rewardAmount: Number(referralRewardAmount), refereeDiscountAmount: Number(refereeDiscountAmount) }),
      });
      await readApiResponse(response);
      setReferralSettingsSavedToast(true);
      setTimeout(() => setReferralSettingsSavedToast(false), 4000);
    } catch (error) {
      setReferralSettingsError(error instanceof Error ? error.message : 'Could not save referral settings.');
    } finally { referralSaveBusy.current = false; setSavingReferralSettings(false); }
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
    if (window.confirm('Reset all pricing rates to default values (₹350 / 400 / 450 / 500 / 200)?')) {
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
    (o) => o.status === 'Under verification'
  ).length;
  const documentsNeededCount = orders.filter((o) => o.status === 'Documents needed').length;
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
            <span className="text-xs font-bold uppercase tracking-wider text-rose-800 bg-rose-100 px-3 py-1 rounded-full">
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
              <p className="text-stone-500 text-xs leading-relaxed">
                Your account is not authorized to access this administrator area.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const navigationGroups = [{ label: 'Daily work', items: [{ id: 'orders' as const, label: 'Agreement Orders', icon: FileText, count: orders.length }, { id: 'custom' as const, label: 'Custom Requests', icon: Printer }, { id: 'enquiries' as const, label: 'Enquiries', icon: MessageSquare, count: enquiries.filter((item) => item.status === 'New').length }] }, { label: 'Business tools & settings', items: [{ id: 'reports' as const, label: 'Reports & Analytics', icon: FileText }, { id: 'pricing' as const, label: 'Pricing', icon: IndianRupee }, { id: 'payments' as const, label: 'Payment Gateway', icon: IndianRupee }, { id: 'referrals' as const, label: 'Referrals', icon: Gift }, { id: 'couriers' as const, label: 'Dispatch & Envelopes', icon: Package }, { id: 'support' as const, label: 'Support Email', icon: Mail }] }, { label: 'Reviews & order requests', items: [{ id: 'reviews' as const, label: 'Customer Reviews', icon: MessageSquare }, { id: 'changes' as const, label: 'Order Change Requests', icon: FileText }, { id: 'refunds' as const, label: 'Cancellation Refunds', icon: RotateCcw }] }];

  return (
    <div className="admin-portal admin-tidy max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6" data-section={activeTab}>
      <AdminMilestone uid={user.uid} paidOrders={orders.filter(order => order.payment?.status === 'Paid').length} ready={!loadingOrders && !ordersError} />
      <header className="admin-hero">
        <div className="admin-hero-copy"><span className="admin-eyebrow"><ShieldCheck aria-hidden="true" className="h-4 w-4" />AgreementPrint Administration</span><h1>Administration</h1><p>Manage agreements, preparation, delivery and customer requests.</p><span className="admin-account"><span aria-hidden="true" /><SupportEmailLink className="rounded-sm hover:underline" /></span></div>
        <div className="admin-hero-actions"><Link href="/" className="admin-website-link"><ExternalLink aria-hidden="true" className="h-4 w-4" />View website</Link>{(activeTab === 'orders' || activeTab === 'enquiries') && <button type="button" onClick={activeTab === 'orders' ? fetchOrderList : fetchEnquiries} disabled={activeTab === 'orders' ? loadingOrders : loadingEnquiries || updatingEnquiryId !== null || deletingEnquiryId !== null} className="admin-refresh"><RefreshCw aria-hidden="true" className={`h-4 w-4 ${(activeTab === 'orders' ? loadingOrders : loadingEnquiries) ? 'animate-spin' : ''}`} />Refresh {activeTab === 'orders' ? 'orders' : 'enquiries'}</button>}</div>
      </header>
      <label className="admin-mobile-section">Admin section<select value={activeTab} onChange={event => setActiveTab(event.target.value as typeof activeTab)}>{navigationGroups.map(group => <optgroup key={group.label} label={group.label}>{group.items.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</optgroup>)}</select></label>
      <nav aria-label="Admin sections" className="admin-navigation">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.25fr]">
          {navigationGroups.map((group) => <div key={group.label} className={group.label === 'Reviews & order requests' ? 'border-t border-stone-200 pt-4 lg:col-span-2' : undefined}><h2 className="admin-nav-heading">{group.label}</h2><div className="admin-nav-items">{group.items.map((item) => <button key={item.id} type="button" data-section={item.id} aria-pressed={activeTab === item.id} onClick={() => setActiveTab(item.id)} className="admin-nav-item"><span className="admin-nav-icon"><item.icon aria-hidden="true" className="h-5 w-5" /></span><span className="admin-nav-label">{item.label}</span>{'count' in item && <span className="admin-nav-count">{item.count}</span>}</button>)}</div></div>)}
        </div>
      </nav>

      <div className="admin-workspace space-y-5">
      {activeTab === 'payments' ? <PaymentGatewaySettings /> : activeTab === 'reports' ? (
        <section className="space-y-5" aria-label="Reports and analytics">
          <header><h2 className="text-2xl font-bold text-stone-900">Reports &amp; Analytics</h2><p className="mt-2 text-sm text-stone-600">Download your business records or view website activity.</p></header>
          <AdminReportDownload />
          <details className="rounded-2xl border border-stone-200 bg-white p-5"><summary className="cursor-pointer text-sm font-semibold text-stone-700">Website visitor activity</summary><div className="mt-5"><AdminVisitorStats /></div></details>
        </section>
      ) : activeTab === 'reviews' ? (
        <section className="space-y-5" aria-label="Customer reviews">
          <header><h2 className="text-2xl font-bold text-stone-900">Customer Reviews</h2><p className="mt-2 text-sm text-stone-600">Review and moderate customer feedback.</p></header>
          <CustomerReviewModeration />

        </section>
      ) : activeTab === 'changes' ? (
        <section className="space-y-5" aria-label="Order change requests">
          <header><h2 className="text-2xl font-bold text-stone-900">Order Change Requests</h2><p className="mt-2 text-sm text-stone-600">Review changes to prepared orders and record related refund adjustments.</p></header>
          <OrderReplacementRequests />
        </section>
      ) : activeTab === 'refunds' ? (
        <section className="space-y-5" aria-label="Cancellation refunds and legacy reconciliation">
          <header><h2 className="text-2xl font-bold text-stone-900">Cancellation Refunds</h2><p className="mt-2 text-sm text-stone-600">Review cancelled-order refunds, check payment gateway status and reconcile legacy records.</p></header>
          <CreditRefundRequests />
        </section>
      ) : activeTab === 'custom' ? <CustomRequests admin /> : activeTab === 'enquiries' ? (
        <section className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5 animate-in fade-in duration-200">
          <div className="border-b border-stone-200 pb-5">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-800 bg-indigo-100 px-2.5 py-0.5 rounded-full">
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

          {enquiryNotice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{enquiryNotice}</p>}
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
                          href={`https://wa.me/${enquiry.phone.replace(/\D/g, '').length === 10 ? '91' : ''}${enquiry.phone.replace(/\D/g, '')}`}
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
                        disabled={updatingEnquiryId !== null || deletingEnquiryId !== null}
                        onChange={(event) => void handleUpdateEnquiryStatus(enquiry, event.target.value as Enquiry['status'])}
                        className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-800 disabled:cursor-wait disabled:opacity-60"
                      >
                        <option value="New">New</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                      </select>
                      <button type="button" onClick={() => void handleDeleteEnquiry(enquiry)} disabled={updatingEnquiryId !== null || deletingEnquiryId !== null} aria-label={`Delete enquiry from ${enquiry.name}`} className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-wait disabled:opacity-50"><Trash2 aria-hidden="true" className="h-4 w-4" />{deletingEnquiryId === enquiry.enquiryId ? 'Deleting...' : 'Delete'}</button>
                      {updatingEnquiryId === enquiry.enquiryId && (
                        <span className="text-xs text-stone-500" role="status">Saving…</span>
                      )}
                      <time className="w-full text-left text-xs text-stone-500 sm:text-right">
                        {new Date(enquiry.createdAt).toLocaleString()}
                      </time>
                    </div>
                  </div>
                  <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-stone-700">
                    {enquiry.message}
                  </p>
                  <p className="mt-3 text-xs font-mono text-stone-400">
                    Reference: {enquiry.enquiryId}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : activeTab === 'referrals' ? (
        <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 animate-in fade-in duration-200">
          <header><p className="text-xs font-bold uppercase tracking-wider text-brand-700">Growth</p><h1 className="mt-1 text-2xl font-bold text-stone-900">Referrals</h1><p className="mt-2 text-sm text-stone-600">Reward the referrer after payment and discount the first order for the new customer.</p></header>
          <nav aria-label="Referral management" className="flex flex-wrap gap-2 border-b border-stone-200 pb-4">
            {([{ id: 'agents', label: 'Agents' }, { id: 'customers', label: 'Customers' }] as const).map(section => <button key={section.id} type="button" aria-current={referralSection === section.id ? 'page' : undefined} onClick={() => setReferralSection(section.id)} className={`min-h-11 rounded-xl px-5 py-2 text-sm font-semibold ${referralSection === section.id ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}>{section.label}</button>)}
          </nav>
          {referralSection === 'customers' && <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-stone-600">Shared rates for customer-generated coupons.</p><button type="button" disabled={savingReferralSettings || loadingReferralSettings} onClick={() => void loadReferralSettings()} className="min-h-11 rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">{loadingReferralSettings ? 'Refreshing...' : 'Refresh settings & totals'}</button></div>
          {loadingReferralSettings && <p role="status" className="text-sm text-stone-600">Loading saved settings and confirmed referral totals...</p>}
          {referralSettingsError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{referralSettingsError}</p>}
          <div className="border-b border-stone-200 pb-5">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-800 bg-purple-100 px-2.5 py-0.5 rounded-full">
              Customers
            </span>
            <h2 className="text-xl font-bold text-stone-900 mt-1">Customer referral rewards</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              The new customer receives a discount on their first order. After successful payment, the customer who referred them earns credits. Set both shared amounts below.
            </p>
          </div>

          {referralSettingsSavedToast && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold" role="status">
              Customer referral credit and first-order discount saved.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Successful customer referrals</p>
              <p className="mt-2 text-2xl font-black text-stone-900">{referralSettingsLoaded && !loadingReferralSettings ? referralStats.rewardedReferrals : '\u2014'}</p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Total customer referrer credits</p>
              <p className="mt-2 text-2xl font-black text-stone-900">{referralSettingsLoaded && !loadingReferralSettings ? `\u20b9${referralStats.totalCreditsIssued.toLocaleString('en-IN')}` : '\u2014'}</p>
            </div>
          </div>

          <p className="text-sm text-stone-600">The totals above count completed first payments. The amounts below are settings for future referrals, not money already issued.</p>
          <form id="customer-referral-settings" onSubmit={event => { event.preventDefault(); void handleSaveReferralSettings(); }}>
            <fieldset disabled={savingReferralSettings || loadingReferralSettings || !referralSettingsLoaded} className="grid gap-5 sm:grid-cols-2">
              <label htmlFor="referral-reward-amount" className="block text-sm font-semibold text-stone-700">Referrer earns in credits (INR)
                <input id="referral-reward-amount" required type="number" min={0} max={100000} step={1} value={referralRewardAmount} onChange={event => { setReferralRewardAmount(event.target.value); setReferralSettingsSavedToast(false); }} aria-describedby="referral-credit-help" className="mt-2 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand-600" />
                <span id="referral-credit-help" className="mt-2 block text-sm font-normal text-stone-600">Added as credits after the new customer pays for their first order. Use 0 to disable new credits.</span>
              </label>
              <label htmlFor="referee-discount-amount" className="block text-sm font-semibold text-stone-700">New customer saves on first order (INR)
                <input id="referee-discount-amount" required type="number" min={0} max={100000} step={1} value={refereeDiscountAmount} onChange={event => { setRefereeDiscountAmount(event.target.value); setReferralSettingsSavedToast(false); }} aria-describedby="referral-discount-help" className="mt-2 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand-600" />
                <span id="referral-discount-help" className="mt-2 block text-sm font-normal text-stone-600">Deducted before payment, up to the order total. Use 0 for no discount. Already-started checkouts keep their reserved price.</span>
              </label>
            </fieldset>
          </form>

          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
            <p><strong className="text-stone-900">How it works:</strong> A customer shares their coupon. A new customer uses it and pays for their first order. The new customer gets the discount on that order. After payment, the customer who shared the code earns account credits.</p>
            <p className="mt-2">Customer codes are managed as one group. Agent referrals have separate amounts in Agents. Each new customer can use the first-order discount only once.</p>
          </div>

          <div className="flex justify-end border-t border-stone-200 pt-5">
            <button
              type="submit"
              form="customer-referral-settings"
              disabled={savingReferralSettings || loadingReferralSettings || !referralSettingsLoaded || !validReferralAmounts}
              className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
            >
              {savingReferralSettings
                ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                : <Save className="h-3.5 w-3.5" />}
              <span>{savingReferralSettings ? 'Saving…' : 'Save customer amounts'}</span>
            </button>
          </div>
          </section>}
          {referralSection === 'agents' && <AgentReferralAdmin />}
        </div>
      ) : activeTab === 'couriers' ? (
        <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="border-b border-stone-200 pb-5">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
              Dispatch Options
            </span>
            <h2 className="text-xl font-bold text-stone-900 mt-1">Dispatch &amp; Envelopes</h2>
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
          <section className="border-t border-stone-200 pt-6"><h3 className="mb-3 text-lg font-bold text-stone-900">Envelope printing</h3><EnvelopePrint /></section>
        </div>
      ) : activeTab === 'support' ? (
        <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="border-b border-stone-200 pb-5">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-800 bg-sky-100 px-2.5 py-0.5 rounded-full">
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
            <p className="text-xs text-stone-500">
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
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                Rate Master
              </span>
              <h2 className="text-xl font-bold text-stone-900 mt-1">
                Official Stamping, Courier & Notary Rates
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Configure stamp-paper packages and notary charges. Updates apply immediately across customer checkout.
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
                disabled={savingPricing || pricingInvalid}
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
            {/* Box 1: ₹100 Stamp Paper Package */}
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                <div>
                  <h3 className="font-bold text-stone-900 text-sm">1. In ₹100 Stamp Paper Package</h3>
                  <p className="text-xs text-stone-500">Standard 11-month tenancy stamp paper with courier charges</p>
                </div>
                <span className="text-xs font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">₹100</span>
              </div>

              <div className="space-y-3">
                <div>
                  <label htmlFor="pricing-stamp100Chennai" className="block text-xs font-bold text-stone-700 mb-1">Chennai - courier included</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-stone-400 text-xs font-bold">₹</span>
                    <input
                      id="pricing-stamp100Chennai"
                      aria-invalid={!!pricingErrors.stamp100Chennai}
                      aria-describedby={pricingErrors.stamp100Chennai ? 'pricing-stamp100Chennai-error' : undefined}
                      type="number"
                      min={PRICING_MINIMUMS.stamp100Chennai}
                      max={MAX_PRICING_AMOUNT}
                      step="1"
                      required
                      value={Number.isFinite(pricingConfig.stamp100Chennai) ? pricingConfig.stamp100Chennai : ''}
                      onChange={(e) =>
                        setPricingConfig({ ...pricingConfig, stamp100Chennai: e.target.valueAsNumber })
                      }
                      className="w-full pl-7 pr-3 py-2 rounded-xl border border-stone-300 text-xs font-bold text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  {pricingErrors.stamp100Chennai && <p id="pricing-stamp100Chennai-error" role="alert" className="mt-1 text-xs text-rose-700">{pricingErrors.stamp100Chennai}</p>}
                  <span className="text-xs text-stone-500">Default: ₹350/-</span>
                </div>

                <div>
                  <label htmlFor="pricing-stamp100TamilNadu" className="block text-xs font-bold text-stone-700 mb-1">Rest of Tamil Nadu - courier included</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-stone-400 text-xs font-bold">₹</span>
                    <input
                      id="pricing-stamp100TamilNadu"
                      aria-invalid={!!pricingErrors.stamp100TamilNadu}
                      aria-describedby={pricingErrors.stamp100TamilNadu ? 'pricing-stamp100TamilNadu-error' : undefined}
                      type="number"
                      min={PRICING_MINIMUMS.stamp100TamilNadu}
                      max={MAX_PRICING_AMOUNT}
                      step="1"
                      required
                      value={Number.isFinite(pricingConfig.stamp100TamilNadu) ? pricingConfig.stamp100TamilNadu : ''}
                      onChange={(e) =>
                        setPricingConfig({ ...pricingConfig, stamp100TamilNadu: e.target.valueAsNumber })
                      }
                      className="w-full pl-7 pr-3 py-2 rounded-xl border border-stone-300 text-xs font-bold text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  {pricingErrors.stamp100TamilNadu && <p id="pricing-stamp100TamilNadu-error" role="alert" className="mt-1 text-xs text-rose-700">{pricingErrors.stamp100TamilNadu}</p>}
                  <span className="text-xs text-stone-500">Default: ₹400/-</span>
                </div>
              </div>
            </div>

            {/* Box 2: ₹200 Stamp Paper Package */}
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                <div>
                  <h3 className="font-bold text-stone-900 text-sm">2. In ₹200 Stamp Paper Package</h3>
                  <p className="text-xs text-stone-500">Higher denomination stamp paper with courier charges</p>
                </div>
                <span className="text-xs font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">₹200</span>
              </div>

              <div className="space-y-3">
                <div>
                  <label htmlFor="pricing-stamp200Chennai" className="block text-xs font-bold text-stone-700 mb-1">Chennai - courier included</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-stone-400 text-xs font-bold">₹</span>
                    <input
                      id="pricing-stamp200Chennai"
                      aria-invalid={!!pricingErrors.stamp200Chennai}
                      aria-describedby={pricingErrors.stamp200Chennai ? 'pricing-stamp200Chennai-error' : undefined}
                      type="number"
                      min={PRICING_MINIMUMS.stamp200Chennai}
                      max={MAX_PRICING_AMOUNT}
                      step="1"
                      required
                      value={Number.isFinite(pricingConfig.stamp200Chennai) ? pricingConfig.stamp200Chennai : ''}
                      onChange={(e) =>
                        setPricingConfig({ ...pricingConfig, stamp200Chennai: e.target.valueAsNumber })
                      }
                      className="w-full pl-7 pr-3 py-2 rounded-xl border border-stone-300 text-xs font-bold text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  {pricingErrors.stamp200Chennai && <p id="pricing-stamp200Chennai-error" role="alert" className="mt-1 text-xs text-rose-700">{pricingErrors.stamp200Chennai}</p>}
                  <span className="text-xs text-stone-500">Default: ₹450/-</span>
                </div>

                <div>
                  <label htmlFor="pricing-stamp200TamilNadu" className="block text-xs font-bold text-stone-700 mb-1">Rest of Tamil Nadu - courier included</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-stone-400 text-xs font-bold">₹</span>
                    <input
                      id="pricing-stamp200TamilNadu"
                      aria-invalid={!!pricingErrors.stamp200TamilNadu}
                      aria-describedby={pricingErrors.stamp200TamilNadu ? 'pricing-stamp200TamilNadu-error' : undefined}
                      type="number"
                      min={PRICING_MINIMUMS.stamp200TamilNadu}
                      max={MAX_PRICING_AMOUNT}
                      step="1"
                      required
                      value={Number.isFinite(pricingConfig.stamp200TamilNadu) ? pricingConfig.stamp200TamilNadu : ''}
                      onChange={(e) =>
                        setPricingConfig({ ...pricingConfig, stamp200TamilNadu: e.target.valueAsNumber })
                      }
                      className="w-full pl-7 pr-3 py-2 rounded-xl border border-stone-300 text-xs font-bold text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  {pricingErrors.stamp200TamilNadu && <p id="pricing-stamp200TamilNadu-error" role="alert" className="mt-1 text-xs text-rose-700">{pricingErrors.stamp200TamilNadu}</p>}
                  <span className="text-xs text-stone-500">Default: ₹500/-</span>
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
                <label htmlFor="pricing-notaryExtraFee" className="block text-xs font-bold text-stone-700 mb-1">Notary attestation additional charge (rupees)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-stone-400 text-xs font-bold">₹</span>
                  <input
                      id="pricing-notaryExtraFee"
                      aria-invalid={!!pricingErrors.notaryExtraFee}
                      aria-describedby={pricingErrors.notaryExtraFee ? 'pricing-notaryExtraFee-error' : undefined}
                    type="number"
                    min={PRICING_MINIMUMS.notaryExtraFee}
                      max={MAX_PRICING_AMOUNT}
                      step="1"
                      required
                    value={Number.isFinite(pricingConfig.notaryExtraFee) ? pricingConfig.notaryExtraFee : ''}
                    onChange={(e) =>
                      setPricingConfig({ ...pricingConfig, notaryExtraFee: e.target.valueAsNumber })
                    }
                    className="w-full pl-7 pr-3 py-2 rounded-xl border border-stone-300 text-xs font-bold text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                  {pricingErrors.notaryExtraFee && <p id="pricing-notaryExtraFee-error" role="alert" className="mt-1 text-xs text-rose-700">{pricingErrors.notaryExtraFee}</p>}
                <span className="text-xs text-stone-500">Default: ₹200/- extra</span>
              </div>
            </div>
          </div>

          {/* Pricing Matrix Preview */}
          <div className="border border-amber-200 bg-amber-50/50 rounded-2xl p-5 space-y-3">
            <h4 className="font-bold text-stone-900 text-xs uppercase tracking-wider text-amber-900">
              Customer Package Matrix (Live Rate Calculator)
            </h4>
            {pricingInvalid ? <p role="status" className="text-sm text-rose-700">Correct the highlighted rates to preview package totals.</p> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-2xs space-y-1">
                <span className="text-stone-500 block">₹100 Paper • Chennai</span>
                <p className="text-base font-black text-stone-900">₹{pricingConfig.stamp100Chennai}/-</p>
                <span className="text-xs text-amber-800 block">With Notary: ₹{pricingConfig.stamp100Chennai + pricingConfig.notaryExtraFee}/-</span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-2xs space-y-1">
                <span className="text-stone-500 block">₹100 Paper • Tamil Nadu</span>
                <p className="text-base font-black text-stone-900">₹{pricingConfig.stamp100TamilNadu}/-</p>
                <span className="text-xs text-amber-800 block">With Notary: ₹{pricingConfig.stamp100TamilNadu + pricingConfig.notaryExtraFee}/-</span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-2xs space-y-1">
                <span className="text-stone-500 block">₹200 Paper • Chennai</span>
                <p className="text-base font-black text-stone-900">₹{pricingConfig.stamp200Chennai}/-</p>
                <span className="text-xs text-amber-800 block">With Notary: ₹{pricingConfig.stamp200Chennai + pricingConfig.notaryExtraFee}/-</span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-2xs space-y-1">
                <span className="text-stone-500 block">₹200 Paper • Tamil Nadu</span>
                <p className="text-base font-black text-stone-900">₹{pricingConfig.stamp200TamilNadu}/-</p>
                <span className="text-xs text-amber-800 block">With Notary: ₹{pricingConfig.stamp200TamilNadu + pricingConfig.notaryExtraFee}/-</span>
              </div>
            </div>
            )}
          </div>
        </div>
      ) : (
        /* ORDERS FULFILLMENT QUEUE VIEW */
        <>
      <header className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-bold tracking-tight text-stone-900">Order desk</h2><p className="mt-1 text-sm text-stone-500">Review active work, payment status and order history.</p></div><span className="rounded-full bg-stone-100 px-3 py-1 text-sm font-semibold text-stone-600">{orders.length} records</span></header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[{ label: 'New orders', status: 'Submitted', count: submittedCount, hint: 'Ready for review', tone: 'sky', icon: FileText }, { label: 'Under review', status: 'Under verification', count: pendingVerificationCount, hint: 'Details being checked', tone: 'violet', icon: ShieldCheck }, { label: 'Waiting for customer', status: 'Documents needed', count: documentsNeededCount, hint: 'Corrections requested', tone: 'amber', icon: Clock }, { label: 'Being prepared', status: 'Drafting', count: draftingCount, hint: 'Preparation and printing', tone: 'pink', icon: Printer }, { label: 'Sent by courier', status: 'Dispatched', count: dispatchedCount, hint: 'On the way to customers', tone: 'teal', icon: Truck }].map((item) => <button key={item.status} type="button" data-tone={item.tone} aria-pressed={statusFilter === item.status} onClick={() => { setStatusFilter(statusFilter === item.status ? 'ALL' : item.status); setSearchQuery(''); }} className="admin-summary-card"><span className="admin-summary-top"><span className="admin-summary-icon"><item.icon aria-hidden="true" className="h-5 w-5" /></span><span className="admin-summary-arrow" aria-hidden="true"><ChevronRight className="h-4 w-4" /></span></span><span className="admin-summary-number">{item.count}</span><span className="admin-summary-label">{item.label}</span><span className="admin-summary-hint">{item.hint}</span></button>)}
      </div>
      {ordersError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{ordersError}<button type="button" onClick={fetchOrderList} className="ml-3 font-semibold underline">Retry</button></div>}


      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label htmlFor="admin-order-search" className="mb-2 block text-sm font-semibold">Search orders</label>
          <div className="relative"><Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            id="admin-order-search"
            placeholder="Search order number, owner, tenant, phone or city"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-300 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
          />
        </div>

        </div>
        <div><label htmlFor="admin-order-status" className="mb-2 block text-sm font-semibold">Status</label>
        <select
          id="admin-order-status"
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
        </select></div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-stone-600"><p aria-live="polite">{loadingOrders ? 'Loading orders...' : `${filteredOrders.length} of ${orders.length} orders shown`}</p>{(searchQuery || statusFilter !== 'ALL') && <button type="button" onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); }} className="rounded-lg border border-stone-300 bg-white px-3 py-2 font-semibold text-stone-700">Clear Filters</button>}</div>
      {/* Order List Table */}
      <div className="bg-white border border-stone-200 rounded-3xl shadow-sm overflow-hidden">
        {loadingOrders ? (
          <div className="py-16 text-center text-xs text-stone-500 space-y-2">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p>Loading application queue...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-16 text-center text-xs text-stone-500">
            {orders.length === 0 ? 'No orders yet. New customer orders will appear here.' : 'No orders match the selected search or filter criteria.'}
          </div>
        ) : (
          <>
          <div className="grid gap-3 p-4 md:hidden">
            {filteredOrders.map(order => <article key={order.orderId} className="space-y-4 rounded-xl border border-stone-200 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold text-stone-500">{order.agreementTerms.agreementType || 'Rental'} agreement</p><h3 className="mt-1 break-all font-mono text-xs font-bold leading-relaxed text-stone-800"><OrderReference reference={order.orderId} /></h3></div><span className="shrink-0 rounded-lg bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-600">{order.replacedByOrderId ? 'Replaced' : order.status}</span></div><div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-stone-500">Owner</p><p className="mt-1 break-words font-semibold">{order.ownerDetails.fullName}</p></div><div><p className="text-xs text-stone-500">Tenant</p><p className="mt-1 break-words font-semibold">{order.tenantDetails.fullName}</p></div><div><p className="text-xs text-stone-500">Property</p><p className="mt-1">{order.propertyDetails.city}</p></div><div><p className="text-xs text-stone-500">Payment</p><p className={`mt-1 font-semibold ${order.payment.status === 'Paid' ? 'text-emerald-700' : 'text-stone-700'}`}>{order.payment.status}{order.payment.amount !== undefined ? ` / ₹${order.payment.amount.toLocaleString('en-IN')}` : ''}</p></div></div><button type="button" aria-label={`Review order ${order.orderId}`} onClick={() => setSelectedOrder(order)} className="min-h-11 w-full rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700">Review Order</button></article>)}
          </div>
          <div className="hidden overflow-x-auto md:block" tabIndex={0} role="region" aria-label="Agreement order table, scroll to see all columns">
            <table className="admin-order-records w-full min-w-[760px] table-fixed text-left text-sm text-stone-700">
              <thead className="border-b border-stone-200 bg-stone-50 text-xs font-semibold text-stone-500"><tr><th scope="col" className="w-[28%] px-5 py-4">Order record</th><th scope="col" className="w-[27%] px-5 py-4">Customer &amp; property</th><th scope="col" className="w-[20%] px-5 py-4">Progress</th><th scope="col" className="w-[15%] px-5 py-4">Payment</th><th scope="col" className="w-[10%] px-4 py-4 text-right"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody className="divide-y divide-stone-100">{filteredOrders.map(ord => <tr key={ord.orderId} className="align-top transition-colors hover:bg-stone-50">
                <td className="px-5 py-5"><p className="text-xs font-semibold text-stone-500">{ord.agreementTerms.agreementType || 'Rental'} agreement</p><p className="mt-1 break-all font-mono text-xs font-semibold leading-relaxed text-stone-800"><OrderReference reference={ord.orderId} /></p><p className="mt-2 text-xs text-stone-500">{new Date(ord.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p></td>
                <td className="px-5 py-5"><p className="break-words font-semibold text-stone-900">{ord.ownerDetails.fullName}</p><p className="mt-1 break-words text-xs text-stone-500">Tenant: {ord.tenantDetails.fullName}</p><p className="mt-3 text-xs text-stone-600">{ord.propertyDetails.city} / {ord.propertyDetails.propertyType}</p></td>
                <td className="px-5 py-5"><span className="inline-flex rounded-lg bg-stone-100 px-2.5 py-1.5 text-xs font-semibold text-stone-700">{ord.replacedByOrderId ? 'Replaced' : ord.status}</span>{ord.correctionStatus === 'Submitted' && <p className="mt-2 text-xs font-semibold text-sky-800">Customer corrections submitted</p>}{ord.replacementPendingId && <p className="mt-2 text-xs font-medium text-amber-800">Replacement on hold</p>}{ord.cancellationRefundStatus && <p className="mt-2 text-xs text-stone-500">Refund: {ord.cancellationRefundStatus}</p>}</td>
                <td className="px-5 py-5"><span className={`inline-flex rounded-lg px-2.5 py-1.5 text-xs font-semibold ${ord.payment.status === 'Paid' ? 'bg-emerald-50 text-emerald-800' : ord.payment.status === 'Failed' ? 'bg-rose-50 text-rose-800' : 'bg-stone-100 text-stone-600'}`}>{ord.payment.status}</span>{ord.payment.amount !== undefined && <p className="mt-2 font-semibold tabular-nums text-stone-800">₹{ord.payment.amount.toLocaleString('en-IN')}</p>}</td>
                <td className="px-4 py-5 text-right"><button type="button" aria-label={`Review order ${ord.orderId}`} onClick={() => setSelectedOrder(ord)} className="min-h-11 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100">Review</button></td>
              </tr>)}</tbody>
            </table>
          </div>
          </>
        )}
      </div>
        </>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div ref={orderDialogRef} role="dialog" aria-modal="true" aria-label={showAgreementPrint ? 'Agreement print preview' : 'Agreement order details'} tabIndex={-1} className={`fixed inset-0 z-[60] bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto ${showAgreementPrint ? 'agreement-print-modal' : ''}`}>
          {showAgreementPrint ? (
            <div className="bg-white rounded-3xl max-w-5xl w-full p-6 sm:p-8 shadow-xl max-h-[95vh] overflow-y-auto space-y-4">
              <RentalAgreementDocument
                blankStampSpace
                data={{
                  ownerDetails: selectedOrder.ownerDetails,
                  tenantDetails: selectedOrder.tenantDetails,
                  propertyDetails: selectedOrder.propertyDetails,
                  agreementTerms: selectedOrder.agreementTerms,
                  orderId: selectedOrder.orderId,
                  createdAt: selectedOrder.createdAt,
                }}
                onBack={() => setShowAgreementPrint(false)}
                title={`${selectedOrder.agreementTerms.agreementType === 'Lease' ? 'Lease' : 'Rental'} Agreement for Stamping (Order #${selectedOrder.orderId})`}
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
                  <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                    Order Management
                  </span>
                  <h2 className="mt-1 break-all font-mono text-base font-bold leading-relaxed text-stone-900"><OrderReference reference={selectedOrder.orderId} /></h2>
                  <p className="text-xs text-stone-500">
                    Customer Email: {selectedOrder.customerEmail} • Created: {new Date(selectedOrder.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAgreementPrint(true)}
                    className="bg-amber-700 hover:bg-amber-800 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                    title="Open agreement formatted for non-judicial stamp paper"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Agreement</span>
                  </button>
                  <button
                    aria-label="Close order details"
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

            {selectedOrder.payment.status === 'Paid' && selectedOrder.status !== 'Cancelled' && !selectedOrder.replacedByOrderId && <EnvelopePrint key={`${selectedOrder.orderId}-${selectedOrder.updatedAt}`} order={selectedOrder} />}
            {/* Application Data Tabs/Sections */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Landlord */}
              <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-1">
                <strong className="block font-bold text-stone-900">Landlord (Owner)</strong>
                <p>Name: {selectedOrder.ownerDetails.fullName}</p>
                <p>{selectedOrder.ownerDetails.relationship || 'Parent / spouse'}: {selectedOrder.ownerDetails.relativeName}</p>
                <p>Age: {selectedOrder.ownerDetails.age} yrs • Phone: {selectedOrder.ownerDetails.phone}</p>
                <p className="font-mono text-emerald-800">Aadhaar Last 4: {maskedAadhaar(selectedOrder.ownerDetails.aadhaarLast4)}</p>
                {selectedOrder.ownerDetails.pan && <p className="font-mono">PAN: {selectedOrder.ownerDetails.pan}</p>}
                <p className="text-stone-500">Address: {selectedOrder.ownerDetails.address}{selectedOrder.ownerDetails.pincode ? ` - ${selectedOrder.ownerDetails.pincode}` : ''}</p>
              </div>

              {/* Tenant */}
              <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-1">
                <strong className="block font-bold text-stone-900">Tenant</strong>
                <p>Name: {selectedOrder.tenantDetails.fullName}</p>
                <p>{selectedOrder.tenantDetails.relationship || 'Parent / spouse'}: {selectedOrder.tenantDetails.relativeName}</p>
                <p>Age: {selectedOrder.tenantDetails.age} yrs • Phone: {selectedOrder.tenantDetails.phone}</p>
                <p className="font-mono text-emerald-800">Aadhaar Last 4: {maskedAadhaar(selectedOrder.tenantDetails.aadhaarLast4)}</p>
                {selectedOrder.tenantDetails.pan && <p className="font-mono">PAN: {selectedOrder.tenantDetails.pan}</p>}
                <p className="text-stone-500">Address: {selectedOrder.tenantDetails.address}{selectedOrder.tenantDetails.pincode ? ` - ${selectedOrder.tenantDetails.pincode}` : ''}</p>
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
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                    Order Total: ₹{(selectedOrder.payment?.totalBeforeCredits ?? selectedOrder.payment?.amount) || (selectedOrder.agreementTerms.stampPaperDenomination === 200 ? (selectedOrder.agreementTerms.deliveryLocation === 'Within Tamil Nadu' ? 500 : 450) : (selectedOrder.agreementTerms.deliveryLocation === 'Within Tamil Nadu' ? 400 : 350)) + (selectedOrder.agreementTerms.includeNotary ? 200 : 0)}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(selectedOrder.payment?.referralCreditApplied ?? 0) > 0 && (
                    <div>Referral credit: <strong>−₹{selectedOrder.payment.referralCreditApplied?.toLocaleString('en-IN')}</strong></div>
                  )}
                  {(selectedOrder.payment?.couponDiscount ?? 0) > 0 && <div className="col-span-2">Coupon ({selectedOrder.payment.couponCode}): <strong>−₹{selectedOrder.payment.couponDiscount?.toLocaleString('en-IN')}</strong></div>}
                  <div>Agreement type: <strong>{selectedOrder.agreementTerms.agreementType || 'Rental'}</strong></div>
                  <div>Rent: <strong>{selectedOrder.agreementTerms.agreementType === 'Lease' ? 'No separate monthly rent' : `₹${selectedOrder.agreementTerms.monthlyRent?.toLocaleString('en-IN')}`}</strong></div>
                  <div>{selectedOrder.agreementTerms.agreementType === 'Lease' ? 'Refundable lease advance' : 'Advance'}: <strong>₹{selectedOrder.agreementTerms.securityDeposit?.toLocaleString('en-IN')}</strong></div>
                  <div>Tenure: <strong>{selectedOrder.agreementTerms.tenureMonths} Months</strong></div>
                  <div>Agreement language: <strong>{selectedOrder.agreementTerms.language || 'English'}</strong></div>
                  {selectedOrder.agreementTerms.agreementType !== 'Lease' && selectedOrder.propertyDetails.propertyType !== 'Commercial Shop' && <div>Painting deduction: <strong>₹{selectedOrder.agreementTerms.paintingDeduction?.toLocaleString('en-IN')}</strong></div>}
                  {selectedOrder.agreementTerms.language === 'Tamil' && selectedOrder.propertyDetails.propertyType === 'Commercial Shop' && <div>Template: <strong>Tamil shop rental agreement</strong></div>}
                  <div>Notice: <strong>{selectedOrder.agreementTerms.noticePeriodDays} Days</strong></div>
                  <div>Stamp Paper: <strong>In ₹{selectedOrder.agreementTerms.stampPaperDenomination || 100} Stamp Paper</strong></div>
                  <div>Courier Delivery: <strong>{selectedOrder.agreementTerms.deliveryLocation || 'Within Chennai'}</strong></div>
                  <div className="col-span-2 sm:col-span-4">
                    Delivery Address:{' '}
                    {selectedOrder.agreementTerms.deliveryRecipient ? (
                      <>
                        <strong>{selectedOrder.agreementTerms.deliveryRecipient}</strong>{' '}
                        {selectedOrder.agreementTerms.deliveryRecipient === 'Owner'
                          ? selectedOrder.ownerDetails.address
                          : selectedOrder.tenantDetails.address}
                    {(selectedOrder.agreementTerms.deliveryRecipient === 'Owner' ? selectedOrder.ownerDetails.pincode : selectedOrder.tenantDetails.pincode) && <> - {selectedOrder.agreementTerms.deliveryRecipient === 'Owner' ? selectedOrder.ownerDetails.pincode : selectedOrder.tenantDetails.pincode}</>}
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
            {selectedOrder.correctionStatus === 'Submitted' && <div className="rounded-xl border border-sky-200 bg-sky-50 p-4"><h3 className="font-bold text-sky-900">Customer corrections submitted</h3><p className="mt-2 text-sm text-sky-800">{selectedOrder.correctionChangedFields?.map(field => field.replaceAll('.', ' / ').replace(/([A-Z])/g, ' $1')).join(', ')}</p><p className="mt-1 text-xs text-sky-700">Review the changes below before continuing preparation.</p></div>}
            <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">Print {1 + (selectedOrder.agreementTerms.extraCopies ?? 0)} copies total ({selectedOrder.agreementTerms.extraCopies ?? 0} extra), each on the selected ₹{selectedOrder.agreementTerms.stampPaperDenomination ?? 100} stamp paper.</p>
            {(selectedOrder.correctionRequestId || selectedOrder.correctionMessage) && <OrderCorrectionHistory orderId={selectedOrder.orderId} updatedAt={selectedOrder.updatedAt} />}
            {selectedOrder.customerClarification && (
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm">
                <h3 className="font-bold text-sky-900">Customer clarification</h3>
                <p className="mt-2 whitespace-pre-wrap break-words text-sky-950">{selectedOrder.customerClarification}</p>
              </div>
            )}
            <div className="border-t border-stone-200 pt-4 space-y-4">
              <h3 className="font-bold text-stone-900 text-xs">Fulfillment Workflow Actions</h3>
              {(selectedOrder.replacementPendingId || selectedOrder.replacedByOrderId) && <p className="text-sm text-amber-800">{selectedOrder.replacedByOrderId ? <>Replaced by <OrderReference reference={selectedOrder.replacedByOrderId} />. This record is retained for history.</> : 'Preparation is on hold until replacement payment is resolved.'}</p>}
              {selectedOrder.payment?.status !== 'Paid' && <p className="text-sm text-amber-800">Payment must be confirmed before drafting, dispatch or delivery.</p>}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="admin-order-status" className="block text-xs font-semibold text-stone-700 mb-1">
                    Transition Order Status
                  </label>
                  <select id="admin-order-status"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as OrderStatus)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs text-stone-900 bg-white"
                  >
                    <option value="Under verification">Under verification</option>
                    {selectedOrder.payment?.status === 'Paid' && <option value="Drafting">Drafting on Stamp Paper</option>}
                    {selectedOrder.payment?.status === 'Paid' && <option value="Delivered">Delivered</option>}
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="admin-order-note" className="block text-xs font-semibold text-stone-700 mb-1">
                    Administrative Note (Logged into audit trail)
                  </label>
                  <input id="admin-order-note"
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
                  disabled={updatingStatus || !!selectedOrder.replacementPendingId || !!selectedOrder.replacedByOrderId || !!selectedOrder.cancellationRefundId}
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
                  disabled={selectedOrder.payment?.status !== 'Paid' || !!selectedOrder.replacementPendingId || !!selectedOrder.replacedByOrderId || !!selectedOrder.cancellationRefundId}
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
                    disabled={updatingStatus || !!selectedOrder.replacementPendingId || !!selectedOrder.replacedByOrderId || !!selectedOrder.cancellationRefundId}
                    onClick={handleSendCorrectionRequest}
                    className="bg-rose-700 hover:bg-rose-800 text-white font-semibold px-4 py-2 rounded-xl text-xs cursor-pointer"
                  >
                    Send Correction Request
                  </button>
                </div>
              )}

              {/* Courier Form */}
              {showCourierForm && selectedOrder.payment?.status === 'Paid' && (
                <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl space-y-3">
                  <h4 className="font-bold text-sky-900 text-xs">Consignment Courier Details</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-sky-900 mb-1">Courier Partner</label>
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
                      <label className="block text-xs font-semibold text-sky-900 mb-1">Tracking Number</label>
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
                    disabled={updatingStatus || !!selectedOrder.replacementPendingId || !!selectedOrder.replacedByOrderId || !!selectedOrder.cancellationRefundId}
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
    </div>
  );
}
