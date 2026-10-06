use std::fs;
use std::path::PathBuf;

/// Must match `identifier` in tauri.conf.json (enforced by test).
pub const IDENTIFIER: &str = "io.github.rzkfyn.shellferry";

/// Identifier used before the ShellFerry rename. Shared with an unrelated app, so only our own
/// files are migrated out of it.
pub const LEGACY_IDENTIFIER: &str = "com.openterm.app";

/// Per-user config dir for app data (`%APPDATA%\<id>` on Windows).
pub fn config_dir() -> Result<PathBuf, String> {
    let dir = dirs::config_dir()
        .ok_or("Cannot resolve config directory")?
        .join(IDENTIFIER);
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create config dir: {e}"))?;
    Ok(dir)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identifier_matches_tauri_conf() {
        let conf: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        assert_eq!(conf["identifier"], IDENTIFIER);
    }
}
