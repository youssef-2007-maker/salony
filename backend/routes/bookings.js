const express = require('express');
const { db } = require('../db');
const { auth } = require('../middleware/auth');
const { paymentsEnabled, requirePayments } = require('../lib/features');
const { isFutureDate } = require('../lib/validate');
const { tierFor, PLUS_DISCOUNT_PCT, REFERRAL_BONUS } = require('./loyalty');

const router = express.Router();

function format(row) {
  return {
    id: row.id,
    salonId: row.salon_id,
    salonName: row.salon_name,
    address: row.salon_address,
    serviceId: row.service_id,
    serviceTitle: row.service_title,
    barberId: row.barber_id,
    barberName: row.barber_name,
    date: row.date,
    time: row.time,
    price: row.price,
    tip: row.tip,
    depositPaid: row.deposit_paid,
    pointsEarned: row.points_earned,
    pointsRedeemed: row.points_redeemed,
    discount: row.discount,
    isAtHome: !!row.is_at_home,
    atHomeAddress: row.at_home_address,
    groupSize: row.group_size,
    paidAt: row.paid_at,
    paidMethod: row.paid_method,
    status: row.status,
    customerName: row.customer_name,
    createdAt: row.created_at,
  };
}

// GET /bookings
router.get('/', auth(), (req, res) => {
  if (req.user.role === 'customer') {
    const rows = db.prepare(`
      SELECT b.*, s.name AS salon_name, s.address AS salon_address
      FROM bookings b JOIN salons s ON s.id = b.salon_id
      WHERE b.customer_id = ?
      ORDER BY b.date DESC, b.time DESC
    `).all(req.user.sub);
    return res.json(rows.map(format));
  }
  const rows = db.prepare(`
    SELECT b.*, s.name AS salon_name, s.address AS salon_address, u.name AS customer_name
    FROM bookings b
    JOIN salons s ON s.id = b.salon_id
    JOIN users u ON u.id = b.customer_id
    LEFT JOIN barbers br ON br.id = b.barber_id
    WHERE s.owner_user_id = ? OR br.user_id = ?
    ORDER BY b.date DESC, b.time DESC
  `).all(req.user.sub, req.user.sub);
  res.json(rows.map(format));
});

