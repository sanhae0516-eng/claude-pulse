import { useEffect } from "react";
import { useMusicSettings } from "../lib/music/storage";
import { useMusicPlayer } from "../lib/music/useMusicPlayer";
import { useSettings } from "../lib/settings";
import { MiniPlayer } from "./MiniPlayer";
import { inTauri } from "../lib/tauri";
import "../styles/music.css";

/**
 * Top-level component rendered into the second Tauri window
 * (label="music", URL `?window=music`).
 *
 * This window owns the entire music feature — audio element, scan state,
 * persistence, controls. The main widget window only opens/hides this window;
 * it doesn't share state via IPC. That keeps the architecture simple at the
 * cost of two independent React mounts, which is fine here.
 */
export function MusicWindow() {
  const [musicSettings, patchMusicSettings] = useMusicSettings();
  // Read main-widget settings too — we just need `opacity` so both windows
  // look identical. The `storage` event listener inside `useSettings` makes
  // this hook update whenever the main widget changes the value.
  const [widgetSettings] = useSettings();
  const player = useMusicPlayer({
    settings: musicSettings,
    patchSettings: patchMusicSettings,
  });

  // When the player goes idle for a moment and the user has restoreOnLaunch
  // off, we could auto-hide the window. For now we leave that to the main
  // widget's ♪ toggle — the music window is just a passive renderer.

  // Hide rather than close on user close attempts inside this window
  // (the main widget owns the lifecycle). Wire ESC to hide.
  useEffect(() => {
    if (!inTauri()) return;
    const onKey = async (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      await getCurrentWebviewWindow().hide();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hideWindow = async () => {
    if (!inTauri()) return;
    const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    await getCurrentWebviewWindow().hide();
  };

  return (
    <div
      className="music-window-root"
      data-tauri-drag-region
      style={{ opacity: widgetSettings.opacity }}
    >
      <MiniPlayer
        player={player}
        settings={musicSettings}
        onClose={hideWindow}
      />
      {/* Hidden audio element lives here, owned by this window. Bound by ref
          inside useMusicPlayer; persists across panel state changes. */}
      <audio ref={player.audioRef} hidden preload="auto" />
    </div>
  );
}
