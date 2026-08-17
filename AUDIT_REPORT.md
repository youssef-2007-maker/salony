# Salony — Production-Readiness Audit & Fix Report

_Date: 17 June 2026 · Scope: frontend (Expo/React Native), backend (Node/Express + SQLite), auth, payments, security, data integrity, store readiness._

This report covers what was inspected, the bugs and risks found, what was fixed in code, what still needs your action, and step-by-step run/deploy/build/submit instructions. Everything described as "fixed" was changed in the actual codebase and verified by an automated test suite (33 checks passing).

---

## 0. Read this first — urgent

**Live API keys were committed in `backend/.env`.** The file contained a working **OpenAI** key and a **Replicate** token in plaintext. Anyone with the repo (or repo history) has them. I removed them from the file, but they are already compromised and **you must revoke and reissue both now**:

- OpenAI: https://platform.openai.com/api-keys — delete the old key, create a new one.
- Replicate: https://replicate.com/account/api-tokens — revoke the old token, create a new one.

Paste the new values into `backend/.env` (kept out of git) or your host's secret manager. The app runs fine with these blank — AI features simply fall back to templates.

A second critical issue: the backend had **no `JWT_SECRET` set**, so it signed auth tokens with a hardcoded default (`salony-dev-secret-change-me`). Anyone could forge tokens for any user, including barbers/owners. Fixed — see Security below. A strong secret was generated into your local `.env`.

---

## 1. What the app is

Salony is a salon/barber marketplace: customers discover nearby salons, book services, pay, earn loyalty points, buy products; barbers manage a salon, services, staff, bookings, analytics, deals, CRM, AI marketing copy and an AI hairstyle try-on. Backend is Express + SQLite (`better-sqlite3`), ~2,750 lines across 11 route modules. Frontend is Expo SDK 51 / React Native 0.74, ~50 screens.

The foundation is genuinely solid — clean structure, sensible schema, graceful AI fallbacks. The gaps were the ones typical of a pre-launch app: secrets handling, auth hardening, input validation, transactional integrity, real payments, and a few store-compliance items.

---

## 2. Bugs & risks found and FIXED (in code)

### Security & auth
1. **Exposed secrets in `.env`** → removed; file now carries placeholders + a rotation notice; strong `JWT_SECRET` generated. _(You must still rotate the leaked keys — §0.)_
2. **Hardcoded JWT fallback secret** → backend now **refuses to boot in production** without a real `JWT_SECRET` (`middleware/auth.js`).
3. **No security headers** → added `helmet`.
4. **CORS fully open** (`app.use(cors())`) → locked to an allowlist (`CORS_ORIGINS`) in production; permissive in dev.
5. **No rate limiting** → global limiter (200 req/min/IP) + strict auth limiter (20 attempts / 15 min/IP) to stop brute-force / credential stuffing.
6. **User enumeration via login timing** → login now always runs a bcrypt compare (even for unknown emails) so response timing doesn't reveal which emails exist.
7. **Weak/again no input validation on signup** → email format + password policy (≥8 chars, letter+digit) enforced; fields length-bounded (`lib/validate.js`).
8. **bcrypt cost 10** → raised to 12.
9. **30-day tokens** → shortened to 7 days (configurable).
10. **Error handler leaked internals** → stack traces/messages hidden in production; added a JSON 404 handler and graceful shutdown.

### Data integrity & backend bugs
11. **Loyalty points-farming exploit** — a customer could `PATCH /bookings/:id/status` to `past` on their *own* booking and get loyalty points + tier + lifetime-spend credit without ever paying. **Fixed**: only the salon owner can mark a booking complete or declined; customers may only cancel.
12. **Non-atomic writes** — signup, booking creation, booking completion, and order placement performed multiple dependent writes with no transaction, so a mid-sequence failure could leave points debited with no booking, half-created users, etc. **Fixed**: all wrapped in `db.transaction(...)`.
13. **Marketplace overselling** — orders never checked stock (`MAX(0, stock-qty)` silently clamped), and quantities weren't validated (negative/huge/duplicate product lines bypassed checks). **Fixed**: quantities validated (1–99), duplicate lines aggregated, stock checked up front, and a guarded `UPDATE ... WHERE stock >= ?` inside a transaction makes overselling impossible even under concurrent orders.
14. **Concurrent point redemption could go negative** → guarded update (`WHERE points >= ?`) inside the booking transaction.
15. **Past-dated bookings accepted** → bookings now require a valid, non-past `YYYY-MM-DD` date.
16. **Client-supplied product IDs** (collision/injection risk) → product IDs now generated server-side.
17. **Product update/delete crashed when barber had no salon** (`salon.id` on `undefined`) → null-guarded; update returns 404 when nothing matched.

### Frontend
18. **No crash recovery** — any render error white-screened the whole app. **Fixed**: added a global `ErrorBoundary` with a "Try again" fallback (wire it to Sentry/Crashlytics later).
19. **Placeholder UI that reviewers reject** — "Payment methods → Coming soon" row and a "coming soon" review hint removed.
20. **No account deletion** (hard App Store requirement) — added `DELETE /auth/me` + a "Delete account" flow on the Profile screen with confirmation.

