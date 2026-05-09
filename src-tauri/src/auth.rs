//! Decrypts the OAuth access token that Claude Desktop stores in
//! `%APPDATA%\Claude\config.json` under the `oauth:tokenCache` key.
//!
//! Storage format mirrors Chromium's "v10" cookie encryption:
//!   1. `Local State` JSON has `os_crypt.encrypted_key` — base64 of
//!      `"DPAPI" + dpapi_blob`. Decrypt the dpapi_blob with the user's
//!      DPAPI to get a 32-byte AES-256 master key.
//!   2. `oauth:tokenCache` is base64 of `"v10" + nonce(12) + ciphertext + tag(16)`.
//!      Decrypt with AES-256-GCM using the master key to get the token JSON.
//!
//! The plaintext is a JSON object containing at least `accessToken`.

use aes_gcm::aead::Aead;
use aes_gcm::{Aes256Gcm, KeyInit, Nonce};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use serde::Deserialize;
use std::fs;
use std::path::PathBuf;

#[derive(Debug)]
pub enum AuthError {
    NotFound(String),
    Decode(String),
    Decrypt(String),
    Parse(String),
}

impl std::fmt::Display for AuthError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AuthError::NotFound(s) => write!(f, "not found: {s}"),
            AuthError::Decode(s) => write!(f, "decode: {s}"),
            AuthError::Decrypt(s) => write!(f, "decrypt: {s}"),
            AuthError::Parse(s) => write!(f, "parse: {s}"),
        }
    }
}

impl std::error::Error for AuthError {}

#[derive(Debug, Deserialize)]
struct LocalState {
    os_crypt: OsCrypt,
}

#[derive(Debug, Deserialize)]
struct OsCrypt {
    encrypted_key: String,
}

fn claude_dir() -> Result<PathBuf, AuthError> {
    let mut p = dirs::config_dir()
        .ok_or_else(|| AuthError::NotFound("config dir".into()))?;
    p.push("Claude");
    Ok(p)
}

#[cfg(target_os = "windows")]
fn dpapi_decrypt(input: &[u8]) -> Result<Vec<u8>, AuthError> {
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Cryptography::{
        CryptUnprotectData, CRYPT_INTEGER_BLOB,
    };

    let mut input_blob = CRYPT_INTEGER_BLOB {
        cbData: input.len() as u32,
        pbData: input.as_ptr() as *mut u8,
    };
    let mut output_blob = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: std::ptr::null_mut(),
    };

    let ok = unsafe {
        CryptUnprotectData(
            &mut input_blob,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            0,
            &mut output_blob,
        )
    };

    if ok == 0 {
        return Err(AuthError::Decrypt("CryptUnprotectData failed".into()));
    }

    let len = output_blob.cbData as usize;
    let result = unsafe { std::slice::from_raw_parts(output_blob.pbData, len).to_vec() };
    unsafe {
        LocalFree(output_blob.pbData as _);
    }
    Ok(result)
}

#[cfg(not(target_os = "windows"))]
fn dpapi_decrypt(_input: &[u8]) -> Result<Vec<u8>, AuthError> {
    Err(AuthError::Decrypt(
        "DPAPI is only available on Windows".into(),
    ))
}

fn read_master_key() -> Result<Vec<u8>, AuthError> {
    let path = claude_dir()?.join("Local State");
    let body = fs::read_to_string(&path).map_err(|e| {
        AuthError::NotFound(format!("Local State at {}: {e}", path.display()))
    })?;
    let state: LocalState =
        serde_json::from_str(&body).map_err(|e| AuthError::Parse(e.to_string()))?;
    let raw = B64
        .decode(state.os_crypt.encrypted_key.as_bytes())
        .map_err(|e| AuthError::Decode(e.to_string()))?;
    if raw.len() < 5 || &raw[..5] != b"DPAPI" {
        return Err(AuthError::Decode(
            "encrypted_key missing DPAPI prefix".into(),
        ));
    }
    dpapi_decrypt(&raw[5..])
}

fn read_token_blob() -> Result<Vec<u8>, AuthError> {
    let path = claude_dir()?.join("config.json");
    let body = fs::read_to_string(&path).map_err(|e| {
        AuthError::NotFound(format!("config.json at {}: {e}", path.display()))
    })?;
    let v: serde_json::Value =
        serde_json::from_str(&body).map_err(|e| AuthError::Parse(e.to_string()))?;
    let cache = v
        .get("oauth:tokenCache")
        .and_then(|x| x.as_str())
        .ok_or_else(|| AuthError::NotFound("oauth:tokenCache missing".into()))?;
    B64.decode(cache.as_bytes())
        .map_err(|e| AuthError::Decode(e.to_string()))
}

