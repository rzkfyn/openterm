use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use hmac::{Hmac, Mac};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use parking_lot::Mutex;

use crate::storage::SavedConnection;

type HmacSha256 = Hmac<Sha256>;

const PBKDF2_ROUNDS: u32 = 100_000;
const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 12;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultStatus {
    pub is_encrypted: bool,
    pub is_unlocked: bool,
}

#[derive(Serialize, Deserialize)]
pub struct EncryptedVaultPayload {
    pub version: u32,
    pub salt_hex: String,
    pub nonce_hex: String,
    pub ciphertext_hex: String,
}

#[derive(Default, Clone)]
pub struct VaultState {
    master_key: Arc<Mutex<Option<[u8; 32]>>>,
}

impl VaultState {
    pub fn new() -> Self {
        Self {
            master_key: Arc::new(Mutex::new(None)),
        }
    }

    pub fn set_key(&self, key: [u8; 32]) {
        *self.master_key.lock() = Some(key);
    }

    pub fn clear_key(&self) {
        *self.master_key.lock() = None;
    }

    pub fn get_key(&self) -> Option<[u8; 32]> {
        *self.master_key.lock()
    }

    pub fn is_unlocked(&self) -> bool {
        self.master_key.lock().is_some()
    }
}

fn vault_dir() -> Result<PathBuf, String> {
    let dir = dirs::config_dir()
        .ok_or("Cannot resolve config directory")?
        .join("com.openterm.app");
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create config dir: {e}"))?;
    Ok(dir)
}

fn vault_enc_path() -> Result<PathBuf, String> {
    Ok(vault_dir()?.join("vault.enc"))
}

fn legacy_connections_path() -> Result<PathBuf, String> {
    Ok(vault_dir()?.join("connections.json"))
}

/// RFC 2898 PBKDF2-HMAC-SHA256 key derivation
pub fn derive_key(password: &str, salt: &[u8], rounds: u32) -> [u8; 32] {
    let mut out = [0u8; 32];
    let mut block = [0u8; 4];
    block[3] = 1; // Block 1 (32 bytes = 1 block for SHA-256)

    let mut mac = <HmacSha256 as Mac>::new_from_slice(password.as_bytes()).expect("HMAC can take key of any size");
    mac.update(salt);
    mac.update(&block);
    let mut u = mac.finalize().into_bytes();
    out.copy_from_slice(&u);

    for _ in 1..rounds {
        let mut mac_iter = <HmacSha256 as Mac>::new_from_slice(password.as_bytes()).expect("HMAC can take key of any size");
        mac_iter.update(&u);
        u = mac_iter.finalize().into_bytes();
        for (o, byte) in out.iter_mut().zip(u.iter()) {
            *o ^= byte;
        }
    }

    out
}

pub fn encrypt_vault(data: &[u8], key: &[u8; 32]) -> Result<EncryptedVaultPayload, String> {
    let mut rng = rand::thread_rng();
    let mut salt = [0u8; SALT_LEN];
    rng.fill_bytes(&mut salt);

    let mut nonce_bytes = [0u8; NONCE_LEN];
    rng.fill_bytes(&mut nonce_bytes);

    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| format!("Cipher init error: {e}"))?;
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, data)
        .map_err(|e| format!("Encryption failed: {e}"))?;

    Ok(EncryptedVaultPayload {
        version: 1,
        salt_hex: hex_encode(&salt),
        nonce_hex: hex_encode(&nonce_bytes),
        ciphertext_hex: hex_encode(&ciphertext),
    })
}

pub fn decrypt_vault(payload: &EncryptedVaultPayload, key: &[u8; 32]) -> Result<Vec<u8>, String> {
    let nonce_bytes = hex_decode(&payload.nonce_hex).map_err(|e| format!("Nonce decode error: {e}"))?;
    let ciphertext = hex_decode(&payload.ciphertext_hex).map_err(|e| format!("Ciphertext decode error: {e}"))?;

    if nonce_bytes.len() != NONCE_LEN {
        return Err("Invalid nonce length in vault".into());
    }

    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| format!("Cipher init error: {e}"))?;
    let nonce = Nonce::from_slice(&nonce_bytes);

    cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|_| "Decryption failed: Incorrect master password or corrupted vault".to_string())
}

pub fn get_status(state: &VaultState) -> Result<VaultStatus, String> {
    let enc_path = vault_enc_path()?;
    let is_encrypted = enc_path.exists();
    let is_unlocked = if is_encrypted {
        state.is_unlocked()
    } else {
        true
    };

    Ok(VaultStatus {
        is_encrypted,
        is_unlocked,
    })
}

