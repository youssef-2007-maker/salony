// Static UI catalogues. All live data (salons, services, barbers, bookings,
// messages) now comes from the backend via src/api/client.js.

export const categories = [
  { id: 'haircut',  label: 'Haircuts',       icon: 'cut', match: ['Hair Salon', "Men's Grooming"] },
  { id: 'beard',    label: 'Beard & Shave',  icon: 'man', match: ["Men's Grooming", 'Barber'] },
  { id: 'grooming', label: "Men's Grooming", icon: 'man', match: ["Men's Grooming", 'Hair Salon'] },
];

export function findCategory(id) {
  return categories.find((c) => c.id === id);
}
