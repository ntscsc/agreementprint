'use client';

import React, { useState } from 'react';
import { 
  Mail, 
  Send, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  Truck,
  Clock
} from 'lucide-react';
import { SupportEmailLink } from '@/components/SupportEmailLink';

export function ContactClient() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    district: '',
    message: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [enquirySuccess, setEnquirySuccess] = useState<{ id: string; name: string; phone: string } | null>(null);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      errs.name = 'Please enter your full name (minimum 2 characters)';
    }
    const cleanPhone = formData.phone.replace(/[^0-9]/g, '');
    if (!cleanPhone || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      errs.phone = 'Please enter a valid 10-digit Indian mobile number (starts with 6-9)';
    }
    if (!formData.message.trim() || formData.message.trim().length < 5) {
      errs.message = 'Please enter your query (at least 5 characters)';
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          district: formData.district.trim(),
          message: formData.message.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit enquiry. Please try again.');
      }

      setEnquirySuccess({
        id: data.enquiryId,
        name: formData.name.trim(),
        phone: formData.phone.trim(),
      });
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Network error occurred. Please retry.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setEnquirySuccess(null);
    setServerError(null);
    setFormErrors({});
    setFormData({ name: '', phone: '', district: '', message: '' });
  };

  return (
    <div className="space-y-14 py-8 pb-16">
      {/* Header Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-stone-900 text-white rounded-3xl p-8 sm:p-12 border border-stone-800 shadow-sm relative overflow-hidden">
          <div className="max-w-3xl space-y-4">
            <span className="text-xs uppercase tracking-wider font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30">
              Support Desk
            </span>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              Contact Support
            </h1>

            <p className="text-stone-300 text-base sm:text-lg leading-relaxed">
              Have a question about rental agreement drafting, stamp duty, or courier tracking? Send us an inquiry below or reach out via email.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left Column: Support Information */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Help & Support</span>
                <h2 className="text-xl font-bold text-stone-900">How to Reach Us</h2>
              </div>

              <div className="space-y-4 text-xs sm:text-sm text-stone-700">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-50 rounded-xl text-purple-700 shrink-0 mt-0.5">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-stone-900">Email Support</h3>
                    <SupportEmailLink className="text-amber-800 hover:underline font-mono block mt-0.5 font-semibold" />
                    <p className="text-stone-500 text-xs mt-0.5">We respond to email queries within 24 hours.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-emerald-50 rounded-xl text-emerald-700 shrink-0 mt-0.5">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-stone-900">Courier Dispatch</h3>
                    <p className="text-stone-600 mt-0.5">
                      Physical agreements are dispatched with tracking details available in your order status.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-50 rounded-xl text-amber-700 shrink-0 mt-0.5">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-stone-900">Working Hours</h3>
                    <p className="text-stone-600 mt-0.5">Monday to Saturday: 9:30 AM – 6:30 PM</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Quick Enquiry Form */}
          <div className="lg:col-span-7">
            <div className="bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-stone-900">Send an Inquiry</h2>
                <p className="text-xs text-stone-600">Submit your questions and our team will review and respond promptly.</p>
              </div>

              {enquirySuccess ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-3 animate-in fade-in">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-emerald-900 text-base">Inquiry Successfully Recorded</h3>
                  <p className="text-xs text-emerald-800 font-mono">Reference ID: {enquirySuccess.id}</p>
                  <p className="text-xs text-emerald-700 max-w-md mx-auto leading-relaxed">
                    Thank you, <strong>{enquirySuccess.name}</strong>. Your inquiry has been safely saved. Our team will contact you at <strong>{enquirySuccess.phone}</strong> during working hours.
                  </p>
                  <button
                    onClick={handleReset}
                    className="text-xs font-semibold text-emerald-800 hover:underline pt-2 cursor-pointer"
                  >
                    Send another query
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate className="space-y-4">
                  {serverError && (
                    <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start justify-between gap-3" role="alert">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <span>{serverError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleSubmit}
                        className="font-bold underline text-rose-900 shrink-0 hover:text-rose-950 flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Retry</span>
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="contact-name" className="block text-xs font-semibold text-stone-700 mb-1">
                        Your Full Name *
                      </label>
                      <input
                        id="contact-name"
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => {
                          setFormData({ ...formData, name: e.target.value });
                          if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
                        }}
                        aria-invalid={!!formErrors.name}
                        aria-describedby={formErrors.name ? 'contact-name-error' : undefined}
                        placeholder="e.g. S. Ramanathan"
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-xs text-stone-900 focus:outline-none focus:ring-2 ${
                          formErrors.name ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/40' : 'border-stone-300 focus:ring-amber-500 bg-white'
                        }`}
                      />
                      {formErrors.name && (
                        <p id="contact-name-error" className="text-[11px] text-rose-600 mt-1">{formErrors.name}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="contact-phone" className="block text-xs font-semibold text-stone-700 mb-1">
                        Mobile Number *
                      </label>
                      <input
                        id="contact-phone"
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        required
                        value={formData.phone}
                        onChange={(e) => {
                          setFormData({ ...formData, phone: e.target.value.replace(/[^0-9]/g, '') });
                          if (formErrors.phone) setFormErrors({ ...formErrors, phone: '' });
                        }}
                        aria-invalid={!!formErrors.phone}
                        aria-describedby={formErrors.phone ? 'contact-phone-error' : undefined}
                        placeholder="10-digit mobile number"
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-xs text-stone-900 focus:outline-none focus:ring-2 ${
                          formErrors.phone ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/40' : 'border-stone-300 focus:ring-amber-500 bg-white'
                        }`}
                      />
                      {formErrors.phone && (
                        <p id="contact-phone-error" className="text-[11px] text-rose-600 mt-1">{formErrors.phone}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="contact-district" className="block text-xs font-semibold text-stone-700 mb-1">
                      Rental Property District in Tamil Nadu (Optional)
                    </label>
                    <input
                      id="contact-district"
                      type="text"
                      value={formData.district}
                      onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                      placeholder="e.g. Chennai, Madurai, Coimbatore, Salem..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="contact-message" className="block text-xs font-semibold text-stone-700 mb-1">
                      Your Query or Tenancy Details *
                    </label>
                    <textarea
                      id="contact-message"
                      rows={4}
                      required
                      value={formData.message}
                      onChange={(e) => {
                        setFormData({ ...formData, message: e.target.value });
                        if (formErrors.message) setFormErrors({ ...formErrors, message: '' });
                      }}
                      aria-invalid={!!formErrors.message}
                      aria-describedby={formErrors.message ? 'contact-message-error' : undefined}
                      placeholder="Tell us about your rental agreement query..."
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-xs text-stone-900 focus:outline-none focus:ring-2 ${
                        formErrors.message ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/40' : 'border-stone-300 focus:ring-amber-500 bg-white'
                      }`}
                    ></textarea>
                    {formErrors.message && (
                      <p id="contact-message-error" className="text-[11px] text-rose-600 mt-1">{formErrors.message}</p>
                    )}
                  </div>

                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 text-[11px] text-stone-500 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Your contact details are strictly confidential and used solely to address your query.</span>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-stone-900 hover:bg-stone-800 disabled:bg-stone-400 text-white font-semibold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Submitting Inquiry...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Submit Inquiry</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
