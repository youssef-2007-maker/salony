import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  // items: { [productId]: { product, qty } }
  const [items, setItems] = useState({});

  const add = useCallback((product, qty = 1) => {
    setItems((prev) => {
      const next = { ...prev };
      const existing = next[product.id];
      // Enforce single-salon cart (backend rejects mixed)
      const otherSalon = Object.values(next).find((it) => it.product.salon_id !== product.salon_id);
      if (otherSalon) return next; // ignore silently — UI shows a clear message
      next[product.id] = { product, qty: (existing?.qty || 0) + qty };
      return next;
    });
  }, []);

  const update = useCallback((productId, qty) => {
    setItems((prev) => {
      const next = { ...prev };
      if (!qty || qty <= 0) delete next[productId];
      else if (next[productId]) next[productId].qty = qty;
      return next;
    });
  }, []);

  const remove = useCallback((productId) => {
    setItems((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }, []);

  const clear = useCallback(() => setItems({}), []);

  const value = useMemo(() => {
    const list = Object.values(items);
    const count = list.reduce((n, it) => n + it.qty, 0);
    const total = list.reduce((n, it) => n + it.qty * it.product.price, 0);
    const salonId = list[0]?.product.salon_id || null;
    return { items: list, count, total, salonId, add, update, remove, clear };
  }, [items, add, update, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
