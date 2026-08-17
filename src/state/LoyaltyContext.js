import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';

const LoyaltyContext = createContext(null);

export function LoyaltyProvider({ children }) {
  const { user, role } = useAuth();
  const [data, setData] = useState(null);

  const refresh = useCallback(async () => {
    if (!user || role !== 'customer') { setData(null); return; }
    try { setData(await api.loyalty()); } catch { /* */ }
  }, [user, role]);

  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo(
    () => ({
      points: data?.points || 0,
      tier: data?.tier,
      nextTier: data?.nextTier,
      lifetimeSpent: data?.lifetimeSpent || 0,
      referralCode: data?.referralCode,
      referralCount: data?.referralCount || 0,
      subscription: data?.subscription,
      history: data?.history || [],
      refresh,
    }),
    [data, refresh]
  );

  return <LoyaltyContext.Provider value={value}>{children}</LoyaltyContext.Provider>;
}

export function useLoyalty() {
  const ctx = useContext(LoyaltyContext);
  if (!ctx) throw new Error('useLoyalty must be used inside LoyaltyProvider');
  return ctx;
}