fn aes_gcm_decrypt(key: &[u8], blob: &[u8]) -> Result<Vec<u8>, AuthError> {
    if blob.len() < 3 + 12 + 16 || &blob[..3] != b"v10" {
        return Err(AuthError::Decode(
            "token blob missing v10 prefix or too short".into(),
        ));
    }
    let nonce = &blob[3..15];
    let ciphertext_with_tag = &blob[15..];
    let cipher =
        Aes256Gcm::new_from_slice(key).map_err(|e| AuthError::Decrypt(e.to_string()))?;
    cipher
        .decrypt(Nonce::from_slice(nonce), ciphertext_with_tag)
        .map_err(|e| AuthError::Decrypt(e.to_string()))
}

fn debug_log(msg: &str) {
    let path = dirs::cache_dir()
        .unwrap_or_else(std::env::temp_dir)
        .join("claude-pulse-auth-debug.log");
    let _ = std::fs::write(&path, msg);
}

/// Recursively dumps the JSON shape (key names + value types/lengths) without
/// leaking actual token values. Caps depth + per-string sizes for safety.
fn shape(v: &serde_json::Value, depth: usize) -> String {
    if depth > 4 {
        return "...".into();
    }
    match v {
        serde_json::Value::Object(o) => {
            let entries: Vec<String> = o
                .iter()
                .take(20)
                .map(|(k, v)| format!("{k}: {}", shape(v, depth + 1)))
                .collect();
            format!("{{ {} }}", entries.join(", "))
        }
        serde_json::Value::Array(a) => format!("[len={}]", a.len()),
        serde_json::Value::String(s) => format!("string(len={})", s.len()),
        serde_json::Value::Number(_) => "num".into(),
        serde_json::Value::Bool(_) => "bool".into(),
        serde_json::Value::Null => "null".into(),
    }
}

/// Recursively walks the value tree and returns the first string field whose
/// key matches a known access-token name.
fn find_access_token(v: &serde_json::Value) -> Option<String> {
    if let Some(obj) = v.as_object() {
        for (k, child) in obj {
            let lower = k.to_lowercase();
            if matches!(
                lower.as_str(),
                "access_token" | "accesstoken" | "token" | "bearer_token"
            ) {
                if let Some(s) = child.as_str() {
                    if !s.is_empty() {
                        return Some(s.to_string());
                    }
                }
            }
            if let Some(found) = find_access_token(child) {
                return Some(found);
            }
        }
    }
    None
}

/// Picks the cache entry whose key contains `claude_code` scope (the active
/// Claude Code session token), falling back to any entry pointing at
/// api.anthropic.com.
fn pick_claude_code_entry(root: &serde_json::Value) -> Option<&serde_json::Value> {
    let obj = root.as_object()?;
    let mut fallback: Option<&serde_json::Value> = None;
    for (k, v) in obj {
        if k.contains("claude_code") {
            return Some(v);
        }
        if k.contains("api.anthropic.com") && fallback.is_none() {
            fallback = Some(v);
        }
    }
    fallback
}

/// Returns the OAuth access token from Claude Desktop's encrypted store.
pub fn get_access_token() -> Result<String, AuthError> {
    let key = read_master_key()?;
    let blob = read_token_blob()?;
    let plaintext = aes_gcm_decrypt(&key, &blob)?;

    let root: serde_json::Value = serde_json::from_slice(&plaintext)
        .map_err(|e| AuthError::Parse(format!("token plaintext is not JSON: {e}")))?;

    // Always log shape so we can verify field mapping (no secrets — only key names + lengths).
    debug_log(&format!(
        "plaintext_len={}\nfull_shape:\n{}\n",
        plaintext.len(),
        shape(&root, 0)
    ));

    let entry = pick_claude_code_entry(&root)
        .ok_or_else(|| AuthError::Parse("no claude_code or api.anthropic.com entry in token cache".into()))?;

    find_access_token(entry).ok_or_else(|| {
        AuthError::Parse("access_token not found in entry — see auth-debug.log".into())
    })
}
