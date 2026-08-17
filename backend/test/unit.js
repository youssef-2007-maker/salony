// Pure unit tests — no DB, no server. Run: node test/unit.js
// Covers the security-critical Paymob HMAC verifier and input validators.

const crypto = require('crypto');
process.env.PAYMOB_HMAC_SECRET = process.env.PAYMOB_HMAC_SECRET || 'testhmac';
const pm = require('../payments/paymob');
const v = require('../lib/validate');

let pass = 0, fail = 0;
const t = (c, m) => { c ? pass++ : (fail++, console.log('  ✗ ' + m)); };

const obj = {
  amount_cents: 25000, created_at: '2026-01-01', currency: 'EGP', error_occured: false,
  has_parent_transaction: false, id: 123, integration_id: 999, is_3d_secure: true,
  is_auth: false, is_capture: false, is_refunded: false, is_standalone_payment: true,
  is_voided: false, order: { id: 555 }, owner: 7,
  source_data: { pan: '2346', sub_type: 'MasterCard', type: 'card' }, success: true,
};
const fields = ['amount_cents','created_at','currency','error_occured','has_parent_transaction','id','integration_id','is_3d_secure','is_auth','is_capture','is_refunded','is_standalone_payment','is_voided','order.id','owner','source_data.pan','source_data.sub_type','source_data.type','success'];
const pick = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const concat = fields.map((f) => { const x = pick(obj, f); return x === true ? 'true' : x === false ? 'false' : (x == null ? '' : String(x)); }).join('');
const good = crypto.createHmac('sha512', process.env.PAYMOB_HMAC_SECRET).update(concat).digest('hex');

t(pm.verifyHmac(obj, good) === true, 'verifyHmac accepts a valid signature');
t(pm.verifyHmac(obj, '00' + good.slice(2)) === false, 'verifyHmac rejects a tampered signature');
t(pm.verifyHmac(obj, '') === false, 'verifyHmac rejects empty signature');

t(v.isEmail('a@b.com') && !v.isEmail('nope'), 'isEmail');
t(!!v.passwordIssue('short') && !v.passwordIssue('Strong123'), 'password policy');
t(v.isFutureDate('2099-01-01') && !v.isFutureDate('2000-01-01') && !v.isFutureDate('x'), 'isFutureDate');
t(v.intIn('5', { min: 1, max: 10 }) === 5 && v.intIn('99', { min: 1, max: 10 }) === 10, 'intIn clamps');

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
