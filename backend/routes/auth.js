const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { sign, auth } = require('../middleware/auth');
const { isEmail, str, passwordIssue } = require('../lib/validate');

const router = express.Router();

const BCRYPT_ROUNDS = 12; // ~250ms/hash — strong without being painfully slow.

function makeReferralCode(name, id) {
  const base = (name || 'SALONY').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6) || 'SALONY';
  return `${base}${id}`;
}

router.post('/signup', (req, res) => {
  const body = req.body || {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = body.password;
  const name = str(body.name, { min: 1, max: 80 });
  const role = body.role;
  const phone = str(body.phone, { max: 30 });
  const referralCode = str(body.referralCode, { max: 40 });

  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: 'email, password, name, role required' });
  }
  if (!isEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  const pwIssue = passwordIssue(password);
  if (pwIssue) return res.status(400).json({ error: pwIssue });
  if (!['customer', 'barber'].includes(role)) {
    return res.status(400).json({ error: 'role must be customer or barber' });
  }

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'Email already registered' });

  const password_hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);

  // Wrap the whole signup (insert + referral code + welcome bonus + referral
  // linkage) in one transaction so a failure can't leave a half-created user.
  const createUser = db.transaction(() => {
    const info = db
      .prepare('INSERT INTO users (email, password_hash, name, role, phone) VALUES (?, ?, ?, ?, ?)')
      .run(email, password_hash, name, role, phone || null);
    const id = info.lastInsertRowid;

    const code = makeReferralCode(name, id);
    db.prepare('UPDATE users SET referral_code = ? WHERE id = ?').run(code, id);

    if (role === 'customer') {
      db.prepare('UPDATE users SET points = points + 100 WHERE id = ?').run(id);
      db.prepare(`INSERT INTO loyalty_ledger (user_id, delta, reason, note)
                  VALUES (?, 100, 'welcome', 'Welcome to Salony — 100 starter points')`).run(id);

      if (referralCode) {
        const ref = db.prepare('SELECT id FROM users WHERE referral_code = ?').get(referralCode);
        if (ref && ref.id !== id) {
          db.prepare('UPDATE users SET referred_by = ? WHERE id = ?').run(ref.id, id);
          db.prepare('INSERT INTO referrals (referrer_id, referred_id) VALUES (?, ?)').run(ref.id, id);
        }
      }
    }
    return id;
  });

  let id;
  try {
    id = createUser();
  } catch (e) {
    // UNIQUE(email) race: two signups with the same email at once.
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    throw e;
  }

  const user = db.prepare('SELECT id, email, name, role, phone FROM users WHERE id = ?').get(id);
  res.json({ token: sign(user), user });
});

router.post('/login', (req, res) => {
  const body = req.body || {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = body.password;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  // Always run a bcrypt compare to keep timing roughly constant whether or not
  // the email exists (avoids user-enumeration via response timing).
  const dummy = '$2a$12$I2cFkaRRRKGwKLlen6EJQ.bDAJhor./uyk5c8EoJmcO/pQIRipwTO';
  const ok = bcrypt.compareSync(password, row ? row.password_hash : dummy);
  if (!row || !ok) return res.status(401).json({ error: 'Invalid credentials' });

  const user = { id: row.id, email: row.email, name: row.name, role: row.role, phone: row.phone };
  res.json({ token: sign(user), user });
});

router.get('/me', auth(), (req, res) => {
  const row = db.prepare('SELECT id, email, name, role, phone FROM users WHERE id = ?').get(req.user.sub);
  if (!row) return res.status(404).json({ error: 'User not found' });
  res.json(row);
});

// DELETE /auth/me — permanent account deletion.
// Required by the Apple App Store (Guideline 5.1.1(v)) and Google Play for any
// app that supports account creation. ON DELETE CASCADE on the FKs removes the
// user's bookings, favourites, loyalty, etc. Owned salons are detached
// (owner_user_id -> NULL) so customers' booking history isn't destroyed.
router.delete('/me', auth(), (req, res) => {
  const userId = req.user.sub;
  const run = db.transaction(() => {
    db.prepare('UPDATE salons SET owner_user_id = NULL WHERE owner_user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  });
  run();
  res.json({ ok: true, deleted: true });
});

module.exports = router;
