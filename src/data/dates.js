// Helpers that produce date and time strips like in the mock-up.

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export function getUpcomingDates(count = 10, start = new Date()) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push({
      iso: d.toISOString().slice(0, 10),
      day: d.getDate(),
      label: DAY_NAMES[d.getDay()],
      raw: d,
    });
  }
  return out;
}

export function getDailySlots() {
  // 09:00 → 6:00 PM every 30 mins. A few marked unavailable to match the mockup.
  const slots = [];
  const unavailable = new Set(['09:00 AM', '09:30 AM', '12:30 PM']);
  for (let h = 9; h <= 18; h++) {
    for (const m of [0, 30]) {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hh = ((h + 11) % 12) + 1;
      const mm = m === 0 ? '00' : '30';
      const label = `${String(hh).padStart(2, '0')}:${mm} ${ampm}`;
      slots.push({ label, available: !unavailable.has(label) });
    }
  }
  return slots;
}

export function formatBookingDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
