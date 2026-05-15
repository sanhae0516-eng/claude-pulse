//! Decrypts the OAuth access token Claude Desktop stores in its Chromium-style
//! `Local State` + `config.json` files. The format follows Chromium OSCrypt:
//!
//! Windows (DPAPI + AES-256-GCM):
//!   1. `Local State` → `os_crypt.encrypted_key` is base64 of `"DPAPI" + blob`.
//!      User's DPAPI decrypts that → 32-byte AES-256 master key.
//!   2. `oauth:tokenCache` is base64 of `"v10" + nonce(12) + ct + tag(16)`.
//!      AES-256-GCM with the master key → plaintext token JSON.
//!
//! macOS (Keychain + AES-128-CBC):
//!   1. Get "Claude Safe Storage" password from Keychain.
//!      PBKDF2-HMAC-SHA1(password, salt="saltysalt", 1003 iter) → 16-byte key.
//!   2. `Local State` → `os_crypt.encrypted_key` is base64 of `"v10" + ct`.
//!      AES-128-CBC (key from step 1, IV = 16×0x20) → master key bytes.
//!   3. `oauth:tokenCache` is base64 of `"v10" + ct`.
//!      AES-128-CBC with the master key, same IV → plaintext token JSON.
//!
//! The plaintext on both is a JSON object containing at least `accessToken`.

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use serde::Deserialize;
use std::fs;
use std::path::PathBuf;

#[cfg(target_os = "windows")]
use aes_gcm::aead::Aead;
#[cfg(target_os = "windows")]
use aes_gcm::{Aes256Gcm, KeyInit, Nonce};

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
    // Claude Desktop shipped via the Microsoft Store is a UWP/AppX package
    // whose `%APPDATA%\Claude\` writes get redirected to
    // `%LOCALAPPDATA%\Packages\Claude_<pkgid>\LocalCache\Roaming\Claude\`.
    // The legacy path still appears in `Get-Item` (Windows installs a
    // package-redirection junction there) but reading it via Win32
    // `CreateFileW` — which `std::fs` uses — returns ERROR_PATH_NOT_FOUND.
    // So we look up the real container path first, and only fall back to
    // the legacy location when no UWP package is present.
    #[cfg(target_os = "windows")]
    {
        if let Some(local) = dirs::data_local_dir() {
            let packages = local.join("Packages");
            if let Ok(entries) = std::fs::read_dir(&packages) {
                for entry in entries.flatten() {
                    let name = entry.file_name();
                    if name.to_string_lossy().starts_with("Claude_") {
                        let uwp = entry
                            .path()
                            .join("LocalCache")
                            .join("Roaming")
                            .join("Claude");
                        if uwp.join("Local State").is_file() {
                            return Ok(uwp);
                        }
                    }
                }
            }
        }
    }

    // Default: `dirs::config_dir()` resolves to the right Chromium-style
    // path on each OS — `%APPDATA%\Claude` on Windows (Win32 install),
    // `~/Library/Application Support/Claude` on macOS, `~/.config/Claude`
    // on Linux. We just need to append "Claude".
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

#[cfg(target_os = "windows")]
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

