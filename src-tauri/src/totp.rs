use hmac::{Hmac, Mac};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha1::Sha1;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
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
    /// Legacy plaintext secret. Only non-empty while migration to the OS keychain is pending;
    /// once migrated it is cleared and therefore no longer serialized.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    secret: String,
    #[serde(default)]
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
            idle_timeout_mins: default_idle_timeout(),
        }
    }
}

/// Where the TOTP shared secret lives. Abstracted so tests don't touch the real keychain.
trait SecretStore {
    fn get(&self) -> Result<Option<String>, String>;
    fn set(&self, secret: &str) -> Result<(), String>;
    fn delete(&self) -> Result<(), String>;
}

/// OS keychain: Windows Credential Manager / macOS Keychain / Linux Secret Service.
struct KeyringStore;

impl KeyringStore {
    fn entry() -> Result<keyring::Entry, String> {
        keyring::Entry::new(crate::paths::IDENTIFIER, "totp-secret")
            .map_err(|e| format!("OS keychain unavailable: {e}"))
    }
}

impl SecretStore for KeyringStore {
    fn get(&self) -> Result<Option<String>, String> {
        match Self::entry()?.get_password() {
            Ok(s) => Ok(Some(s)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(format!("OS keychain read failed: {e}")),
        }
    }

    fn set(&self, secret: &str) -> Result<(), String> {
        Self::entry()?
            .set_password(secret)
            .map_err(|e| format!("OS keychain write failed: {e}"))
    }

    fn delete(&self) -> Result<(), String> {
        match Self::entry()?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(format!("OS keychain delete failed: {e}")),
        }
    }
}

fn totp_file_path() -> Result<PathBuf, String> {
    Ok(crate::paths::config_dir()?.join("totp.json"))
}

/// Read totp.json, migrating a legacy plaintext secret into `store`. If the keychain write fails
/// the secret stays in memory (and thus in the file on the next write) and migration is retried.
fn load(path: &Path, store: &dyn SecretStore) -> SavedTotpData {
    let mut data: SavedTotpData = fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();

    if !data.secret.is_empty() {
        match store.set(&data.secret) {
            Ok(()) => {
                data.secret.clear();
                if let Err(e) = save(path, &data) {
                    eprintln!("[ShellFerry] failed to scrub legacy TOTP secret from disk: {e}");
                }
            }
            Err(e) => eprintln!("[ShellFerry] TOTP secret migration deferred: {e}"),
        }
    }
    data
}

fn save(path: &Path, data: &SavedTotpData) -> Result<(), String> {
    let json = serde_json::to_string_pretty(data)
        .map_err(|e| format!("Failed to serialize TOTP data: {e}"))?;
    fs::write(path, json).map_err(|e| format!("Failed to write TOTP file: {e}"))
}

/// The active secret: legacy in-file value if migration is pending, else the keychain.
fn active_secret(data: &SavedTotpData, store: &dyn SecretStore) -> Option<String> {
    if !data.secret.is_empty() {
        return Some(data.secret.clone());
    }
    match store.get() {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[ShellFerry] {e}");
            None
        }
    }
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
        "otpauth://totp/ShellFerry:client?secret={}&issuer=ShellFerry&algorithm=SHA1&digits=6&period=30",
        secret
    );

    TotpSetupInfo { secret, uri }
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

/// 8 emergency backup codes: (plaintext for the user, hashes for disk).
fn new_backup_codes() -> (Vec<String>, Vec<String>) {
    let mut rng = rand::thread_rng();
    (0..8)
        .map(|_| {
            let mut bytes = [0u8; 5];
            rng.fill_bytes(&mut bytes);
            let code = base32_encode(&bytes);
            let formatted = format!("{}-{}", &code[0..4], &code[4..8]);
            (formatted.clone(), hash_code(&formatted))
        })
        .unzip()
}

// Public API: real file + OS keychain.

pub fn get_config() -> TotpConfig {
    get_config_in(&totp_file_path().unwrap_or_default(), &KeyringStore)
}

