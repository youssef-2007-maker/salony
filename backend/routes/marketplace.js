// Marketplace: barbers list grooming products, customers order, Salony takes 15%.

const crypto = require('crypto');
const express = require('express');
const { db } = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { str, num, intIn } = require('../lib/validate');

const router = express.Router();
const COMMISSION = 0.15;

function ownsSalon(userId) {
  return db.prepare('SELECT id FROM salons WHERE owner_user_id = ?').get(userId);
}

// GET /marketplace/products?q=&salonId=&category=&limit=&offset=
router.get('/products', (req, res) => {
  const { q, salonId, category } = req.query;
  const limit = intIn(req.query.limit, { min: 1, max: 100, def: 50 });
  const offset = intIn(req.query.offset, { min: 0, max: 100000, def: 0 });
  let sql = `SELECT p.*, s.name AS salon_name FROM products p
             JOIN salons s ON s.id = p.salon_id
             WHERE p.stock > 0`;
  const params = [];
  if (salonId)  { sql += ' AND p.salon_id = ?'; params.push(salonId); }
  if (category) { sql += ' AND p.category = ?'; params.push(category); }
  if (q) {
    sql += ' AND (LOWER(p.title) LIKE ? OR LOWER(p.description) LIKE ?)';
    const needle = `%${String(q).toLowerCase()}%`;
    params.push(needle, needle);
  }
  sql += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  res.json(db.prepare(sql).all(...params));
});

router.get('/products/:id', (req, res) => {
  const p = db.prepare(`SELECT p.*, s.name AS salon_name FROM products p
                        JOIN salons s ON s.id = p.salon_id WHERE p.id = ?`).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(p);
});

