// Deals, waitlist, deposits config, staff, AI marketing, tax export, mini-site.

const express = require('express');
const { db } = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { generateCopy, aiAvailable } = require('../ai/llm');

const router = express.Router();

function ownsSalon(userId) {
  return db.prepare('SELECT * FROM salons WHERE owner_user_id = ?').get(userId);
}

// ─── Deals (flash / off-peak) ───────────────────────────────────

// Public: live deals + nearby
router.get('/deals', (req, res) => {
  const rows = db.prepare(`
    SELECT d.*, s.name AS salon_name, s.address, s.lat, s.lng, s.rating, s.review_count
    FROM deals d JOIN salons s ON s.id = d.salon_id
    WHERE d.active = 1
      AND datetime(d.starts_at) <= datetime('now')
      AND datetime(d.ends_at) >= datetime('now')
    ORDER BY d.pct DESC
  `).all();
  res.json(rows);
});

router.get('/me/deals', auth(), requireRole('barber'), (req, res) => {
  const salon = ownsSalon(req.user.sub);
  if (!salon) return res.json([]);
  res.json(db.prepare(`SELECT * FROM deals WHERE salon_id = ? ORDER BY ends_at DESC`).all(salon.id));
});

router.post('/me/deals', auth(), requireRole('barber'), (req, res) => {
  const salon = ownsSalon(req.user.sub);
  if (!salon) return res.status(400).json({ error: 'No salon' });
  const { title, pct, startsAt, endsAt } = req.body || {};
  if (!title || !pct || !endsAt) return res.status(400).json({ error: 'title, pct, endsAt required' });
  db.prepare(`INSERT INTO deals (salon_id, title, pct, starts_at, ends_at, active)
              VALUES (?, ?, ?, ?, ?, 1)`)
              .run(salon.id, title, Math.max(5, Math.min(80, parseInt(pct, 10))),
                   startsAt || new Date().toISOString(), endsAt);
  res.json({ ok: true });
});

router.delete('/me/deals/:id', auth(), requireRole('barber'), (req, res) => {
  const salon = ownsSalon(req.user.sub);
  db.prepare('UPDATE deals SET active = 0 WHERE id = ? AND salon_id = ?').run(req.params.id, salon.id);
  res.json({ ok: true });
});

// ─── Wait-list ─────────────────────────────────────────────────

router.post('/waitlist', auth(), requireRole('customer'), (req, res) => {
  const { salonId, serviceId, preferredDate, preferredTime } = req.body || {};
  if (!salonId || !preferredDate) return res.status(400).json({ error: 'salonId, preferredDate required' });
  db.prepare(`INSERT INTO waitlist (customer_id, salon_id, service_id, preferred_date, preferred_time)
              VALUES (?, ?, ?, ?, ?)`)
              .run(req.user.sub, salonId, serviceId || null, preferredDate, preferredTime || null);
  res.json({ ok: true, message: "You're on the wait-list. We'll notify you if a slot opens." });
});

router.get('/me/waitlist', auth(), requireRole('customer'), (req, res) => {
  res.json(db.prepare(`SELECT w.*, s.name AS salon_name FROM waitlist w
                       JOIN salons s ON s.id = w.salon_id
                       WHERE customer_id = ? ORDER BY w.created_at DESC`).all(req.user.sub));
});

router.delete('/me/waitlist/:id', auth(), requireRole('customer'), (req, res) => {
  db.prepare('DELETE FROM waitlist WHERE id = ? AND customer_id = ?').run(req.params.id, req.user.sub);
  res.json({ ok: true });
});

router.get('/me/salon-waitlist', auth(), requireRole('barber'), (req, res) => {
  const salon = ownsSalon(req.user.sub);
  if (!salon) return res.json([]);
  res.json(db.prepare(`SELECT w.*, u.name AS customer_name, u.phone FROM waitlist w
                       JOIN users u ON u.id = w.customer_id
                       WHERE w.salon_id = ? ORDER BY w.created_at`).all(salon.id));
});

// ─── Deposit + loyalty + at-home config ─────────────────────────

