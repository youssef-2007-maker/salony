const express = require('express');
const { db } = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /messages — thread list for the user
router.get('/', auth(), (req, res) => {
  if (req.user.role === 'customer') {
    const rows = db
      .prepare(
        `SELECT m.salon_id, s.name AS salon_name,
                m.body, m.created_at, m.read_at
         FROM messages m
         JOIN salons s ON s.id = m.salon_id
         WHERE m.user_id = ?
         ORDER BY m.created_at DESC`
      )
      .all(req.user.sub);

    const seen = new Set();
    const threads = [];
    for (const r of rows) {
      if (seen.has(r.salon_id)) continue;
      seen.add(r.salon_id);
      threads.push({
        id: `${r.salon_id}-${req.user.sub}`,
        salonId: r.salon_id,
        salonName: r.salon_name,
        preview: r.body,
        time: ago(r.created_at),
        unread: !r.read_at,
      });
    }
    return res.json(threads);
  }

  // Barber: list of customers they've talked to
  const salon = db.prepare('SELECT id, name FROM salons WHERE owner_user_id = ?').get(req.user.sub);
  if (!salon) return res.json([]);
  const rows = db
    .prepare(
      `SELECT m.user_id, u.name AS user_name, m.body, m.created_at, m.read_at
       FROM messages m
       JOIN users u ON u.id = m.user_id
       WHERE m.salon_id = ?
       ORDER BY m.created_at DESC`
    )
    .all(salon.id);
  const seen = new Set();
  const threads = [];
  for (const r of rows) {
    if (seen.has(r.user_id)) continue;
    seen.add(r.user_id);
    threads.push({
      id: `${salon.id}-${r.user_id}`,
      salonId: salon.id,
      salonName: r.user_name,
      preview: r.body,
      time: ago(r.created_at),
      unread: !r.read_at,
    });
  }
  res.json(threads);
});

function ago(iso) {
  const then = new Date(iso + (iso.includes('Z') ? '' : 'Z')).getTime();
  const diff = Date.now() - then;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

module.exports = router;
