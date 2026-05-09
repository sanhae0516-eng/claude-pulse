use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use walkdir::WalkDir;

const FIVE_HOURS: i64 = 5 * 60 * 60;
/// Calibrated limit: each `type:"user"` record represents one /v1/messages API
/// call (initial prompt OR tool-result continuation). Anthropic's /usage seems
/// to count these — observed ~246 records mapping to ~19% of Max 5x → limit ≈ 1300.
/// Real algorithm is non-linear (token-weighted) so still approximate.
const DEFAULT_LIMIT: u64 = 1300;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UsageSnapshot {
    pub window_start: String,
    pub window_ms: i64,
    pub tokens_used: u64,
    pub tokens_limit: u64,
    pub by_model: HashMap<String, u64>,
    pub refreshed_at: String,
}

#[derive(Debug, Deserialize)]
struct Record {
    #[serde(rename = "type")]
    record_type: Option<String>,
    timestamp: Option<String>,
}

fn projects_dir() -> Option<PathBuf> {
    let mut p = dirs::home_dir()?;
    p.push(".claude");
    p.push("projects");
    Some(p)
}

pub fn collect_usage() -> Result<UsageSnapshot, String> {
    let dir = projects_dir().ok_or("home dir not found")?;
    if !dir.exists() {
        return Err(format!("not found: {}", dir.display()));
    }

    let now = Utc::now();
    let cutoff = now - Duration::seconds(FIVE_HOURS);

    let mut timestamps: Vec<DateTime<Utc>> = Vec::new();

    for entry in WalkDir::new(&dir).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if !path.is_file() || path.extension().map(|e| e != "jsonl").unwrap_or(true) {
            continue;
        }
        let file = match File::open(path) {
            Ok(f) => f,
            Err(_) => continue,
        };
        let reader = BufReader::new(file);
        for line in reader.lines().flatten() {
            let rec: Record = match serde_json::from_str(&line) {
                Ok(r) => r,
                Err(_) => continue,
            };
            // Count every `type: "user"` record — that maps 1:1 to a /v1/messages
            // API call (initial user prompt OR tool-result continuation).
            if rec.record_type.as_deref() != Some("user") {
                continue;
            }
            let ts: DateTime<Utc> = match rec.timestamp.as_deref() {
                Some(s) => match DateTime::parse_from_rfc3339(s) {
                    Ok(t) => t.into(),
                    Err(_) => continue,
                },
                None => continue,
            };
            if ts < cutoff {
                continue;
            }
            timestamps.push(ts);
        }
    }

    if timestamps.is_empty() {
        return Ok(UsageSnapshot {
            window_start: now.to_rfc3339(),
            window_ms: FIVE_HOURS * 1000,
            tokens_used: 0,
            tokens_limit: DEFAULT_LIMIT,
            by_model: HashMap::new(),
            refreshed_at: now.to_rfc3339(),
        });
    }

    timestamps.sort();
    // Simple 5h rolling: window starts at the earliest record in the last 5h.
    // Anthropic's actual session-reset logic is opaque, so the time-to-reset
    // shown here is the floor-truth "earliest activity + 5h", NOT Anthropic's
    // session window.
    let window_start = timestamps[0];
    let count = timestamps.len() as u64;

    Ok(UsageSnapshot {
        window_start: window_start.to_rfc3339(),
        window_ms: FIVE_HOURS * 1000,
        tokens_used: count,
        tokens_limit: DEFAULT_LIMIT,
        by_model: HashMap::new(),
        refreshed_at: now.to_rfc3339(),
    })
}
