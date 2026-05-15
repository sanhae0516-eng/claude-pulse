import { useEffect, useMemo, useState } from "react";
import type { MusicSettings } from "../lib/music/types";
import type { MusicPlayerApi } from "../lib/music/useMusicPlayer";
import { pickFiles } from "../lib/music/tauri-music";
import { sound } from "../lib/sound";

interface MiniPlayerProps {
  player: MusicPlayerApi;
  settings: MusicSettings;
  /** Called when the user wants to dismiss the player (e.g. when idle). */
  onClose?: () => void;
}

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const total = Math.floor(sec);
  const s = total % 60;
  const m = Math.floor(total / 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Compact rectangular player that sits below the square widget body when the
 * music feature is in use. One-line metadata + transport buttons + progress
 * + volume. No track list — the user opted for compact mode.
 *
 * When no folder is picked yet, swaps to a folder-picker prompt.
 */
export function MiniPlayer({ player, settings, onClose }: MiniPlayerProps) {
  const { play, scan, togglePlay, next, prev, seek, setVolume } = player;

  const currentTrack = useMemo(
    () =>
      play.currentTrackId
        ? scan.tracks.find((t) => t.id === play.currentTrackId) ?? null
        : null,
    [play.currentTrackId, scan.tracks]
  );

  // Progress drag draft — keep thumb under cursor during drag.
  const [draftPos, setDraftPos] = useState(play.position);
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (!dragging) setDraftPos(play.position);
  }, [play.position, dragging]);

  const commitSeek = () => {
    seek(draftPos);
    setDragging(false);
  };

  const isPlaying = play.status === "playing";
  const canControl = play.currentTrackId !== null || scan.tracks.length > 0;
  const duration = play.duration > 0 ? play.duration : 0;
  const hasLibrary = settings.selectedPaths.length > 0;

  // ── Empty state — no files picked yet ───────────────────────────
  if (!hasLibrary) {
    return (
      <div className="mini-player mini-empty">
        <div className="mini-empty-text">음원 파일을 선택해주세요</div>
        <button
          className="mini-folder-btn"
          onClick={async () => {
            sound.click();
            const paths = await pickFiles();
            if (paths) await player.loadTracks(paths);
          }}
        >
          🎵 음원 선택
        </button>
        {onClose && (
          <button className="mini-close" onClick={onClose} aria-label="close player">
            ✕
          </button>
        )}
      </div>
    );
  }

  // ── Scan in progress ────────────────────────────────────────────
  if (scan.status === "scanning") {
    return (
      <div className="mini-player mini-empty">
        <div className="mini-empty-text">스캔 중…</div>
        {onClose && (
          <button className="mini-close" onClick={onClose} aria-label="close player">
            ✕
          </button>
        )}
      </div>
    );
  }

  // ── Normal playback UI ──────────────────────────────────────────
  // Pick title + subtitle for the one-line meta strip.
  const titleText =
    currentTrack?.title ?? (scan.tracks[0]?.title ?? "곡을 선택해 주세요");
  const subText = currentTrack
    ? currentTrack.artist ?? "—"
    : scan.tracks.length > 0
    ? `${scan.tracks.length}곡 대기 중`
    : "음원 파일이 없습니다";

  return (
    <div className="mini-player">
      <div className="mini-meta">
        {isPlaying && (
          <span className="mini-equalizer" aria-hidden="true">
            <span /><span /><span /><span />
          </span>
        )}
        <span className="mini-title" title={titleText}>{titleText}</span>
        <span className="mini-sub" title={subText}>{subText}</span>
        {onClose && (
          <button className="mini-close" onClick={onClose} aria-label="close player">
            ✕
          </button>
        )}
      </div>

      <div className="mini-progress">
        <input
          type="range"
          min={0}
          max={Math.max(duration, 1)}
          step={0.1}
          value={dragging ? draftPos : play.position}
          onChange={(e) => {
            setDragging(true);
            setDraftPos(Number(e.target.value));
          }}
          onPointerUp={commitSeek}
          onKeyUp={commitSeek}
          onBlur={() => dragging && commitSeek()}
          disabled={!canControl || duration === 0}
          className="mini-progress-slider"
          aria-label="progress"
        />
        <span className="mini-time mono">
          {fmt(dragging ? draftPos : play.position)} / {fmt(duration)}
        </span>
      </div>

      <div className="mini-controls">
        <button
          className="mini-btn"
          onClick={() => void prev()}
          disabled={!canControl}
          aria-label="previous"
          title="이전 곡"
        >
          <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
            <path d="M4 3h1.5v10H4zM6 8l7-5v10z" />
          </svg>
        </button>
        <button
          className="mini-btn mini-btn-play"
          onClick={() => void togglePlay()}
          disabled={!canControl}
          aria-label={isPlaying ? "pause" : "play"}
          title={isPlaying ? "일시정지" : "재생"}
        >
          {isPlaying ? (
            <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor">
              <rect x="3.5" y="2.5" width="3" height="11" rx="0.5" />
              <rect x="9.5" y="2.5" width="3" height="11" rx="0.5" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor">
              <path d="M4 2.5l9 5.5-9 5.5z" />
            </svg>
          )}
        </button>
        <button
          className="mini-btn"
          onClick={() => void next()}
          disabled={!canControl}
          aria-label="next"
          title="다음 곡"
        >
          <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
            <path d="M3 3l7 5-7 5zM10.5 3H12v10h-1.5z" />
          </svg>
        </button>
        <button
          className="mini-btn mini-btn-list"
          onClick={async () => {
            // Re-pick library shortcut (replaces the track list in compact mode).
            sound.click();
            const paths = await pickFiles();
            if (paths) await player.loadTracks(paths);
          }}
          title="음원 다시 선택"
          aria-label="change library"
        >
          <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
            <path d="M1.5 3.5h4l1 1h8v9h-13zM2 2v.5h12v1.5" stroke="currentColor" strokeWidth="0.8" fill="none" />
          </svg>
        </button>
        <div className="mini-volume">
          <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor" aria-hidden="true">
            <path d="M2 6h2.5L8 3v10L4.5 10H2z" />
            <path d="M10.5 5.5a3 3 0 010 5M12.5 3.5a5 5 0 010 9" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" />
          </svg>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(settings.volume * 100)}
            onChange={(e) => setVolume(Number(e.target.value) / 100)}
            className="mini-volume-slider"
            aria-label="volume"
          />
        </div>
      </div>
    </div>
  );
}
