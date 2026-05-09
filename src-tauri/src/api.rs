//! Calls Claude's authenticated `/api/oauth/usage` endpoint, the same one
//! that powers the `/usage` slash command in Claude Code.
//!
//! Response shape is reverse-engineered from the Claude Code binary
//! (`five_hour`, `seven_day`, `seven_day_opus` buckets, each with
//! `utilization` and `resets_at`). We deserialize loosely (`serde_json::Value`)
//! and pluck the fields we care about so unknown additions don't break us.

use serde::Serialize;

const USAGE_URL: &str = "https://api.anthropic.com/api/oauth/usage";

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UsageBucket {
    /// 0.0–1.0 (or 0–100 — we normalize to 0..1 below)
    pub utilization: f64,
    /// RFC3339 timestamp of next reset, if known.
    pub resets_at: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UsageSnapshot {
    pub plan: Option<String>,
    pub five_hour: Option<UsageBucket>,
    pub seven_day: Option<UsageBucket>,
    pub seven_day_opus: Option<UsageBucket>,
    pub refreshed_at: String,
}

fn extract_bucket(v: &serde_json::Value) -> Option<UsageBucket> {
    let obj = v.as_object()?;
    // utilization may be 0..1 fractional or 0..100 percentage
    let raw = obj
        .get("utilization")
        .or_else(|| obj.get("utilization_pct"))
        .or_else(|| obj.get("percentage"))
        .or_else(|| obj.get("used"))
        .and_then(|x| x.as_f64())?;
    let utilization = if raw > 1.0 { raw / 100.0 } else { raw };

    let resets_at = obj
        .get("resets_at")
        .or_else(|| obj.get("reset_at"))
        .or_else(|| obj.get("resetAt"))
        .and_then(|x| x.as_str())
        .map(|s| s.to_string());

    Some(UsageBucket {
        utilization,
        resets_at,
    })
}

fn debug_log(msg: &str) {
    let path = dirs::cache_dir()
        .unwrap_or_else(std::env::temp_dir)
        .join("claude-pulse-debug.log");
    let _ = std::fs::write(&path, msg);
}

pub async fn fetch_usage(token: &str) -> Result<UsageSnapshot, String> {
    let client = reqwest::Client::builder()
        .user_agent("claude-pulse/0.3")
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get(USAGE_URL)
        .bearer_auth(token)
        .header("anthropic-beta", "oauth-2025-04-20")
        .send()
        .await
        .map_err(|e| format!("request: {e}"))?;

    let status = resp.status();
    let text = resp.text().await.map_err(|e| e.to_string())?;

    debug_log(&format!(
        "[{}] /usage status={} body_len={}\n{}\n",
        chrono::Utc::now(),
        status,
        text.len(),
        text.chars().take(2000).collect::<String>()
    ));

    if !status.is_success() {
        return Err(format!("HTTP {status}: {}", text.chars().take(120).collect::<String>()));
    }

    let v: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("parse: {e}"))?;

    // Try common shapes: top-level keys, or nested under "usage"/"limits".
    let root = v.get("usage").or_else(|| v.get("limits")).unwrap_or(&v);

    let plan = v
        .get("plan")
        .or_else(|| v.get("plan_name"))
        .and_then(|x| x.as_str())
        .map(|s| s.to_string());

    let five_hour = root.get("five_hour").and_then(extract_bucket);
    let seven_day = root.get("seven_day").and_then(extract_bucket);
    let seven_day_opus = root.get("seven_day_opus").and_then(extract_bucket);

    Ok(UsageSnapshot {
        plan,
        five_hour,
        seven_day,
        seven_day_opus,
        refreshed_at: chrono::Utc::now().to_rfc3339(),
    })
}
