// HTTP smoke test for the main user flows. Run against a RUNNING backend:
//   1. node db.js --seed        (fresh seed)
//   2. npm start                (in another terminal)
//   3. node test/smoke.mjs      (or: BASE=https://api.salony.app node test/smoke.mjs)
//
// Exits non-zero if any check fails. Safe to run repeatedly (uses random emails).

const BASE = process.env.BASE || 'http://localhost:4000';
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; } else { fail++; console.log('  ✗ ' + m); } }
async function j(method, path, body, token) {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let d = null; const t = await r.text();
  try { d = JSON.parse(t); } catch { d = t; }
  return { status: r.status, d };
}
const rnd = Math.random().toString(36).slice(2, 8);

let r = await j('POST', '/auth/signup', { email: 'bad', password: 'short', name: 'X', role: 'customer' });
ok(r.status === 400, 'signup rejects invalid email/password');
r = await j('POST', '/auth/signup', { email: `c_${rnd}@t.com`, password: 'weakpass', name: 'No Digit', role: 'customer' });
ok(r.status === 400, 'signup rejects password without a digit');
r = await j('POST', '/auth/signup', { email: `c_${rnd}@t.com`, password: 'Strong123', name: 'Cust ' + rnd, role: 'customer' });
ok(r.status === 200 && r.d.token, 'customer signup works + returns token');
const custToken = r.d.token;
r = await j('POST', '/auth/signup', { email: `c_${rnd}@t.com`, password: 'Strong123', name: 'Dup', role: 'customer' });
ok(r.status === 409, 'duplicate email rejected (409)');

r = await j('GET', '/loyalty/me', null, custToken);
ok(r.d.points === 100, 'welcome bonus = 100 pts');

r = await j('POST', '/auth/login', { email: `c_${rnd}@t.com`, password: 'wrongpass9' });
ok(r.status === 401, 'login wrong password -> 401');
r = await j('POST', '/auth/login', { email: `c_${rnd}@t.com`, password: 'Strong123' });
ok(r.status === 200 && r.d.token, 'login correct -> token');

r = await j('GET', '/salons');
ok(r.status === 200 && Array.isArray(r.d) && r.d.length > 0, 'list salons works');
r = await j('GET', '/salons/the-barber-shop');
ok(r.d.services && r.d.services.length > 0, 'salon detail has services');
const svc = r.d.services[0];

r = await j('POST', '/bookings', { salonId: 'the-barber-shop', serviceId: svc.id, date: '2020-01-01', time: '11:00 AM' }, custToken);
ok(r.status === 400, 'booking with past date rejected');
r = await j('POST', '/bookings', { salonId: 'the-barber-shop', serviceId: svc.id, date: '2027-01-01', time: '11:00 AM' }, custToken);
ok(r.status === 200 && r.d.id, 'valid future booking created');
const bookingId = r.d.id;

r = await j('PATCH', `/bookings/${bookingId}/status`, { status: 'past' }, custToken);
ok(r.status === 403, 'customer cannot complete own booking (points-farming blocked)');
let br = await j('POST', '/auth/login', { email: 'mohamed@salony.app', password: 'password' });
ok(br.status === 200, 'seed barber login');
r = await j('PATCH', `/bookings/${bookingId}/status`, { status: 'past' }, br.d.token);
ok(r.status === 200, 'salon owner can complete booking');

r = await j('POST', '/payments/intention', { refType: 'booking', refId: bookingId }, custToken);
ok(r.status === 200 && (r.d.mock === true || r.d.checkoutUrl), 'payment intention (mock or real)');
r = await j('POST', '/payments/webhook', { obj: { id: 1, success: true }, hmac: 'deadbeef' });
ok(r.status === 401, 'payment webhook rejects bad HMAC');

r = await j('POST', '/marketplace/orders', { items: [{ productId: 'p-pomade-classic', qty: -3 }] }, custToken);
ok(r.status === 400, 'order rejects negative qty');
r = await j('POST', '/marketplace/orders', { items: [{ productId: 'p-pomade-classic', qty: 30 }] }, custToken);
ok(r.status === 409, 'order rejects oversell');
r = await j('POST', '/marketplace/orders', { items: [{ productId: 'p-pomade-classic', qty: 2 }] }, custToken);
ok(r.status === 200 && r.d.orderId, 'valid order placed');

r = await j('GET', '/bookings');
ok(r.status === 401, 'private route requires token');
r = await j('DELETE', '/auth/me', null, custToken);
ok(r.status === 200 && r.d.deleted, 'account deletion works');
r = await j('GET', '/nope/nope');
ok(r.status === 404, 'unknown route -> 404 json');

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
