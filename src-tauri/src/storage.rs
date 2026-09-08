use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionBookmark {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub local_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remote_path: Option<String>,
}

/// Saved connection profile — no password/passphrase stored.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedConnection {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_type: crate::models::AuthType,
    pub private_key_path: Option<String>,
    pub password: Option<String>,
    pub passphrase: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub folder: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub bookmarks: Vec<ConnectionBookmark>,
    pub created_at: u64,
    pub updated_at: u64,
}

fn connections_path() -> Result<PathBuf, String> {
    let dir = dirs::config_dir()
        .ok_or("Cannot resolve config directory")?
        .join("com.openterm.app");
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create config dir: {e}"))?;
    Ok(dir.join("connections.json"))
}

fn read_all() -> Result<Vec<SavedConnection>, String> {
    let path = connections_path()?;
    if !path.exists() {
        return Ok(vec![]);
    }
    let data = fs::read_to_string(&path).map_err(|e| format!("Read failed: {e}"))?;
    serde_json::from_str(&data).map_err(|e| format!("Parse failed: {e}"))
}

fn write_all(connections: &[SavedConnection]) -> Result<(), String> {
    let path = connections_path()?;
    let data = serde_json::to_string_pretty(connections)
        .map_err(|e| format!("Serialize failed: {e}"))?;
    fs::write(&path, data).map_err(|e| format!("Write failed: {e}"))?;

    // ponytail: unix-only 600 permission; upgrade to OS keychain for secrets
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o600));
    }

    Ok(())
}

fn now_millis() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

pub fn list() -> Result<Vec<SavedConnection>, String> {
    read_all()
}

pub fn save(mut conn: SavedConnection) -> Result<SavedConnection, String> {
    let mut all = read_all()?;
    let now = now_millis();

    if let Some(existing) = all.iter_mut().find(|c| c.id == conn.id) {
        conn.updated_at = now;
        conn.created_at = existing.created_at;
        *existing = conn.clone();
    } else {
        conn.created_at = now;
        conn.updated_at = now;
        all.push(conn.clone());
    }

    write_all(&all)?;
    Ok(conn)
}

pub fn delete(id: &str) -> Result<(), String> {
    let mut all = read_all()?;
    let before = all.len();
    all.retain(|c| c.id != id);
    if all.len() == before {
        return Err(format!("Connection {id} not found"));
    }
    write_all(&all)
}
