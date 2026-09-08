use hmac::{Hmac, Mac};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha1::Sha1;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

type HmacSha1 = Hmac<Sha1>;

const BASE32_ALPHABET: &[u8; 32] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TotpConfig {
    pub enabled: bool,
    pub idle_timeout_mins: u32,
    pub has_backup_codes: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TotpSetupInfo {
    pub secret: String,
    pub uri: String,
}

fn default_idle_timeout() -> u32 {
    15
}

#[derive(Serialize, Deserialize)]
struct SavedTotpData {
    enabled: bool,
    secret: String,
    backup_code_hashes: Vec<String>,
    #[serde(default = "default_idle_timeout")]
    idle_timeout_mins: u32,
}

impl Default for SavedTotpData {
    fn default() -> Self {
        Self {
            enabled: false,
            secret: String::new(),
            backup_code_hashes: vec![],
            idle_timeout_mins: 15,
        }
    }
}

fn totp_file_path() -> Result<PathBuf, String> {
    let dir = dirs::config_dir()
        .ok_or("Cannot resolve config directory")?
        .join("com.openterm.app");
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create config dir: {e}"))?;
    Ok(dir.join("totp.json"))
}

fn read_totp_data() -> SavedTotpData {
    if let Ok(path) = totp_file_path() {
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(data) = serde_json::from_str::<SavedTotpData>(&content) {
                    return data;
                }
            }
        }
    }
    SavedTotpData {
        enabled: false,
        secret: String::new(),
        backup_code_hashes: vec![],
        idle_timeout_mins: 15,
    }
}

fn write_totp_data(data: &SavedTotpData) -> Result<(), String> {
    let path = totp_file_path()?;
    let json = serde_json::to_string_pretty(data)
        .map_err(|e| format!("Failed to serialize TOTP data: {e}"))?;
    fs::write(path, json).map_err(|e| format!("Failed to write TOTP file: {e}"))?;
    Ok(())
}

/// Base32 encode raw bytes without padding
pub fn base32_encode(data: &[u8]) -> String {
    let mut result = String::new();
    let mut buffer = 0u64;
    let mut bits_left = 0;

    for &byte in data {
        buffer = (buffer << 8) | (byte as u64);
        bits_left += 8;
        while bits_left >= 5 {
            bits_left -= 5;
            let index = ((buffer >> bits_left) & 0x1F) as usize;
            result.push(BASE32_ALPHABET[index] as char);
        }
    }

    if bits_left > 0 {
        let index = ((buffer << (5 - bits_left)) & 0x1F) as usize;
        result.push(BASE32_ALPHABET[index] as char);
    }

    result
}

/// Base32 decode string ignoring whitespace and hyphens
pub fn base32_decode(encoded: &str) -> Result<Vec<u8>, String> {
    let clean: String = encoded.chars().filter(|c| !c.is_whitespace() && *c != '-').collect();
    let mut result = Vec::new();
    let mut buffer = 0u64;
    let mut bits_left = 0;

    for c in clean.to_ascii_uppercase().chars() {
        let val = match c {
            'A'..='Z' => (c as u8 - b'A') as u64,
            '2'..='7' => (c as u8 - b'2' + 26) as u64,
            '=' => break,
            _ => return Err(format!("Invalid Base32 character: {}", c)),
        };

        buffer = (buffer << 5) | val;
        bits_left += 5;
        if bits_left >= 8 {
            bits_left -= 8;
            result.push(((buffer >> bits_left) & 0xFF) as u8);
        }
    }

    Ok(result)
}

/// RFC 6238 TOTP computation
pub fn compute_totp(secret: &str, time_step: u64) -> Result<String, String> {
    let secret_bytes = base32_decode(secret)?;
    let mut mac = <HmacSha1 as Mac>::new_from_slice(&secret_bytes)
        .map_err(|e| format!("HMAC init error: {e}"))?;

    let counter_bytes = time_step.to_be_bytes();
    mac.update(&counter_bytes);
    let hmac_result = mac.finalize().into_bytes();

    let offset = (hmac_result[19] & 0x0f) as usize;
    let code = (((hmac_result[offset] & 0x7f) as u32) << 24)
        | (((hmac_result[offset + 1]) as u32) << 16)
        | (((hmac_result[offset + 2]) as u32) << 8)
        | ((hmac_result[offset + 3]) as u32);

    let totp = code % 1_000_000;
    Ok(format!("{:06}", totp))
}

pub fn verify_totp_code(secret: &str, code: &str, current_epoch_secs: u64) -> bool {
    let current_step = current_epoch_secs / 30;
    let clean_code = code.trim().replace([' ', '-'], "");

    // Check step - 1, step, step + 1 (±30s tolerance)
    for offset in [-1i64, 0, 1] {
        let step = match (current_step as i64).checked_add(offset) {
            Some(s) if s >= 0 => s as u64,
            _ => continue,
        };

        if let Ok(expected) = compute_totp(secret, step) {
            if expected == clean_code {
                return true;
            }
        }
    }
    false
}

