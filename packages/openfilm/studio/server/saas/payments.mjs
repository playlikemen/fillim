// @ts-check
/**
 * Fillim billing over Razorpay (one-time 30-day passes, INR, no auto-renew).
 * Plans live here only: the browser names a plan, never an amount.
 * Orders are created with Razorpay's REST API (Basic auth, no SDK); a payment is granted once, either by the
 * Checkout handler's signed callback (verify) or by Razorpay's webhook, whichever lands first.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ensureSchema, query } from './db.mjs';

/** @typedef {'creator' | 'studio'} PaidPlanId */
/** @typedef {{ id: PaidPlanId, name: string, amount: number, currency: 'INR', credits: number, days: number, blurb: string }} PaidPlan */

/** @type {Record<PaidPlanId, PaidPlan>} */
export const PLANS = {
  creator: { id: 'creator', name: 'Creator', amount: 49900, currency: 'INR', credits: 1000, days: 30, blurb: '1,000 render credits for 30 days' },
  studio: { id: 'studio', name: 'Studio', amount: 149900, currency: 'INR', credits: 5000, days: 30, blurb: '5,000 render credits for 30 days' },
};

const keyId = () => process.env.RAZORPAY_KEY_ID?.trim() || '';
const keySecret = () => process.env.RAZORPAY_KEY_SECRET?.trim() || '';
const webhookSecret = () => process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || '';

export const billingEnabled = () => Boolean(keyId() && keySecret());

/** @param {unknown} id @returns {PaidPlan | null} */
export const planOf = (id) => (typeof id === 'string' && Object.hasOwn(PLANS, id) ? PLANS[/** @type {PaidPlanId} */ (id)] : null);

/** Public view of the plans (what the dashboard lists). */
export const publicPlans = () => Object.values(PLANS).map(({ id, name, amount, currency, credits, days, blurb }) => ({ id, name, amount, currency, credits, days, blurb }));

const ensureBillingSchema = ensureSchema;

/** @param {string} a @param {string} b */
function safeEqualHex(a, b) {
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  return x.length === y.length && timingSafeEqual(x, y);
}

/** @param {string} payload @param {string} secret */
const hmac = (payload, secret) => createHmac('sha256', secret).update(payload).digest('hex');

/**
 * Create a Razorpay order for a signed-in user and remember it.
 * @param {{ id: string, email: string, name?: string | null }} user
 * @param {unknown} planId
 */
