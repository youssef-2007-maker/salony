const express = require('express');
const { db } = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Great-circle distance in km
function haversine(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function isActive(iso) {
  return !!iso && new Date(iso).getTime() > Date.now();
}

function activeDeal(salonId) {
  return db.prepare(`SELECT id, title, pct, ends_at FROM deals
                     WHERE salon_id = ? AND active = 1
                       AND datetime(starts_at) <= datetime('now')
                       AND datetime(ends_at) >= datetime('now')
                     ORDER BY pct DESC LIMIT 1`).get(salonId);
}

function decorate(salon, lat, lng) {
  const tags = JSON.parse(salon.tags || '[]');
  const distanceKm =
    lat != null && lng != null
      ? Number(haversine(lat, lng, salon.lat, salon.lng).toFixed(1))
      : null;
  const deal = activeDeal(salon.id);
  return {
    id: salon.id,
    name: salon.name,
    category: salon.category,
    address: salon.address,
    lat: salon.lat,
    lng: salon.lng,
    rating: salon.rating,
    reviewCount: salon.review_count,
    priceLabel: salon.price_label,
    tags,
    hours: salon.hours,
    about: salon.about,
    distanceKm,
    plan: salon.plan || 'free',
    isVerified: !!salon.is_verified,
    isBoosted: isActive(salon.boost_until),
    isFeatured: isActive(salon.featured_until),
    handle: salon.handle,
    pointsRate: salon.points_rate,
    redeemValue: salon.redeem_value,
    depositRequired: !!salon.deposit_required,
    depositPct: salon.deposit_pct,
    offersAtHome: !!salon.offers_at_home,
    atHomeFee: salon.at_home_fee,
    deal: deal ? { id: deal.id, title: deal.title, pct: deal.pct } : null,
  };
}

// GET /salons?lat=&lng=&q=&category=
router.get('/', (req, res) => {
  const { lat, lng, q, category } = req.query;
  const userLat = lat ? parseFloat(lat) : null;
  const userLng = lng ? parseFloat(lng) : null;

  let rows = db.prepare('SELECT * FROM salons').all();

  if (q) {
    const needle = String(q).toLowerCase();
    rows = rows.filter(
      (s) =>
        s.name.toLowerCase().includes(needle) ||
        s.address.toLowerCase().includes(needle) ||
        s.category.toLowerCase().includes(needle)
    );
  }
  if (category) {
    rows = rows.filter((s) => s.category.toLowerCase() === String(category).toLowerCase());
  }

  let salons = rows.map((r) => decorate(r, userLat, userLng));
  if (userLat != null && userLng != null) {
    salons.sort((a, b) => a.distanceKm - b.distanceKm);
  } else {
    salons.sort((a, b) => b.rating - a.rating);
  }
  // Cap the payload. With a large salon table this prevents a single request
  // from serialising the entire DB. Clients paginate via limit/offset.
  const limit = Math.min(parseInt(req.query.limit || '50', 10) || 50, 100);
  const offset = Math.max(parseInt(req.query.offset || '0', 10) || 0, 0);
  res.json(salons.slice(offset, offset + limit));
});

// Score that powers Recommended ordering. Boosted/premium get a big lift but
// distance + rating still matter, so a boosted salon 50km away can't beat a
// great salon next door.
function score(s) {
  let v = (s.rating || 0) * 2;
  if (s.distanceKm != null) v -= Math.min(s.distanceKm, 30) * 0.1;
  if (s.isBoosted) v += 5;
  if (s.plan === 'premium') v += 2;
  else if (s.plan === 'pro') v += 1;
  if (s.isVerified) v += 0.5;
  return v;
}

// GET /salons/recommended?lat=&lng=&limit=
router.get('/recommended', (req, res) => {
  const { lat, lng } = req.query;
  const userLat = lat ? parseFloat(lat) : null;
  const userLng = lng ? parseFloat(lng) : null;
  const limit = Math.min(parseInt(req.query.limit || '6', 10), 20);

  const rows = db.prepare('SELECT * FROM salons').all();
  let salons = rows.map((r) => decorate(r, userLat, userLng));
  salons.sort((a, b) => score(b) - score(a));
  res.json(salons.slice(0, limit));
});

// GET /salons/featured?limit=  — only currently-featured premium salons
router.get('/featured', (req, res) => {
  const { lat, lng } = req.query;
  const userLat = lat ? parseFloat(lat) : null;
  const userLng = lng ? parseFloat(lng) : null;
  const limit = Math.min(parseInt(req.query.limit || '6', 10), 20);
  const rows = db
    .prepare("SELECT * FROM salons WHERE featured_until IS NOT NULL AND featured_until > datetime('now')")
    .all();
  const salons = rows.map((r) => decorate(r, userLat, userLng));
  salons.sort((a, b) => b.rating - a.rating);
  res.json(salons.slice(0, limit));
});

// GET /salons/:id
router.get('/:id', (req, res) => {
  const { lat, lng } = req.query;
  const userLat = lat ? parseFloat(lat) : null;
  const userLng = lng ? parseFloat(lng) : null;

  const salon = db.prepare('SELECT * FROM salons WHERE id = ?').get(req.params.id);
  if (!salon) return res.status(404).json({ error: 'Salon not found' });

  const services = db
    .prepare('SELECT id, title, duration, details, price FROM services WHERE salon_id = ?')
    .all(req.params.id);
  const barbers = db
    .prepare('SELECT id, name, initial, tint, is_any AS isAny FROM barbers WHERE salon_id = ?')
    .all(req.params.id)
    .map((b) => ({ ...b, isAny: !!b.isAny }));

  res.json({ ...decorate(salon, userLat, userLng), services, barbers });
});

// GET /categories — distinct categories with counts
router.get('/meta/categories', (req, res) => {
  const rows = db
    .prepare('SELECT category, COUNT(*) AS count FROM salons GROUP BY category')
    .all();
  res.json(rows);
});

// POST /salons/:id/favourite  (customer only)
router.post('/:id/favourite', auth(), (req, res) => {
  if (req.user.role !== 'customer') return res.status(403).json({ error: 'customer only' });
  db.prepare('INSERT OR IGNORE INTO favourites (user_id, salon_id) VALUES (?, ?)')
    .run(req.user.sub, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id/favourite', auth(), (req, res) => {
  if (req.user.role !== 'customer') return res.status(403).json({ error: 'customer only' });
  db.prepare('DELETE FROM favourites WHERE user_id = ? AND salon_id = ?')
    .run(req.user.sub, req.params.id);
  res.json({ ok: true });
});

// GET /salons/me/favourites  (customer only)
router.get('/me/favourites', auth(), (req, res) => {
  if (req.user.role !== 'customer') return res.status(403).json({ error: 'customer only' });
  const { lat, lng } = req.query;
  const userLat = lat ? parseFloat(lat) : null;
  const userLng = lng ? parseFloat(lng) : null;
  const rows = db
    .prepare(
      `SELECT s.* FROM salons s
       JOIN favourites f ON f.salon_id = s.id
       WHERE f.user_id = ?`
    )
    .all(req.user.sub);
  res.json(rows.map((r) => decorate(r, userLat, userLng)));
});

module.exports = router;
