import { useEffect, useRef } from "react";
import type { MusicPlayerApi } from "../../lib/music/useMusicPlayer";
import { TrackRow } from "./TrackRow";

interface TrackListProps {
  player: MusicPlayerApi;
}

export function TrackList({ player }: TrackListProps) {
  const { scan, play, playIndex } = player;
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the current track when it changes (keeps it in view).
  useEffect(() => {
    if (!play.currentTrackId) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-track-id="${CSS.escape(play.currentTrackId)}"]`
    );
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [play.currentTrackId]);

  if (scan.status === "scanning") {
    return <div className="music-list-status">스캔 중…</div>;
  }
  if (scan.status === "error") {
    return <div className="music-list-status music-list-error">{scan.error}</div>;
  }
  if (scan.status === "ready" && scan.tracks.length === 0) {
    return <div className="music-list-status">음원 파일이 없습니다</div>;
  }

  return (
    <div className="music-list" ref={listRef}>
      {scan.tracks.map((t, i) => (
        <div data-track-id={t.id} key={t.id}>
          <TrackRow
            track={t}
            isCurrent={play.currentTrackId === t.id}
            isPlaying={play.currentTrackId === t.id && play.status === "playing"}
            onPlay={() => void playIndex(i)}
          />
        </div>
      ))}
      {scan.skippedCount > 0 && (
        <div className="music-list-status music-list-skipped">
          읽지 못한 파일 {scan.skippedCount}개 (DRM 보호 또는 손상)
        </div>
      )}
    </div>
  );
}
