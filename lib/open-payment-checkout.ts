'use client';

import { readApiResponse } from '@/lib/api-response';

type CheckoutConstructor = new (options: Record<string, unknown>) => { open: () => void };
let sdkLoading: Promise<void> | undefined;

function loadCheckout() {
  const browser = window as unknown as { Razorpay?: CheckoutConstructor };
  if (browser.Razorpay) return Promise.resolve();
  if (!sdkLoading) sdkLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => { script.remove(); reject(new Error('Secure payment took too long to load. Please retry.')); }, 15000);
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => { clearTimeout(timer); resolve(); };
    script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('Could not load secure payment. Please retry.')); };
    document.head.appendChild(script);
  }).catch(error => { sdkLoading = undefined; throw error; });
  return sdkLoading;
}

/** Open Razorpay in place; other gateways retain their hosted redirects. */
export async function openPaymentCheckout(redirectUrl: string) {
  const url = new URL(redirectUrl, window.location.origin);
  if (url.origin !== window.location.origin || url.pathname !== '/payment/razorpay/checkout') {
    window.location.assign(redirectUrl);
    return;
  }
  const attempt = url.searchParams.get('attempt');
  if (!attempt) throw new Error('Payment reference is missing. Please retry.');
  const { auth } = await import('@/lib/firebase');
  const request = async (action: string, fields = {}) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Sign in with the account used for this order.');
    return readApiResponse(await fetch('/api/payment/razorpay/checkout', {
      method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...fields, attempt, action }),
    }));
  };
  await loadCheckout();
  const options = await request('options');
  if (options.paid) { window.location.assign(options.returnUrl); return; }
  const Razorpay = (window as unknown as { Razorpay: CheckoutConstructor }).Razorpay;
  if (!Razorpay) throw new Error('Could not load secure payment. Please retry.');
  await new Promise<void>((resolve, reject) => {
    let settling = false;
    const finish = async (action: string, fields = {}) => {
      if (settling) return;
      settling = true;
      try {
        const result = await request(action, fields);
        if (action === 'verify' && !result.paid) throw new Error('Payment confirmation is pending. Check payment status before retrying.');
        window.location.assign(result.returnUrl);
        resolve();
      } catch (error) { reject(error); }
    };
    const checkout = new Razorpay({ key: options.key, order_id: options.razorpayOrderId, amount: options.amount,
      currency: options.currency, name: 'AgreementPrint', description: 'Agreement order',
      handler: (fields: Record<string, unknown>) => { void finish('verify', fields); },
      modal: { ondismiss: () => { void finish('dismiss'); } },
    });
    checkout.open();
  });
}
