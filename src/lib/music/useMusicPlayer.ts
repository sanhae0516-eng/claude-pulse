import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MusicSettings, PlayState, ScanState, Track } from "./types";
import { scanFiles, trackSrc } from "./tauri-music";
import { inTauri } from "../tauri";

export interface MusicPlayerApi {
  /** Ref to attach to the hidden <audio> element rendered by Widget. */
  audioRef: React.RefObject<HTMLAudioElement>;
  scan: ScanState;
  play: PlayState;
  /** Scan an explicit list of file paths and replace the current library. */
  loadTracks: (paths: string[]) => Promise<void>;
  /** Play the track at index. If already loaded, just resume. */
  playIndex: (i: number) => Promise<void>;
  /** Play the given track id (does the index lookup for you). */
  playId: (id: string) => Promise<void>;
  /** Toggle play/pause on the current track. */
  togglePlay: () => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  /** Seek to seconds. */
  seek: (sec: number) => void;
  /** Set volume 0..1 (also persists). */
  setVolume: (v: number) => void;
  /** Stop and clear current track (used when folder changes). */
  stop: () => void;
}

interface Options {
  settings: MusicSettings;
  patchSettings: (p: Partial<MusicSettings>) => void;
}

/**
 * Owns the HTMLAudioElement lifecycle and exposes a high-level player API.
 *
 * Crucial invariant: the `<audio>` element is rendered by Widget at the top
 * level (not by MusicPanel) — that way unmounting the panel never tears the
 * audio down. The ref returned here gets attached to that element.
 */