// Barber product CRUD
router.post('/me/products', auth(), requireRole('barber'), (req, res) => {
  const salon = ownsSalon(req.user.sub);
  if (!salon) return res.status(400).json({ error: 'Create a salon first' });
  const title = str(req.body?.title, { min: 1, max: 120 });
  const price = num(req.body?.price);
  if (!title || price == null) return res.status(400).json({ error: 'title and price required' });
  if (price < 0 || price > 1000000) return res.status(400).json({ error: 'Invalid price.' });
  const description = str(req.body?.description, { max: 2000 }) || '';
  const category = str(req.body?.category, { max: 40 }) || 'Hair';
  const stock = intIn(req.body?.stock, { min: 0, max: 1000000, def: 0 });
  // Generate the ID server-side so clients can't collide or inject one.
  const id = `p-${crypto.randomBytes(8).toString('hex')}`;
  db.prepare(`INSERT INTO products (id, salon_id, title, description, price, stock, category)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
              .run(id, salon.id, title, description, price, stock, category);
  res.json({ ok: true, id });
});

router.patch('/me/products/:id', auth(), requireRole('barber'), (req, res) => {
  const salon = ownsSalon(req.user.sub);
  if (!salon) return res.status(400).json({ error: 'No salon yet' });
  const title = req.body?.title != null ? str(req.body.title, { min: 1, max: 120 }) : null;
  const description = req.body?.description != null ? (str(req.body.description, { max: 2000 }) || '') : null;
  const category = req.body?.category != null ? str(req.body.category, { max: 40 }) : null;
  const price = req.body?.price != null ? num(req.body.price) : null;
  const stock = req.body?.stock != null ? intIn(req.body.stock, { min: 0, max: 1000000, def: null }) : null;
  if (price != null && (price < 0 || price > 1000000)) return res.status(400).json({ error: 'Invalid price.' });
  const r = db.prepare(`UPDATE products SET title = COALESCE(?, title), description = COALESCE(?, description),
                                  price = COALESCE(?, price), stock = COALESCE(?, stock),
                                  category = COALESCE(?, category)
              WHERE id = ? AND salon_id = ?`)
              .run(title, description, price, stock, category, req.params.id, salon.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Product not found' });
  res.json({ ok: true });
});

router.delete('/me/products/:id', auth(), requireRole('barber'), (req, res) => {
  const salon = ownsSalon(req.user.sub);
  if (!salon) return res.status(400).json({ error: 'No salon yet' });
  db.prepare('DELETE FROM products WHERE id = ? AND salon_id = ?').run(req.params.id, salon.id);
  res.json({ ok: true });
});

router.get('/me/products', auth(), requireRole('barber'), (req, res) => {
  const salon = ownsSalon(req.user.sub);
  if (!salon) return res.json([]);
  res.json(db.prepare('SELECT * FROM products WHERE salon_id = ? ORDER BY created_at DESC').all(salon.id));
});

// Orders
router.post('/orders', auth(), requireRole('customer'), (req, res) => {
  const raw = req.body?.items;
  if (!Array.isArray(raw) || raw.length === 0) return res.status(400).json({ error: 'items required' });
  if (raw.length > 50) return res.status(400).json({ error: 'Too many line items.' });

  // Aggregate quantities per product so a repeated productId can't bypass the
  // stock check, and validate every qty is a sane positive integer.
  const wanted = new Map(); // productId -> qty
  for (const it of raw) {
    const id = typeof it?.productId === 'string' ? it.productId : null;
    const qty = parseInt(it?.qty ?? 1, 10);
    if (!id) return res.status(400).json({ error: 'Each item needs a productId.' });
    if (!Number.isFinite(qty) || qty < 1 || qty > 99) {
      return res.status(400).json({ error: 'Quantity must be between 1 and 99.' });
    }
    wanted.set(id, (wanted.get(id) || 0) + qty);
  }

  const ids = [...wanted.keys()];
  const products = db.prepare(`SELECT * FROM products WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids);
  if (products.length !== ids.length) return res.status(400).json({ error: 'Some products are unavailable.' });

  const salonIds = [...new Set(products.map((p) => p.salon_id))];
  if (salonIds.length > 1) {
    return res.status(400).json({ error: 'Order can only contain products from one salon at a time.' });
  }
  const salonId = salonIds[0];

  // Reject the whole order up front if anything is out of stock.
  for (const p of products) {
    const need = wanted.get(p.id);
    if (p.stock < need) {
      return res.status(409).json({ error: `Only ${p.stock} of "${p.title}" left in stock.` });
    }
  }

  let total = 0;
  for (const p of products) total += p.price * wanted.get(p.id);
  total = Math.round(total);
  const commission = Math.round(total * COMMISSION);

  // Atomic: create order + items + decrement stock, with a guarded UPDATE that
  // can't drive stock negative even under concurrent orders.
  const placeOrder = db.transaction(() => {
    const info = db.prepare(`INSERT INTO orders (customer_id, salon_id, total, commission, status)
                             VALUES (?, ?, ?, ?, 'paid')`)
                  .run(req.user.sub, salonId, total, commission);
    const insertItem = db.prepare(`INSERT INTO order_items (order_id, product_id, title, qty, unit_price)
                                   VALUES (?, ?, ?, ?, ?)`);
    const decStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?');
    for (const p of products) {
      const need = wanted.get(p.id);
      insertItem.run(info.lastInsertRowid, p.id, p.title, need, p.price);
      const r = decStock.run(need, p.id, need);
      if (r.changes !== 1) throw new Error(`OUT_OF_STOCK:${p.title}`);
    }
    return info.lastInsertRowid;
  });

  let orderId;
  try {
    orderId = placeOrder();
  } catch (e) {
    if (String(e.message).startsWith('OUT_OF_STOCK')) {
      return res.status(409).json({ error: 'Sorry, an item just sold out. Please try again.' });
    }
    throw e;
  }
  res.json({ ok: true, orderId, total, commission });
});

router.get('/me/orders', auth(), requireRole('customer'), (req, res) => {
  const orders = db.prepare(`SELECT o.*, s.name AS salon_name FROM orders o
                             JOIN salons s ON s.id = o.salon_id
                             WHERE customer_id = ? ORDER BY o.created_at DESC`).all(req.user.sub);
  for (const o of orders) {
    o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
  }
  res.json(orders);
});

router.get('/me/salon-orders', auth(), requireRole('barber'), (req, res) => {
  const salon = ownsSalon(req.user.sub);
  if (!salon) return res.json([]);
  const orders = db.prepare(`SELECT o.*, u.name AS customer_name FROM orders o
                             JOIN users u ON u.id = o.customer_id
                             WHERE o.salon_id = ? ORDER BY o.created_at DESC`).all(salon.id);
  for (const o of orders) {
    o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
  }
  res.json(orders);
});

module.exports = router;
