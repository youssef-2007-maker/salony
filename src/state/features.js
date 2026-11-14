// Which money/marketplace features are live, as reported by the backend
// (GET /payments/config). Until the answer arrives — or if it fails — both are
// treated as off, so the app never offers a payment it can't take.
import { useEffect, useState } from 'react';
import { api } from '../api/client';

const OFF = { payments: false, marketplace: false, subscriptions: false };
let cached = null;
let inflight = null;

function load() {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = api
      .featureConfig()
      .then((cfg) => {
        cached = {
          payments: !!cfg?.payments,
          marketplace: !!cfg?.marketplace,
          subscriptions: !!cfg?.subscriptions,
        };
        return cached;
      })
      .catch(() => OFF)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useFeatures() {
  const [features, setFeatures] = useState(cached || OFF);
  const [ready, setReady] = useState(!!cached);
  useEffect(() => {
    let alive = true;
    load().then((f) => {
      if (alive) {
        setFeatures(f);
        setReady(true);
      }
    });
    return () => {
      alive = false;
    };
  }, []);
  return { ...features, ready };
}
