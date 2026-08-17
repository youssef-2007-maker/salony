// SQLite database setup + seed data for Salony.
// Run `node db.js --seed` to (re)create tables and load demo content.

const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.SALONY_DB_PATH || path.join(__dirname, 'salony.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function migrate() {
  // ── salons columns ──────────────────────────────────────────────
  const salonCols = db.prepare("PRAGMA table_info('salons')").all().map((c) => c.name);
  const addSalon = (name, decl) => {
    if (!salonCols.includes(name)) db.exec(`ALTER TABLE salons ADD COLUMN ${name} ${decl}`);
  };
  addSalon('plan', "TEXT NOT NULL DEFAULT 'free'");
  addSalon('plan_until', 'TEXT');
  addSalon('boost_until', 'TEXT');
  addSalon('is_verified', 'INTEGER NOT NULL DEFAULT 0');
  addSalon('featured_until', 'TEXT');
  // Loyalty + marketing settings barber controls themselves
  addSalon('points_rate', 'REAL NOT NULL DEFAULT 0.05');     // % of price earned as points
  addSalon('redeem_value', 'REAL NOT NULL DEFAULT 1');       // EGP per redeemed point
  addSalon('handle', 'TEXT');                                // unique mini-site handle
  addSalon('deposit_required', 'INTEGER NOT NULL DEFAULT 0');
  addSalon('deposit_pct', 'REAL NOT NULL DEFAULT 0.25');
  addSalon('offers_at_home', 'INTEGER NOT NULL DEFAULT 0');
  addSalon('at_home_fee', 'REAL NOT NULL DEFAULT 100');

  // ── users columns ───────────────────────────────────────────────
  const userCols = db.prepare("PRAGMA table_info('users')").all().map((c) => c.name);
  const addUser = (name, decl) => {
    if (!userCols.includes(name)) db.exec(`ALTER TABLE users ADD COLUMN ${name} ${decl}`);
  };
  addUser('points', 'INTEGER NOT NULL DEFAULT 0');
  addUser('tier', "TEXT NOT NULL DEFAULT 'bronze'");
  addUser('lifetime_spent', 'REAL NOT NULL DEFAULT 0');
  addUser('referral_code', 'TEXT');
  addUser('referred_by', 'INTEGER REFERENCES users(id) ON DELETE SET NULL');
  addUser('birthday', 'TEXT');
  addUser('subscription_active', 'INTEGER NOT NULL DEFAULT 0');
  addUser('subscription_until', 'TEXT');
  addUser('subscription_free_cuts', 'INTEGER NOT NULL DEFAULT 0');

  // ── bookings columns ────────────────────────────────────────────
  const bkCols = db.prepare("PRAGMA table_info('bookings')").all().map((c) => c.name);
  const addBk = (name, decl) => {
    if (!bkCols.includes(name)) db.exec(`ALTER TABLE bookings ADD COLUMN ${name} ${decl}`);
  };
  addBk('tip', 'REAL NOT NULL DEFAULT 0');
  addBk('deposit_paid', 'REAL NOT NULL DEFAULT 0');
  addBk('points_earned', 'INTEGER NOT NULL DEFAULT 0');
  addBk('points_redeemed', 'INTEGER NOT NULL DEFAULT 0');
  addBk('discount', 'REAL NOT NULL DEFAULT 0');
  addBk('is_at_home', 'INTEGER NOT NULL DEFAULT 0');
  addBk('at_home_address', 'TEXT');
  addBk('group_size', 'INTEGER NOT NULL DEFAULT 1');
  addBk('paid_at', 'TEXT');
  addBk('paid_method', 'TEXT');

  db.exec(`
    CREATE TABLE IF NOT EXISTS promotions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK(kind IN ('subscribe','boost')),
      plan TEXT, days INTEGER, amount REAL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS loyalty_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      salon_id TEXT REFERENCES salons(id) ON DELETE SET NULL,
      booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
      delta INTEGER NOT NULL,             -- positive = earn, negative = redeem
      reason TEXT NOT NULL,               -- 'booking', 'redeem', 'referral', 'welcome', 'birthday'
      note TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      referred_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending', -- pending | rewarded
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      category TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      total REAL NOT NULL,
      commission REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | shipped | delivered | cancelled
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      qty INTEGER NOT NULL,
      unit_price REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      booking_id INTEGER UNIQUE REFERENCES bookings(id) ON DELETE SET NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      body TEXT,
      photo_url TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS crm_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      note TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      pct INTEGER NOT NULL,                  -- 10 = 10% off
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS waitlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      service_id TEXT REFERENCES services(id) ON DELETE SET NULL,
      preferred_date TEXT NOT NULL,
      preferred_time TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      notified_at TEXT
    );

    CREATE TABLE IF NOT EXISTS staff_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      role TEXT,                              -- 'Senior barber', 'Apprentice', etc
      commission_pct REAL DEFAULT 50,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,                    -- 'instagram','sms','email'
      title TEXT,
      body TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Payment intentions / transactions (Paymob). One row per checkout attempt.
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL DEFAULT 'paymob',
      reference TEXT UNIQUE NOT NULL,        -- our merchant reference (special_reference)
      intention_id TEXT,                     -- provider intention id
      provider_txn_id TEXT,                  -- provider transaction id (from webhook)
      ref_type TEXT NOT NULL,                -- 'booking' | 'order'
      ref_id TEXT NOT NULL,                  -- bookings.id / orders.id (stored as text)
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EGP',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','failed')),
      created_at TEXT DEFAULT (datetime('now')),
      paid_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_payments_ref ON payments(ref_type, ref_id);

    -- Indexes for the hot query paths (helps at scale).
    CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_salon ON bookings(salon_id);
    CREATE INDEX IF NOT EXISTS idx_services_salon ON services(salon_id);
    CREATE INDEX IF NOT EXISTS idx_products_salon ON products(salon_id);
    CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_salon ON orders(salon_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_salon ON reviews(salon_id);
    CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);
    CREATE INDEX IF NOT EXISTS idx_loyalty_user ON loyalty_ledger(user_id);
  `);
}

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('customer','barber')),
      phone TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS salons (
      id TEXT PRIMARY KEY,
      owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      address TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      rating REAL DEFAULT 0,
      review_count INTEGER DEFAULT 0,
      price_label TEXT DEFAULT 'EGP',
      tags TEXT DEFAULT '[]',          -- JSON array
      hours TEXT,
      about TEXT
    );

    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      duration TEXT NOT NULL,
      details TEXT,
      price REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS barbers (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      initial TEXT,
      tint INTEGER DEFAULT 0,
      is_any INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      barber_id TEXT REFERENCES barbers(id) ON DELETE SET NULL,
      service_id TEXT REFERENCES services(id) ON DELETE SET NULL,
      service_title TEXT NOT NULL,
      barber_name TEXT,
      date TEXT NOT NULL,              -- ISO yyyy-mm-dd
      time TEXT NOT NULL,              -- '11:00 AM'
      price REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'upcoming'
              CHECK(status IN ('upcoming','past','cancelled','declined')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS favourites (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, salon_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sender TEXT NOT NULL CHECK(sender IN ('salon','customer')),
      body TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      read_at TEXT
    );
  `);
  migrate();
}

function seed() {
  const bcrypt = require('bcryptjs');
  init();

  // Wipe existing rows in dependency order
  db.exec(`
    DELETE FROM ai_posts;
    DELETE FROM staff_members;
    DELETE FROM waitlist;
    DELETE FROM deals;
    DELETE FROM crm_notes;
    DELETE FROM reviews;
    DELETE FROM order_items;
    DELETE FROM orders;
    DELETE FROM products;
    DELETE FROM referrals;
    DELETE FROM loyalty_ledger;
    DELETE FROM promotions;
    DELETE FROM messages;
    DELETE FROM favourites;
    DELETE FROM bookings;
    DELETE FROM barbers;
    DELETE FROM services;
    DELETE FROM salons;
    DELETE FROM users;
  `);

  // Demo users
  const insertUser = db.prepare(`
    INSERT INTO users (email, password_hash, name, role, phone)
    VALUES (?, ?, ?, ?, ?)
  `);
  const hash = (pw) => bcrypt.hashSync(pw, 10);

  const customerId = insertUser.run(
    'demo@salony.app', hash('password'), 'Youssef Hamad', 'customer', '+201000000001'
  ).lastInsertRowid;

  const mohamedId = insertUser.run(
    'mohamed@salony.app', hash('password'), 'Mohamed', 'barber', '+201000000002'
  ).lastInsertRowid;
  const cynthiaId = insertUser.run(
    'cynthia@salony.app', hash('password'), 'Cynthia', 'barber', '+201000000003'
  ).lastInsertRowid;
  const nourId = insertUser.run(
    'nour@salony.app', hash('password'), 'Nour', 'barber', '+201000000004'
  ).lastInsertRowid;

  // Salons (lat/lng are real Cairo neighbourhoods)
  const insertSalon = db.prepare(`
    INSERT INTO salons (id, owner_user_id, name, category, address, lat, lng,
                        rating, review_count, price_label, tags, hours, about)
    VALUES (@id, @owner_user_id, @name, @category, @address, @lat, @lng,
            @rating, @review_count, @price_label, @tags, @hours, @about)
  `);

  const salons = [
    {
      id: 'the-barber-shop',
      owner_user_id: mohamedId,
      name: 'The Barber Shop',
      category: 'Hair Salon',
      address: 'El Marghany, Heliopolis',
      lat: 30.0911, lng: 31.3239,
      rating: 5.0, review_count: 248,
      price_label: 'EGP',
      tags: JSON.stringify(['Hair Salon']),
      hours: 'Open today 10:00 AM – 11:00 PM',
      about: 'A modern grooming destination in the heart of Heliopolis. Premium haircuts, beard work and grooming rituals delivered by award-winning barbers.',
    },
    {
      id: 'zamalek-grooming',
      owner_user_id: null,
      name: 'Zamalek Grooming Co.',
      category: "Men's Grooming",
      address: '26th of July St, Zamalek',
      lat: 30.0626, lng: 31.2197,
      rating: 4.7, review_count: 156,
      price_label: 'EGP',
      tags: JSON.stringify(["Men's Grooming", 'Hair Salon']),
      hours: 'Open today 11:00 AM – 10:00 PM',
      about: 'Old-school barbering with modern technique. Hot towel shaves, scissor cuts, and bespoke beard grooming.',
    },
  ];
  salons.forEach((s) => insertSalon.run(s));

  // Demo upgrades — show what Pro / Premium / boost look like in the UI
  const inAYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const inAWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`UPDATE salons SET plan = 'premium', plan_until = ?, is_verified = 1,
                                  featured_until = ?, boost_until = ?
              WHERE id = 'the-barber-shop'`).run(inAYear, inAWeek, inAWeek);

  // Services
  const insertSvc = db.prepare(`
    INSERT INTO services (id, salon_id, title, duration, details, price)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const services = [
    ['classic-haircut', 'the-barber-shop', 'Classic Haircut', '45 min', 'Includes wash & dry', 200],
    ['beard-trim', 'the-barber-shop', 'Beard Trim & Shape', '20 min', 'Hot towel finish', 120],
    ['haircut-beard', 'the-barber-shop', 'Haircut + Beard Combo', '60 min', 'Full service', 280],
    ['kids-cut', 'the-barber-shop', "Kids' Haircut", '30 min', 'Under 12 years', 150],

    ['zam-cut', 'zamalek-grooming', 'Scissor Cut', '45 min', 'Wash & style', 250],
    ['zam-shave', 'zamalek-grooming', 'Hot Towel Shave', '40 min', 'Straight razor', 220],
  ];
  services.forEach((row) => insertSvc.run(...row));

  // Barbers
  const insertBarber = db.prepare(`
    INSERT INTO barbers (id, salon_id, user_id, name, initial, tint, is_any)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const barbers = [
    // The Barber Shop
    ['any-tbs', 'the-barber-shop', null, 'Any', '👤', 0, 1],
    ['mohamed', 'the-barber-shop', mohamedId, 'Mohamed', 'M', 0, 0],
    ['ramy', 'the-barber-shop', null, 'Ramy', 'R', 1, 0],
    ['khalid', 'the-barber-shop', null, 'Khalid', 'K', 2, 0],
    // Lavish
    // Glow
    // Zamalek
    ['any-zam', 'zamalek-grooming', null, 'Any', '👤', 0, 1],
    ['hassan', 'zamalek-grooming', null, 'Hassan', 'H', 1, 0],
    // Nails
  ];
  barbers.forEach((row) => insertBarber.run(...row));

  // Demo bookings for the customer
  const insertBooking = db.prepare(`
    INSERT INTO bookings (customer_id, salon_id, barber_id, service_id, service_title,
                          barber_name, date, time, price, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertBooking.run(customerId, 'the-barber-shop', 'mohamed', 'classic-haircut',
    'Classic Haircut', 'Mohamed', '2026-05-21', '11:00 AM', 200, 'upcoming');
  insertBooking.run(customerId, 'the-barber-shop', 'ramy', 'beard-trim',
    'Beard Trim & Shape', 'Ramy', '2026-04-30', '02:30 PM', 120, 'past');

  // Demo messages
  const insertMsg = db.prepare(`
    INSERT INTO messages (salon_id, user_id, sender, body, read_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertMsg.run('the-barber-shop', customerId, 'salon',
    'Your appointment is confirmed. See you Friday!', null);
  insertMsg.run('the-barber-shop', customerId, 'salon',
    'Thanks for visiting — leave us a quick review?', new Date().toISOString());

  // --- Loyalty seed: give the demo customer some starting points + a code ---
  db.prepare(`UPDATE users SET points = 320, tier = 'silver', lifetime_spent = 1400,
                                referral_code = 'YOUSSEF50' WHERE id = ?`).run(customerId);
  db.prepare(`UPDATE users SET referral_code = 'MOHAMED50' WHERE id = ?`).run(mohamedId);
  db.prepare(`INSERT INTO loyalty_ledger (user_id, salon_id, delta, reason, note)
              VALUES (?, ?, 320, 'welcome', 'Welcome to Salony — 320 starter points')`)
              .run(customerId, 'the-barber-shop');

  // --- Salon mini-site handles + at-home + loyalty config ---
  db.prepare(`UPDATE salons SET handle = 'thebarbershop', deposit_required = 1, deposit_pct = 0.25,
                                 offers_at_home = 1, at_home_fee = 150,
                                 points_rate = 0.08, redeem_value = 1
              WHERE id = 'the-barber-shop'`).run();
  db.prepare(`UPDATE salons SET handle = 'zamalek', offers_at_home = 1, at_home_fee = 200,
                                 points_rate = 0.05 WHERE id = 'zamalek-grooming'`).run();

  // --- Products (marketplace) ---
  const insertProduct = db.prepare(`INSERT INTO products (id, salon_id, title, description, price, stock, category)
                                    VALUES (?, ?, ?, ?, ?, ?, ?)`);
  insertProduct.run('p-pomade-classic', 'the-barber-shop', 'Classic Pomade',
    'Medium hold, high-shine finish for slick-back styles.', 280, 24, 'Hair');
  insertProduct.run('p-beard-oil',      'the-barber-shop', 'Beard Oil 30ml',
    'Argan + jojoba blend. Tames frizz, softens beard.', 220, 18, 'Beard');

  // --- Reviews seed ---
  db.prepare(`INSERT INTO reviews (salon_id, user_id, rating, body)
              VALUES ('the-barber-shop', ?, 5, 'Best fade in Heliopolis. Mohamed is a magician.')`)
              .run(customerId);

  // --- Active deal on The Barber Shop ---
  const dayAhead = new Date(Date.now() + 3 * 86400000).toISOString();
  db.prepare(`INSERT INTO deals (salon_id, title, pct, starts_at, ends_at, active)
              VALUES ('the-barber-shop', 'Tuesday & Wednesday 20% off all cuts', 20, datetime('now'), ?, 1)`)
              .run(dayAhead);

  // --- Staff seed for The Barber Shop ---
  db.prepare(`INSERT INTO staff_members (salon_id, name, role, commission_pct)
              VALUES ('the-barber-shop', 'Mohamed (Owner)', 'Master barber', 100)`).run();
  db.prepare(`INSERT INTO staff_members (salon_id, name, role, commission_pct)
              VALUES ('the-barber-shop', 'Ramy', 'Senior barber', 60)`).run();
  db.prepare(`INSERT INTO staff_members (salon_id, name, role, commission_pct)
              VALUES ('the-barber-shop', 'Khalid', 'Apprentice', 40)`).run();

  console.log('Seeded database at', DB_PATH);
}

module.exports = { db, init, seed, migrate };

if (require.main === module) {
  if (process.argv.includes('--seed')) seed();
  else init();
}