export function useMusicPlayer({ settings, patchSettings }: Options): MusicPlayerApi {
  const audioRef = useRef<HTMLAudioElement>(null);

  const [scan, setScan] = useState<ScanState>({
    status: "idle",
    tracks: [],
    skippedCount: 0,
    error: null,
  });

  const [play, setPlay] = useState<PlayState>({
    status: "idle",
    currentTrackId: null,
    position: 0,
    duration: 0,
    error: null,
  });

  // Keep a ref of current playState for use inside event handlers without
  // re-binding listeners every state change.
  const playRef = useRef(play);
  playRef.current = play;
  const tracksRef = useRef<Track[]>([]);
  tracksRef.current = scan.tracks;

  // ── Audio element event wiring ──────────────────────────────────────
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onTimeUpdate = () => {
      setPlay((s) => ({ ...s, position: el.currentTime }));
    };
    const onLoadedMeta = () => {
      setPlay((s) => ({ ...s, duration: el.duration || 0 }));
    };
    const onPlay = () => {
      setPlay((s) => ({ ...s, status: "playing", error: null }));
    };
    const onPause = () => {
      // Distinguish "paused by user" from "ended naturally" — onEnded fires
      // separately, so a pause here is genuinely paused.
      setPlay((s) => (s.status === "playing" ? { ...s, status: "paused" } : s));
    };
    const onEnded = () => {
      // Auto-advance. If no next track, stop.
      void advanceTrack(1);
    };
    const onError = () => {
      const code = el.error?.code;
      const msg =
        code === 4
          ? "재생할 수 없는 형식이에요"
          : code === 3
          ? "디코딩 오류"
          : code === 2
          ? "네트워크 오류"
          : "재생 실패";
      setPlay((s) => ({ ...s, status: "error", error: msg }));
    };

    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("loadedmetadata", onLoadedMeta);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    el.addEventListener("error", onError);
    return () => {
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("loadedmetadata", onLoadedMeta);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("error", onError);
    };
    // We intentionally don't depend on `advanceTrack` (it's a stable closure
    // that reads refs).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply persisted volume to the audio element whenever it changes.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = settings.volume;
  }, [settings.volume]);

  const advanceTrack = useCallback(
    async (delta: 1 | -1) => {
      const tracks = tracksRef.current;
      const currentId = playRef.current.currentTrackId;
      if (tracks.length === 0) return;
      const idx = currentId ? tracks.findIndex((t) => t.id === currentId) : -1;
      const nextIdx = idx + delta;
      if (nextIdx < 0 || nextIdx >= tracks.length) {
        // Off the end of the playlist — stop.
        const el = audioRef.current;
        if (el) el.pause();
        setPlay((s) => ({ ...s, status: "idle", position: 0 }));
        return;
      }
      await playIndexImpl(nextIdx);
    },
    // playIndexImpl is closed below; tracksRef/playRef are mutable, so we
    // intentionally keep deps empty.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const playIndexImpl = useCallback(
    async (i: number) => {
      const tracks = tracksRef.current;
      const t = tracks[i];
      if (!t) return;
      const el = audioRef.current;
      if (!el) return;
      try {
        setPlay((s) => ({
          ...s,
          status: "loading",
          currentTrackId: t.id,
          position: 0,
          duration: t.durationSecs ?? 0,
          error: null,
        }));
        const src = await trackSrc(t.path);
        el.src = src;
        el.currentTime = 0;
        await el.play();
        patchSettings({ lastPlayedTrackId: t.id, lastPlayedPosition: 0 });
      } catch (e) {
        setPlay((s) => ({ ...s, status: "error", error: String(e) }));
      }
    },
    [patchSettings]
  );

  const playIndex = playIndexImpl;
  const playId = useCallback(
    async (id: string) => {
      const idx = tracksRef.current.findIndex((t) => t.id === id);
      if (idx >= 0) await playIndexImpl(idx);
    },
    [playIndexImpl]
  );

  const togglePlay = useCallback(async () => {
    const el = audioRef.current;
    if (!el) return;
    if (play.status === "playing") {
      el.pause();
    } else if (play.currentTrackId) {
      try {
        await el.play();
      } catch (e) {
        setPlay((s) => ({ ...s, status: "error", error: String(e) }));
      }
    } else if (tracksRef.current.length > 0) {
      // Nothing loaded yet → start at index 0.
      await playIndexImpl(0);
    }
  }, [play.status, play.currentTrackId, playIndexImpl]);

  const next = useCallback(() => advanceTrack(1), [advanceTrack]);
  const prev = useCallback(() => advanceTrack(-1), [advanceTrack]);

  const seek = useCallback((sec: number) => {
    const el = audioRef.current;
    if (!el) return;
    if (Number.isFinite(sec) && sec >= 0) {
      el.currentTime = sec;
      setPlay((s) => ({ ...s, position: sec }));
    }
  }, []);

  const setVolume = useCallback(
    (v: number) => {
      const clamped = Math.max(0, Math.min(1, v));
      if (audioRef.current) audioRef.current.volume = clamped;
      patchSettings({ volume: clamped });
    },
    [patchSettings]
  );

  const stop = useCallback(() => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    setPlay({
      status: "idle",
      currentTrackId: null,
      position: 0,
      duration: 0,
      error: null,
    });
  }, []);

  const loadTracks = useCallback(
    async (paths: string[]) => {
      setScan({ status: "scanning", tracks: [], skippedCount: 0, error: null });
      try {
        const result = await scanFiles(paths);
        setScan({
          status: "ready",
          tracks: result.tracks,
          skippedCount: result.skipped.length,
          error: null,
        });
        patchSettings({ selectedPaths: paths });
        // If the previously playing track is still in the new list and the
        // user wants restore, cue it (paused). Otherwise reset.
        if (
          settings.restoreOnLaunch &&
          settings.lastPlayedTrackId &&
          result.tracks.some((t) => t.id === settings.lastPlayedTrackId)
        ) {
          const t = result.tracks.find((t) => t.id === settings.lastPlayedTrackId)!;
          const el = audioRef.current;
          if (el) {
            const src = await trackSrc(t.path);
            el.src = src;
            el.currentTime = settings.lastPlayedPosition || 0;
          }
          setPlay({
            status: "paused",
            currentTrackId: t.id,
            position: settings.lastPlayedPosition || 0,
            duration: t.durationSecs ?? 0,
            error: null,
          });
        } else {
          // Library changed — stop any leftover audio.
          stop();
        }
      } catch (e) {
        setScan({
          status: "error",
          tracks: [],
          skippedCount: 0,
          error: String(e),
        });
      }
    },
    [patchSettings, settings.lastPlayedTrackId, settings.lastPlayedPosition, settings.restoreOnLaunch, stop]
  );

  // Auto-load saved library on first mount.
  useEffect(() => {
    if (settings.selectedPaths.length > 0) void loadTracks(settings.selectedPaths);
    // Only on mount — subsequent picks go through loadTracks() directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist position every ~5s while playing (so a crash leaves a sane restore point).
  useEffect(() => {
    if (play.status !== "playing") return;
    const id = window.setInterval(() => {
      if (audioRef.current) {
        patchSettings({ lastPlayedPosition: audioRef.current.currentTime });
      }
    }, 5000);
    return () => window.clearInterval(id);
  }, [play.status, patchSettings]);

  // Broadcast play.status so the main widget can react (Claw'd starts dancing
  // when status === "playing"). This is the music window's side of the
  // contract; the receiver lives in `useMusicStatus`.
  useEffect(() => {
    if (!inTauri()) return;
    void (async () => {
      const { emit } = await import("@tauri-apps/api/event");
      await emit("music:status", { status: play.status });
    })();
  }, [play.status]);

  return useMemo(
    () => ({
      audioRef,
      scan,
      play,
      loadTracks,
      playIndex,
      playId,
      togglePlay,
      next,
      prev,
      seek,
      setVolume,
      stop,
    }),
    [scan, play, loadTracks, playIndex, playId, togglePlay, next, prev, seek, setVolume, stop]
  );
}
