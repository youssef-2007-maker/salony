// Loyalty points, tiers, referrals, Salony Plus customer subscription.

const express = require('express');
const { db } = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { requireSubscriptions } = require('../lib/features');

const router = express.Router();

const TIERS = [
  { id: 'bronze', label: 'Bronze', min: 0,    multiplier: 1.0,  color: '#A05A2C' },
  { id: 'silver', label: 'Silver', min: 1000, multiplier: 1.25, color: '#9AA0A6' },
  { id: 'gold',   label: 'Gold',   min: 5000, multiplier: 1.5,  color: '#D4AF37' },
];

const PLUS_PRICE = 99;          // EGP / month
const PLUS_DISCOUNT_PCT = 0.15; // 15% off bookings
const PLUS_FREE_CUTS = 1;       // free cut credit per month
const REFERRAL_BONUS = 50;      // points to each side when first booking completes
const WELCOME_BONUS = 100;      // signup welcome points

function tierFor(lifetimeSpent) {
  let chosen = TIERS[0];
  for (const t of TIERS) if (lifetimeSpent >= t.min) chosen = t;
  return chosen;
}

function recompute(userId) {
  const u = db.prepare('SELECT lifetime_spent FROM users WHERE id = ?').get(userId);
  if (!u) return;
  const t = tierFor(u.lifetime_spent || 0);
  db.prepare('UPDATE users SET tier = ? WHERE id = ?').run(t.id, userId);
}

// GET /loyalty/me  → balance, tier, history, perks
router.get('/me', auth(), (req, res) => {
  const me = db.prepare(`SELECT id, name, email, points, tier, lifetime_spent,
                                referral_code, subscription_active,
                                subscription_until, subscription_free_cuts
                         FROM users WHERE id = ?`).get(req.user.sub);
  if (!me) return res.status(404).json({ error: 'Not found' });
  recompute(me.id);
  const refreshed = db.prepare('SELECT tier FROM users WHERE id = ?').get(me.id);
  me.tier = refreshed.tier;

  const tier = tierFor(me.lifetime_spent || 0);
  const next = TIERS.find((t) => t.min > (me.lifetime_spent || 0));
  const history = db.prepare(`SELECT id, delta, reason, note, created_at, salon_id
                              FROM loyalty_ledger
                              WHERE user_id = ? ORDER BY created_at DESC LIMIT 30`).all(me.id);
  const referralCount = db.prepare('SELECT COUNT(*) AS n FROM referrals WHERE referrer_id = ?').get(me.id).n;

  res.json({
    points: me.points,
    tier,
    nextTier: next ? { ...next, deficit: next.min - (me.lifetime_spent || 0) } : null,
    lifetimeSpent: me.lifetime_spent,
    referralCode: me.referral_code,
    referralCount,
    subscription: {
      active: !!me.subscription_active,
      until: me.subscription_until,
      freeCuts: me.subscription_free_cuts,
      monthlyPrice: PLUS_PRICE,
      discountPct: PLUS_DISCOUNT_PCT,
    },
    history,
  });
});

// GET /loyalty/tiers
router.get('/tiers', (_req, res) => res.json(TIERS));

// POST /loyalty/redeem-quote { salonId, basePrice, points }
// Tells the client what discount X points would buy at this salon.
router.post('/redeem-quote', auth(), (req, res) => {
  const { salonId, basePrice, points } = req.body || {};
  if (!salonId || basePrice == null || points == null) {
    return res.status(400).json({ error: 'salonId, basePrice, points required' });
  }
  const me = db.prepare('SELECT points FROM users WHERE id = ?').get(req.user.sub);
  const salon = db.prepare('SELECT redeem_value FROM salons WHERE id = ?').get(salonId);
  if (!salon) return res.status(404).json({ error: 'Salon not found' });
  const pts = Math.min(Math.max(0, parseInt(points, 10)), me?.points || 0);
  // Don't let redemption exceed 50% of base price
  const maxDiscount = basePrice * 0.5;
  const rawDiscount = pts * salon.redeem_value;
  const discount = Math.min(maxDiscount, rawDiscount);
  const usedPoints = Math.ceil(discount / salon.redeem_value);
  res.json({ discount: Math.round(discount), usedPoints, redeemValue: salon.redeem_value, maxDiscount });
});

// POST /loyalty/subscribe  → Salony Plus (mocked payment)
router.post('/subscribe', auth(), requireRole('customer'), requireSubscriptions, (req, res) => {
  const now = new Date();
  const until = new Date(now.getTime() + 30 * 86400 * 1000).toISOString();
  db.prepare(`UPDATE users SET subscription_active = 1, subscription_until = ?,
                                 subscription_free_cuts = subscription_free_cuts + ?
              WHERE id = ?`).run(until, PLUS_FREE_CUTS, req.user.sub);
  res.json({ ok: true, until, freeCutsAdded: PLUS_FREE_CUTS, price: PLUS_PRICE });
});

router.post('/unsubscribe', auth(), requireRole('customer'), (req, res) => {
  db.prepare(`UPDATE users SET subscription_active = 0 WHERE id = ?`).run(req.user.sub);
  res.json({ ok: true });
});

// POST /loyalty/apply-referral  { code }
router.post('/apply-referral', auth(), requireRole('customer'), (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'code required' });
  const me = db.prepare('SELECT referred_by FROM users WHERE id = ?').get(req.user.sub);
  if (me.referred_by) return res.status(400).json({ error: 'Already referred' });
  const ref = db.prepare('SELECT id FROM users WHERE referral_code = ?').get(code);
  if (!ref) return res.status(404).json({ error: 'Code not found' });
  if (ref.id === req.user.sub) return res.status(400).json({ error: "Can't refer yourself" });
  db.prepare('UPDATE users SET referred_by = ? WHERE id = ?').run(ref.id, req.user.sub);
  db.prepare(`INSERT INTO referrals (referrer_id, referred_id) VALUES (?, ?)`).run(ref.id, req.user.sub);
  res.json({ ok: true, message: 'Applied. Both of you get 50 points when your first booking completes.' });
});

module.exports = router;
module.exports.TIERS = TIERS;
module.exports.PLUS_DISCOUNT_PCT = PLUS_DISCOUNT_PCT;
module.exports.WELCOME_BONUS = WELCOME_BONUS;
module.exports.REFERRAL_BONUS = REFERRAL_BONUS;
module.exports.tierFor = tierFor;