pub fn unlock_vault(state: &VaultState, password: &str) -> Result<Vec<SavedConnection>, String> {
    let enc_path = vault_enc_path()?;
    if !enc_path.exists() {
        return Err("Vault is not encrypted".to_string());
    }

    let payload_str = fs::read_to_string(&enc_path).map_err(|e| format!("Read vault failed: {e}"))?;
    let payload: EncryptedVaultPayload = serde_json::from_str(&payload_str)
        .map_err(|e| format!("Parse vault metadata failed: {e}"))?;

    let salt = hex_decode(&payload.salt_hex).map_err(|e| format!("Salt decode error: {e}"))?;
    let key = derive_key(password, &salt, PBKDF2_ROUNDS);

    let decrypted_bytes = decrypt_vault(&payload, &key)?;
    let connections: Vec<SavedConnection> = serde_json::from_slice(&decrypted_bytes)
        .map_err(|e| format!("Parse decrypted profiles failed: {e}"))?;

    state.set_key(key);
    Ok(connections)
}

pub fn lock_vault(state: &VaultState) -> Result<(), String> {
    state.clear_key();
    Ok(())
}

pub fn set_master_password(
    state: &VaultState,
    old_password: Option<&str>,
    new_password: &str,
) -> Result<(), String> {
    if new_password.trim().len() < 6 {
        return Err("Master password must be at least 6 characters".to_string());
    }

    let enc_path = vault_enc_path()?;
    let current_connections = if enc_path.exists() {
        let old_pwd = old_password.ok_or_else(|| "Current master password required to change password".to_string())?;
        unlock_vault(state, old_pwd)?
    } else {
        // Read unencrypted legacy connections if present
        let leg_path = legacy_connections_path()?;
        if leg_path.exists() {
            let data = fs::read_to_string(&leg_path).map_err(|e| format!("Read legacy profiles failed: {e}"))?;
            serde_json::from_str(&data).unwrap_or_default()
        } else {
            vec![]
        }
    };

    let mut rng = rand::thread_rng();
    let mut salt = [0u8; SALT_LEN];
    rng.fill_bytes(&mut salt);

    let new_key = derive_key(new_password, &salt, PBKDF2_ROUNDS);
    let serialized = serde_json::to_vec_pretty(&current_connections)
        .map_err(|e| format!("Serialize profiles failed: {e}"))?;

    let mut nonce_bytes = [0u8; NONCE_LEN];
    rng.fill_bytes(&mut nonce_bytes);

    let cipher = Aes256Gcm::new_from_slice(&new_key).map_err(|e| format!("Cipher init error: {e}"))?;
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher.encrypt(nonce, serialized.as_ref())
        .map_err(|e| format!("Encrypt error: {e}"))?;

    let payload = EncryptedVaultPayload {
        version: 1,
        salt_hex: hex_encode(&salt),
        nonce_hex: hex_encode(&nonce_bytes),
        ciphertext_hex: hex_encode(&ciphertext),
    };

    let payload_json = serde_json::to_string_pretty(&payload)
        .map_err(|e| format!("Serialize vault failed: {e}"))?;

    fs::write(&enc_path, payload_json).map_err(|e| format!("Write vault.enc failed: {e}"))?;

    // Delete unencrypted legacy connections.json to ensure no plain profiles remain on disk
    let leg_path = legacy_connections_path()?;
    if leg_path.exists() {
        let _ = fs::remove_file(leg_path);
    }

    state.set_key(new_key);
    Ok(())
}

pub fn remove_master_password(state: &VaultState, current_password: &str) -> Result<(), String> {
    let enc_path = vault_enc_path()?;
    if !enc_path.exists() {
        return Ok(());
    }

    let connections = unlock_vault(state, current_password)?;
    let leg_path = legacy_connections_path()?;
    let data = serde_json::to_string_pretty(&connections)
        .map_err(|e| format!("Serialize failed: {e}"))?;
    fs::write(&leg_path, data).map_err(|e| format!("Write legacy file failed: {e}"))?;

    fs::remove_file(&enc_path).map_err(|e| format!("Failed to remove vault.enc: {e}"))?;
    state.clear_key();
    Ok(())
}

pub fn list_vault_connections(state: &VaultState) -> Result<Vec<SavedConnection>, String> {
    let enc_path = vault_enc_path()?;
    if !enc_path.exists() {
        let leg_path = legacy_connections_path()?;
        if !leg_path.exists() {
            return Ok(vec![]);
        }
        let data = fs::read_to_string(&leg_path).map_err(|e| format!("Read failed: {e}"))?;
        return serde_json::from_str(&data).map_err(|e| format!("Parse failed: {e}"));
    }

    let key = state.get_key().ok_or_else(|| "Vault is locked. Master password required.".to_string())?;
    let payload_str = fs::read_to_string(&enc_path).map_err(|e| format!("Read vault failed: {e}"))?;
    let payload: EncryptedVaultPayload = serde_json::from_str(&payload_str)
        .map_err(|e| format!("Parse vault failed: {e}"))?;

    let decrypted = decrypt_vault(&payload, &key)?;
    serde_json::from_slice(&decrypted).map_err(|e| format!("Parse decrypted profiles failed: {e}"))
}

