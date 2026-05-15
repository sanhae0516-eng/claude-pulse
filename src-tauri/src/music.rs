//! Local music folder scanner. Walks a directory recursively, picks up files
//! with audio extensions, and reads embedded tags via `lofty`.
//!
//! Album-art extraction is intentionally OFF — the user opted for text-only
//! rows, so we keep the IPC payload light by not shipping image bytes.

use lofty::file::{AudioFile, TaggedFileExt};
use lofty::probe::Probe;
use lofty::tag::Accessor;
use serde::Serialize;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::Path;
use std::time::Instant;
use walkdir::WalkDir;

const AUDIO_EXTS: &[&str] = &["mp3", "flac", "wav", "m4a", "ogg", "opus"];

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    /// Stable id derived from path. Survives across scans of the same file.
    pub id: String,
    pub path: String,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub duration_secs: Option<f64>,
    pub track_no: Option<u32>,
    pub file_size: u64,
    pub modified_ms: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub tracks: Vec<Track>,
    /// Paths that matched the extension filter but failed to read.
    /// Caller can show them as "재생 불가" rows or just log.
    pub skipped: Vec<String>,
    pub elapsed_ms: u128,
}

fn path_hash(path: &Path) -> String {
    let mut hasher = DefaultHasher::new();
    path.to_string_lossy().hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

fn has_audio_ext(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| AUDIO_EXTS.iter().any(|x| x.eq_ignore_ascii_case(e)))
        .unwrap_or(false)
}

fn read_track(path: &Path) -> Result<Track, String> {
    let metadata = std::fs::metadata(path).map_err(|e| e.to_string())?;
    let file_size = metadata.len();
    let modified_ms = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);

    let tagged = Probe::open(path)
        .map_err(|e| e.to_string())?
        .read()
        .map_err(|e| e.to_string())?;

    let duration_secs = Some(tagged.properties().duration().as_secs_f64());

    // primary_tag() prefers ID3v2 over ID3v1, etc. Falls back to first tag.
    let tag_ref = tagged.primary_tag().or_else(|| tagged.first_tag());

    let (title, artist, album, track_no) = if let Some(tag) = tag_ref {
        (
            tag.title().map(|s| s.into_owned()),
            tag.artist().map(|s| s.into_owned()),
            tag.album().map(|s| s.into_owned()),
            tag.track(),
        )
    } else {
        (None, None, None, None)
    };

    // Fall back to file stem when no title tag.
    let title = title.or_else(|| {
        path.file_stem()
            .and_then(|s| s.to_str())
            .map(|s| s.to_string())
    });

    Ok(Track {
        id: path_hash(path),
        path: path.to_string_lossy().to_string(),
        title,
        artist,
        album,
        duration_secs,
        track_no,
        file_size,
        modified_ms,
    })
}

/// Read metadata for an explicit list of files the user picked from the
/// native multi-file dialog. Skips paths that aren't files or whose extension
/// isn't a supported audio format. Order in the returned `tracks` follows the
/// same (artist, album, track_no, title) sort as `music_scan_folder` for
/// consistency — the user can still select files randomly.
#[tauri::command]
pub async fn music_scan_files(paths: Vec<String>) -> Result<ScanResult, String> {
    let started = Instant::now();
    let mut tracks: Vec<Track> = Vec::new();
    let mut skipped: Vec<String> = Vec::new();

    for path_str in paths {
        let p = Path::new(&path_str);
        if !p.is_file() {
            skipped.push(path_str);
            continue;
        }
        if !has_audio_ext(p) {
            skipped.push(path_str);
            continue;
        }
        match read_track(p) {
            Ok(t) => tracks.push(t),
            Err(_) => skipped.push(path_str),
        }
    }

    tracks.sort_by(|a, b| {
        a.artist
            .as_deref()
            .unwrap_or("")
            .cmp(b.artist.as_deref().unwrap_or(""))
            .then_with(|| {
                a.album
                    .as_deref()
                    .unwrap_or("")
                    .cmp(b.album.as_deref().unwrap_or(""))
            })
            .then_with(|| a.track_no.unwrap_or(0).cmp(&b.track_no.unwrap_or(0)))
            .then_with(|| {
                a.title
                    .as_deref()
                    .unwrap_or("")
                    .cmp(b.title.as_deref().unwrap_or(""))
            })
    });

    Ok(ScanResult {
        tracks,
        skipped,
        elapsed_ms: started.elapsed().as_millis(),
    })
}

#[tauri::command]
pub async fn music_scan_folder(path: String) -> Result<ScanResult, String> {
    // Validate up front so we return a friendly error instead of an empty list.
    let root = Path::new(&path);
    if !root.exists() {
        return Err(format!("폴더가 존재하지 않습니다: {}", path));
    }
    if !root.is_dir() {
        return Err(format!("폴더가 아닙니다: {}", path));
    }

    let started = Instant::now();
    let mut tracks: Vec<Track> = Vec::new();
    let mut skipped: Vec<String> = Vec::new();

    // walkdir handles UTF-8 paths fine on Windows via WCHAR -> String.
    // We limit depth conservatively to avoid pathological symlink loops.
    for entry in WalkDir::new(root)
        .follow_links(false)
        .max_depth(8)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if !entry.file_type().is_file() {
            continue;
        }
        let p = entry.path();
        if !has_audio_ext(p) {
            continue;
        }
        match read_track(p) {
            Ok(t) => tracks.push(t),
            Err(_) => skipped.push(p.to_string_lossy().to_string()),
        }
    }

    // Sort by (artist, album, track_no, title) for a sensible default order.
    // The frontend can sort differently later if needed.
    tracks.sort_by(|a, b| {
        a.artist
            .as_deref()
            .unwrap_or("")
            .cmp(b.artist.as_deref().unwrap_or(""))
            .then_with(|| {
                a.album
                    .as_deref()
                    .unwrap_or("")
                    .cmp(b.album.as_deref().unwrap_or(""))
            })
            .then_with(|| a.track_no.unwrap_or(0).cmp(&b.track_no.unwrap_or(0)))
            .then_with(|| {
                a.title
                    .as_deref()
                    .unwrap_or("")
                    .cmp(b.title.as_deref().unwrap_or(""))
            })
    });

    Ok(ScanResult {
        tracks,
        skipped,
        elapsed_ms: started.elapsed().as_millis(),
    })
}
