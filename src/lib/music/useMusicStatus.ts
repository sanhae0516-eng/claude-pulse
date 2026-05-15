import { useEffect, useState } from "react";
import { inTauri } from "../tauri";
import type { PlayStatus } from "./types";

interface MusicStatusEvent {
  status: PlayStatus;
}

/**
 * Listens for `music:status` events emitted by the music window so the main
 * widget can react to playback (e.g. switch Claw'd's mood to "dancing").
 *
 * The music window is the source of truth — it owns the audio element. The
 * main widget only observes. When the music window is hidden / not yet
 * created, no events arrive and this hook simply stays at its last value
 * (defaults to "idle" on first mount).
 */
export function useMusicStatus(): PlayStatus {
  const [status, setStatus] = useState<PlayStatus>("idle");

  useEffect(() => {
    if (!inTauri()) return;
    let unlisten: (() => void) | null = null;
    (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      unlisten = await listen<MusicStatusEvent>("music:status", (e) => {
        if (e.payload && typeof e.payload.status === "string") {
          setStatus(e.payload.status);
        }
      });
    })();
    return () => unlisten?.();
  }, []);

  return status;
}
