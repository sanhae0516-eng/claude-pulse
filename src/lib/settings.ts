import { useEffect, useState } from "react";

export type ColorScheme = "mint" | "blue" | "violet" | "rose";

export interface Settings {
  opacity: number;          // 0.5..1.0
  size: number;             // px, applied to both width & height (160..360)
  showCharacter: boolean;
  showWeek: boolean;
  showCount: boolean;       // (no raw count anymore but kept for forward compat)
  colorScheme: ColorScheme;
  locked: boolean;          // when true, drag is disabled
}

export const DEFAULTS: Settings = {
  opacity: 1,
  size: 220,
  showCharacter: true,
  showWeek: true,
  showCount: false,
  colorScheme: "mint",
  locked: false,
};

export const SIZE_MIN = 160;
export const SIZE_MAX = 360;
export const SIZE_STEP = 20;

const STORAGE_KEY = "claude-pulse:settings:v1";

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function save(s: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore quota/private mode */
  }
}

/** Hook returns [settings, patch]. patch accepts a partial to merge in. */
export function useSettings(): [Settings, (p: Partial<Settings>) => void] {
  const [settings, setSettings] = useState<Settings>(() => load());
  useEffect(() => save(settings), [settings]);
  const patch = (p: Partial<Settings>) =>
    setSettings((prev) => ({ ...prev, ...p }));
  return [settings, patch];
}

export const COLOR_PRESETS: Record<ColorScheme, { low: string; mid: string; high: string; ring: string }> = {
  mint:   { low: "#6EE7B7", mid: "#FCD34D", high: "#F87171", ring: "#60A5FA" },
  blue:   { low: "#60A5FA", mid: "#A78BFA", high: "#F472B6", ring: "#34D399" },
  violet: { low: "#C4B5FD", mid: "#F0ABFC", high: "#FB7185", ring: "#FCD34D" },
  rose:   { low: "#FDA4AF", mid: "#FBBF24", high: "#EF4444", ring: "#A78BFA" },
};
