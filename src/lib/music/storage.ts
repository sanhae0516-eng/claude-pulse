import { useEffect, useState } from "react";
import type { MusicSettings } from "./types";
import { inTauri } from "../tauri";

const STORAGE_KEY = "claude-pulse:music:v1";

export const DEFAULTS: MusicSettings = {
  selectedPaths: [],
  volume: 0.7,
  lastPlayedTrackId: null,
  lastPlayedPosition: 0,
  restoreOnLaunch: false,
};

function load(): MusicSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const stored = JSON.parse(raw);
    // Spread merges fill any missing keys with the current defaults — safe
    // upgrade path when we add new fields in v2 later.
    return { ...DEFAULTS, ...stored };
  } catch {
    return DEFAULTS;
  }
}

function save(s: MusicSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore quota / private mode */
  }
}

const TAURI_MUSIC_SETTINGS_EVENT = "music-settings:changed";

/**
 * Music settings hook — same shape as the main `useSettings` hook. Cross-
 * window updates flow via Tauri events (browser storage events don't fire
 * across separate Tauri webviews).
 */
export function useMusicSettings(): [MusicSettings, (p: Partial<MusicSettings>) => void] {
  const [settings, setSettings] = useState<MusicSettings>(() => load());
  useEffect(() => save(settings), [settings]);

  useEffect(() => {
    if (!inTauri()) return;
    let unlisten: (() => void) | null = null;
    (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      unlisten = await listen<MusicSettings>(TAURI_MUSIC_SETTINGS_EVENT, (e) => {
        setSettings(e.payload);
      });
    })();
    return () => unlisten?.();
  }, []);

  const patch = (p: Partial<MusicSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...p };
      if (inTauri()) {
        void (async () => {
          const { emit } = await import("@tauri-apps/api/event");
          await emit(TAURI_MUSIC_SETTINGS_EVENT, next);
        })();
      }
      return next;
    });
  };
  return [settings, patch];
}
