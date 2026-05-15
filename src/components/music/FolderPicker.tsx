import { pickFiles } from "../../lib/music/tauri-music";
import { sound } from "../../lib/sound";

interface FolderPickerProps {
  onPick: (paths: string[]) => void;
}

/** Empty-state pane shown when no audio files have been chosen yet.
 *  Component name kept for backwards-compat — it's a *file* picker now. */
export function FolderPicker({ onPick }: FolderPickerProps) {
  const choose = async () => {
    sound.click();
    const paths = await pickFiles();
    if (paths) onPick(paths);
  };
  return (
    <div className="music-empty">
      <div className="music-empty-icon" aria-hidden="true">♪</div>
      <div className="music-empty-title">음원 파일을 골라주세요</div>
      <div className="music-empty-hint">
        mp3 / flac / wav / m4a / ogg / opus 파일을 여러 개 선택할 수 있어요
      </div>
      <button className="music-btn-cta" onClick={choose}>
        🎵 음원 선택
      </button>
    </div>
  );
}
