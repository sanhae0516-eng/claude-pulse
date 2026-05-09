import { useState } from "react";
import { Ring } from "./Ring";
import { ClaudePet } from "./ClaudePet";
import { SettingsPanel } from "./SettingsPanel";
import { CogButton } from "./ui/CogButton";
import { inTauri } from "../lib/tauri";
import { useUsage } from "../lib/useUsage";
import { formatRemaining, msUntilReset } from "../lib/usage";
import { useSettings, COLOR_PRESETS } from "../lib/settings";
import { useApplyWindowSize } from "../lib/window";

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;

/** 0..1 of how much of the 5h window has elapsed. */
function timeProgress(resetsAt: string | null, now: number): number {
  if (!resetsAt) return 0;
  return Math.max(0, Math.min(1, 1 - msUntilReset(resetsAt, now) / FIVE_HOURS_MS));
}

function shortError(e: string): string {
  const lower = e.toLowerCase();
  if (e.includes("429") || lower.includes("rate_limit")) return "rate-limited · retrying";
  if (e.includes("401") || lower.includes("auth")) return "auth — open Claude Desktop";
  if (lower.includes("request") || lower.includes("network")) return "offline · retrying";
  return "retrying…";
}

export function Widget() {
  const { snap, now, error } = useUsage();
  const [showSettings, setShowSettings] = useState(false);
  const [settings, patchSettings] = useSettings();
  useApplyWindowSize(settings.size);

  const wrapperStyle = { opacity: settings.opacity } as React.CSSProperties;
  const dragProps =
    settings.locked || showSettings ? {} : { "data-tauri-drag-region": true };

  // Settings panel takes precedence so the user can open it even before the
  // first successful fetch (e.g. cold start during a rate-limit window).
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
  const color = uRatio < 0.6 ? palette.low : uRatio < 0.85 ? palette.mid : palette.high;
  const mood = uRatio >= 0.95 ? "alarm" : uRatio >= 0.85 ? "worried" : "happy";
  const pulse = uRatio >= 0.95 ? "warning" : uRatio >= 0.8 ? "soft" : "none";
  const pct = Math.round(uRatio * 100);
  const weekPct = week ? Math.round(week.utilization * 100) : null;

  return (
    <div
      className={`widget ${inTauri() ? "in-tauri" : "in-browser"}`}
      style={wrapperStyle}
      {...dragProps}
    >
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
        <div className="widget-remaining mono" {...dragProps}>{remaining}</div>
        {settings.showWeek && weekPct !== null && (
          <div className="widget-week mono" {...dragProps}>week {weekPct}%</div>
        )}
      </div>
      <CogButton onClick={() => setShowSettings(true)} />
    </div>
  );
}