pub fn update_idle_timeout(mins: u32) -> Result<(), String> {
    update_idle_timeout_in(&totp_file_path()?, &KeyringStore, mins)
}

pub fn enable_totp(secret: &str, initial_code: &str) -> Result<Vec<String>, String> {
    enable_totp_in(&totp_file_path()?, &KeyringStore, secret, initial_code, now_secs())
}

pub fn generate_emergency_recovery_codes() -> Result<Vec<String>, String> {
    let path = totp_file_path()?;
    let mut data = load(&path, &KeyringStore);
    let (codes, hashes) = new_backup_codes();
    data.backup_code_hashes = hashes;
    save(&path, &data)?;
    Ok(codes)
}

pub fn disable_totp(code_or_backup: &str) -> Result<(), String> {
    disable_totp_in(&totp_file_path()?, &KeyringStore, code_or_backup, now_secs())
}

pub fn validate_login_code(code_or_backup: &str) -> Result<bool, String> {
    validate_login_code_in(&totp_file_path()?, &KeyringStore, code_or_backup, now_secs())
}

// Testable cores.

fn get_config_in(path: &Path, store: &dyn SecretStore) -> TotpConfig {
    let data = load(path, store);
    TotpConfig {
        enabled: data.enabled,
        idle_timeout_mins: data.idle_timeout_mins,
        has_backup_codes: !data.backup_code_hashes.is_empty(),
    }
}

fn update_idle_timeout_in(path: &Path, store: &dyn SecretStore, mins: u32) -> Result<(), String> {
    let mut data = load(path, store);
    data.idle_timeout_mins = mins;
    save(path, &data)
}

fn enable_totp_in(
    path: &Path,
    store: &dyn SecretStore,
    secret: &str,
    initial_code: &str,
    now: u64,
) -> Result<Vec<String>, String> {
    if !verify_totp_code(secret, initial_code, now) {
        return Err("Invalid TOTP verification code. Ensure your device clock is accurate.".to_string());
    }

    // Keychain first: if it is unavailable, 2FA stays off rather than falling back to plaintext.
    store.set(secret)?;

    let (codes, hashes) = new_backup_codes();
    let mut data = load(path, store);
    data.enabled = true;
    data.secret.clear();
    data.backup_code_hashes = hashes;
    save(path, &data)?;
    Ok(codes)
}

fn disable_totp_in(
    path: &Path,
    store: &dyn SecretStore,
    code_or_backup: &str,
    now: u64,
) -> Result<(), String> {
    let mut data = load(path, store);
    if !data.enabled {
        return Ok(());
    }

    let is_totp_valid = active_secret(&data, store)
        .is_some_and(|s| verify_totp_code(&s, code_or_backup, now));
    let is_backup_valid = data.backup_code_hashes.contains(&hash_code(code_or_backup));

    if !is_totp_valid && !is_backup_valid {
        return Err("Invalid TOTP code or backup code. Cannot disable 2FA.".to_string());
    }

    data.enabled = false;
    data.secret.clear();
    data.backup_code_hashes = vec![];
    save(path, &data)?;
    if let Err(e) = store.delete() {
        eprintln!("[ShellFerry] {e}");
    }
    Ok(())
}