// POST /bookings
router.post('/', auth(), (req, res) => {
  if (req.user.role !== 'customer') return res.status(403).json({ error: 'customer only' });
  const {
    salonId, barberId, serviceId, date, time,
    redeemPoints, tip,
    isAtHome, atHomeAddress,
    groupSize,
    payMethod: requestedPayMethod, // 'cash' | 'card' | 'subscription_credit'
  } = req.body || {};
  // Until real payments are live, every booking is paid at the salon.
  const payMethod = paymentsEnabled() ? requestedPayMethod : 'cash';
  if (!salonId || !serviceId || !date || !time) {
    return res.status(400).json({ error: 'salonId, serviceId, date, time required' });
  }
  if (!isFutureDate(date)) {
    return res.status(400).json({ error: 'Pick a valid date that is not in the past.' });
  }
  if (typeof time !== 'string' || time.length > 20) {
    return res.status(400).json({ error: 'Invalid time.' });
  }
  const svc = db.prepare('SELECT * FROM services WHERE id = ? AND salon_id = ?').get(serviceId, salonId);
  if (!svc) return res.status(404).json({ error: 'Service not found' });

  let barber = null;
  if (barberId) {
    barber = db.prepare('SELECT * FROM barbers WHERE id = ? AND salon_id = ?').get(barberId, salonId);
    if (!barber) return res.status(404).json({ error: 'Barber not found' });
  }

  const salon = db.prepare('SELECT * FROM salons WHERE id = ?').get(salonId);
  const me = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.sub);

  const groups = Math.max(1, Math.min(10, parseInt(groupSize || 1, 10)));
  const atHome = !!isAtHome && !!salon.offers_at_home;
  let basePrice = svc.price * groups;
  if (atHome) basePrice += (salon.at_home_fee || 0);

  // Apply discounts: deal, then Salony Plus, then points redemption
  const deal = db.prepare(`SELECT * FROM deals WHERE salon_id = ? AND active = 1
                           AND datetime(starts_at) <= datetime('now')
                           AND datetime(ends_at) >= datetime('now')
                           ORDER BY pct DESC LIMIT 1`).get(salonId);
  let discount = 0;
  if (deal) discount += Math.round(basePrice * (deal.pct / 100));

  let plusApplied = false;
  let freeCutUsed = false;
  if (me.subscription_active && new Date(me.subscription_until) > new Date()) {
    if ((me.subscription_free_cuts || 0) > 0 && groups === 1) {
      // Use free cut credit — wipes out the service price (not extras)
      discount += Math.min(basePrice, svc.price);
      freeCutUsed = true;
    } else {
      discount += Math.round((basePrice - discount) * PLUS_DISCOUNT_PCT);
      plusApplied = true;
    }
  }

  // Points redemption
  const pointsToUse = Math.max(0, Math.min(parseInt(redeemPoints || 0, 10), me.points || 0));
  const maxPointDisc = (basePrice - discount) * 0.5; // never let points cover > 50%
  const rawPtsDisc = pointsToUse * (salon.redeem_value || 1);
  const pointsDiscount = Math.min(maxPointDisc, rawPtsDisc);
  discount += pointsDiscount;
  const pointsRedeemed = pointsDiscount > 0 ? Math.ceil(pointsDiscount / (salon.redeem_value || 1)) : 0;

  const finalPrice = Math.max(0, Math.round(basePrice - discount));

  // Deposit — only when real payments are live; otherwise everything is
  // paid at the salon.
  let depositPaid = 0;
  if (paymentsEnabled() && salon.deposit_required && payMethod !== 'subscription_credit') {
    depositPaid = Math.round(finalPrice * (salon.deposit_pct || 0.25));
  }

  // Points earned with tier multiplier (capped to actually-paid amount)
  const tier = tierFor(me.lifetime_spent || 0);
  const pointsEarned = Math.round(finalPrice * (salon.points_rate || 0.05) * tier.multiplier);

  const tipVal = Math.max(0, parseInt(tip || 0, 10));

  // Create the booking and apply point-redemption / free-cut credit atomically
  // so we can never debit points without a booking, or vice-versa.
  const createBooking = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO bookings (customer_id, salon_id, barber_id, service_id, service_title,
                            barber_name, date, time, price, status,
                            tip, deposit_paid, points_earned, points_redeemed, discount,
                            is_at_home, at_home_address, group_size, paid_method, paid_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'upcoming',
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.sub, salonId, barberId || null, serviceId, svc.title,
      barber ? barber.name : 'Any', date, time, finalPrice,
      tipVal, depositPaid, pointsEarned, pointsRedeemed, Math.round(discount),
      atHome ? 1 : 0, atHomeAddress || null, groups,
      payMethod || 'cash', payMethod && payMethod !== 'cash' ? new Date().toISOString() : null
    );

    if (pointsRedeemed > 0) {
      // Guarded update so a stale balance can't go negative under concurrency.
      const r = db.prepare('UPDATE users SET points = points - ? WHERE id = ? AND points >= ?')
        .run(pointsRedeemed, req.user.sub, pointsRedeemed);
      if (r.changes !== 1) throw new Error('INSUFFICIENT_POINTS');
      db.prepare(`INSERT INTO loyalty_ledger (user_id, salon_id, booking_id, delta, reason, note)
                  VALUES (?, ?, ?, ?, 'redeem', 'Redeemed at booking')`)
                  .run(req.user.sub, salonId, info.lastInsertRowid, -pointsRedeemed);
    }

    if (freeCutUsed) {
      db.prepare('UPDATE users SET subscription_free_cuts = subscription_free_cuts - 1 WHERE id = ? AND subscription_free_cuts > 0')
        .run(req.user.sub);
    }
    return info.lastInsertRowid;
  });

  let bookingId;
  try {
    bookingId = createBooking();
  } catch (e) {
    if (e.message === 'INSUFFICIENT_POINTS') {
      return res.status(409).json({ error: 'Your points balance changed. Please review and try again.' });
    }
    throw e;
  }

  const row = db.prepare(`SELECT b.*, s.name AS salon_name, s.address AS salon_address
                          FROM bookings b JOIN salons s ON s.id = b.salon_id WHERE b.id = ?`)
                .get(bookingId);
  res.json({
    ...format(row),
    discountReasons: {
      deal: deal ? { title: deal.title, pct: deal.pct } : null,
      plusApplied,
      freeCutUsed,
      pointsRedeemed,
      pointsDiscount: Math.round(pointsDiscount),
    },
  });
});

