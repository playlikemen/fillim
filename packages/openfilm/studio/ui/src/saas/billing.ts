/* Fillim billing client: plans come from the server, Razorpay Checkout is loaded only when someone pays. */

export type PaidPlanId = 'creator' | 'studio';

export interface BillingPlan {
  id: PaidPlanId;
  name: string;
  amount: number; // paise
  currency: 'INR';
  credits: number;
  days: number;
  blurb: string;
}

export interface BillingConfig {
  enabled: boolean;
  plans: BillingPlan[];
}

interface OrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  plan: PaidPlanId;
  planName: string;
  name: string;
  email: string;
}

interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
  on(event: 'payment.failed', cb: (resp: { error?: { description?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

export const isPaidPlan = (value: unknown): value is PaidPlanId => value === 'creator' || value === 'studio';

export const formatInr = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100);

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  if (!res.ok) throw new Error(data.error || data.message || `Request failed (${res.status}).`);
  return data as T;
}

export async function fetchBillingConfig(): Promise<BillingConfig> {
  try {
    const res = await fetch('/api/saas/billing/config', { cache: 'no-store' });
    if (!res.ok) return { enabled: false, plans: [] };
    return (await res.json()) as BillingConfig;
  } catch {
    return { enabled: false, plans: [] };
  }
}

let checkoutScript: Promise<void> | null = null;
function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  checkoutScript ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      checkoutScript = null;
      reject(new Error('Could not load Razorpay Checkout. Check your connection and try again.'));
    };
    document.head.appendChild(script);
  });
  return checkoutScript;
}

export type CheckoutResult = { status: 'paid' } | { status: 'dismissed' } | { status: 'failed'; message: string };

/** Create the order on the server, open Razorpay Checkout, and verify the signed result on the server. */
export async function payForPlan(plan: PaidPlanId): Promise<CheckoutResult> {
  const [order] = await Promise.all([postJson<OrderResponse>('/api/saas/billing/order', { plan }), loadCheckout()]);
  if (!window.Razorpay) throw new Error('Razorpay Checkout did not load.');
  const Razorpay = window.Razorpay;
  return new Promise<CheckoutResult>((resolve) => {
    let settled = false;
    let lastError = '';
    const done = (result: CheckoutResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const rzp = new Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: 'Fillim',
      description: `${order.planName} pass · 30 days`,
      prefill: { name: order.name, email: order.email },
      theme: { color: '#ca281b' },
      handler: (resp: RazorpaySuccess) => {
        postJson('/api/saas/billing/verify', {
          orderId: resp.razorpay_order_id,
          paymentId: resp.razorpay_payment_id,
          signature: resp.razorpay_signature,
        })
          .then(() => done({ status: 'paid' }))
          .catch((err: unknown) =>
            done({
              status: 'failed',
              message: `Payment went through but we could not confirm it yet (${err instanceof Error ? err.message : 'unknown error'}). Your credits will appear once Razorpay notifies us.`,
            })
          );
      },
      modal: { ondismiss: () => done(lastError ? { status: 'failed', message: lastError } : { status: 'dismissed' }) },
    });
    /* Checkout stays open after a failed attempt so the person can retry; the failure is reported only if they give up */
    rzp.on('payment.failed', (resp) => {
      lastError = resp.error?.description || 'The payment did not go through.';
    });
    rzp.open();
  });
}
