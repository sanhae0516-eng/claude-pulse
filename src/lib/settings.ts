import { useEffect, useState } from "react";

export type ColorScheme = "claude" | "mint" | "blue" | "violet" | "rose" | "custom";

export interface Palette {
  usageRing: string;  // inner ring (usage %)
  timeRing: string;   // outer ring (time until reset)
  number: string;     // center percentage number
}

export interface Settings {
  opacity: number;          // 0.5..1.0
  size: number;             // px, applied to both width & height (160..360)
  showCharacter: boolean;
  showWeek: boolean;
  colorScheme: ColorScheme;
  customPalette: Palette;   // active when colorScheme === "custom"
  locked: boolean;          // when true, drag is disabled
  soundsEnabled: boolean;   // UI click / toggle sounds
  voiceEnabled: boolean;    // Claw'd typing voice (per-character blips)
  voiceVolume: number;      // 0..1 voice gain multiplier
}

export const COLOR_PRESETS: Record<Exclude<ColorScheme, "custom">, Palette> = {
  claude: { usageRing: "#D97757", timeRing: "#C9B89A", number: "#C7503A" },
  mint:   { usageRing: "#6EE7B7", timeRing: "#60A5FA", number: "#6EE7B7" },
  blue:   { usageRing: "#60A5FA", timeRing: "#34D399", number: "#60A5FA" },
  violet: { usageRing: "#C4B5FD", timeRing: "#FCD34D", number: "#C4B5FD" },
  rose:   { usageRing: "#FDA4AF", timeRing: "#A78BFA", number: "#FDA4AF" },
};

export const DEFAULTS: Settings = {
  opacity: 1,
  size: 220,
  showCharacter: true,
  showWeek: true,
  colorScheme: "claude",
  customPalette: { ...COLOR_PRESETS.claude },
  locked: false,
  soundsEnabled: true,
  voiceEnabled: true,
  voiceVolume: 0.5,
};

export const SIZE_MIN = 160;
export const SIZE_MAX = 360;
export const SIZE_STEP = 5;

const STORAGE_KEY = "claude-pulse:settings:v1";

/**
 * Migrate older stored palettes that used the {low, mid, high, ring} shape
 * to the new {usageRing, timeRing, number} shape so existing users don't lose
 * their custom color choice.
 */
function migratePalette(p: any): Palette {
  if (!p || typeof p !== "object") return { ...DEFAULTS.customPalette };
  if ("usageRing" in p && "timeRing" in p && "number" in p) {
    return { ...DEFAULTS.customPalette, ...p };
  }
  // Legacy {low, mid, high, ring} shape
  return {
    usageRing: p.low ?? DEFAULTS.customPalette.usageRing,
    timeRing: p.ring ?? DEFAULTS.customPalette.timeRing,
    number: p.low ?? DEFAULTS.customPalette.number,
  };
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const stored = JSON.parse(raw);
    return {
      ...DEFAULTS,
      ...stored,
      customPalette: migratePalette(stored.customPalette),
    };
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

/** Resolves the active palette for the current settings. */
export function getPalette(settings: Settings): Palette {
  if (settings.colorScheme === "custom") return settings.customPalette;
  return COLOR_PRESETS[settings.colorScheme];
}

/** Channel metadata for the custom-palette editor UI. */
export const PALETTE_CHANNELS: ReadonlyArray<{
  key: keyof Palette;
  label: string;
  hint: string;
}> = [
  { key: "usageRing", label: "Usage ring", hint: "inner ring (% used)" },
  { key: "timeRing",  label: "Time ring",  hint: "outer countdown ring" },
  { key: "number",    label: "Number",     hint: "center % text" },
];