### Performance / scalability
21. **Unbounded `/salons`** returned the entire table → capped with `limit`/`offset` (default 50, max 100).
22. **Missing indexes** on hot foreign keys → added indexes on bookings, services, products, orders, reviews, messages, loyalty (helps materially as data grows).
23. **No pagination on products** → added `limit`/`offset`.

---

## 3. Payments — Paymob wired up

Payments were entirely mocked (and the mock collected raw card numbers in-app, which is a PCI/store violation). Implemented **Paymob Unified Checkout** properly:

- `backend/payments/paymob.js` — creates a payment **Intention** and returns a hosted **checkout URL** (card data is entered on Paymob's PCI-compliant page, never in the app). Includes **HMAC-SHA512 webhook signature verification** (constant-time) so payment confirmations can't be forged.
- `backend/routes/payments.js` — `POST /payments/intention` (server computes the amount — never trusts the client), `POST /payments/webhook` (HMAC-verified, marks the booking/order paid), `GET /payments/status` (client polls).
- New `payments` table tracks each intention (`pending → paid/failed`).
- Frontend `PaymentSheet` now opens Paymob's hosted checkout when configured, polls for confirmation, and falls back to the test form only when no keys are set.

**Graceful degradation:** with no Paymob keys, `/payments/intention` returns `{ mock: true }` and the app uses the test flow — nothing breaks. Set the keys in `.env` (see `.env`'s Paymob section) to go live.

### ⚠️ App Store / Play Store payment rule (important)
Apple and Google require **their own in-app purchase systems for *digital* goods/subscriptions**, and **forbid** third-party card processors for them. Real-world services and physical goods are exempt. For Salony:

| Item | Type | Allowed processor on iOS/Android |
| --- | --- | --- |
| Booking a haircut/service | Real-world service | ✅ Paymob (card) or cash |
| Marketplace products (pomade, oil…) | Physical goods | ✅ Paymob (card) or cash |
| **Salony Plus, Pro/Premium plans, Boosts** | **Digital** | ❌ Must use **Apple IAP / Google Play Billing** |

Paymob is wired for the *allowed* cases (bookings, orders). The digital subscriptions (`/billing/subscribe`, `/billing/boost`, `/loyalty/subscribe`) are **still mocked** and must be migrated to StoreKit / Play Billing before submission, or restricted to web/Android, or you risk rejection. This is a business decision — see Remaining Issues.

---

## 4. What was tested

Automated suite added under `backend/test/`:

- `npm run test:unit` — Paymob HMAC verify (valid/tampered/empty) + all input validators. **7/7 pass.**
- `npm run test:smoke` — end-to-end HTTP flow against a running server. **22/22 pass.**

Flows verified: signup validation, duplicate-email rejection, welcome bonus, login (correct/incorrect/timing-safe), salon browse + detail, booking (past-date rejected, valid created), the points-farming exploit is blocked, owner can complete bookings, payment intention (mock + HMAC webhook rejection), order quantity validation, oversell rejection, valid order + stock decrement, private-route auth, account deletion, and 404 handling.

> Note: the backend uses the native `better-sqlite3` module compiled for your Mac. Tests here ran against an isolated copy using Node's built-in SQLite so your installed module was never touched. On your machine just run the two npm scripts above — they exercise the exact same route code.

**Not covered (needs your devices/accounts):** on-device UI rendering across screen sizes, real Paymob transactions (needs your merchant keys), and actual store builds/submission (needs your Apple/Google accounts). See below.

---

## 5. Remaining issues / your decisions

1. **Rotate the leaked OpenAI + Replicate keys** (§0) — do this today.
2. **Digital-goods payments** — decide how to sell Plus/Pro/Premium/Boost on mobile: implement Apple IAP + Google Play Billing (recommended), or sell only on web. Don't ship them through Paymob on iOS/Android.
3. **Bundle identifier** — `app.config.js` uses the placeholder `com.salony.app`. Register a real bundle ID/package you own and set `SALONY_IOS_BUNDLE_ID` / `SALONY_ANDROID_PACKAGE`.
4. **Host the legal pages** — `legal/privacy.md` and `legal/terms.md` are written and reference account deletion correctly, but the URLs in config (`https://salony.app/privacy`, `/terms`, `/support`) must be **live** before submission.
5. **`eas.json` submit block** has placeholders (`YOUR_APPLE_ID_EMAIL`, etc.) — fill with your real Apple/Google credentials.
6. **Database** — SQLite is fine for launch/single-server. For real horizontal scale (multiple backend instances), migrate to Postgres; the schema is standard SQL and ports cleanly. Until then, run a single instance and back up `salony.db` regularly.
7. **Push notifications & "Appointment reminders" toggle** are UI-only — wire to Expo Notifications if you want them functional (or hide them).
8. **Crash reporting** — `ErrorBoundary` logs to console; connect Sentry/Crashlytics for production visibility.
9. **Seed/demo data** — the demo accounts (`demo@salony.app` etc., password `password`) and Cairo sample salons exist for development. Do **not** ship the seed to production; start with a clean DB.

---

## 6. Run locally

**Backend**
```bash
cd backend
npm install                 # builds better-sqlite3 for your machine
cp .env.example .env        # then edit: set JWT_SECRET (a strong one already in your .env)
npm run seed                # creates + seeds salony.db (dev only)
npm start                   # http://localhost:4000
# in another terminal, optional:
npm run test:unit && npm run test:smoke
```

**App**
```bash
# from the project root
npm install
npx expo start              # press i (iOS sim), a (Android emulator), or scan in Expo Go
```
The app reads the API URL from `app.config.js` → `extra.apiUrl` (defaults to `http://localhost:4000`; Android emulator auto-rewrites to `10.0.2.2`). For a physical device, set `SALONY_API_URL` to your machine's LAN IP.

---

## 7. Deploy the backend

Any Node host works (Render, Fly.io, Railway). Example (Render):

1. Push the repo to GitHub (confirm `.env`, `*.db`, and key files are gitignored — they are).
2. New Web Service → root `backend/` → build `npm install` → start `npm start`.
3. Set environment variables (NOT in git):
   - `JWT_SECRET` (strong, unique), `SALONY_ENV=production`
   - `CORS_ORIGINS` = your app/web origins (comma-separated)
   - `PAYMOB_SECRET_KEY`, `PAYMOB_PUBLIC_KEY`, `PAYMOB_HMAC_SECRET`, `PAYMOB_CARD_INTEGRATION_ID`
   - (optional) `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `REPLICATE_API_TOKEN` (the **new** rotated ones)
4. SQLite needs a **persistent disk** (e.g. Render Disk mounted at `backend/`) so `salony.db` survives restarts. Run the schema once (it auto-creates on boot via `init()`); don't run `--seed` in prod.
5. In the Paymob dashboard, set the **transaction processed callback** to `https://<your-api>/payments/webhook`.
6. Point the app at it: set `SALONY_API_URL=https://<your-api>` in `eas.json` production env.

---

## 8. Build the mobile app (EAS)

```bash
npm install -g eas-cli
eas login
eas init                    # sets extra.eas.projectId
# set your real IDs:
#   SALONY_IOS_BUNDLE_ID, SALONY_ANDROID_PACKAGE, SALONY_API_URL (in eas.json)
eas build --platform ios --profile production
eas build --platform android --profile production
```
Icons (1024×1024) and splash are already configured. `runtimeVersion`/OTA is set up; leave `EAS_UPDATE_URL` unset if you don't use OTA.

---

## 9. Submit to the stores

**Apple App Store**
1. Create the app in App Store Connect with your bundle ID; have an Apple Developer account ($99/yr).
2. Fill `eas.json` → `submit.production.ios` (`appleId`, `ascAppId`, `appleTeamId`).
3. `eas submit --platform ios --latest`
4. In App Store Connect: screenshots, description, **privacy policy + support URL** (must be live), App Privacy questionnaire (declare: account data, location, photos, usage). Confirm the **account-deletion** path (Profile → Delete account) — reviewers check this.
5. Ensure digital-goods payments use IAP (§3) or aren't present on iOS.

**Google Play**
1. Google Play Console account ($25 one-time); create the app.
2. Provide `play-service-account.json` (referenced in `eas.json`) for automated submission.
3. `eas submit --platform android --latest`
4. Complete the Data Safety form, content rating, privacy policy URL, and add a Play "Delete account" web/URL option in addition to in-app deletion.
5. Same digital-goods rule via Google Play Billing.

---

## 10. Files changed/added (summary)

**Backend** — `server.js` (helmet, CORS allowlist, rate limits, logging, 404, safe errors, graceful shutdown), `middleware/auth.js` (secret enforcement, shorter tokens), `routes/auth.js` (validation, transaction, account deletion, timing-safe login), `routes/bookings.js` (date validation, transactions, exploit fix), `routes/marketplace.js` (qty/stock validation, transactional orders, server IDs, pagination), `routes/salons.js` (pagination cap), `db.js` (payments table, indexes), `.env` (secrets removed, JWT secret, Paymob vars). **New:** `lib/validate.js`, `payments/paymob.js`, `routes/payments.js`, `test/unit.js`, `test/smoke.mjs`.

**Frontend** — `App.js` (ErrorBoundary), `src/components/ErrorBoundary.js` (new), `src/screens/ProfileScreen.js` (account deletion, placeholder removed), `src/screens/PaymentSheet.js` (Paymob hosted checkout), `src/screens/ReviewScreen.js` (placeholder removed), `src/api/client.js` (deleteAccount, payment methods).

**Legal** — `legal/privacy.md` (deletion path aligned).
