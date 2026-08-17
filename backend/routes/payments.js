// Payments — Paymob Unified Checkout, with graceful mock fallback.
//
//   POST /payments/intention   (auth)  { refType:'booking'|'order', refId }
//        → { enabled:true, checkoutUrl, reference }   when Paymob is configured
//        → { enabled:false, mock:true }               otherwise (client mocks)
//   POST /payments/webhook              ← Paymob transaction callback (HMAC verified)
//   GET  /payments/status?reference=   (auth)  → { status }
//
// IMPORTANT (store policy): use this for real-world SERVICES (bookings) and
// PHYSICAL GOODS (marketplace orders) only. Digital subscriptions (Salony Plus,
// Pro/Premium plans, boosts) must use Apple In-App Purchase / Google Play
// Billing on mobile — see RELEASE/AUDIT notes.

const crypto = require('crypto');
const express = require('express');
const { db } = require('../db');
const { auth } = require('../middleware/auth');
const paymob = require('../payments/paymob');

const router = express.Router();

function newReference(refType, refId) {
  return `salony-${refType}-${refId}-${crypto.randomBytes(4).toString('hex')}`;
}

// Compute the amount due server-side. Never trust a client-supplied amount.
function amountDue(refType, refId, userId) {
  if (refType === 'booking') {
    const b = db.prepare('SELECT * FROM bookings WHERE id = ? AND customer_id = ?').get(refId, userId);
    if (!b) return null;
    if (b.paid_at) return { error: 'Already paid' };
    const due = Math.max(0, (b.price || 0) + (b.tip || 0) - (b.deposit_paid || 0));
    return { amountEgp: due, row: b };
  }
  if (refType === 'order') {
    const o = db.prepare('SELECT * FROM orders WHERE id = ? AND customer_id = ?').get(refId, userId);
    if (!o) return null;
    return { amountEgp: o.total || 0, row: o };
  }
  return null;
}

router.post('/intention', auth(), (req, res) => {
  const { refType, refId } = req.body || {};
  if (!['booking', 'order'].includes(refType) || refId == null) {
    return res.status(400).json({ error: 'refType (booking|order) and refId required' });
  }

  const calc = amountDue(refType, String(refId), req.user.sub);
  if (!calc) return res.status(404).json({ error: 'Item not found' });
  if (calc.error) return res.status(409).json({ error: calc.error });
  if (calc.amountEgp <= 0) return res.status(400).json({ error: 'Nothing to pay.' });

  if (!paymob.isEnabled()) {
    return res.json({ enabled: false, mock: true, amountEgp: calc.amountEgp });
  }

  const reference = newReference(refType, refId);
  db.prepare(`INSERT INTO payments (reference, ref_type, ref_id, user_id, amount_cents, status)
              VALUES (?, ?, ?, ?, ?, 'pending')`)
    .run(reference, refType, String(refId), req.user.sub, Math.round(calc.amountEgp * 100));

  const me = db.prepare('SELECT name, email, phone FROM users WHERE id = ?').get(req.user.sub) || {};
  const [firstName, ...rest] = String(me.name || 'Salony Customer').split(' ');

  paymob
    .createIntention({
      amountEgp: calc.amountEgp,
      reference,
      billing: { firstName, lastName: rest.join(' ') || 'Customer', email: me.email, phone: me.phone },
    })
    .then((out) => {
      db.prepare('UPDATE payments SET intention_id = ? WHERE reference = ?').run(String(out.intentionId), reference);
      res.json({ enabled: true, checkoutUrl: out.checkoutUrl, reference, amountEgp: calc.amountEgp });
    })
    .catch((e) => {
      db.prepare("UPDATE payments SET status = 'failed' WHERE reference = ?").run(reference);
      res.status(502).json({ error: `Payment provider error: ${e.message}` });
    });
});

// Paymob transaction callback. Public, but every payload is HMAC-verified.
router.post('/webhook', (req, res) => {
  const receivedHmac = req.query.hmac || req.body?.hmac;
  const obj = req.body?.obj || req.body;
  if (!paymob.verifyHmac(obj, receivedHmac)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const success = obj.success === true || obj.success === 'true';
  const reference = obj?.order?.merchant_order_id || obj?.payment_key_claims?.extra?.reference ||
    obj?.order?.merchant_order_id || req.body?.special_reference;

  const payment = reference
    ? db.prepare('SELECT * FROM payments WHERE reference = ?').get(reference)
    : null;

  // Always 200 so Paymob stops retrying; we just record what we can.
  if (!payment) return res.json({ ok: true, matched: false });
  if (payment.status === 'paid') return res.json({ ok: true, alreadyPaid: true });

  const finalize = db.transaction(() => {
    if (success) {
      db.prepare(`UPDATE payments SET status='paid', paid_at=datetime('now'), provider_txn_id=? WHERE id=?`)
        .run(String(obj.id || ''), payment.id);
      if (payment.ref_type === 'booking') {
        db.prepare(`UPDATE bookings SET paid_at=datetime('now'), paid_method='card' WHERE id=?`)
          .run(payment.ref_id);
      } else if (payment.ref_type === 'order') {
        db.prepare(`UPDATE orders SET status='paid' WHERE id=?`).run(payment.ref_id);
      }
    } else {
      db.prepare(`UPDATE payments SET status='failed' WHERE id=?`).run(payment.id);
    }
  });
  finalize();

  res.json({ ok: true, status: success ? 'paid' : 'failed' });
});

router.get('/status', auth(), (req, res) => {
  const { reference } = req.query;
  if (!reference) return res.status(400).json({ error: 'reference required' });
  const p = db.prepare('SELECT status, ref_type, ref_id FROM payments WHERE reference = ? AND user_id = ?')
    .get(reference, req.user.sub);
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json({ status: p.status, refType: p.ref_type, refId: p.ref_id });
});

module.exports = router;
