// Paymob payment provider (Egypt) — Unified Checkout "Intention API".
//
// Flow:
//   1. createIntention()  → POST /v1/intention/  (Bearer SECRET key)
//        returns { client_secret, id }
//   2. Client opens:  {BASE}/unifiedcheckout/?publicKey={PUBLIC}&clientSecret={client_secret}
//   3. Paymob calls our webhook (transaction processed callback) with an `hmac`.
//        We verify it with verifyHmac() before trusting the result.
//
// Everything degrades gracefully: if the keys aren't set, isEnabled() is false
// and the caller falls back to the mock flow. No keys = no crash.
//
// Docs: https://developers.paymob.com/egypt/

const crypto = require('crypto');

const BASE_URL = process.env.PAYMOB_BASE_URL || 'https://accept.paymob.com';
const SECRET_KEY = process.env.PAYMOB_SECRET_KEY || process.env.PAYMOB_API_KEY || '';
const PUBLIC_KEY = process.env.PAYMOB_PUBLIC_KEY || '';
const HMAC_SECRET = process.env.PAYMOB_HMAC_SECRET || '';
const CARD_INTEGRATION_ID = process.env.PAYMOB_CARD_INTEGRATION_ID || '';

const TIMEOUT_MS = 15000;

function isEnabled() {
  return Boolean(SECRET_KEY && PUBLIC_KEY && CARD_INTEGRATION_ID);
}

async function withTimeout(fn, ms = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

// amountEgp: whole EGP (e.g. 250). Paymob works in piastres (cents).
async function createIntention({ amountEgp, reference, billing = {}, items = [] }) {
  if (!isEnabled()) throw new Error('Paymob is not configured');
  const amountCents = Math.round(Number(amountEgp) * 100);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new Error('Invalid payment amount');
  }

  const body = {
    amount: amountCents,
    currency: 'EGP',
    payment_methods: [Number(CARD_INTEGRATION_ID)],
    items:
      items.length > 0
        ? items
        : [{ name: reference || 'Salony', amount: amountCents, description: 'Salony payment', quantity: 1 }],
    billing_data: {
      first_name: billing.firstName || 'Salony',
      last_name: billing.lastName || 'Customer',
      email: billing.email || 'customer@salony.app',
      phone_number: billing.phone || '+201000000000',
      // Paymob requires these keys to be present; "NA" is accepted.
      apartment: 'NA', floor: 'NA', street: 'NA', building: 'NA',
      shipping_method: 'NA', postal_code: 'NA', city: 'NA',
      country: 'EG', state: 'NA',
    },
    extras: { reference: reference || null },
    special_reference: reference || undefined,
  };

  const res = await withTimeout((signal) =>
    fetch(`${BASE_URL}/v1/intention/`, {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Token ${SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  );

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  if (!res.ok || !json) {
    throw new Error(`Paymob intention failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const clientSecret = json.client_secret;
  if (!clientSecret) throw new Error('Paymob intention returned no client_secret');

  return {
    intentionId: json.id,
    clientSecret,
    checkoutUrl: `${BASE_URL}/unifiedcheckout/?publicKey=${encodeURIComponent(PUBLIC_KEY)}&clientSecret=${encodeURIComponent(clientSecret)}`,
    amountCents,
  };
}

// Verify the HMAC on a Paymob transaction callback. Paymob concatenates a fixed,
// ordered set of fields from the transaction object and signs with SHA-512.
// `obj` is the `obj` field of the webhook body (or the flattened query for the
// redirect callback). Returns true only on an exact, constant-time match.
const HMAC_FIELDS = [
  'amount_cents', 'created_at', 'currency', 'error_occured', 'has_parent_transaction',
  'id', 'integration_id', 'is_3d_secure', 'is_auth', 'is_capture', 'is_refunded',
  'is_standalone_payment', 'is_voided', 'order.id', 'owner',
  'source_data.pan', 'source_data.sub_type', 'source_data.type', 'success',
];

function pick(obj, path) {
  return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

function verifyHmac(obj, receivedHmac) {
  if (!HMAC_SECRET || !receivedHmac || !obj) return false;
  const concatenated = HMAC_FIELDS.map((f) => {
    const v = pick(obj, f);
    if (v === true) return 'true';
    if (v === false) return 'false';
    return v == null ? '' : String(v);
  }).join('');
  const computed = crypto.createHmac('sha512', HMAC_SECRET).update(concatenated).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(String(receivedHmac), 'hex'));
  } catch {
    return false;
  }
}

module.exports = { isEnabled, createIntention, verifyHmac, BASE_URL };
