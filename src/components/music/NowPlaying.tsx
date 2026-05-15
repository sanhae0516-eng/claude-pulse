import type { PlayState, Track } from "../../lib/music/types";

interface NowPlayingProps {
  track: Track | null;
  play: PlayState;
}

/** Top section of the music panel — shows current track meta as text. */
export function NowPlaying({ track, play }: NowPlayingProps) {
  if (play.status === "error") {
    return (
      <div className="music-now-playing">
        <div className="music-now-title">재생 오류</div>
        <div className="music-now-sub">{play.error ?? "알 수 없는 오류"}</div>
      </div>
    );
  }
  if (!track) {
    return (
      <div className="music-now-playing music-now-empty">
        <div className="music-now-title">곡을 선택해 주세요</div>
        <div className="music-now-sub">아래 리스트에서 누르면 재생됩니다</div>
      </div>
    );
  }
  const title = track.title ?? "이름 없음";
  const sub = [track.artist, track.album].filter(Boolean).join(" · ");
  return (
    <div className="music-now-playing">
      <div className="music-now-title" title={title}>{title}</div>
      <div className="music-now-sub" title={sub}>
        {sub || "—"}
      </div>
    </div>
  );
}
