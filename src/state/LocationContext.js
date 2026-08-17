import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

const LocationContext = createContext(null);

const OVERRIDE_KEY = '@salony/locationOverride';
const FALLBACK = { lat: 30.0596, lng: 31.4912, label: 'Al Rehab, Cairo' };

export function LocationProvider({ children }) {
  // gpsCoords = what GPS told us (or null). override = what the user manually picked.
  const [gpsCoords, setGpsCoords] = useState(null);
  const [gpsLabel, setGpsLabel] = useState(null);
  const [override, setOverride] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | granted | denied | error
  const [loading, setLoading] = useState(false);

  // Hydrate override
  useEffect(() => {
    AsyncStorage.getItem(OVERRIDE_KEY).then((v) => {
      if (v) {
        try { setOverride(JSON.parse(v)); } catch { /* */ }
      }
    });
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== 'granted') {
        setStatus('denied');
        return;
      }
      setStatus('granted');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setGpsCoords(next);
      try {
        const places = await Location.reverseGeocodeAsync(next);
        const p = places && places[0];
        if (p) {
          const parts = [p.district || p.subregion || p.name, p.city || p.region].filter(Boolean);
          setGpsLabel(parts.join(', '));
        }
      } catch { /* best effort */ }
    } catch {
      setStatus('error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const setOverrideLocation = useCallback(async (place) => {
    // place: { name, region, lat, lng } | null  (null = clear override)
    if (!place) {
      setOverride(null);
      await AsyncStorage.removeItem(OVERRIDE_KEY);
      return;
    }
    const next = {
      lat: place.lat,
      lng: place.lng,
      label: place.region ? `${place.name}, ${place.region}` : place.name,
    };
    setOverride(next);
    await AsyncStorage.setItem(OVERRIDE_KEY, JSON.stringify(next));
  }, []);

  const useDeviceLocation = useCallback(async () => {
    await setOverrideLocation(null);
    await refresh();
  }, [setOverrideLocation, refresh]);

  // Resolution: override > GPS > fallback
  const effective = useMemo(() => {
    if (override) return { coords: { lat: override.lat, lng: override.lng }, label: override.label, source: 'override' };
    if (gpsCoords) return { coords: gpsCoords, label: gpsLabel || 'Your location', source: 'gps' };
    return { coords: { lat: FALLBACK.lat, lng: FALLBACK.lng }, label: FALLBACK.label, source: 'fallback' };
  }, [override, gpsCoords, gpsLabel]);

  const value = useMemo(
    () => ({
      coords: effective.coords,
      label: effective.label,
      source: effective.source,
      status,
      loading,
      override,
      hasReal: status === 'granted',
      refresh,
      setOverrideLocation,
      useDeviceLocation,
    }),
    [effective, status, loading, override, refresh, setOverrideLocation, useDeviceLocation]
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used inside LocationProvider');
  return ctx;
}
