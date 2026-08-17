// Reviews, CRM notes, AI hairstyle stub.

const express = require('express');
const { db } = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { generateHairstyle, imageGenAvailable } = require('../ai/imagegen');

const router = express.Router();

// Bump the JSON limit on this router so a base64 selfie (~1-3MB) fits comfortably.
router.use(express.json({ limit: '10mb' }));

function ownsSalon(userId) {
  return db.prepare('SELECT id FROM salons WHERE owner_user_id = ?').get(userId);
}

// ─── Reviews ────────────────────────────────────────────────────

// GET /social/salons/:id/reviews
router.get('/salons/:id/reviews', (req, res) => {
  const rows = db.prepare(`SELECT r.id, r.rating, r.body, r.photo_url, r.created_at,
                                  u.name AS author
                           FROM reviews r
                           JOIN users u ON u.id = r.user_id
                           WHERE r.salon_id = ? ORDER BY r.created_at DESC LIMIT 50`)
                 .all(req.params.id);
  const summary = db.prepare(`SELECT ROUND(AVG(rating), 1) AS avg, COUNT(*) AS count
                              FROM reviews WHERE salon_id = ?`).get(req.params.id);
  res.json({ summary, reviews: rows });
});

// POST /social/reviews  { bookingId, rating, body?, photoUrl? }
router.post('/reviews', auth(), requireRole('customer'), (req, res) => {
  const { bookingId, rating, body, photoUrl } = req.body || {};
  if (!bookingId || !rating) return res.status(400).json({ error: 'bookingId and rating required' });
  const booking = db.prepare(`SELECT * FROM bookings WHERE id = ? AND customer_id = ?`)
                    .get(bookingId, req.user.sub);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.status !== 'past') return res.status(400).json({ error: 'You can only review completed bookings.' });

  try {
    db.prepare(`INSERT INTO reviews (salon_id, booking_id, user_id, rating, body, photo_url)
                VALUES (?, ?, ?, ?, ?, ?)`)
                .run(booking.salon_id, booking.id, req.user.sub,
                     Math.max(1, Math.min(5, rating)), body || null, photoUrl || null);
  } catch (e) {
    return res.status(409).json({ error: 'You already reviewed this booking.' });
  }

  // Recompute the salon's rating snapshot
  const s = db.prepare('SELECT ROUND(AVG(rating), 1) AS avg, COUNT(*) AS count FROM reviews WHERE salon_id = ?')
              .get(booking.salon_id);
  db.prepare('UPDATE salons SET rating = ?, review_count = ? WHERE id = ?')
    .run(s.avg || 0, s.count || 0, booking.salon_id);

  // Award 25 points for reviewing
  db.prepare('UPDATE users SET points = points + 25 WHERE id = ?').run(req.user.sub);
  db.prepare(`INSERT INTO loyalty_ledger (user_id, salon_id, booking_id, delta, reason, note)
              VALUES (?, ?, ?, 25, 'review', 'Thanks for leaving a review!')`)
              .run(req.user.sub, booking.salon_id, booking.id);

  res.json({ ok: true, pointsAwarded: 25 });
});

// ─── CRM notes (barber adds notes per customer) ─────────────────

router.get('/crm/customers', auth(), requireRole('barber'), (req, res) => {
  const salon = ownsSalon(req.user.sub);
  if (!salon) return res.json([]);
  const customers = db.prepare(`
    SELECT u.id, u.name, u.email, u.phone,
           COUNT(b.id) AS visits,
           COALESCE(SUM(b.price), 0) AS lifetime,
           MAX(b.date) AS last_visit
    FROM users u
    JOIN bookings b ON b.customer_id = u.id
    WHERE b.salon_id = ?
    GROUP BY u.id
    ORDER BY last_visit DESC
  `).all(salon.id);
  res.json(customers);
});

router.get('/crm/customers/:customerId', auth(), requireRole('barber'), (req, res) => {
  const salon = ownsSalon(req.user.sub);
  if (!salon) return res.status(404).json({ error: 'No salon' });
  const customer = db.prepare(`SELECT id, name, email, phone FROM users WHERE id = ?`)
                     .get(req.params.customerId);
  if (!customer) return res.status(404).json({ error: 'Not found' });
  const bookings = db.prepare(`SELECT id, service_title, barber_name, date, time, price, status
                               FROM bookings WHERE salon_id = ? AND customer_id = ?
                               ORDER BY date DESC`)
                     .all(salon.id, req.params.customerId);
  const notes = db.prepare(`SELECT * FROM crm_notes WHERE salon_id = ? AND customer_id = ?
                            ORDER BY created_at DESC`)
                   .all(salon.id, req.params.customerId);
  res.json({ customer, bookings, notes });
});

