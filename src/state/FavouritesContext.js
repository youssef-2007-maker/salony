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
import { useLocation } from './LocationContext';

const FavouritesContext = createContext(null);

export function FavouritesProvider({ children }) {
  const { user, role } = useAuth();
  const { coords } = useLocation();
  const [ids, setIds] = useState(new Set());
  const [list, setList] = useState([]);

  const refresh = useCallback(async () => {
    if (!user || role !== 'customer') {
      setIds(new Set());
      setList([]);
      return;
    }
    try {
      const data = await api.favourites({ lat: coords?.lat, lng: coords?.lng });
      setList(data);
      setIds(new Set(data.map((s) => s.id)));
    } catch {
      /* keep current */
    }
  }, [user, role, coords?.lat, coords?.lng]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggle = useCallback(
    async (id) => {
      if (!user || role !== 'customer') return;
      const wasFav = ids.has(id);
      // optimistic
      setIds((prev) => {
        const next = new Set(prev);
        if (wasFav) next.delete(id);
        else next.add(id);
        return next;
      });
      try {
        if (wasFav) await api.removeFavourite(id);
        else await api.addFavourite(id);
        refresh();
      } catch {
        // rollback
        setIds((prev) => {
          const next = new Set(prev);
          if (wasFav) next.add(id);
          else next.delete(id);
          return next;
        });
      }
    },
    [ids, user, role, refresh]
  );

  const isFavourite = useCallback((id) => ids.has(id), [ids]);

  const value = useMemo(
    () => ({ favourites: Array.from(ids), list, toggle, isFavourite, refresh }),
    [ids, list, toggle, isFavourite, refresh]
  );

  return <FavouritesContext.Provider value={value}>{children}</FavouritesContext.Provider>;
}

export function useFavourites() {
  const ctx = useContext(FavouritesContext);
  if (!ctx) throw new Error('useFavourites must be used inside FavouritesProvider');
  return ctx;
}