pub fn save_vault_connection(state: &VaultState, mut conn: SavedConnection) -> Result<SavedConnection, String> {
    let mut all = list_vault_connections(state)?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    if let Some(existing) = all.iter_mut().find(|c| c.id == conn.id) {
        conn.updated_at = now;
        conn.created_at = existing.created_at;
        *existing = conn.clone();
    } else {
        conn.created_at = now;
        conn.updated_at = now;
        all.push(conn.clone());
    }

    write_vault_connections(state, &all)?;
    Ok(conn)
}

pub fn delete_vault_connection(state: &VaultState, id: &str) -> Result<(), String> {
    let mut all = list_vault_connections(state)?;
    let before = all.len();
    all.retain(|c| c.id != id);
    if all.len() == before {
        return Err(format!("Connection {id} not found"));
    }
    write_vault_connections(state, &all)
}

fn write_vault_connections(state: &VaultState, connections: &[SavedConnection]) -> Result<(), String> {
    let enc_path = vault_enc_path()?;
    if !enc_path.exists() {
        let leg_path = legacy_connections_path()?;
        let data = serde_json::to_string_pretty(connections)
            .map_err(|e| format!("Serialize failed: {e}"))?;
        fs::write(&leg_path, data).map_err(|e| format!("Write failed: {e}"))?;
        return Ok(());
    }

    let key = state.get_key().ok_or_else(|| "Vault is locked. Master password required.".to_string())?;
    let serialized = serde_json::to_vec_pretty(connections)
        .map_err(|e| format!("Serialize failed: {e}"))?;

    let payload_str = fs::read_to_string(&enc_path).map_err(|e| format!("Read vault failed: {e}"))?;
    let existing_payload: EncryptedVaultPayload = serde_json::from_str(&payload_str)
        .map_err(|e| format!("Parse vault metadata failed: {e}"))?;

    let mut rng = rand::thread_rng();
    let mut nonce_bytes = [0u8; NONCE_LEN];
    rng.fill_bytes(&mut nonce_bytes);

    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| format!("Cipher init error: {e}"))?;
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher.encrypt(nonce, serialized.as_ref())
        .map_err(|e| format!("Encrypt error: {e}"))?;

    let payload = EncryptedVaultPayload {
        version: 1,
        salt_hex: existing_payload.salt_hex,
        nonce_hex: hex_encode(&nonce_bytes),
        ciphertext_hex: hex_encode(&ciphertext),
    };

    let payload_json = serde_json::to_string_pretty(&payload)
        .map_err(|e| format!("Serialize vault failed: {e}"))?;

    fs::write(&enc_path, payload_json).map_err(|e| format!("Write vault.enc failed: {e}"))
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

fn hex_decode(s: &str) -> Result<Vec<u8>, String> {
    if s.len() % 2 != 0 {
        return Err("Hex string has odd length".to_string());
    }
    (0..s.len())
        .step_by(2)
        .map(|i| {
            u8::from_str_radix(&s[i..i + 2], 16)
                .map_err(|e| format!("Hex parse error: {e}"))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pbkdf2_derivation_deterministic() {
        let key1 = derive_key("password123", b"test_salt_123456", 1000);
        let key2 = derive_key("password123", b"test_salt_123456", 1000);
        assert_eq!(key1, key2);

        let key3 = derive_key("different_pwd", b"test_salt_123456", 1000);
        assert_ne!(key1, key3);
    }

    #[test]
    fn test_vault_encrypt_decrypt_roundtrip() {
        let key = derive_key("my_master_password", b"test_salt_123456", 1000);
        let original_data = b"{\"message\":\"super secret ssh profiles\"}";

        let encrypted = encrypt_vault(original_data, &key).expect("Encryption failed");
        let decrypted = decrypt_vault(&encrypted, &key).expect("Decryption failed");

        assert_eq!(original_data.to_vec(), decrypted);
    }

    #[test]
    fn test_vault_decrypt_wrong_password_fails() {
        let key = derive_key("correct_pwd", b"test_salt_123456", 1000);
        let wrong_key = derive_key("wrong_pwd", b"test_salt_123456", 1000);
        let original_data = b"secret data";

        let encrypted = encrypt_vault(original_data, &key).unwrap();
        let result = decrypt_vault(&encrypted, &wrong_key);

        assert!(result.is_err());
    }

    #[test]
    fn test_hex_encode_decode() {
        let data = b"Hello, World!";
        let encoded = hex_encode(data);
        let decoded = hex_decode(&encoded).unwrap();
        assert_eq!(data.to_vec(), decoded);
    }
}