fn hash_code(code: &str) -> String {
    let clean = code.trim().to_uppercase();
    let mut hasher = Sha256::new();
    hasher.update(clean.as_bytes());
    format!("{:x}", hasher.finalize())
}

pub fn generate_new_totp_secret() -> TotpSetupInfo {
    let mut rng = rand::thread_rng();
    let mut secret_bytes = [0u8; 20]; // 160-bit key
    rng.fill_bytes(&mut secret_bytes);

    let secret = base32_encode(&secret_bytes);
    let uri = format!(
        "otpauth://totp/OpenTerm:client?secret={}&issuer=OpenTerm&algorithm=SHA1&digits=6&period=30",
        secret
    );

    TotpSetupInfo { secret, uri }
}

pub fn get_config() -> TotpConfig {
    let data = read_totp_data();
    TotpConfig {
        enabled: data.enabled,
        idle_timeout_mins: data.idle_timeout_mins,
        has_backup_codes: !data.backup_code_hashes.is_empty(),
    }
}

pub fn update_idle_timeout(mins: u32) -> Result<(), String> {
    let mut data = read_totp_data();
    data.idle_timeout_mins = mins;
    write_totp_data(&data)
}

pub fn enable_totp(secret: &str, initial_code: &str) -> Result<Vec<String>, String> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    if !verify_totp_code(secret, initial_code, now) {
        return Err("Invalid TOTP verification code. Ensure your device clock is accurate.".to_string());
    }

    // Generate 8 emergency backup recovery codes
    let mut backup_codes = Vec::new();
    let mut backup_hashes = Vec::new();
    let mut rng = rand::thread_rng();

    for _ in 0..8 {
        let mut bytes = [0u8; 5];
        rng.fill_bytes(&mut bytes);
        let code = base32_encode(&bytes);
        let formatted = format!("{}-{}", &code[0..4], &code[4..8]);
        backup_hashes.push(hash_code(&formatted));
        backup_codes.push(formatted);
    }

    let mut data = read_totp_data();
    data.enabled = true;
    data.secret = secret.to_string();
    data.backup_code_hashes = backup_hashes;

    write_totp_data(&data)?;
    Ok(backup_codes)
}

pub fn disable_totp(code_or_backup: &str) -> Result<(), String> {
    let mut data = read_totp_data();
    if !data.enabled {
        return Ok(());
    }

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let is_totp_valid = verify_totp_code(&data.secret, code_or_backup, now);
    let hashed = hash_code(code_or_backup);
    let is_backup_valid = data.backup_code_hashes.contains(&hashed);

    if !is_totp_valid && !is_backup_valid {
        return Err("Invalid TOTP code or backup code. Cannot disable 2FA.".to_string());
    }

    data.enabled = false;
    data.secret = String::new();
    data.backup_code_hashes = vec![];
    write_totp_data(&data)?;
    Ok(())
}

pub fn validate_login_code(code_or_backup: &str) -> Result<bool, String> {
    let mut data = read_totp_data();
    if !data.enabled {
        return Ok(true);
    }

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    if verify_totp_code(&data.secret, code_or_backup, now) {
        return Ok(true);
    }

    // Check backup codes
    let hashed = hash_code(code_or_backup);
    if let Some(pos) = data.backup_code_hashes.iter().position(|h| h == &hashed) {
        // Invalidate used backup code
        data.backup_code_hashes.remove(pos);
        let _ = write_totp_data(&data);
        return Ok(true);
    }

    Ok(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_base32_roundtrip() {
        let original = b"Hello OpenTerm 2FA!";
        let encoded = base32_encode(original);
        let decoded = base32_decode(&encoded).unwrap();
        assert_eq!(original.to_vec(), decoded);
    }

    #[test]
    fn test_rfc6238_standard_vectors() {
        // RFC 6238 test secret "12345678901234567890" in Base32 is GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ
        let secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
        // Unix time: 59s -> step = 1 -> RFC code is 287082
        let code1 = compute_totp(secret, 59 / 30).unwrap();
        assert_eq!(code1, "287082");

        // Unix time: 1111111109s -> step = 37037036 -> RFC code is 081804
        let code2 = compute_totp(secret, 1111111109 / 30).unwrap();
        assert_eq!(code2, "081804");
    }

    #[test]
    fn test_verify_drift_window() {
        let secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
        let now = 1111111109u64; // step = 37037036, code = 081804

        // Exact time matches
        assert!(verify_totp_code(secret, "081804", now));
        // Within +25s (same or +1 window) matches
        assert!(verify_totp_code(secret, "081804", now + 25));
        // Wrong code fails
        assert!(!verify_totp_code(secret, "123456", now));
    }
}