export async function createOrder(user, planId) {
  const plan = planOf(planId);
  if (!plan) return { error: 'Unknown plan.', status: 400 };
  if (!billingEnabled()) return { error: 'Billing is not configured.', status: 503 };
  await ensureBillingSchema();
  const receipt = `fl_${user.id.replace(/[^\w]/g, '').slice(0, 20)}_${Date.now().toString(36)}`.slice(0, 40);
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${keyId()}:${keySecret()}`).toString('base64')}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ amount: plan.amount, currency: plan.currency, receipt, notes: { userId: user.id, plan: plan.id } }),
  });
  const body = /** @type {{ id?: string, error?: { description?: string } }} */ (await res.json().catch(() => ({})));
  if (!res.ok || !body.id) return { error: body.error?.description || `Razorpay refused the order (${res.status}).`, status: 502 };
  await query(
    `INSERT INTO saas_payments (user_id, plan, order_id, amount, currency) VALUES ($1, $2, $3, $4, $5)`,
    [user.id, plan.id, body.id, plan.amount, plan.currency]
  );
  return {
    order: {
      orderId: body.id,
      amount: plan.amount,
      currency: plan.currency,
      keyId: keyId(),
      plan: plan.id,
      planName: plan.name,
      name: user.name || '',
      email: user.email,
    },
  };
}

/**
 * Grant a paid order exactly once: the UPDATE … WHERE status <> 'paid' is the lock.
 * @param {string} orderId @param {string} paymentId @param {string | null} [expectUserId] the caller, when known
 * @returns {Promise<{ granted: boolean, plan?: PaidPlan, userId?: string, error?: string }>}
 */
async function grantOrder(orderId, paymentId, expectUserId = null) {
  await ensureBillingSchema();
  const rows = await query(`SELECT user_id, plan, status FROM saas_payments WHERE order_id = $1`, [orderId]);
  const row = rows[0];
  if (!row) return { granted: false, error: 'Unknown order.' };
  if (expectUserId && row.user_id !== expectUserId) return { granted: false, error: 'Unknown order.' };
  const plan = planOf(row.plan);
  if (!plan) return { granted: false, error: 'Unknown plan.' };
  const claimed = await query(
    `UPDATE saas_payments SET status = 'paid', payment_id = $2, paid_at = NOW()
      WHERE order_id = $1 AND status <> 'paid' RETURNING user_id`,
    [orderId, paymentId]
  );
  if (!claimed[0]) return { granted: false, plan, userId: row.user_id }; // already granted
  await query(
    `UPDATE saas_users
        SET plan = $2,
            plan_expires_at = GREATEST(COALESCE(plan_expires_at, NOW()), NOW()) + ($3 || ' days')::interval,
            credits_remaining = credits_remaining + $4,
            updated_at = NOW()
      WHERE id = $1`,
    [row.user_id, plan.id, String(plan.days), plan.credits]
  );
  await query(
    `INSERT INTO saas_usage_events (user_id, project_id, event_type, credits_delta, meta) VALUES ($1, NULL, 'billing.purchase', $2, $3::jsonb)`,
    [row.user_id, plan.credits, JSON.stringify({ plan: plan.id, orderId, paymentId, amount: plan.amount, currency: plan.currency })]
  );
  return { granted: true, plan, userId: row.user_id };
}

/**
 * Checkout's success handler: check Razorpay's signature over `order|payment`, then grant.
 * @param {{ id: string }} user @param {any} body
 */
export async function verifyPayment(user, body) {
  const orderId = typeof body?.orderId === 'string' ? body.orderId : '';
  const paymentId = typeof body?.paymentId === 'string' ? body.paymentId : '';
  const signature = typeof body?.signature === 'string' ? body.signature : '';
  if (!orderId || !paymentId || !signature) return { error: 'Missing payment details.', status: 400 };
  if (!billingEnabled()) return { error: 'Billing is not configured.', status: 503 };
  if (!safeEqualHex(hmac(`${orderId}|${paymentId}`, keySecret()), signature)) return { error: 'Payment signature did not match.', status: 400 };
  const result = await grantOrder(orderId, paymentId, user.id);
  if (result.error) return { error: result.error, status: 404 };
  return { ok: true, granted: result.granted, plan: result.plan?.id };
}

/**
 * Razorpay webhook: raw body signed with the webhook secret. payment.captured and order.paid grant; others are ignored.
 * @param {Buffer} raw @param {string} signature
 */
export async function handleWebhook(raw, signature) {
  const secret = webhookSecret();
  if (!secret) return { error: 'Webhook is not configured.', status: 503 };
  if (!signature || !safeEqualHex(hmac(raw.toString('utf8'), secret), signature)) return { error: 'Bad signature.', status: 400 };
  /** @type {any} */
  let event;
  try { event = JSON.parse(raw.toString('utf8')); } catch { return { error: 'Body is not JSON.', status: 400 }; }
  if (event?.event !== 'payment.captured' && event?.event !== 'order.paid') return { ok: true, ignored: true };
  const payment = event?.payload?.payment?.entity;
  const orderId = payment?.order_id || event?.payload?.order?.entity?.id;
  if (typeof orderId !== 'string' || typeof payment?.id !== 'string') return { ok: true, ignored: true };
  const result = await grantOrder(orderId, payment.id);
  return { ok: true, granted: result.granted };
}

/** Raw request body with a size cap (webhook signatures are over the exact bytes). */
export async function readRaw(/** @type {import('node:http').IncomingMessage} */ req, limit = 1 << 20) {
  let size = 0;
  /** @type {Buffer[]} */
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('request body too large'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
