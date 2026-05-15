import type { Track } from "../../lib/music/types";

interface TrackRowProps {
  track: Track;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay: () => void;
}

function fmt(sec: number | null): string {
  if (!sec || !Number.isFinite(sec)) return "—";
  const total = Math.floor(sec);
  const s = total % 60;
  const m = Math.floor(total / 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TrackRow({ track, isCurrent, isPlaying, onPlay }: TrackRowProps) {
  const title = track.title ?? "이름 없음";
  const artist = track.artist ?? "—";
  return (
    <button
      className={`music-row ${isCurrent ? "is-current" : ""}`}
      onClick={onPlay}
      title={`${title}${artist !== "—" ? " — " + artist : ""}`}
    >
      <span className="music-row-indicator" aria-hidden="true">
        {isCurrent ? (isPlaying ? "♪" : "❚❚") : ""}
      </span>
      <span className="music-row-title">{title}</span>
      <span className="music-row-artist">{artist}</span>
      <span className="music-row-duration mono">{fmt(track.durationSecs)}</span>
    </button>
  );
}
