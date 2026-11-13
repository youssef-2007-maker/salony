# Salony

A salon & barbershop booking app for Egypt — React Native + Expo on the front end, Node + Express + SQLite on the back. Customers book; barbers manage their salons.

## Run it (two terminals)

### Terminal 1 — backend

```bash
cd backend
npm install          # first time
node db.js --seed    # creates SQLite DB + demo data (first time)
npm start
```

Listens on http://localhost:4000.

### Terminal 2 — Expo app

```bash
# from the project root
npm install          # first time
npx expo start --ios
```

Press `i` in the Expo CLI if the simulator doesn't open automatically.

## Demo logins

| Role     | Email                | Password   |
|----------|----------------------|------------|
| Customer | demo@salony.app      | password   |
| Barber   | mohamed@salony.app   | password   |
| Barber   | cynthia@salony.app   | password   |
| Barber   | nour@salony.app      | password   |

Or sign up fresh — the signup screen has a Customer/Barber role toggle.

## What's in the box

**Customer:** Browse salons sorted by distance from the user's GPS, search/filter by category, view a salon's services + barbers, book an appointment, see upcoming / past bookings, favourite salons, message a salon, edit profile.

**Barber:** Daily dashboard with today's stats and incoming bookings, mark bookings done or declined, create/edit your salon (name, category, address, hours, services), and pin the salon to your current device location so customers nearby see you under "Recommended near you".

## Architecture

```
backend/                Node + Express + SQLite (better-sqlite3)
  server.js             entrypoint
  db.js                 schema + seed
  middleware/auth.js    JWT verification
  routes/auth.js        signup, login, /me
  routes/salons.js      list / recommended (haversine) / single / favourites
  routes/bookings.js    create, list, status updates (customer + barber)
  routes/barbers.js     barber's own salon CRUD + services
  routes/messages.js    inbox threads

src/                    React Native (Expo SDK 51)
  api/client.js         fetch wrapper, AsyncStorage token, base URL
  state/AuthContext.js  signup / login / logout
  state/LocationContext.js  expo-location permission + GPS
  state/FavouritesContext.js
  state/BookingsContext.js
  navigation/           AuthNavigator, customer TabNavigator, BarberNavigator,
                        gated in RootNavigator by user role
  screens/              customer screens
  screens/barber/       barber screens
  data/salons.js        static category catalogue (icons + labels)
  data/dates.js         calendar + time-slot helpers
```

## Location

The app uses `expo-location` to request foreground location once on launch. If granted, the home screen's "Recommended" list is sorted by Haversine distance from the user's coordinates (server-side). If denied, it falls back to a Cairo coordinate so the experience still works.

Barbers set their salon's pin from the dashboard or salon editor by tapping "Use my current location" — that's the coordinate customers see distance from.

## Tech notes

- The Expo app reads the API base URL from `app.json → extra.apiUrl` (default `http://localhost:4000`). On Android emulator, `localhost` is auto-rewritten to `10.0.2.2` so the host machine is reachable.
- For a real device (not the simulator), set `apiUrl` in `app.json` to your Mac's LAN IP, e.g. `http://192.168.1.24:4000`, and make sure the phone is on the same Wi-Fi.
- Tokens are stored in `AsyncStorage` under `@salony/token` and sent as `Authorization: Bearer …`.
- The backend's JWT secret is `process.env.JWT_SECRET` (defaults to a dev string — set it in production).

## Deploy later

`eas.json` is already wired for EAS Build (Expo's cloud build service). When you're ready for the App Store / Play Store, host the backend (Render, Fly.io, Railway, your own VPS), then change `app.json → extra.apiUrl` to that public URL before building.

## Web app (live site)

The same codebase builds a web app. One server hosts both the website and the API:

```bash
npm install
npx expo export --platform web   # builds the site into dist/
cd backend && npm install && npm start
# open http://localhost:4000 — the web app; the API is at /api/...
```

- On web the app calls the API on the same domain under `/api`; native builds keep using `/...` on `SALONY_API_URL`.
- The site is an installable PWA (Add to Home Screen on iPhone / Install app on Android & Chrome).
- A fresh, empty database is seeded with demo salons on first boot (`SALONY_AUTO_SEED=false` to disable).
- Deploy: `render.yaml` at the repo root is a Render Blueprint (Render → New → Blueprint → this repo).