router.post('/crm/notes', auth(), requireRole('barber'), (req, res) => {
  const salon = ownsSalon(req.user.sub);
  if (!salon) return res.status(400).json({ error: 'No salon' });
  const { customerId, note } = req.body || {};
  if (!customerId || !note) return res.status(400).json({ error: 'customerId, note required' });
  db.prepare(`INSERT INTO crm_notes (salon_id, customer_id, note) VALUES (?, ?, ?)`)
    .run(salon.id, customerId, note);
  res.json({ ok: true });
});

router.delete('/crm/notes/:id', auth(), requireRole('barber'), (req, res) => {
  const salon = ownsSalon(req.user.sub);
  db.prepare('DELETE FROM crm_notes WHERE id = ? AND salon_id = ?').run(req.params.id, salon.id);
  res.json({ ok: true });
});

// ─── AI hairstyle stub ──────────────────────────────────────────
// Real implementation would call an image-gen model. For now we return a
// preset gallery of styles the user can "try on" — the UX is real, the model
// hook-up is a config swap later.

const HAIRSTYLES = [
  { id: 'fade-low',   title: 'Low Fade',     hint: 'Clean and modern, good for round faces.' },
  { id: 'fade-mid',   title: 'Mid Fade',     hint: 'Versatile, suits most face shapes.' },
  { id: 'fade-high',  title: 'High Fade',    hint: 'Bold; emphasises strong jawlines.' },
  { id: 'crop',       title: 'French Crop',  hint: 'Easy maintenance, textured top.' },
  { id: 'pompadour',  title: 'Pompadour',    hint: 'Classic, needs styling product.' },
  { id: 'buzz',       title: 'Buzz Cut',     hint: 'Minimal upkeep, athletic look.' },
  { id: 'quiff',      title: 'Quiff',        hint: 'Volume on top, fades on sides.' },
  { id: 'caesar',     title: 'Caesar',       hint: 'Short, fringe forward.' },
];

router.get('/ai/hairstyles', (_req, res) => {
  res.json({
    aiEnabled: imageGenAvailable(),
    styles: HAIRSTYLES,
  });
});

router.post('/ai/recommend', auth(), (_req, res) => {
  // No real CV here. Return curated picks from the gallery + recommended salons.
  const pick = HAIRSTYLES.slice(0, 4);
  res.json({
    styles: pick,
    note: imageGenAvailable()
      ? 'Picked based on the catalogue. Use Try-on to see them rendered on your photo.'
      : 'These suggestions are based on a curated catalogue. The real model lights up once Salony connects an image-generation key.',
  });
});

// POST /social/ai/tryon  { styleId, selfieB64? | selfieUrl? }
// Generates a rendered "this is you with this haircut" image.
// Returns either { url } or { b64 } depending on the provider, plus { provider }.
// When no image-gen provider is configured, returns 503 with { aiEnabled: false }
// so the client can fall back to its placeholder UI.
router.post('/ai/tryon', auth(), async (req, res) => {
  if (!imageGenAvailable()) {
    return res.status(503).json({
      error: 'AI try-on is not configured on this server.',
      aiEnabled: false,
    });
  }
  const { styleId, selfieB64, selfieUrl } = req.body || {};
  if (!styleId) return res.status(400).json({ error: 'styleId required' });
  if (!selfieB64 && !selfieUrl) {
    return res.status(400).json({ error: 'selfieB64 or selfieUrl required' });
  }
  const style = HAIRSTYLES.find((s) => s.id === styleId);
  if (!style) return res.status(404).json({ error: 'Unknown style' });

  try {
    const out = await generateHairstyle({ selfieB64, selfieUrl, style });
    if (!out) {
      return res.status(503).json({ error: 'No provider returned an image.', aiEnabled: false });
    }
    res.json({
      style: { id: style.id, title: style.title, hint: style.hint },
      ...out, // { url? b64? provider }
    });
  } catch (e) {
    console.error('AI try-on failed:', e.message);
    res.status(502).json({ error: e.message || 'AI provider error' });
  }
});

module.exports = router;
