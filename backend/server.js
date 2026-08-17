// Salony backend – Express + SQLite.
// Start with: npm start  (from inside backend/)
//
// See README / RELEASE.md for the full endpoint list.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { init } = require('./db');
const authRoutes = require('./routes/auth');
const salonRoutes = require('./routes/salons');
const bookingRoutes = require('./routes/bookings');
const barberRoutes = require('./routes/barbers');
const messageRoutes = require('./routes/messages');
const billingRoutes = require('./routes/billing');
const loyaltyRoutes = require('./routes/loyalty');
const marketplaceRoutes = require('./routes/marketplace');
const socialRoutes = require('./routes/social');
const operationsRoutes = require('./routes/operations');
const paymentRoutes = require('./routes/payments');

const IS_PROD = (process.env.SALONY_ENV || process.env.NODE_ENV) === 'production';
const app = express();

// Behind a reverse proxy (Render/Fly/Nginx) so req.ip / rate-limit work correctly.
app.set('trust proxy', 1);

// Security headers. API-only server, so no need for a CSP that blocks nothing.
app.use(helmet());

// CORS: in production, lock to an explicit allowlist (CORS_ORIGINS, comma-sep).
// In dev, reflect any origin so Expo/web/emulator all work.
const allowlist = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin(origin, cb) {
      // Native apps and curl send no Origin header — always allow those.
      if (!origin) return cb(null, true);
      if (!IS_PROD || allowlist.length === 0) return cb(null, true);
      if (allowlist.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
  })
);

// Request logging. Concise in prod, colourful in dev.
app.use(morgan(IS_PROD ? 'combined' : 'dev'));

// Default JSON limit is 100kb — too small for the AI hairstyle try-on, which
// posts a base64 selfie. 10mb gives headroom. Everything else stays small.
app.use(express.json({ limit: '10mb' }));

// Global rate limit — blunt protection against abuse / scraping.
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 200, // 200 req/min/IP across the whole API
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests, please slow down.' },
  })
);

// Tight limiter for auth — stops credential-stuffing / brute force.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20, // 20 attempts / 15 min / IP
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in a few minutes.' },
});

// Health checks
app.get('/', (_req, res) => res.json({ ok: true, service: 'salony-backend' }));
app.get('/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use('/auth', authLimiter, authRoutes);
app.use('/salons', salonRoutes);
app.use('/bookings', bookingRoutes);
app.use('/barbers', barberRoutes);
app.use('/messages', messageRoutes);
app.use('/billing', billingRoutes);
app.use('/loyalty', loyaltyRoutes);
app.use('/marketplace', marketplaceRoutes);
app.use('/social', socialRoutes);
app.use('/ops', operationsRoutes);
app.use('/payments', paymentRoutes);

// 404 for unknown routes
app.use((req, res) => res.status(404).json({ error: `Not found: ${req.method} ${req.path}` }));

// Final error handler — never leak stack traces / internals in production.
app.use((err, _req, res, _next) => {
  if (err && err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    error: IS_PROD && status === 500 ? 'Server error' : err.message || 'Server error',
  });
});

init();

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  console.log(`Salony backend listening on http://localhost:${PORT}`);
});

// Graceful shutdown so in-flight requests finish and the DB closes cleanly.
function shutdown() {
  console.log('Shutting down…');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = app;
