// Salony backend – Express app (shared by server.js and the Netlify function).
//
// See README / RELEASE.md for the full endpoint list.

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// Client IP for rate limiting. Visitors arrive through the Cloudflare Worker
// (Netlify is blocked by Egyptian ISPs), which passes the real visitor IP in
// x-salony-client-ip. Direct Netlify traffic uses Netlify's own header;
// elsewhere Express derives it from X-Forwarded-For (trust proxy).
const clientKey = (req) =>
  ipKeyGenerator(String(
    req.headers['x-salony-client-ip'] ||
    req.headers['x-nf-client-connection-ip'] ||
    req.ip || '0.0.0.0'
  ));

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
// CSP is disabled because the same server also hosts the web app bundle,
// which loads remote salon images and fonts.
// frameguard is off so the app can also be shown inside the Hugging Face
// Spaces page, which embeds it in an iframe.
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, frameguard: false }));

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
    keyGenerator: clientKey,
    validate: { ip: false },
    message: { error: 'Too many requests, please slow down.' },
  })
);

// Tight limiter for auth — stops credential-stuffing / brute force.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20, // 20 attempts / 15 min / IP
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: clientKey,
  validate: { ip: false },
  message: { error: 'Too many attempts. Try again in a few minutes.' },
});

// Health checks
app.get('/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// All API routes live on one router, mounted twice:
//   /api/...  used by the web app (same origin as the site)
//   /...      used by the native iOS/Android builds (unchanged paths)
const api = express.Router();
api.get('/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
api.use('/auth', authLimiter, authRoutes);
api.use('/salons', salonRoutes);
api.use('/bookings', bookingRoutes);
api.use('/barbers', barberRoutes);
api.use('/messages', messageRoutes);
api.use('/billing', billingRoutes);
api.use('/loyalty', loyaltyRoutes);
api.use('/marketplace', marketplaceRoutes);
api.use('/social', socialRoutes);
api.use('/ops', operationsRoutes);
api.use('/payments', paymentRoutes);

app.use('/api', api);
// Netlify Functions may pass the function path through unchanged.
app.use('/.netlify/functions/api', api);
app.use('/api', (req, res) => res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` }));

// Web app: serve the Expo web export (../dist) if it has been built.
const WEB_DIR = process.env.SALONY_WEB_DIR || path.join(__dirname, '..', 'dist');
const HAS_WEB = fs.existsSync(path.join(WEB_DIR, 'index.html'));
if (HAS_WEB) {
  app.use(
    express.static(WEB_DIR, {
      index: 'index.html',
      setHeaders(res, filePath) {
        // Hashed bundles can be cached forever; index.html must always be fresh.
        if (filePath.endsWith('index.html') || filePath.endsWith('sw.js')) {
          res.setHeader('Cache-Control', 'no-cache');
        } else if (filePath.includes(`${path.sep}_expo${path.sep}`) || filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    })
  );
} else {
  app.get('/', (_req, res) => res.json({ ok: true, service: 'salony-backend' }));
}

app.use(api);

// Browser navigations to unknown paths get the web app (SPA fallback);
// everything else gets a JSON 404.
app.use((req, res) => {
  if (HAS_WEB && req.method === 'GET' && (req.headers.accept || '').includes('text/html')) {
    res.setHeader('Cache-Control', 'no-cache');
    return res.sendFile(path.join(WEB_DIR, 'index.html'));
  }
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
});

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

// Local development only: opt in with SALONY_AUTO_SEED=true to load demo salons
// into an empty database. Never on by default, so real deployments start clean.
if (process.env.SALONY_AUTO_SEED === 'true') {
  const { db, seed } = require('./db');
  const users = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (users === 0) {
    console.log('Empty database — seeding demo data');
    seed();
  }
}

module.exports = app;
