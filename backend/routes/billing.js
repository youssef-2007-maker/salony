// Premium plans + boost (marketing) + business analytics for barbers.
// Payment is mocked — in production this would call Stripe / Paymob and
// flip the row after a webhook.

const express = require('express');
const { db } = require('../db');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

const PLANS = {
  free:    { id: 'free',    label: 'Free',    priceMonthly: 0,   verified: false, boostDays: 0,  featured: false },
  pro:     { id: 'pro',     label: 'Pro',     priceMonthly: 149, verified: true,  boostDays: 3,  featured: false },
  premium: { id: 'premium', label: 'Premium', priceMonthly: 399, verified: true,  boostDays: 14, featured: true  },
};

const BOOST_DAY_PRICE = 50; // EGP per day for à-la-carte boosts

function mySalon(userId) {
  return db.prepare('SELECT * FROM salons WHERE owner_user_id = ?').get(userId);
}

function addDays(base, days) {
  const d = base ? new Date(base) : new Date();
  if (d < new Date()) d.setTime(Date.now()); // never extend a past expiry
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// --- Public ---

router.get('/plans', (_req, res) => {
  res.json(Object.values(PLANS).map((p) => ({
    ...p,
    description: descriptionFor(p),
  })));
});

function descriptionFor(p) {
  switch (p.id) {
    case 'free':
      return 'Standard listing. Show up in search and category results.';
    case 'pro':
      return 'Verified badge, full business analytics, and one 3-day boost per month.';
    case 'premium':
      return 'Everything in Pro, plus a "Featured this week" slot and 14 days of boost per month.';
    default:
      return '';
  }
}

// --- Subscribe (mocked payment) ---

router.post('/subscribe', auth(), requireRole('barber'), (req, res) => {
  const { plan } = req.body || {};
  if (!PLANS[plan]) return res.status(400).json({ error: 'Unknown plan' });

  const salon = mySalon(req.user.sub);
  if (!salon) return res.status(400).json({ error: 'Create a salon first.' });

  const p = PLANS[plan];
  const planUntil = plan === 'free'
    ? null
    : addDays(salon.plan_until, 30);
  const boostUntil = p.boostDays > 0
    ? addDays(salon.boost_until, p.boostDays)
    : salon.boost_until;
  const featuredUntil = p.featured
    ? addDays(salon.featured_until, 30)
    : salon.featured_until;

  db.prepare(`
    UPDATE salons
       SET plan = ?, plan_until = ?, boost_until = ?, featured_until = ?,
           is_verified = ?
     WHERE id = ?
  `).run(
    plan,
    planUntil,
    boostUntil,
    featuredUntil,
    p.verified ? 1 : 0,
    salon.id
  );

  db.prepare(`
    INSERT INTO promotions (salon_id, kind, plan, days, amount)
    VALUES (?, 'subscribe', ?, 30, ?)
  `).run(salon.id, plan, p.priceMonthly);

  res.json({ ok: true, plan, planUntil, boostUntil, featuredUntil });
});

// --- Boost (à la carte) ---

router.post('/boost', auth(), requireRole('barber'), (req, res) => {
  const days = Math.max(1, Math.min(30, parseInt(req.body?.days || 3, 10)));
  const salon = mySalon(req.user.sub);
  if (!salon) return res.status(400).json({ error: 'Create a salon first.' });

  const boostUntil = addDays(salon.boost_until, days);
  const amount = days * BOOST_DAY_PRICE;

  db.prepare('UPDATE salons SET boost_until = ? WHERE id = ?').run(boostUntil, salon.id);
  db.prepare(`
    INSERT INTO promotions (salon_id, kind, days, amount)
    VALUES (?, 'boost', ?, ?)
  `).run(salon.id, days, amount);

  res.json({ ok: true, boostUntil, amount, pricePerDay: BOOST_DAY_PRICE });
});

// --- Analytics ---

router.get('/analytics', auth(), requireRole('barber'), (req, res) => {
  const salon = mySalon(req.user.sub);
  if (!salon) return res.json(empty());

  // Range: 'month' (default) | 'quarter' | 'year'
  const range = ['month', 'quarter', 'year'].includes(req.query.range)
    ? req.query.range
    : 'month';
  const days = range === 'year' ? 365 : range === 'quarter' ? 90 : 30;
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString().slice(0, 10);

  // Previous-period for trend %
  const prevSince = new Date();
  prevSince.setDate(prevSince.getDate() - days * 2);
  const prevSinceIso = prevSince.toISOString().slice(0, 10);

  const completedFilter = `(status = 'past' OR (status = 'upcoming' AND date <= date('now')))`;

  const periodRow = db.prepare(`
    SELECT
      COUNT(*)                 AS bookings,
      COALESCE(SUM(price), 0)  AS revenue,
      COUNT(DISTINCT customer_id) AS clients
    FROM bookings
    WHERE salon_id = ? AND date >= ? AND ${completedFilter}
  `).get(salon.id, sinceIso);

  const prevRow = db.prepare(`
    SELECT
      COUNT(*)                AS bookings,
      COALESCE(SUM(price),0)  AS revenue,
      COUNT(DISTINCT customer_id) AS clients
    FROM bookings
    WHERE salon_id = ? AND date >= ? AND date < ? AND ${completedFilter}
  `).get(salon.id, prevSinceIso, sinceIso);

  const upcomingRow = db.prepare(`
    SELECT COUNT(*) AS bookings, COALESCE(SUM(price),0) AS revenue
    FROM bookings
    WHERE salon_id = ? AND status = 'upcoming' AND date >= date('now')
  `).get(salon.id);

  // Monthly revenue series — last 6 months
  const months = db.prepare(`
    SELECT substr(date, 1, 7)    AS month,
           COUNT(*)                AS bookings,
           COALESCE(SUM(price),0)  AS revenue
    FROM bookings
    WHERE salon_id = ?
      AND date >= date('now', '-6 months')
      AND ${completedFilter}
    GROUP BY month
    ORDER BY month
  `).all(salon.id);

  // Top services
  const topServices = db.prepare(`
    SELECT service_title AS title,
           COUNT(*)       AS bookings,
           COALESCE(SUM(price),0) AS revenue
    FROM bookings
    WHERE salon_id = ? AND date >= ? AND ${completedFilter}
    GROUP BY service_title
    ORDER BY bookings DESC
    LIMIT 5
  `).all(salon.id, sinceIso);

  // Repeat clients in the period
  const clientRepeats = db.prepare(`
    SELECT customer_id, COUNT(*) AS n
    FROM bookings
    WHERE salon_id = ? AND date >= ? AND ${completedFilter}
    GROUP BY customer_id
  `).all(salon.id, sinceIso);
  const repeatClients = clientRepeats.filter((r) => r.n > 1).length;
  const retention = clientRepeats.length
    ? Math.round((repeatClients / clientRepeats.length) * 100)
    : 0;

  // Commission model — Salony charges nothing on plan 'premium', 5% on 'pro', 8% on 'free'.
  const commissionPct =
    salon.plan === 'premium' ? 0 : salon.plan === 'pro' ? 0.05 : 0.08;
  const commission = Math.round(periodRow.revenue * commissionPct);
  const netProfit = periodRow.revenue - commission;

  res.json({
    range,
    plan: salon.plan,
    commissionPct,
    period: {
      revenue: periodRow.revenue,
      commission,
      netProfit,
      bookings: periodRow.bookings,
      clients: periodRow.clients,
      repeatClients,
      retentionPct: retention,
    },
    previous: {
      revenue: prevRow.revenue,
      bookings: prevRow.bookings,
      clients: prevRow.clients,
    },
    trends: {
      revenuePct: pct(prevRow.revenue, periodRow.revenue),
      bookingsPct: pct(prevRow.bookings, periodRow.bookings),
      clientsPct: pct(prevRow.clients, periodRow.clients),
    },
    upcoming: upcomingRow,
    months,
    topServices,
    insights: buildInsights({
      plan: salon.plan,
      bookings: periodRow.bookings,
      retention,
      isFeatured: !expired(salon.featured_until),
      isBoosted: !expired(salon.boost_until),
    }),
  });
});

function pct(prev, cur) {
  if (!prev && !cur) return 0;
  if (!prev) return 100;
  return Math.round(((cur - prev) / prev) * 100);
}

function expired(iso) {
  if (!iso) return true;
  return new Date(iso).getTime() < Date.now();
}

function empty() {
  return {
    range: 'month',
    plan: 'free',
    commissionPct: 0.08,
    period: { revenue: 0, commission: 0, netProfit: 0, bookings: 0, clients: 0, repeatClients: 0, retentionPct: 0 },
    previous: { revenue: 0, bookings: 0, clients: 0 },
    trends: { revenuePct: 0, bookingsPct: 0, clientsPct: 0 },
    upcoming: { bookings: 0, revenue: 0 },
    months: [],
    topServices: [],
    insights: ['Create your salon to start collecting bookings and analytics.'],
  };
}

function buildInsights({ plan, bookings, retention, isFeatured, isBoosted }) {
  const out = [];
  if (plan === 'free') {
    out.push('Upgrade to Pro to unlock full analytics, a verified badge, and a free monthly boost.');
  }
  if (bookings === 0) {
    out.push('No completed bookings yet — try boosting your salon to attract first-time clients.');
  } else if (bookings < 5) {
    out.push('Slow start this period — promotions on weekends typically lift bookings by 30–50%.');
  }
  if (retention >= 40) {
    out.push(`Great client retention (${retention}%) — your regulars love you. Ask them to leave reviews.`);
  } else if (bookings > 5 && retention < 20) {
    out.push('Low retention — consider a loyalty offer (every 5th cut free) to bring clients back.');
  }
  if (!isBoosted && plan !== 'premium') {
    out.push('You\'re not currently boosted. Boosting puts you at the top of "Recommended near you" for nearby customers.');
  }
  if (isFeatured) out.push('You\'re in this week\'s Featured slot — expect a surge in profile visits.');
  return out;
}

// --- Recent activity (promotions log) ---

router.get('/promotions', auth(), requireRole('barber'), (req, res) => {
  const salon = mySalon(req.user.sub);
  if (!salon) return res.json([]);
  res.json(
    db.prepare(
      `SELECT * FROM promotions WHERE salon_id = ? ORDER BY created_at DESC LIMIT 20`
    ).all(salon.id)
  );
});

module.exports = router;
module.exports.PLANS = PLANS;
