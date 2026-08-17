const jwt = require('jsonwebtoken');

const IS_PROD = (process.env.SALONY_ENV || process.env.NODE_ENV) === 'production';
const DEV_SECRET = 'salony-dev-secret-change-me';

// In production a real JWT_SECRET is mandatory. Falling back to the shared dev
// secret would let anyone forge admin/barber tokens, so we fail fast at boot
// rather than run insecurely.
if (IS_PROD && (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEV_SECRET)) {
  throw new Error(
    'FATAL: JWT_SECRET must be set to a strong, unique value in production. ' +
    'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
  );
}

const SECRET = process.env.JWT_SECRET || DEV_SECRET;
// 7-day access tokens (was 30d). Shorter window limits the blast radius of a
// leaked token. Override with JWT_EXPIRES_IN if you add refresh tokens later.
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function sign(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email, name: user.name },
    SECRET,
    { expiresIn: EXPIRES_IN }
  );
}

function auth(required = true) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      if (!required) return next();
      return res.status(401).json({ error: 'Missing token' });
    }
    try {
      req.user = jwt.verify(token, SECRET);
      next();
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Auth required' });
    if (req.user.role !== role) return res.status(403).json({ error: `${role} only` });
    next();
  };
}

module.exports = { sign, auth, requireRole, SECRET };