fn validate_login_code_in(
    path: &Path,
    store: &dyn SecretStore,
    code_or_backup: &str,
    now: u64,
) -> Result<bool, String> {
    let mut data = load(path, store);
    if !data.enabled && data.backup_code_hashes.is_empty() {
        return Ok(true);
    }

    if data.enabled
        && active_secret(&data, store).is_some_and(|s| verify_totp_code(&s, code_or_backup, now))
    {
        return Ok(true);
    }

    // Backup codes are single-use.
    let hashed = hash_code(code_or_backup);
    if let Some(pos) = data.backup_code_hashes.iter().position(|h| h == &hashed) {
        data.backup_code_hashes.remove(pos);
        let _ = save(path, &data);
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

    use std::cell::RefCell;

    #[derive(Default)]
    struct MemStore {
        secret: RefCell<Option<String>>,
        fail: bool,
    }

    impl SecretStore for MemStore {
        fn get(&self) -> Result<Option<String>, String> {
            Ok(self.secret.borrow().clone())
        }
        fn set(&self, s: &str) -> Result<(), String> {
            if self.fail {
                return Err("keychain down".into());
            }
            *self.secret.borrow_mut() = Some(s.to_string());
            Ok(())
        }
        fn delete(&self) -> Result<(), String> {
            *self.secret.borrow_mut() = None;
            Ok(())
        }
    }

    const SECRET: &str = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    const NOW: u64 = 1111111109; // code 081804
    const CODE: &str = "081804";

    fn tmp_file(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("shellferry-totp-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d.join("totp.json")
    }

    fn legacy_file(path: &Path) {
        fs::write(
            path,
            format!(r#"{{"enabled":true,"secret":"{SECRET}","backup_code_hashes":[],"idle_timeout_mins":15}}"#),
        )
        .unwrap();
    }

    #[test]
    fn enable_stores_secret_in_keychain_not_on_disk() {
        let path = tmp_file("enable");
        let store = MemStore::default();
        let codes = enable_totp_in(&path, &store, SECRET, CODE, NOW).unwrap();

        assert_eq!(codes.len(), 8);
        assert_eq!(store.get().unwrap().as_deref(), Some(SECRET));
        let disk = fs::read_to_string(&path).unwrap();
        assert!(!disk.contains(SECRET));
        assert!(!disk.contains("\"secret\""));
        assert!(validate_login_code_in(&path, &store, CODE, NOW).unwrap());
        assert!(!validate_login_code_in(&path, &store, "000000", NOW).unwrap());
    }

    #[test]
    fn enable_fails_without_keychain_and_writes_nothing() {
        let path = tmp_file("nokeychain");
        let store = MemStore { fail: true, ..Default::default() };
        assert!(enable_totp_in(&path, &store, SECRET, CODE, NOW).is_err());
        assert!(!path.exists());
    }

    #[test]
    fn legacy_secret_migrates_to_keychain() {
        let path = tmp_file("migrate");
        legacy_file(&path);
        let store = MemStore::default();

        assert!(get_config_in(&path, &store).enabled);
        assert_eq!(store.get().unwrap().as_deref(), Some(SECRET));
        assert!(!fs::read_to_string(&path).unwrap().contains(SECRET));
        assert!(validate_login_code_in(&path, &store, CODE, NOW).unwrap());
    }

    #[test]
    fn legacy_secret_kept_when_keychain_fails() {
        let path = tmp_file("migrate-fail");
        legacy_file(&path);
        let store = MemStore { fail: true, ..Default::default() };

        // Login still works from the in-file secret; nothing is lost.
        assert!(validate_login_code_in(&path, &store, CODE, NOW).unwrap());
        assert!(fs::read_to_string(&path).unwrap().contains(SECRET));
    }

    #[test]
    fn disable_removes_keychain_entry() {
        let path = tmp_file("disable");
        let store = MemStore::default();
        enable_totp_in(&path, &store, SECRET, CODE, NOW).unwrap();

        assert!(disable_totp_in(&path, &store, "000000", NOW).is_err());
        disable_totp_in(&path, &store, CODE, NOW).unwrap();
        assert!(store.get().unwrap().is_none());
        assert!(!get_config_in(&path, &store).enabled);
    }

    #[test]
    fn backup_code_works_when_keychain_secret_missing() {
        let path = tmp_file("backup");
        let store = MemStore::default();
        let codes = enable_totp_in(&path, &store, SECRET, CODE, NOW).unwrap();
        store.delete().unwrap();

        assert!(!validate_login_code_in(&path, &store, CODE, NOW).unwrap());
        assert!(validate_login_code_in(&path, &store, &codes[0], NOW).unwrap());
        assert!(!validate_login_code_in(&path, &store, &codes[0], NOW).unwrap(), "single use");
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
