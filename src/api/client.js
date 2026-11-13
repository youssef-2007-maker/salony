// Thin fetch wrapper for the Salony backend.
// API URL comes from app.json -> extra.apiUrl. Override per-platform if needed.

import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = '@salony/token';

function resolveBaseUrl() {
  // Web build: the API is served from the same server as the web app, under
  // /api. Only when running the Expo dev server (port 8081) do we fall back to
  // the configured apiUrl (usually http://localhost:4000).
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.port !== '8081') {
    return `${window.location.origin}/api`;
  }

  const fromConfig =
    Constants?.expoConfig?.extra?.apiUrl ||
    Constants?.manifest?.extra?.apiUrl ||
    'http://localhost:4000';

  // Android emulator can't reach the host's "localhost" — it sees the host as 10.0.2.2.
  if (Platform.OS === 'android' && fromConfig.includes('localhost')) {
    return fromConfig.replace('localhost', '10.0.2.2');
  }
  return fromConfig;
}

export const API_URL = resolveBaseUrl();

let memoryToken = null;

export async function loadToken() {
  if (memoryToken) return memoryToken;
  try {
    memoryToken = await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    memoryToken = null;
  }
  return memoryToken;
}

export async function saveToken(token) {
  memoryToken = token;
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = 'GET', body, query, auth = true, timeoutMs = 8000 } = {}) {
  const token = auth ? await loadToken() : null;
  const url = new URL(path.startsWith('http') ? path : `${API_URL}${path}`);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    });
  }

  // Abort after timeoutMs so an unreachable backend doesn't hang the UI forever.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(url.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      const err = new Error("Can't reach Salony right now. Check your connection and try again.");
      err.status = 0;
      throw err;
    }
    const err = new Error(e.message || 'Network error');
    err.status = 0;
    throw err;
  }
  clearTimeout(timer);

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!res.ok) {
    const message = (data && data.error) || `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  // auth
  signup: (body) => request('/auth/signup', { method: 'POST', body, auth: false }),
  login: (body) => request('/auth/login', { method: 'POST', body, auth: false }),
  me: () => request('/auth/me'),
  deleteAccount: () => request('/auth/me', { method: 'DELETE' }),

  // salons
  listSalons: (query) => request('/salons', { query, auth: false }),
  recommendedSalons: (query) => request('/salons/recommended', { query, auth: false }),
  featuredSalons: (query) => request('/salons/featured', { query, auth: false }),
  salon: (id, query) => request(`/salons/${id}`, { query, auth: false }),
  categories: () => request('/salons/meta/categories', { auth: false }),

  // favourites
  favourites: (query) => request('/salons/me/favourites', { query }),
  addFavourite: (id) => request(`/salons/${id}/favourite`, { method: 'POST' }),
  removeFavourite: (id) => request(`/salons/${id}/favourite`, { method: 'DELETE' }),

  // bookings
  bookings: () => request('/bookings'),
  createBooking: (body) => request('/bookings', { method: 'POST', body }),
  updateBookingStatus: (id, status) =>
    request(`/bookings/${id}/status`, { method: 'PATCH', body: { status } }),

  // barber
  mySalon: () => request('/barbers/me/salon'),
  createSalon: (body) => request('/barbers/me/salon', { method: 'POST', body }),
  updateSalon: (body) => request('/barbers/me/salon', { method: 'PATCH', body }),
  addService: (body) => request('/barbers/me/services', { method: 'POST', body }),
  removeService: (id) => request(`/barbers/me/services/${id}`, { method: 'DELETE' }),

  // messages
  messages: () => request('/messages'),

  // billing / analytics / marketing
  plans: () => request('/billing/plans', { auth: false }),
  subscribe: (plan) => request('/billing/subscribe', { method: 'POST', body: { plan } }),
  boost: (days) => request('/billing/boost', { method: 'POST', body: { days } }),
  analytics: (range) => request('/billing/analytics', { query: { range } }),
  promotions: () => request('/billing/promotions'),

  // loyalty
  loyalty: () => request('/loyalty/me'),
  loyaltyTiers: () => request('/loyalty/tiers', { auth: false }),
  redeemQuote: (body) => request('/loyalty/redeem-quote', { method: 'POST', body }),
  subscribePlus: () => request('/loyalty/subscribe', { method: 'POST' }),
  unsubscribePlus: () => request('/loyalty/unsubscribe', { method: 'POST' }),
  applyReferral: (code) => request('/loyalty/apply-referral', { method: 'POST', body: { code } }),

  // marketplace
  products: (query) => request('/marketplace/products', { query, auth: false }),
  product: (id) => request(`/marketplace/products/${id}`, { auth: false }),
  myProducts: () => request('/marketplace/me/products'),
  addProduct: (body) => request('/marketplace/me/products', { method: 'POST', body }),
  updateProduct: (id, body) => request(`/marketplace/me/products/${id}`, { method: 'PATCH', body }),
  removeProduct: (id) => request(`/marketplace/me/products/${id}`, { method: 'DELETE' }),
  placeOrder: (items) => request('/marketplace/orders', { method: 'POST', body: { items } }),
  myOrders: () => request('/marketplace/me/orders'),
  mySalonOrders: () => request('/marketplace/me/salon-orders'),

  // social
  salonReviews: (id) => request(`/social/salons/${id}/reviews`, { auth: false }),
  postReview: (body) => request('/social/reviews', { method: 'POST', body }),
  crmCustomers: () => request('/social/crm/customers'),
  crmCustomer: (id) => request(`/social/crm/customers/${id}`),
  addCrmNote: (body) => request('/social/crm/notes', { method: 'POST', body }),
  removeCrmNote: (id) => request(`/social/crm/notes/${id}`, { method: 'DELETE' }),
  hairstyles: () => request('/social/ai/hairstyles', { auth: false }),
  hairstyleRecommend: () => request('/social/ai/recommend', { method: 'POST' }),
  hairstyleTryOn: (body) => request('/social/ai/tryon', {
    method: 'POST',
    body,                 // { styleId, selfieB64 | selfieUrl }
    timeoutMs: 60000,     // image generation is slow.
  }),

  // ops: deals, waitlist, settings, staff, AI marketing, tax, mini-site
  liveDeals: () => request('/ops/deals', { auth: false }),
  myDeals: () => request('/ops/me/deals'),
  addDeal: (body) => request('/ops/me/deals', { method: 'POST', body }),
  removeDeal: (id) => request(`/ops/me/deals/${id}`, { method: 'DELETE' }),
  joinWaitlist: (body) => request('/ops/waitlist', { method: 'POST', body }),
  myWaitlist: () => request('/ops/me/waitlist'),
  leaveWaitlist: (id) => request(`/ops/me/waitlist/${id}`, { method: 'DELETE' }),
  salonWaitlist: () => request('/ops/me/salon-waitlist'),
  updateSettings: (body) => request('/ops/me/settings', { method: 'PATCH', body }),
  staff: () => request('/ops/me/staff'),
  addStaff: (body) => request('/ops/me/staff', { method: 'POST', body }),
  removeStaff: (id) => request(`/ops/me/staff/${id}`, { method: 'DELETE' }),
  aiTemplates: () => request('/ops/me/ai/templates'),
  aiGenerate: (body) => request('/ops/me/ai/generate', { method: 'POST', body }),
  aiPosts: () => request('/ops/me/ai/posts'),
  tax: (year) => request('/ops/me/tax', { query: { year } }),
  taxCsvUrl: (year, token) => `${API_URL}/ops/me/tax.csv?year=${year}&_t=${encodeURIComponent(token || '')}`,
  siteUrl: (handle) => `${API_URL}/ops/site/${handle}`,

  // booking extras
  payBooking: (id, body) => request(`/bookings/${id}/pay`, { method: 'POST', body }),

  // payments (Paymob hosted checkout, with mock fallback)
  paymentIntention: (body) => request('/payments/intention', { method: 'POST', body }),
  paymentStatus: (reference) => request('/payments/status', { query: { reference } }),
};

