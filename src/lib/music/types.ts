/** Single audio file scanned from the user's music folder. */
export interface Track {
  /** Stable id from path hash (matches Rust `path_hash`). */
  id: string;
  /** Absolute filesystem path. Frontend converts to asset URL with convertFileSrc. */
  path: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  durationSecs: number | null;
  trackNo: number | null;
  fileSize: number;
  modifiedMs: number;
}

/** Result of a folder scan. */
export interface ScanResult {
  tracks: Track[];
  /** Paths that matched audio extensions but failed to read (corrupt / DRM / unsupported). */
  skipped: string[];
  elapsedMs: number;
}

/** Persisted across launches (localStorage key `claude-pulse:music:v1`). */
export interface MusicSettings {
  /** Absolute paths the user picked via the multi-file dialog. Empty means
   *  "no library yet — show the picker prompt". Replaces the older
   *  `folderPath` model which used a recursive folder scan; we kept the
   *  scan command in Rust for future use but the UI is file-pick only. */
  selectedPaths: string[];
  /** 0..1 audio gain. */
  volume: number;
  /** id of the track that was playing when the app last quit. */
  lastPlayedTrackId: string | null;
  /** Position within that track in seconds. */
  lastPlayedPosition: number;
  /** If true, restore lastPlayedTrack on next launch (cued, paused). */
  restoreOnLaunch: boolean;
}

export type PlayStatus = "idle" | "loading" | "playing" | "paused" | "error";

export interface PlayState {
  status: PlayStatus;
  currentTrackId: string | null;
  /** Live position in seconds (driven by <audio> timeupdate). */
  position: number;
  /** Duration of the current track in seconds (audio metadata). */
  duration: number;
  /** Last error message — surfaced in NowPlaying when status === "error". */
  error: string | null;
}

export type ScanStatus = "idle" | "scanning" | "ready" | "error";

export interface ScanState {
  status: ScanStatus;
  tracks: Track[];
  skippedCount: number;
  error: string | null;
}
