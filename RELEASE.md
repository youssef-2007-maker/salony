# Releasing Salony to the App Store & Google Play

This is the real, no-handwaving checklist. Work through it top to bottom. None of the items are technically hard, but skipping one stops the launch.

---

## Honest status

What's done: a polished, multi-screen app with two complete user flows (customer + barber), real auth, real database, location-based search, a marketplace, loyalty + tiers, premium plans + boost, deals, reviews, wait-list, CRM, mini-sites, tax reports, staff management, and a payment sheet UI. **AI features are now wired to real LLM/image providers** with graceful template fallback when no key is set. **Privacy policy + terms drafts now live in `legal/`.** The Expo project is wired for EAS Build with image-picker permissions and store-URL plumbing.

What's **not** ready for store submission, in order of priority:

1. The backend runs on `localhost:4000`. Stores will reject an app that can't function on a phone in someone else's hand. (See section 1.)
2. Payment is a mock UI. Stripe/Paymob keys aren't connected, so customer money isn't moving. (See section 2.)
3. The icon and splash are placeholder PNGs Claude generated. You need real brand artwork. (See section 3.)
4. No real Apple Developer / Google Play accounts have been registered against the bundle ID. (See section 4.)
5. The privacy policy and terms drafts in `legal/` need to be (a) reviewed by a lawyer if you're in a regulated market, (b) hosted at a public URL, and (c) the URLs set in `eas.json` env. (See section 5.)
6. ~~AI features are template stubs.~~ ✅ Done. The LLM/image clients live in `backend/ai/`. Set `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` (for marketing copy) and `REPLICATE_API_TOKEN` or `OPENAI_API_KEY` (for hairstyle previews) on the host and the features go live automatically. Without keys, they fall back to templates so the UX is still complete.

Realistic path to "live in TestFlight + Play internal testing" once you have the prerequisites: **one focused day**. Public listing on both stores: 1–7 days of Apple/Google review on top.

---

## 1. Host the backend (90 min)

The Expo app now reads its API URL from `SALONY_API_URL` at build time (configured in `app.config.js` + `eas.json`).

Pick a host:

- **Render** (recommended for speed) — Free tier supports a small web service. Point it at `backend/`, set start command to `node server.js`, add a persistent disk for `salony.db`. ~10 min to deploy.
- **Fly.io** — More control, generous free tier. `fly launch` from the `backend/` folder.
- **Railway / DigitalOcean App Platform** — Also fine.
- **Your own VPS** — works, but you handle ops.

Once deployed:

1. Note your URL, e.g. `https://salony-api.onrender.com`.
2. Open `eas.json` and replace the placeholder `SALONY_API_URL` under the `production` profile with that URL.
3. Optional: set up a `staging` Render service and put its URL under the `preview` profile.
4. SSH into the host (or use Render's shell) and run `node db.js --seed` **once** to create the schema and demo data. After that, the app is your source of truth — never run `--seed` in production again, it wipes data.
5. Set a real `JWT_SECRET` env var on the host. Don't ship the dev default.

Smoke test: from your laptop, `curl https://your-url/health` should return `{"ok":true,...}`. If yes, you're done.

---

## 2. Connect real payments (2–4 hrs)

The app currently mocks payments. To go live, swap in a real processor.

**Recommended for Egypt: Paymob.** Card + Apple Pay + Fawry support. Stripe also works (cards only) and is faster to set up if you're outside Egypt.

The integration points are isolated:

- `backend/routes/billing.js` (subscribe + boost) — replace the immediate `INSERT INTO promotions` with a "create payment intent → webhook on success → flip the row" flow.
- `backend/routes/bookings.js` `/bookings/:id/pay` — same pattern.
- `backend/routes/marketplace.js` `/orders` — same pattern.
- `backend/routes/loyalty.js` `/subscribe` (Salony Plus) — same pattern.
- `src/screens/PaymentSheet.js` — replace the mock card form with the Stripe / Paymob SDK component. Stripe ships `@stripe/stripe-react-native`; Paymob has a JS SDK + iframe flow.

Apple Pay / Google Pay specifically require platform configuration:

- iOS: register a Merchant ID in your Apple Developer account, add it to `app.config.js` under `ios.entitlements`.
- Android: add Google Pay activity to AndroidManifest via an Expo plugin.

In-app subscription edge case: Apple **requires** digital subscriptions (like Salony Plus) to use Apple's In-App Purchase system, not Stripe. Real-world services (haircuts, products) can use Stripe/Paymob. Plan accordingly — either pipe Plus through StoreKit, or position it as a "premium service tier" rather than a digital subscription.

---

## 3. Real brand artwork (1 hr or designer turnaround)

Replace these placeholder files in `assets/`:

- `icon.png` — 1024×1024 PNG, no transparency, no rounded corners (Apple adds them)
- `adaptive-icon.png` — 1024×1024, foreground only, leave 25% safe padding on all sides
- `splash.png` — 1284×2778 (works on every device), brand colour background
- `favicon.png` — 48×48 for the web build

If you don't have a designer, Midjourney/DALL·E + Figma will get you something acceptable in an hour. The Apple icon guidelines page is the authoritative spec.

---

## 4. Apple Developer + Google Play accounts (1 day to provision)

- **Apple Developer Program**: \$99/yr. Sign up at developer.apple.com. Approval can take 24–48h. You can build immediately with a free dev account but submitting requires the paid one.
- **Google Play Developer**: \$25 one-time. Sign up at play.google.com/console. Approval ~1h.

While you wait:

1. Pick a real, unique bundle ID. `com.salony.app` is a placeholder — Apple won't let you use it unless you own `salony.app` domain. Update both `ios.bundleIdentifier` and `android.package` in `app.config.js` to something like `com.yourcompany.salony`.
2. Reserve the app name in App Store Connect and Google Play Console (first-come-first-served).
3. Generate an Apple Push certificate (for future push notifications).
4. Create a Google Play service account and download the JSON key into `play-service-account.json` at the project root (already gitignored — check). Update `eas.json` submit section with your Apple ID, Apple Team ID, and ASC app ID.

---

## 5. Privacy policy + terms of service (~15 min)

Drafts are already in `legal/privacy.md` and `legal/terms.md`. They're tailored to Salony's actual data flows (incl. AI sub-processors, payments via Stripe/Paymob, Egyptian law) so you mostly need to:

1. Read them once. Fix any factual inaccuracies — especially the registered business address and contact emails.
2. If you operate in the EU or take EU customers, have a lawyer skim them. The drafts are good enough for most early-stage launches but not a substitute for legal review at scale.
3. Host them somewhere public. Easiest options: drop the Markdown into a Notion page set to "share with web", or render via GitHub Pages. The URLs should be stable — don't put them on a path that might 404.
4. Set the live URLs in `eas.json` (`SALONY_PRIVACY_URL`, `SALONY_TERMS_URL`, `SALONY_SUPPORT_URL`). The app's Profile → Help & Support / Terms & Privacy menu items already link to whatever those env vars point at.
5. Paste the privacy URL into both store consoles when submitting.

---

## 6. Store listing assets (3–5 hrs)

App Store and Google Play both need:

- App name (30 chars max — "Salony" or "Salony: Book Salons")
- Subtitle (30 chars — "Cuts, color, bookings — Egypt")
- Description (4000 chars — write it once, paste in both stores)
- Keywords (Apple only, 100 chars comma-separated)
- 5+ screenshots in each device size:
  - iPhone 6.7" (1290×2796) — iPhone 15 Pro Max etc.
  - iPhone 6.5" (1242×2688) — iPhone 11 Pro Max etc.
  - iPad 12.9" (2048×2732) — if you support tablets
  - Android phone (1080×1920 minimum)
  - Android tablet (1200×1920)
- App preview videos (optional but help conversion)
- 1024×1024 icon (Apple) / 512×512 feature graphic (Google)

Tip: use the iOS Simulator's File → Save Screen Shot at 6.7" device size to capture screenshots, then add marketing text in Figma / Canva.

---

## 7. Build and submit

Once everything above is true, the actual build + submit is mechanical:

```bash
# One time
npm install -g eas-cli
eas login
eas init          # creates an EAS project, writes the ID into app.config.js

# Production builds
npm run build:ios       # → uploads .ipa to EAS, then to App Store Connect
npm run build:android   # → uploads .aab to EAS, then to Play Console

# Submit for review
npm run submit:ios
npm run submit:android
```

Build time per platform: ~15–25 min in the cloud. EAS will email you when each is done.

After submission:

- **Apple**: usually 24–48h for first review. Common rejections: missing privacy policy, missing demo login, broken sign-in flow. Provide demo creds (`demo@salony.app` / `password`) in the App Review Information section.
- **Google**: a few hours to a couple of days. First app from a new account takes longest.

For **internal testing first** (highly recommended before public release):

- Apple: builds automatically go to TestFlight. Invite testers by email — they install via TestFlight app on their phone. No review needed.
- Google: Push the build to the "internal testing" track in Play Console — same idea, instant access for ~100 testers.

Use the internal tracks to catch issues for a week before flipping the switch to public.

---

## 8. Things to fix before customers see this

Functional gaps that are fine for testing but should be polished before public launch:

- **Push notifications**: the in-app reminder system exists but pushes aren't wired up. Use `expo-notifications` + a small cron on the backend.
- **Image upload**: review photos and product images currently can't be uploaded. Add `expo-image-picker` + an S3 / Cloudinary bucket.
- ~~**Real AI**: marketing assistant and hairstyle preview use templates / a curated gallery.~~ Done — the LLM/image-gen integrations live in `backend/ai/llm.js` and `backend/ai/imagegen.js`. Just add API keys (`backend/.env.example` lists them). Without keys you get template fallback, which still ships a complete UX.
- **Real SMS**: WhatsApp/SMS confirmations are in the data model but not actually sent. Twilio or Vonage wraps this in ~30 min of code.
- **Rate limiting**: add `express-rate-limit` on auth endpoints so brute force is impossible.
- **HTTPS-only**: enforce TLS at the proxy (Render does this by default; check on other hosts).
- **Backups**: schedule daily backups of `salony.db`. Render → enable persistent disk + snapshot.
- **Error monitoring**: add Sentry (free tier) to both backend and Expo app.

None of these block submission — they just keep the experience honest at scale.

---

## Summary timeline

| Day | Work | Output |
|-----|------|--------|
| 1   | Host backend, register accounts, swap in real brand icons | App works on a real device |
| 2   | Stripe/Paymob integration + privacy policy + screenshots | Ready to build |
| 3   | EAS build + submit to TestFlight & Play internal | Testable on real phones |
| 3–10| Wait for Apple/Google review | Live in stores |

So: **a focused week** from "where you are now" to "downloadable from the App Store and Play Store", assuming you don't get blocked on a designer or payment processor approval.

---

If you want me to pick the next thing to do — host the backend on Render, swap in Stripe, or write the App Store listing copy — just say the word.
