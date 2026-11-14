// Feature gates for the live launch.
//
// Payments: anything that would charge money (in-app card payment, deposits,
// Salony Plus, barber Premium/Boost) only works once real Paymob keys are set.
// Without them those endpoints refuse instead of pretending to charge.
//
// Subscriptions (Salony Plus, barber Premium/Boost): their billing isn't wired to
// a real payment yet, so they stay off until SUBSCRIPTIONS_ENABLED=true.
//
// Marketplace: switched off until launch. Set MARKETPLACE_ENABLED=true to open it.
const paymob = require('../payments/paymob');

const paymentsEnabled = () => paymob.isEnabled();
const marketplaceEnabled = () => process.env.MARKETPLACE_ENABLED === 'true';
const subscriptionsEnabled = () => process.env.SUBSCRIPTIONS_ENABLED === 'true';

function requirePayments(_req, res, next) {
  if (paymentsEnabled()) return next();
  return res.status(503).json({ error: 'In-app payments are coming soon.' });
}

function requireSubscriptions(_req, res, next) {
  if (subscriptionsEnabled()) return next();
  return res.status(503).json({ error: 'Subscriptions are coming soon.' });
}

function requireMarketplace(_req, res, next) {
  if (marketplaceEnabled()) return next();
  return res.status(503).json({ error: 'The marketplace is coming soon.' });
}

module.exports = {
  paymentsEnabled, marketplaceEnabled, subscriptionsEnabled,
  requirePayments, requireMarketplace, requireSubscriptions,
};