router.patch('/me/settings', auth(), requireRole('barber'), (req, res) => {
  const salon = ownsSalon(req.user.sub);
  if (!salon) return res.status(404).json({ error: 'No salon' });
  const {
    pointsRate, redeemValue,
    depositRequired, depositPct,
    offersAtHome, atHomeFee,
    handle,
  } = req.body || {};
  db.prepare(`UPDATE salons SET
                points_rate = COALESCE(?, points_rate),
                redeem_value = COALESCE(?, redeem_value),
                deposit_required = COALESCE(?, deposit_required),
                deposit_pct = COALESCE(?, deposit_pct),
                offers_at_home = COALESCE(?, offers_at_home),
                at_home_fee = COALESCE(?, at_home_fee),
                handle = COALESCE(?, handle)
              WHERE id = ?`)
    .run(
      pointsRate ?? null,
      redeemValue ?? null,
      depositRequired == null ? null : (depositRequired ? 1 : 0),
      depositPct ?? null,
      offersAtHome == null ? null : (offersAtHome ? 1 : 0),
      atHomeFee ?? null,
      handle ?? null,
      salon.id
    );
  res.json({ ok: true });
});

// ─── Staff ─────────────────────────────────────────────────────

router.get('/me/staff', auth(), requireRole('barber'), (req, res) => {
  const salon = ownsSalon(req.user.sub);
  if (!salon) return res.json([]);
  res.json(db.prepare('SELECT * FROM staff_members WHERE salon_id = ? ORDER BY active DESC, name')
             .all(salon.id));
});

router.post('/me/staff', auth(), requireRole('barber'), (req, res) => {
  const salon = ownsSalon(req.user.sub);
  if (!salon) return res.status(400).json({ error: 'No salon' });
  const { name, role, commissionPct } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  db.prepare(`INSERT INTO staff_members (salon_id, name, role, commission_pct, active)
              VALUES (?, ?, ?, ?, 1)`)
              .run(salon.id, name, role || null, commissionPct ?? 50);
  res.json({ ok: true });
});

router.delete('/me/staff/:id', auth(), requireRole('barber'), (req, res) => {
  const salon = ownsSalon(req.user.sub);
  db.prepare('UPDATE staff_members SET active = 0 WHERE id = ? AND salon_id = ?')
    .run(req.params.id, salon.id);
  res.json({ ok: true });
});

// ─── AI marketing assistant (template-driven; real model = config swap) ──

const TEMPLATES = [
  {
    id: 'weekend-promo',
    kind: 'instagram',
    title: 'Weekend promo',
    body: '✂️ {salon_name} weekend special — book any haircut Friday or Saturday and get {pct}% off. Walk-ins welcome but slots fill fast. Book on Salony 👉 salony.app/{handle}',
  },
  {
    id: 'new-service',
    kind: 'instagram',
    title: 'New service launch',
    body: '✨ New at {salon_name}: try our {service} this month. Limited intro pricing for the first 30 bookings. Reserve yours at salony.app/{handle}',
  },
  {
    id: 'sms-reminder',
    kind: 'sms',
    title: 'WhatsApp reminder',
    body: 'Hey from {salon_name}! It\'s been a while — book your next cut on Salony and get {pct}% off as a returning customer. salony.app/{handle}',
  },
  {
    id: 'review-ask',
    kind: 'sms',
    title: 'Review request',
    body: 'Thanks for visiting {salon_name}! Got a sec to leave us a star rating? It really helps. salony.app/{handle}',
  },
  {
    id: 'event-prep',
    kind: 'instagram',
    title: 'Event-season post',
    body: '👰‍♀️ Wedding season is here. Book your full grooming package at {salon_name} — haircut, beard, brows, the works. salony.app/{handle}',
  },
];

router.get('/me/ai/templates', auth(), requireRole('barber'), (_req, res) => {
  res.json({
    aiEnabled: aiAvailable(),
    templates: TEMPLATES,
  });
});