/// macOS Chromium OSCrypt: master key lives encrypted in `Local State` as
/// `"v10" + AES-128-CBC(payload)`. The CBC key is PBKDF2-HMAC-SHA1 of a
/// Keychain-stored password.
///
/// Keychain service name is the Electron product name + " Safe Storage";
/// for Claude Desktop this is "Claude Safe Storage" / "Claude". If it ever
/// changes (rename, electron-builder config tweak) the Keychain Access app
/// shows the actual name — that's where to look on a failing install.
#[cfg(target_os = "macos")]
fn read_master_key() -> Result<Vec<u8>, AuthError> {
    use cbc::cipher::{block_padding::Pkcs7, BlockDecryptMut, KeyIvInit};
    use pbkdf2::pbkdf2_hmac;
    use security_framework::passwords::get_generic_password;
    use sha1::Sha1;

    type Aes128CbcDec = cbc::Decryptor<aes::Aes128>;

    // 1. Keychain → password bytes.
    let password = get_generic_password("Claude Safe Storage", "Claude")
        .map_err(|e| AuthError::Decrypt(format!("keychain lookup: {e}")))?;

    // 2. Derive AES-128 key (Chromium constants).
    let mut derived = [0u8; 16];
    pbkdf2_hmac::<Sha1>(&password, b"saltysalt", 1003, &mut derived);

    // 3. Read & decode `Local State` → encrypted_key.
    let path = claude_dir()?.join("Local State");
    let body = fs::read_to_string(&path).map_err(|e| {
        AuthError::NotFound(format!("Local State at {}: {e}", path.display()))
    })?;
    let state: LocalState =
        serde_json::from_str(&body).map_err(|e| AuthError::Parse(e.to_string()))?;
    let raw = B64
        .decode(state.os_crypt.encrypted_key.as_bytes())
        .map_err(|e| AuthError::Decode(e.to_string()))?;

    // 4. "v10" prefix → CBC ciphertext.
    if raw.len() < 3 || &raw[..3] != b"v10" {
        return Err(AuthError::Decode(
            "encrypted_key missing v10 prefix".into(),
        ));
    }
    let mut buf = raw[3..].to_vec();

    // 5. AES-128-CBC with IV = 16 spaces (Chromium convention).
    let cipher = Aes128CbcDec::new(&derived.into(), &[b' '; 16].into());
    let plaintext = cipher
        .decrypt_padded_mut::<Pkcs7>(&mut buf)
        .map_err(|e| AuthError::Decrypt(format!("CBC decrypt master key: {e:?}")))?;

    Ok(plaintext.to_vec())
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn read_master_key() -> Result<Vec<u8>, AuthError> {
    Err(AuthError::Decrypt(
        "Claude Pulse currently only supports Windows and macOS".into(),
    ))
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

/// Decrypts a Chromium OSCrypt `"v10" + ciphertext` blob with the given
/// master key. Algorithm differs per OS:
///   - Windows: AES-256-GCM, 12-byte nonce after the prefix, 16-byte tag.
///   - macOS:   AES-128-CBC with fixed IV (16 × space). No nonce, no tag.
#[cfg(target_os = "windows")]
fn decrypt_payload(key: &[u8], blob: &[u8]) -> Result<Vec<u8>, AuthError> {
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

#[cfg(target_os = "macos")]
fn decrypt_payload(key: &[u8], blob: &[u8]) -> Result<Vec<u8>, AuthError> {
    use cbc::cipher::{block_padding::Pkcs7, BlockDecryptMut, KeyIvInit};
    type Aes128CbcDec = cbc::Decryptor<aes::Aes128>;

    if blob.len() < 3 || &blob[..3] != b"v10" {
        return Err(AuthError::Decode(
            "token blob missing v10 prefix".into(),
        ));
    }
    if key.len() != 16 {
        return Err(AuthError::Decrypt(format!(
            "expected 16-byte master key on macOS, got {} bytes",
            key.len()
        )));
    }
    let mut buf = blob[3..].to_vec();
    let cipher = Aes128CbcDec::new(key.into(), &[b' '; 16].into());
    let plaintext = cipher
        .decrypt_padded_mut::<Pkcs7>(&mut buf)
        .map_err(|e| AuthError::Decrypt(format!("CBC decrypt token: {e:?}")))?;
    Ok(plaintext.to_vec())
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn decrypt_payload(_key: &[u8], _blob: &[u8]) -> Result<Vec<u8>, AuthError> {
    Err(AuthError::Decrypt(
        "Claude Pulse currently only supports Windows and macOS".into(),
    ))
}

fn debug_log(msg: &str) {
    use std::io::Write;
    let path = dirs::cache_dir()
        .unwrap_or_else(std::env::temp_dir)
        .join("claude-pulse-auth-debug.log");
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
    {
        let _ = writeln!(f, "[{}] {}", chrono::Utc::now(), msg);
    }
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
    debug_log("--- get_access_token start ---");

    let key = read_master_key().map_err(|e| {
        debug_log(&format!("read_master_key FAILED: {e}"));
        e
    })?;
    debug_log(&format!("read_master_key ok (key_len={})", key.len()));

    let blob = read_token_blob().map_err(|e| {
        debug_log(&format!("read_token_blob FAILED: {e}"));
        e
    })?;
    debug_log(&format!("read_token_blob ok (blob_len={})", blob.len()));

    let plaintext = decrypt_payload(&key, &blob).map_err(|e| {
        debug_log(&format!("decrypt_payload FAILED: {e}"));
        e
    })?;
    debug_log(&format!(
        "decrypt_payload ok (plaintext_len={})",
        plaintext.len()
    ));

    let root: serde_json::Value = serde_json::from_slice(&plaintext).map_err(|e| {
        debug_log(&format!("plaintext JSON parse FAILED: {e}"));
        AuthError::Parse(format!("token plaintext is not JSON: {e}"))
    })?;

    // Log shape so we can verify field mapping (no secrets — only key names + lengths).
    debug_log(&format!("plaintext_shape: {}", shape(&root, 0)));

    let entry = pick_claude_code_entry(&root).ok_or_else(|| {
        debug_log("pick_claude_code_entry FAILED: no matching entry");
        AuthError::Parse("no claude_code or api.anthropic.com entry in token cache".into())
    })?;

    let token = find_access_token(entry).ok_or_else(|| {
        debug_log("find_access_token FAILED: no access_token field in entry");
        AuthError::Parse("access_token not found in entry — see auth-debug.log".into())
    })?;
    debug_log(&format!("get_access_token ok (token_len={})", token.len()));
    Ok(token)
}
