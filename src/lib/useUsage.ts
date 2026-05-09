import { useEffect, useState } from "react";
import type { UsageSnapshot } from "./usage";
import { fetchUsage } from "./tauri";

const REFRESH_MS = 60_000;
const TICK_MS = 1_000;
const BACKOFF_MS = 90_000;
const SNAP_CACHE_KEY = "claude-pulse:last-snap:v1";

function loadCachedSnap(): UsageSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAP_CACHE_KEY);
    return raw ? (JSON.parse(raw) as UsageSnapshot) : null;
  } catch {
    return null;
  }
}

function saveCachedSnap(s: UsageSnapshot) {
  try {
    localStorage.setItem(SNAP_CACHE_KEY, JSON.stringify(s));
  } catch {
    /* ignore quota / private mode */
  }
}

export interface UsageState {
  snap: UsageSnapshot | null;
  /** Wall-clock tick (ms since epoch), updated every second for live countdown */
  now: number;
  /** Most recent fetch error, or null. Suppressed when a cached snapshot is showing. */
  error: string | null;
}

/**
 * Fetches usage on mount, polls every 60s, retries with 90s back-off on failure.
 * Hydrates from localStorage on first render so cold-start during a transient
 * 429 still shows the last good data instead of a giant error.
 */
export function useUsage(): UsageState {
  const [snap, setSnap] = useState<UsageSnapshot | null>(() => loadCachedSnap());
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | undefined;
    const schedule = (ms: number) => {
      timeoutId = window.setTimeout(load, ms);
    };
    const load = async () => {
      try {
        const s = await fetchUsage();
        if (cancelled) return;
        setSnap(s);
        saveCachedSnap(s);
        setError(null);
        schedule(REFRESH_MS);
      } catch (e) {
        if (cancelled) return;
        const msg = String(e);
        console.warn("fetchUsage failed", e);
        // Keep last-good snapshot visible during transient errors.
        setError((_) => (loadCachedSnap() || snap ? null : msg));
        schedule(BACKOFF_MS);
      }
    };
    schedule(0);
    const tick = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => {
      cancelled = true;
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { snap, now, error };
}