// Fill template placeholders. Used as the fallback when no LLM key is configured
// and as the "user prompt" we hand the model when one is.
function fillTemplate(tpl, salon, vars) {
  const pct = vars?.pct ?? 15;
  const service = vars?.service || 'signature cut';
  return tpl.body
    .replaceAll('{salon_name}', salon.name)
    .replaceAll('{handle}', salon.handle || 'yourshop')
    .replaceAll('{pct}', String(pct))
    .replaceAll('{service}', service);
}

router.post('/me/ai/generate', auth(), requireRole('barber'), async (req, res) => {
  const salon = ownsSalon(req.user.sub);
  if (!salon) return res.status(400).json({ error: 'No salon' });
  const { templateId, pct, service, tone, freeform } = req.body || {};

  // Freeform mode: user types whatever they want, no template required. We
  // still need a saved title/kind for the posts table.
  let tpl;
  if (freeform) {
    tpl = { id: 'freeform', kind: 'instagram', title: 'Custom post', body: freeform };
  } else {
    tpl = TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return res.status(404).json({ error: 'Unknown template' });
  }

  const filledTemplate = fillTemplate(tpl, salon, { pct, service });
  let body = filledTemplate;
  let provider = 'template';

  if (aiAvailable()) {
    try {
      const system = [
        `You are a marketing copywriter for ${salon.name}, a salon/barbershop in Egypt.`,
        `Write punchy social copy that sounds like it was written by a real human running the salon, not a corporate brand. Mix Arabic and English casually if it fits. Use 1-3 emoji max.`,
        `Always include the booking link salony.app/${salon.handle || 'yourshop'} once. Never invent prices not given. Keep it under 280 characters unless asked.`,
        tone ? `Tone: ${tone}.` : '',
      ].filter(Boolean).join(' ');
      const user = freeform
        ? `Rewrite or expand this into a finished post:\n\n${freeform}`
        : `Write a ${tpl.kind === 'sms' ? 'WhatsApp/SMS message' : 'Instagram caption'} for the "${tpl.title}" use case. You can use this draft as a starting point, but you can rewrite it freely:\n\n${filledTemplate}`;
      const out = await generateCopy({ system, user, maxTokens: 350 });
      if (out && out.text) {
        body = out.text;
        provider = out.provider;
      }
    } catch (e) {
      // LLM failed mid-flight — keep the template fallback so the user still
      // gets a result. Log so the operator can debug.
      console.warn('AI generate failed, using template:', e.message);
    }
  }

  const info = db.prepare(`INSERT INTO ai_posts (salon_id, kind, title, body) VALUES (?, ?, ?, ?)`)
                .run(salon.id, tpl.kind, tpl.title, body);
  res.json({
    id: info.lastInsertRowid,
    kind: tpl.kind,
    title: tpl.title,
    body,
    provider, // 'anthropic' | 'openai' | 'template'
  });
});

router.get('/me/ai/posts', auth(), requireRole('barber'), (req, res) => {
  const salon = ownsSalon(req.user.sub);
  if (!salon) return res.json([]);
  res.json(db.prepare('SELECT * FROM ai_posts WHERE salon_id = ? ORDER BY created_at DESC LIMIT 50')
             .all(salon.id));
});

// ─── Tax / income export ───────────────────────────────────────

router.get('/me/tax', auth(), requireRole('barber'), (req, res) => {
  const salon = ownsSalon(req.user.sub);
  if (!salon) return res.json({ rows: [] });
  const year = parseInt(req.query.year || new Date().getFullYear(), 10);
  const rows = db.prepare(`
    SELECT substr(date, 1, 7) AS month,
           COUNT(*) AS bookings,
           COALESCE(SUM(price), 0) AS gross,
           COALESCE(SUM(tip), 0)    AS tips,
           COALESCE(SUM(price + tip), 0) AS total
    FROM bookings
    WHERE salon_id = ? AND date LIKE ? AND status = 'past'
    GROUP BY month ORDER BY month
  `).all(salon.id, `${year}-%`);
  const orderRows = db.prepare(`
    SELECT substr(created_at, 1, 7) AS month,
           COUNT(*) AS orders,
           COALESCE(SUM(total), 0)      AS gross,
           COALESCE(SUM(commission), 0) AS commission
    FROM orders WHERE salon_id = ? AND created_at LIKE ? AND status != 'cancelled'
    GROUP BY month ORDER BY month
  `).all(salon.id, `${year}-%`);
  res.json({ year, salon: { id: salon.id, name: salon.name }, bookings: rows, products: orderRows });
});

