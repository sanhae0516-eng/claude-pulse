import { useEffect, useState } from "react";
import type { MusicPlayerApi } from "../../lib/music/useMusicPlayer";

interface PlayerControlsProps {
  player: MusicPlayerApi;
  volume: number;
}

/** Format seconds → "M:SS" or "H:MM:SS" for longer tracks. */
function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const total = Math.floor(sec);
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function PlayerControls({ player, volume }: PlayerControlsProps) {
  const { play, togglePlay, next, prev, seek, setVolume } = player;
  const isPlaying = play.status === "playing";
  const canControl = play.currentTrackId !== null || player.scan.tracks.length > 0;
  const duration = play.duration > 0 ? play.duration : 0;

  // Slider draft pattern (same as settings size slider) — keep the thumb under
  // the cursor during drag, commit on pointer release.
  const [draftPos, setDraftPos] = useState(play.position);
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (!dragging) setDraftPos(play.position);
  }, [play.position, dragging]);

  const commitSeek = () => {
    seek(draftPos);
    setDragging(false);
  };

  return (
    <div className="music-controls">
      <div className="music-buttons">
        <button
          className="music-btn"
          onClick={prev}
          disabled={!canControl}
          aria-label="previous"
          title="이전 곡"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M4 3h1.5v10H4zM6 8l7-5v10z" />
          </svg>
        </button>
        <button
          className="music-btn music-btn-play"
          onClick={togglePlay}
          disabled={!canControl}
          aria-label={isPlaying ? "pause" : "play"}
          title={isPlaying ? "일시정지" : "재생"}
        >
          {isPlaying ? (
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <rect x="3.5" y="2.5" width="3" height="11" rx="0.5" />
              <rect x="9.5" y="2.5" width="3" height="11" rx="0.5" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <path d="M4 2.5l9 5.5-9 5.5z" />
            </svg>
          )}
        </button>
        <button
          className="music-btn"
          onClick={next}
          disabled={!canControl}
          aria-label="next"
          title="다음 곡"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M3 3l7 5-7 5zM10.5 3H12v10h-1.5z" />
          </svg>
        </button>
        <div className="music-volume">
          <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
            <path d="M2 6h2.5L8 3v10L4.5 10H2zM10.5 5.5a3 3 0 010 5M12.5 3.5a5 5 0 010 9" stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinecap="round" />
          </svg>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(volume * 100)}
            onChange={(e) => setVolume(Number(e.target.value) / 100)}
            className="music-volume-slider"
            aria-label="volume"
          />
        </div>
      </div>
      <div className="music-progress">
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
          className="music-progress-slider"
          aria-label="progress"
        />
        <span className="music-time mono">
          {fmt(dragging ? draftPos : play.position)} / {fmt(duration)}
        </span>
      </div>
    </div>
  );
}
