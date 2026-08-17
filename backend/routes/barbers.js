const express = require('express');
const { db } = require('../db');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /barbers/me/salon — the salon this barber owns (or null)
router.get('/me/salon', auth(), requireRole('barber'), (req, res) => {
  const salon = db.prepare('SELECT * FROM salons WHERE owner_user_id = ?').get(req.user.sub);
  if (!salon) return res.json(null);
  const services = db
    .prepare('SELECT id, title, duration, details, price FROM services WHERE salon_id = ?')
    .all(salon.id);
  const barbers = db
    .prepare('SELECT id, name, initial, tint, is_any AS isAny FROM barbers WHERE salon_id = ?')
    .all(salon.id)
    .map((b) => ({ ...b, isAny: !!b.isAny }));
  res.json({
    ...salon,
    tags: JSON.parse(salon.tags || '[]'),
    services,
    barbers,
  });
});

// PATCH /barbers/me/salon — update salon profile (incl. location)
router.patch('/me/salon', auth(), requireRole('barber'), (req, res) => {
  const salon = db.prepare('SELECT * FROM salons WHERE owner_user_id = ?').get(req.user.sub);
  if (!salon) return res.status(404).json({ error: 'No salon owned' });
  const { name, category, address, lat, lng, hours, about, priceLabel, tags } = req.body || {};
  db.prepare(
    `UPDATE salons SET
       name = COALESCE(?, name),
       category = COALESCE(?, category),
       address = COALESCE(?, address),
       lat = COALESCE(?, lat),
       lng = COALESCE(?, lng),
       hours = COALESCE(?, hours),
       about = COALESCE(?, about),
       price_label = COALESCE(?, price_label),
       tags = COALESCE(?, tags)
     WHERE id = ?`
  ).run(
    name ?? null,
    category ?? null,
    address ?? null,
    lat ?? null,
    lng ?? null,
    hours ?? null,
    about ?? null,
    priceLabel ?? null,
    tags ? JSON.stringify(tags) : null,
    salon.id
  );
  res.json({ ok: true });
});

// POST /barbers/me/salon — create a new salon for this barber if they don't have one
router.post('/me/salon', auth(), requireRole('barber'), (req, res) => {
  const existing = db.prepare('SELECT id FROM salons WHERE owner_user_id = ?').get(req.user.sub);
  if (existing) return res.status(409).json({ error: 'Already owns a salon', id: existing.id });

  const { id, name, category, address, lat, lng, hours, about } = req.body || {};
  if (!id || !name || !category || !address || lat == null || lng == null) {
    return res.status(400).json({ error: 'id, name, category, address, lat, lng required' });
  }
  db.prepare(
    `INSERT INTO salons (id, owner_user_id, name, category, address, lat, lng, hours, about)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, req.user.sub, name, category, address, lat, lng, hours || null, about || null);

  // Auto-add a default "Any" barber + the owner as a barber
  db.prepare(
    `INSERT INTO barbers (id, salon_id, user_id, name, initial, tint, is_any)
     VALUES (?, ?, NULL, 'Any', '👤', 0, 1)`
  ).run(`any-${id}`, id);

  const owner = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.sub);
  db.prepare(
    `INSERT INTO barbers (id, salon_id, user_id, name, initial, tint, is_any)
     VALUES (?, ?, ?, ?, ?, 0, 0)`
  ).run(`${id}-owner`, id, req.user.sub, owner.name, owner.name[0].toUpperCase());

  res.json({ ok: true, id });
});

// POST /barbers/me/services — add a service
router.post('/me/services', auth(), requireRole('barber'), (req, res) => {
  const salon = db.prepare('SELECT id FROM salons WHERE owner_user_id = ?').get(req.user.sub);
  if (!salon) return res.status(400).json({ error: 'No salon yet' });
  const { id, title, duration, details, price } = req.body || {};
  if (!id || !title || !duration || price == null) {
    return res.status(400).json({ error: 'id, title, duration, price required' });
  }
  db.prepare('INSERT INTO services (id, salon_id, title, duration, details, price) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, salon.id, title, duration, details || '', price);
  res.json({ ok: true });
});

// DELETE /barbers/me/services/:id
router.delete('/me/services/:id', auth(), requireRole('barber'), (req, res) => {
  const salon = db.prepare('SELECT id FROM salons WHERE owner_user_id = ?').get(req.user.sub);
  if (!salon) return res.status(400).json({ error: 'No salon yet' });
  db.prepare('DELETE FROM services WHERE id = ? AND salon_id = ?').run(req.params.id, salon.id);
  res.json({ ok: true });
});

module.exports = router;