router.get('/me/tax.csv', auth(), requireRole('barber'), (req, res) => {
  const salon = ownsSalon(req.user.sub);
  if (!salon) return res.status(404).send('No salon');
  const year = parseInt(req.query.year || new Date().getFullYear(), 10);
  const rows = db.prepare(`SELECT date, service_title, barber_name, price, tip,
                                  CASE status WHEN 'past' THEN 'COMPLETED' ELSE UPPER(status) END AS status
                           FROM bookings WHERE salon_id = ? AND date LIKE ? ORDER BY date`)
                 .all(salon.id, `${year}-%`);
  const lines = ['Date,Service,Barber,Price (EGP),Tip (EGP),Status'];
  for (const r of rows) {
    lines.push([r.date, JSON.stringify(r.service_title), JSON.stringify(r.barber_name || ''),
                r.price, r.tip || 0, r.status].join(','));
  }
  res.set('Content-Type', 'text/csv');
  res.set('Content-Disposition', `attachment; filename="salony-${salon.id}-${year}.csv"`);
  res.send(lines.join('\n'));
});

// ─── Mini-site (public salon page) ─────────────────────────────

router.get('/site/:handle', (req, res) => {
  const salon = db.prepare(`SELECT * FROM salons WHERE handle = ?`).get(req.params.handle);
  if (!salon) return res.status(404).send('<h1>Not found</h1>');
  const services = db.prepare('SELECT * FROM services WHERE salon_id = ?').all(salon.id);
  const html = renderSite(salon, services);
  res.set('Content-Type', 'text/html');
  res.send(html);
});

function renderSite(salon, services) {
  const svcRows = services.map(
    (s) => `<li><strong>${s.title}</strong> <span class="dur">${s.duration}</span>
            <span class="price">${s.price} EGP</span><br/><small>${s.details || ''}</small></li>`
  ).join('');
  return `<!doctype html><html><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${salon.name} — Salony</title>
    <style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;background:#FAF6F2;color:#1B1B1B}
      .hero{background:#7D1A3D;color:#fff;padding:48px 24px;text-align:center}
      .hero h1{margin:0;font-size:32px}
      .hero p{opacity:0.85;margin-top:8px}
      main{max-width:560px;margin:0 auto;padding:24px}
      .card{background:#fff;border-radius:16px;padding:20px;margin:16px 0;box-shadow:0 6px 18px rgba(0,0,0,0.06)}
      .meta{display:flex;gap:12px;flex-wrap:wrap;margin-top:12px;color:#6F6A66;font-size:14px}
      ul{list-style:none;padding:0}
      li{padding:12px 0;border-bottom:1px solid #E6E1DC}
      .dur,.price{float:right;color:#7D1A3D;font-weight:700}
      .cta{display:block;background:#7D1A3D;color:#fff;text-align:center;padding:16px;border-radius:12px;text-decoration:none;font-weight:800;margin-top:24px}
      footer{text-align:center;color:#6F6A66;font-size:12px;padding:24px}
    </style></head><body>
    <div class="hero"><h1>${salon.name}</h1><p>${salon.category} · ${salon.address}</p></div>
    <main>
      <div class="card">
        <h3 style="margin-top:0">About</h3>
        <p>${salon.about || ''}</p>
        <div class="meta">
          <span>⭐ ${salon.rating} (${salon.review_count})</span>
          ${salon.hours ? `<span>🕒 ${salon.hours}</span>` : ''}
        </div>
      </div>
      <div class="card">
        <h3 style="margin-top:0">Services</h3>
        <ul>${svcRows}</ul>
      </div>
      <a class="cta" href="#">Book on Salony</a>
      <footer>Powered by <strong>Salony</strong> · salony.app/${salon.handle}</footer>
    </main>
    </body></html>`;
}

module.exports = router;
