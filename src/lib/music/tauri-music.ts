import { inTauri } from "../tauri";
import type { ScanResult, Track } from "./types";

/**
 * Open a native *file* picker filtered to audio formats, with multi-select
 * enabled. The dialog shows actual audio files (unlike folder pickers, which
 * OS-level dialogs render as folder-only).
 *
 * Resolves to the list of absolute paths or null if the user cancelled.
 */
export async function pickFiles(): Promise<string[] | null> {
  if (!inTauri()) {
    return ["/mock/song1.mp3", "/mock/song2.flac", "/mock/song3.m4a"];
  }
  const { open } = await import("@tauri-apps/plugin-dialog");
  const result = await open({
    directory: false,
    multiple: true,
    title: "음원 파일 선택",
    filters: [
      {
        name: "Audio",
        extensions: ["mp3", "flac", "wav", "m4a", "ogg", "opus"],
      },
    ],
  });
  if (!result) return null;
  if (Array.isArray(result)) return result.length > 0 ? result : null;
  return [result as string];
}

/**
 * Read metadata for an explicit file list. Used after `pickFiles`.
 */
export async function scanFiles(paths: string[]): Promise<ScanResult> {
  if (inTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<ScanResult>("music_scan_files", { paths });
  }
  return mockScan();
}

/**
 * Open a native folder picker. Kept for backwards compatibility / future
 * use — the UI today uses `pickFiles` because the folder picker can't
 * preview audio file presence on Windows / macOS.
 */
export async function pickFolder(): Promise<string | null> {
  if (!inTauri()) return "/mock/music";
  const { open } = await import("@tauri-apps/plugin-dialog");
  const result = await open({
    directory: true,
    multiple: false,
    title: "음원 폴더 선택",
  });
  if (Array.isArray(result)) return result[0] ?? null;
  return (result as string | null) ?? null;
}

/**
 * Recursively scan a folder via the Rust `music_scan_folder` command.
 * Currently unused by the UI; kept symmetric with `scanFiles`.
 */
export async function scanFolder(path: string): Promise<ScanResult> {
  if (inTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<ScanResult>("music_scan_folder", { path });
  }
  return mockScan();
}

/**
 * Convert a filesystem path to a URL the `<audio>` element can play.
 * Inside Tauri this uses the asset protocol; in browser preview we just
 * return the path (it won't actually play — that's fine for layout work).
 */
export async function trackSrc(path: string): Promise<string> {
  if (inTauri()) {
    const { convertFileSrc } = await import("@tauri-apps/api/core");
    return convertFileSrc(path);
  }
  return path;
}

function mockScan(): ScanResult {
  const tracks: Track[] = [
    {
      id: "mock-1",
      path: "/mock/music/song1.mp3",
      title: "잔잔한 오후",
      artist: "Mock Artist",
      album: "Browser Preview",
      durationSecs: 213,
      trackNo: 1,
      fileSize: 5_242_880,
      modifiedMs: Date.now(),
    },
    {
      id: "mock-2",
      path: "/mock/music/song2.flac",
      title: "Late Night Code",
      artist: "Mock Artist",
      album: "Browser Preview",
      durationSecs: 178,
      trackNo: 2,
      fileSize: 31_457_280,
      modifiedMs: Date.now(),
    },
    {
      id: "mock-3",
      path: "/mock/music/song3.m4a",
      title: "픽셀 위의 산책",
      artist: "Another Mock",
      album: "Demo Album",
      durationSecs: 295,
      trackNo: null,
      fileSize: 7_340_032,
      modifiedMs: Date.now(),
    },
  ];
  return { tracks, skipped: [], elapsedMs: 12 };
}
