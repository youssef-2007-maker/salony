// Small, dependency-free input validation helpers used across routes.
// Throws { status, message } style errors that the route turns into 400s.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isEmail(v) {
  return typeof v === 'string' && v.length <= 254 && EMAIL_RE.test(v);
}

// Returns a trimmed, length-bounded string or null if invalid.
function str(v, { min = 0, max = 5000 } = {}) {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (t.length < min || t.length > max) return null;
  return t;
}

function intIn(v, { min = -Infinity, max = Infinity, def = null } = {}) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return def;
  return Math.max(min, Math.min(max, n));
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ISO yyyy-mm-dd, and not in the past (date-only comparison).
function isFutureDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() >= today.getTime();
}

// A minimal-but-real password policy. >= 8 chars, contains a letter and a digit.
function passwordIssue(pw) {
  if (typeof pw !== 'string' || pw.length < 8) return 'Password must be at least 8 characters.';
  if (pw.length > 200) return 'Password is too long.';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) {
    return 'Password must contain at least one letter and one number.';
  }
  return null;
}

module.exports = { isEmail, str, intIn, num, isFutureDate, passwordIssue };
