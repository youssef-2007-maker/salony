import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';

const BookingsContext = createContext(null);

export function BookingsProvider({ children }) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setBookings([]);
      return;
    }
    setLoading(true);
    try {
      const data = await api.bookings();
      setBookings(data);
    } catch {
      /* keep current */
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addBooking = useCallback(
    async (payload) => {
      const created = await api.createBooking(payload);
      setBookings((prev) => [created, ...prev]);
      return created;
    },
    []
  );

  const cancelBooking = useCallback(async (id) => {
    await api.updateBookingStatus(id, 'cancelled');
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: 'cancelled' } : b)));
  }, []);

  const updateStatus = useCallback(async (id, status) => {
    await api.updateBookingStatus(id, status);
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
  }, []);

  const value = useMemo(() => {
    const upcoming = bookings.filter((b) => b.status === 'upcoming');
    const past = bookings.filter((b) => b.status === 'past' || b.status === 'cancelled' || b.status === 'declined');
    return {
      bookings,
      upcoming,
      past,
      loading,
      addBooking,
      cancelBooking,
      updateStatus,
      refresh,
    };
  }, [bookings, loading, addBooking, cancelBooking, updateStatus, refresh]);

  return <BookingsContext.Provider value={value}>{children}</BookingsContext.Provider>;
}

export function useBookings() {
  const ctx = useContext(BookingsContext);
  if (!ctx) throw new Error('useBookings must be used inside BookingsProvider');
  return ctx;
}
