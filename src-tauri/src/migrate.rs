//! One-time migration out of the legacy `com.openterm.app` data dirs.
//!
//! The legacy dirs are shared with an unrelated app that uses the same identifier, so only files
//! we own are touched, and every step is non-destructive until its copy is verified.

use std::fs;
use std::io;
use std::path::Path;

use crate::paths::{IDENTIFIER, LEGACY_IDENTIFIER};

const OWN_FILES: &[&str] = &["vault.enc", "connections.json", "totp.json"];

/// Run all migrations. Errors are logged, never fatal: worst case the user starts fresh while the
/// legacy files stay where they were.
pub fn run() {
    if let Some(base) = dirs::config_dir() {
        for (name, result) in move_own_files(&base.join(LEGACY_IDENTIFIER), &base.join(IDENTIFIER)) {
            if let Err(e) = result {
                eprintln!("[ShellFerry] migrate {name} failed, legacy copy kept: {e}");
            }
        }
    }

    // WebView2 profile lives in %LOCALAPPDATA%\<identifier>\EBWebView on Windows.
    #[cfg(target_os = "windows")]
    if let Some(base) = dirs::data_local_dir() {
        let rel = Path::new("EBWebView").join("Default").join("Local Storage");
        if let Err(e) = copy_dir_if_absent(&base.join(LEGACY_IDENTIFIER).join(&rel), &base.join(IDENTIFIER).join(&rel)) {
            eprintln!("[ShellFerry] migrate UI preferences failed: {e}");
        }
    }
}

/// Move each of OWN_FILES from `old` to `new` unless `new` already has it.
pub fn move_own_files(old: &Path, new: &Path) -> Vec<(&'static str, io::Result<()>)> {
    if !old.is_dir() {
        return vec![];
    }
    OWN_FILES
        .iter()
        .filter(|name| old.join(name).is_file() && !new.join(name).exists())
        .map(|name| (*name, move_file(&old.join(name), &new.join(name))))
        .collect()
}

fn move_file(src: &Path, dst: &Path) -> io::Result<()> {
    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent)?;
    }
    if fs::rename(src, dst).is_ok() {
        return Ok(());
    }
    // Cross-volume or locked: copy, verify, then remove the original.
    fs::copy(src, dst)?;
    if fs::read(src)? != fs::read(dst)? {
        let _ = fs::remove_file(dst);
        return Err(io::Error::new(io::ErrorKind::InvalidData, "copy verification failed"));
    }
    fs::remove_file(src)
}

/// Recursively copy `src` to `dst` if `dst` does not exist. A partial copy is removed so the
/// consumer never sees a half-written directory. LevelDB `LOCK` files are skipped: they may be
/// held open by a running process and are recreated on open.
pub fn copy_dir_if_absent(src: &Path, dst: &Path) -> io::Result<()> {
    if !src.is_dir() || dst.exists() {
        return Ok(());
    }
    copy_dir(src, dst).inspect_err(|_| {
        let _ = fs::remove_dir_all(dst);
    })
}

fn copy_dir(src: &Path, dst: &Path) -> io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let to = dst.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir(&entry.path(), &to)?;
        } else if entry.file_name() != "LOCK" {
            fs::copy(entry.path(), to)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp(name: &str) -> std::path::PathBuf {
        let d = std::env::temp_dir().join(format!("shellferry-migrate-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn moves_only_own_files() {
        let root = tmp("own");
        let (old, new) = (root.join("old"), root.join("new"));
        fs::create_dir_all(&old).unwrap();
        fs::write(old.join("vault.enc"), b"vault").unwrap();
        fs::write(old.join("totp.json"), b"{}").unwrap();
        fs::write(old.join("state.json"), b"theirs").unwrap();

        let results = move_own_files(&old, &new);
        assert_eq!(results.len(), 2);
        assert!(results.iter().all(|(_, r)| r.is_ok()));

        assert_eq!(fs::read(new.join("vault.enc")).unwrap(), b"vault");
        assert!(new.join("totp.json").exists());
        assert!(!old.join("vault.enc").exists());
        assert!(!old.join("totp.json").exists());
        assert!(old.join("state.json").exists(), "foreign files must stay");
        assert!(!new.join("state.json").exists());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn never_overwrites_existing_destination() {
        let root = tmp("exists");
        let (old, new) = (root.join("old"), root.join("new"));
        fs::create_dir_all(&old).unwrap();
        fs::create_dir_all(&new).unwrap();
        fs::write(old.join("vault.enc"), b"old").unwrap();
        fs::write(new.join("vault.enc"), b"new").unwrap();

        assert!(move_own_files(&old, &new).is_empty());
        assert_eq!(fs::read(new.join("vault.enc")).unwrap(), b"new");
        assert_eq!(fs::read(old.join("vault.enc")).unwrap(), b"old");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn missing_legacy_dir_is_noop() {
        let root = tmp("missing");
        assert!(move_own_files(&root.join("nope"), &root.join("new")).is_empty());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn copies_dir_tree_skipping_lock_and_keeps_source() {
        let root = tmp("dir");
        let src = root.join("src");
        fs::create_dir_all(src.join("leveldb")).unwrap();
        fs::write(src.join("leveldb").join("000003.log"), b"data").unwrap();
        fs::write(src.join("leveldb").join("LOCK"), b"").unwrap();

        let dst = root.join("dst");
        copy_dir_if_absent(&src, &dst).unwrap();
        assert_eq!(fs::read(dst.join("leveldb").join("000003.log")).unwrap(), b"data");
        assert!(!dst.join("leveldb").join("LOCK").exists());
        assert!(src.join("leveldb").join("000003.log").exists());

        // Second run must not touch an existing destination.
        fs::write(dst.join("leveldb").join("000003.log"), b"changed").unwrap();
        copy_dir_if_absent(&src, &dst).unwrap();
        assert_eq!(fs::read(dst.join("leveldb").join("000003.log")).unwrap(), b"changed");
        let _ = fs::remove_dir_all(root);
    }
}