// PATCH /bookings/:id/status
router.patch('/:id/status', auth(), (req, res) => {
  const { status } = req.body || {};
  if (!['upcoming', 'past', 'cancelled', 'declined'].includes(status)) {
    return res.status(400).json({ error: 'invalid status' });
  }
  const row = db.prepare(`SELECT b.*, s.owner_user_id FROM bookings b
                          JOIN salons s ON s.id = b.salon_id WHERE b.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const isOwner = req.user.role === 'barber' && row.owner_user_id === req.user.sub;
  const isCustomer = req.user.role === 'customer' && row.customer_id === req.user.sub;
  if (!isOwner && !isCustomer) return res.status(403).json({ error: 'forbidden' });

  // Only the salon can mark a booking completed ('past') — this is what credits
  // loyalty points and lifetime spend. Letting customers do it would let them
  // farm points/tier on bookings they never paid for. Customers may cancel only.
  if (status === 'past' && !isOwner) {
    return res.status(403).json({ error: 'Only the salon can mark a booking complete.' });
  }
  if (status === 'declined' && !isOwner) {
    return res.status(403).json({ error: 'Only the salon can decline a booking.' });
  }

  const apply = db.transaction(() => {
    db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, row.id);

    // Side effects on completion (idempotent — guarded by row.status !== 'past')
    if (status === 'past' && row.status !== 'past') {
      if (row.points_earned > 0) {
        db.prepare('UPDATE users SET points = points + ? WHERE id = ?')
          .run(row.points_earned, row.customer_id);
        db.prepare(`INSERT INTO loyalty_ledger (user_id, salon_id, booking_id, delta, reason, note)
                    VALUES (?, ?, ?, ?, 'booking', 'Points earned from booking')`)
                    .run(row.customer_id, row.salon_id, row.id, row.points_earned);
      }
      db.prepare('UPDATE users SET lifetime_spent = lifetime_spent + ? WHERE id = ?')
        .run(row.price, row.customer_id);
      const u = db.prepare('SELECT lifetime_spent, referred_by FROM users WHERE id = ?').get(row.customer_id);
      db.prepare('UPDATE users SET tier = ? WHERE id = ?').run(tierFor(u.lifetime_spent).id, row.customer_id);

      if (u.referred_by) {
        const ref = db.prepare(`SELECT * FROM referrals WHERE referrer_id = ? AND referred_id = ?`)
                      .get(u.referred_by, row.customer_id);
        if (ref && ref.status === 'pending') {
          db.prepare(`UPDATE users SET points = points + ? WHERE id IN (?, ?)`)
            .run(REFERRAL_BONUS, u.referred_by, row.customer_id);
          db.prepare(`INSERT INTO loyalty_ledger (user_id, salon_id, booking_id, delta, reason, note)
                      VALUES (?, ?, ?, ?, 'referral', 'Referral reward')`)
                      .run(u.referred_by, row.salon_id, row.id, REFERRAL_BONUS);
          db.prepare(`INSERT INTO loyalty_ledger (user_id, salon_id, booking_id, delta, reason, note)
                      VALUES (?, ?, ?, ?, 'referral', 'Welcome — referred by a friend')`)
                      .run(row.customer_id, row.salon_id, row.id, REFERRAL_BONUS);
          db.prepare(`UPDATE referrals SET status = 'rewarded' WHERE id = ?`).run(ref.id);
        }
      }
    }

    // On cancellation, refund redeemed points (once — guard on previous status).
    if (status === 'cancelled' && row.status !== 'cancelled' && row.points_redeemed > 0) {
      db.prepare('UPDATE users SET points = points + ? WHERE id = ?')
        .run(row.points_redeemed, row.customer_id);
      db.prepare(`INSERT INTO loyalty_ledger (user_id, salon_id, booking_id, delta, reason, note)
                  VALUES (?, ?, ?, ?, 'refund', 'Cancelled booking - points refunded')`)
                  .run(row.customer_id, row.salon_id, row.id, row.points_redeemed);
    }
  });
  apply();

  res.json({ ok: true });
});

// POST /bookings/:id/pay  → mock pay-in-app + tip
router.post('/:id/pay', auth(), requirePayments, (req, res) => {
  const { method, tip } = req.body || {};
  const row = db.prepare('SELECT * FROM bookings WHERE id = ? AND customer_id = ?')
                .get(req.params.id, req.user.sub);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const tipVal = Math.max(0, parseInt(tip || 0, 10));
  db.prepare(`UPDATE bookings SET paid_method = ?, paid_at = datetime('now'), tip = ?
              WHERE id = ?`).run(method || 'card', tipVal, row.id);
  res.json({ ok: true });
});

module.exports = router;
