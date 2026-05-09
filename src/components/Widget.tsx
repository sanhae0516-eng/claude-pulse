import { useEffect, useState } from "react";
import { Ring } from "./Ring";
import { ClaudePet } from "./ClaudePet";
import { SettingsPanel } from "./SettingsPanel";
import { fetchUsage, inTauri } from "../lib/tauri";
import {
  type UsageSnapshot,
  formatRemaining,
  msUntilReset,
} from "../lib/usage";
import { useSettings, COLOR_PRESETS } from "../lib/settings";

const REFRESH_MS = 60_000;
const TICK_MS = 1_000;
/** When fetch fails (429, network) retry after this many ms. */
const BACKOFF_MS = 90_000;
const SNAP_CACHE_KEY = "claude-pulse:last-snap:v1";

function loadCachedSnap(): UsageSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAP_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveCachedSnap(s: UsageSnapshot) {
  try {
    localStorage.setItem(SNAP_CACHE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;

function timeProgress(resetsAt: string | null, now: number): number {
  if (!resetsAt) return 0;
  const remaining = msUntilReset(resetsAt, now);
  return Math.max(0, Math.min(1, 1 - remaining / FIVE_HOURS_MS));
}

function shortError(e: string): string {
  if (e.includes("429") || e.toLowerCase().includes("rate_limit")) {
    return "rate-limited · retrying";
  }
  if (e.toLowerCase().includes("auth") || e.includes("401")) {
    return "auth — open Claude Desktop";
  }
  if (e.toLowerCase().includes("request") || e.toLowerCase().includes("network")) {
    return "offline · retrying";
  }
  return "retrying…";
}

export function Widget() {
  // Hydrate from localStorage so a 429 / network blip on cold start still
  // shows the last known data instead of a giant red error overlay.
  const [snap, setSnap] = useState<UsageSnapshot | null>(() => loadCachedSnap());
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, patchSettings] = useSettings();

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
        // Only surface the error if we have NEVER had a snapshot (no cache + no live).
        // Otherwise silently keep the last good snapshot.
        const msg = String(e);
        console.warn("fetchUsage failed", e);
        setError((_) => (loadCachedSnap() || snap ? null : msg));
        schedule(BACKOFF_MS);
      }
    };
    schedule(0);
    const tick = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => {
      cancelled = true;
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply window size whenever settings.size changes (Tauri only)
  useEffect(() => {
    if (!inTauri()) return;
    (async () => {
      try {
        const [{ getCurrentWebviewWindow }, { LogicalSize }] = await Promise.all([
          import("@tauri-apps/api/webviewWindow"),
          import("@tauri-apps/api/dpi"),
        ]);
        const win = getCurrentWebviewWindow();
        await win.setSize(new LogicalSize(settings.size, settings.size));
      } catch (e) {
        console.error("setSize failed", e);
      }
    })();
  }, [settings.size]);

  // Drag enabled when not locked + not in settings panel
  const dragProps = settings.locked || showSettings ? {} : { "data-tauri-drag-region": true };

  const wrapperStyle = {
    opacity: settings.opacity,
  } as React.CSSProperties;

  // Settings panel takes precedence — must work even before any data has loaded
  // (e.g. cold start during a rate-limit window).
  if (showSettings) {
    return (
      <div className="widget" style={wrapperStyle}>
        <SettingsPanel
          settings={settings}
          onChange={patchSettings}
          onClose={() => setShowSettings(false)}
        />
      </div>
    );
  }

  if (!snap) {
    const hint = error ? shortError(error) : "fetching…";
    return (
      <div className="widget" style={wrapperStyle} {...dragProps}>
        <div className="widget-loading-stack" {...dragProps}>
          <div className="widget-loading-dots mono" {...dragProps}>•••</div>
          <div className="widget-loading-hint" {...dragProps}>{hint}</div>
        </div>
        <CogButton onClick={() => setShowSettings(true)} />
      </div>
    );
  }

  const five = snap.fiveHour;
  const week = snap.sevenDay;
  const uRatio = five?.utilization ?? 0;
  const tRatio = timeProgress(five?.resetsAt ?? null, now);
  const remaining = formatRemaining(msUntilReset(five?.resetsAt ?? null, now));
  const palette = COLOR_PRESETS[settings.colorScheme];
  const color =
    uRatio < 0.6 ? palette.low :
    uRatio < 0.85 ? palette.mid :
    palette.high;
  const mood: "happy" | "worried" | "alarm" =
    uRatio >= 0.95 ? "alarm" : uRatio >= 0.85 ? "worried" : "happy";
  const pulse = uRatio >= 0.95 ? "warning" : uRatio >= 0.8 ? "soft" : "none";
  const pct = Math.round(uRatio * 100);
  const weekPct = week ? Math.round(week.utilization * 100) : null;

  return (
    <div
      className={`widget ${inTauri() ? "in-tauri" : "in-browser"}`}
      style={wrapperStyle}
      {...dragProps}
    >
      {showSettings ? (
        <SettingsPanel
          settings={settings}
          onChange={patchSettings}
          onClose={() => setShowSettings(false)}
        />
      ) : (
        <>
          <Ring
            radius={47}
            thickness={1.8}
            progress={1 - tRatio}
            color={palette.ring}
            trackColor="rgba(255, 255, 255, 0.08)"
          />
          <Ring
            radius={40}
            thickness={3.6}
            progress={uRatio}
            color={color}
            trackColor="rgba(255, 255, 255, 0.06)"
            glow
            pulse={pulse}
          />
          <div className="widget-center" {...dragProps}>
            {settings.showCharacter && <ClaudePet mood={mood} />}
            <div className="widget-pct mono" style={{ color }} {...dragProps}>
              {pct}<span className="widget-pct-sym">%</span>
            </div>
            <div className="widget-remaining mono" {...dragProps}>
              {remaining}
            </div>
            {settings.showWeek && weekPct !== null && (
              <div className="widget-week mono" {...dragProps}>
                week {weekPct}%
              </div>
            )}
          </div>
          <CogButton onClick={() => setShowSettings(true)} />
        </>
      )}
    </div>
  );
}

function CogButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="widget-cog"
      onClick={onClick}
      aria-label="settings"
    >
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4">
        <circle cx="8" cy="8" r="2.2" />
        <path d="M8 1.5v2M8 12.5v2M14.5 8h-2M3.5 8h-2M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4M12.6 12.6l-1.4-1.4M4.8 4.8L3.4 3.4" strokeLinecap="round" />
      </svg>
    </button>
  );
}
