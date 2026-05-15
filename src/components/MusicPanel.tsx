import { useMemo } from "react";
import type { MusicSettings } from "../lib/music/types";
import type { MusicPlayerApi } from "../lib/music/useMusicPlayer";
import { pickFiles } from "../lib/music/tauri-music";
import { sound } from "../lib/sound";
import { NowPlaying } from "./music/NowPlaying";
import { PlayerControls } from "./music/PlayerControls";
import { TrackList } from "./music/TrackList";
import { FolderPicker } from "./music/FolderPicker";
import "../styles/music.css";

interface MusicPanelProps {
  player: MusicPlayerApi;
  settings: MusicSettings;
  onChange: (p: Partial<MusicSettings>) => void;
  onClose: () => void;
}

/** Overlay panel that replaces the widget body (same pattern as SettingsPanel). */
export function MusicPanel({ player, settings, onChange, onClose }: MusicPanelProps) {
  const closeSilent = () => {
    sound.click();
    onClose();
  };

  const changeLibrary = async () => {
    sound.click();
    const paths = await pickFiles();
    if (paths) await player.loadTracks(paths);
  };

  const currentTrack = useMemo(
    () =>
      player.play.currentTrackId
        ? player.scan.tracks.find((t) => t.id === player.play.currentTrackId) ?? null
        : null,
    [player.play.currentTrackId, player.scan.tracks]
  );

  const hasLibrary = settings.selectedPaths.length > 0;

  return (
    <div className="music-panel" data-tauri-drag-region>
      <div className="music-header" data-tauri-drag-region>
        <span className="music-title">MUSIC</span>
        <button
          className="music-close"
          onClick={closeSilent}
          aria-label="close music"
        >
          ✕
        </button>
      </div>

      {!hasLibrary ? (
        <div className="music-body">
          <FolderPicker onPick={(paths) => void player.loadTracks(paths)} />
        </div>
      ) : (
        <>
          <div className="music-body">
            <NowPlaying track={currentTrack} play={player.play} />
            <PlayerControls player={player} volume={settings.volume} />
            <TrackList player={player} />
          </div>
          <div className="music-footer">
            <button
              className="music-footer-btn"
              onClick={changeLibrary}
              title={`${settings.selectedPaths.length}개 음원`}
            >
              🎵 음원 변경
            </button>
            <label className="music-footer-toggle">
              <input
                type="checkbox"
                checked={settings.restoreOnLaunch}
                onChange={(e) => {
                  (e.target.checked ? sound.toggleOn : sound.toggleOff)();
                  onChange({ restoreOnLaunch: e.target.checked });
                }}
              />
              <span>다음 실행 시 복원</span>
            </label>
          </div>
        </>
      )}
    </div>
  );
}
