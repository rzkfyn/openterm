use std::fs;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::PathBuf;
use std::time::UNIX_EPOCH;

use crate::models::{FileEntry, FileStatInfo, PaginatedEntries};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PathAccessMode {
    ReadDir,
    Read,
    Write,
}

/// Validate that a path is safe to access, preventing path traversal,
/// credential theft (.ssh, .gnupg, private keys), and system tampering.
pub fn validate_local_path(path_str: &str, mode: PathAccessMode) -> Result<PathBuf, String> {
    if path_str.contains('\0') {
        return Err("Invalid path: contains null byte".to_string());
    }

    let raw_clean = path_str.trim_start_matches(r"\\?\");
    let target_path = if raw_clean.is_empty() || raw_clean == "~" {
        dirs::home_dir().unwrap_or_else(|| PathBuf::from("/"))
    } else if raw_clean == "~/" || raw_clean.starts_with("~/") || raw_clean.starts_with(r"~\") {
        let sub = &raw_clean[2..];
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("/"))
            .join(sub)
    } else {
        PathBuf::from(raw_clean)
    };

    #[allow(unused_mut)]
    let mut canonical = if target_path.exists() {
        target_path
            .canonicalize()
            .map_err(|e| format!("Failed to read path '{}': {}", path_str, e))?
    } else {
        if mode == PathAccessMode::ReadDir {
            return Err(format!("Directory does not exist: {}", path_str));
        }
        let mut ancestor = target_path.clone();
        let mut tail_components = Vec::new();
        while !ancestor.exists() {
            if let Some(name) = ancestor.file_name() {
                tail_components.push(name.to_os_string());
            } else {
                break;
            }
            if !ancestor.pop() {
                break;
            }
        }
        if !ancestor.exists() {
            return Err(format!("Cannot resolve path '{}': parent does not exist", path_str));
        }
        let mut resolved = ancestor
            .canonicalize()
            .map_err(|e| format!("Failed to resolve ancestor path: {}", e))?;
        tail_components.reverse();
        for comp in tail_components {
            let s = comp.to_string_lossy();
            if s == "." || s == ".." {
                return Err("Path contains invalid traversal components".to_string());
            }
            resolved.push(comp);
        }
        resolved
    };

    // Strip Windows verbatim prefix (\\?\) to avoid invalid path errors downstream
    #[cfg(windows)]
    {
        let canonical_str = canonical.to_string_lossy();
        if let Some(stripped) = canonical_str.strip_prefix(r"\\?\") {
            canonical = PathBuf::from(stripped);
        }
    }

    let path_normalized = canonical.to_string_lossy().to_lowercase().replace('\\', "/");

    // 1. Block access to credential directories
    let in_credential_dir = canonical.components().any(|c| {
        let name = c.as_os_str().to_string_lossy().to_lowercase();
        matches!(
            name.as_str(),
            ".ssh" | ".gnupg" | ".aws" | ".azure" | ".kube" | ".docker"
        )
    });
    if in_credential_dir {
        return Err("Access to credentials directory is denied".to_string());
    }

    // 2. Block reading/uploading private SSH keys
    if let Some(file_name) = canonical.file_name().and_then(|f| f.to_str()) {
        let name_lower = file_name.to_lowercase();
        if mode == PathAccessMode::Read || mode == PathAccessMode::ReadDir {
            if name_lower.starts_with("id_rsa")
                || name_lower.starts_with("id_ed25519")
                || name_lower.starts_with("id_ecdsa")
                || name_lower.starts_with("id_dsa")
            {
                return Err("Access to private SSH key file is denied".to_string());
            }
        }
    }

    // 3. Block writing to shell configuration files
    if mode == PathAccessMode::Write {
        if let Some(file_name) = canonical.file_name().and_then(|f| f.to_str()) {
            let name_lower = file_name.to_lowercase();
            const SHELL_CONFIGS: &[&str] = &[
                ".bashrc", ".bash_profile", ".bash_login", ".bash_logout",
                ".zshrc", ".zprofile", ".zshenv", ".zlogin", ".zlogout",
                ".profile", ".cshrc", ".tcshrc", ".kshrc",
            ];
            if SHELL_CONFIGS.contains(&name_lower.as_str()) {
                return Err("Modification of shell configuration file is denied".to_string());
            }
        }
    }

    // 4. Platform specific system directories
    #[cfg(windows)]
    {
        if path_normalized.contains("/start menu/programs/startup") {
            return Err("Access to Windows Startup directory is denied".to_string());
        }

        let win_dir = std::env::var("SystemRoot")
            .unwrap_or_else(|_| "C:\\Windows".to_string())
            .to_lowercase()
            .replace('\\', "/");

        if path_normalized == win_dir || path_normalized.starts_with(&format!("{}/", win_dir)) {
            if mode == PathAccessMode::Write
                || path_normalized.contains("/system32")
                || path_normalized.contains("/syswow64")
            {
                return Err("Access to Windows system directory is denied".to_string());
            }
        }
    }

    #[cfg(not(windows))]
    {
        const SENSITIVE_UNIX_PATHS: &[&str] = &[
            "/etc", "/boot", "/sys", "/proc", "/dev", "/sbin", "/usr/sbin", "/root"
        ];
        for prefix in SENSITIVE_UNIX_PATHS {
            if path_normalized == *prefix || path_normalized.starts_with(&format!("{}/", prefix)) {
                if mode == PathAccessMode::Write
                    || *prefix == "/root"
                    || *prefix == "/proc"
                    || *prefix == "/sys"
                    || *prefix == "/dev"
                    || path_normalized.starts_with("/etc/shadow")
                    || path_normalized.starts_with("/etc/sudoers")
                {
                    return Err("Access to system directory is denied".to_string());
                }
            }
        }
    }

    Ok(canonical)
}

pub fn read_local_dir(
    path_str: &str,
    offset: usize,
    limit: usize,
) -> Result<PaginatedEntries, String> {
    let canonical = validate_local_path(path_str, PathAccessMode::ReadDir)?;

    let read_dir = fs::read_dir(&canonical)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    let mut entries: Vec<FileEntry> = Vec::new();

    for entry_res in read_dir {
        if let Ok(entry) = entry_res {
            let file_name = entry.file_name().to_string_lossy().to_string();
            let file_name_lower = file_name.to_lowercase();

            // Filter out sensitive credential directories and keys from listing
            if matches!(
                file_name_lower.as_str(),
                ".ssh" | ".gnupg" | ".aws" | ".azure" | ".kube" | ".docker"
            ) || file_name_lower.starts_with("id_rsa")
                || file_name_lower.starts_with("id_ed25519")
                || file_name_lower.starts_with("id_ecdsa")
                || file_name_lower.starts_with("id_dsa")
            {
                continue;
            }

            let file_path = entry.path().to_string_lossy().to_string();
            let meta = entry.metadata().ok();

            let (is_dir, is_symlink, size, modified, permissions) = if let Some(m) = meta {
                let is_symlink = entry.file_type().map(|ft| ft.is_symlink()).unwrap_or(false);
                let modified = m
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                    .map(|d| d.as_secs());
                #[cfg(unix)]
                let permissions = Some(m.permissions().mode());
                #[cfg(not(unix))]
                let permissions = None;
                (m.is_dir(), is_symlink, m.len(), modified, permissions)
            } else {
                (false, false, 0, None, None)
            };

            entries.push(FileEntry {
                name: file_name,
                path: file_path,
                size,
                is_dir,
                is_symlink,
                modified,
                permissions,
            });
        }
    }

    // Sort: directories first, then alphabetically case-insensitive
    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    let total = entries.len();
    let paged: Vec<FileEntry> = entries
        .into_iter()
        .skip(offset)
        .take(limit)
        .collect();

    let has_more = offset + paged.len() < total;

    Ok(PaginatedEntries {
        path: canonical.to_string_lossy().to_string(),
        entries: paged,
        total,
        offset,
        limit,
        has_more,
    })
}

pub fn stat_local_path(path_str: &str) -> FileStatInfo {
    let Ok(p) = validate_local_path(path_str, PathAccessMode::Read) else {
        return FileStatInfo {
            exists: false,
            size: 0,
            modified: None,
            is_dir: false,
        };
    };
    if let Ok(meta) = fs::metadata(&p) {
        let modified = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs());
        FileStatInfo {
            exists: true,
            size: meta.len(),
            modified,
            is_dir: meta.is_dir(),
        }
    } else {
        FileStatInfo {
            exists: false,
            size: 0,
            modified: None,
            is_dir: false,
        }
    }
}

pub fn remove_local_path(path_str: &str, is_dir: bool) -> Result<(), String> {
    let p = validate_local_path(path_str, PathAccessMode::Write)?;
    if !p.exists() {
        return Err(format!("Path does not exist: {}", path_str));
    }
    if is_dir {
        fs::remove_dir_all(&p).map_err(|e| format!("Failed to delete directory '{}': {}", path_str, e))
    } else {
        fs::remove_file(&p).map_err(|e| format!("Failed to delete file '{}': {}", path_str, e))
    }
}

pub fn rename_local_path(old_path: &str, new_path: &str) -> Result<(), String> {
    let from = validate_local_path(old_path, PathAccessMode::Write)?;
    let to = validate_local_path(new_path, PathAccessMode::Write)?;
    if !from.exists() {
        return Err(format!("Source path does not exist: {}", old_path));
    }
    fs::rename(&from, &to).map_err(|e| format!("Failed to rename '{}' to '{}': {}", old_path, new_path, e))
}

pub fn create_local_dir(path_str: &str) -> Result<(), String> {
    let p = validate_local_path(path_str, PathAccessMode::Write)?;
    fs::create_dir_all(&p).map_err(|e| format!("Failed to create directory '{}': {}", path_str, e))
}

pub fn create_local_file(path_str: &str) -> Result<(), String> {
    let p = validate_local_path(path_str, PathAccessMode::Write)?;
    if let Some(parent) = p.parent() {
        if !parent.exists() {
            let _ = fs::create_dir_all(parent);
        }
    }
    fs::OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(false)
        .open(&p)
        .map_err(|e| format!("Failed to create file '{}': {}", path_str, e))
        .map(|_| ())
}

pub fn read_local_text_file(path_str: &str, max_bytes: usize) -> Result<String, String> {
    let p = validate_local_path(path_str, PathAccessMode::Read)?;
    if !p.exists() {
        return Err(format!("File does not exist: {}", path_str));
    }
    let meta = fs::metadata(&p).map_err(|e| format!("Failed to stat file '{}': {}", path_str, e))?;
    if meta.is_dir() {
        return Err(format!("Cannot open directory '{}' as text file", path_str));
    }
    if meta.len() > max_bytes as u64 {
        return Err(format!(
            "File size ({} bytes) exceeds maximum editor limit ({} bytes)",
            meta.len(),
            max_bytes
        ));
    }
    let bytes = fs::read(&p).map_err(|e| format!("Failed to read file '{}': {}", path_str, e))?;
    String::from_utf8(bytes).map_err(|_| "File appears to be binary (non UTF-8 content)".to_string())
}

pub fn write_local_text_file(path_str: &str, content: &str) -> Result<(), String> {
    let p = validate_local_path(path_str, PathAccessMode::Write)?;
    if let Some(parent) = p.parent() {
        if !parent.exists() {
            let _ = fs::create_dir_all(parent);
        }
    }
    fs::write(&p, content.as_bytes()).map_err(|e| format!("Failed to write file '{}': {}", path_str, e))
}
pub fn copy_local_item(src: &str, dest: &str) -> Result<(), String> {
    let src_p = validate_local_path(src, PathAccessMode::Read)?;
    let dest_p = validate_local_path(dest, PathAccessMode::Write)?;
    if src_p.is_dir() {
        if !dest_p.exists() {
            fs::create_dir_all(&dest_p).map_err(|e| format!("Failed to create destination dir: {}", e))?;
        }
        for entry in fs::read_dir(&src_p).map_err(|e| format!("Failed to read source dir: {}", e))? {
            if let Ok(entry) = entry {
                let file_name = entry.file_name();
                let src_sub = src_p.join(&file_name);
                let dest_sub = dest_p.join(&file_name);
                copy_local_item(&src_sub.to_string_lossy(), &dest_sub.to_string_lossy())?;
            }
        }
    } else {
        if let Some(parent) = dest_p.parent() {
            let _ = fs::create_dir_all(parent);
        }
        fs::copy(&src_p, &dest_p).map_err(|e| format!("Failed to copy file: {}", e))?;
    }
    Ok(())
}


pub fn open_file_in_editor(path_str: &str, custom_command: Option<&str>) -> Result<(), String> {
    let p = validate_local_path(path_str, PathAccessMode::Read)?;
    if !p.exists() {
        return Err(format!("File does not exist: {}", path_str));
    }
    let target_str = p.to_string_lossy().to_string();

    if let Some(cmd) = custom_command {
        let trimmed = cmd.trim();
        if !trimmed.is_empty() {
            #[cfg(target_os = "windows")]
            {
                std::process::Command::new("cmd")
                    .args(["/C", &format!("{} \"{}\"", trimmed, target_str)])
                    .spawn()
                    .map_err(|e| format!("Failed to launch custom editor '{}': {}", trimmed, e))?;
                return Ok(());
            }
            #[cfg(not(target_os = "windows"))]
            {
                std::process::Command::new("sh")
                    .args(["-c", &format!("{} \"$1\"", trimmed), "--", &target_str])
                    .spawn()
                    .map_err(|e| format!("Failed to launch custom editor '{}': {}", trimmed, e))?;
                return Ok(());
            }
        }
    }

    // Default OS application
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &target_str])
            .spawn()
            .map_err(|e| format!("Failed to open file with system default handler: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&target_str)
            .spawn()
            .map_err(|e| format!("Failed to open file with system default handler: {}", e))?;
    }
    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(&target_str)
            .spawn()
            .map_err(|e| format!("Failed to open file with system default handler: {}", e))?;
    }
    Ok(())
}

#[cfg(target_os = "windows")]
pub fn copy_files_to_system_clipboard(paths: &[String]) -> Result<(), String> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use windows::Win32::Foundation::HWND;
    use windows::Win32::System::DataExchange::{CloseClipboard, EmptyClipboard, OpenClipboard, SetClipboardData, RegisterClipboardFormatW};
    use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GHND};
    use windows::Win32::UI::Shell::DROPFILES;
    use windows::core::w;

    if paths.is_empty() {
        return Ok(());
    }

    let mut normalized_paths: Vec<String> = Vec::new();
    for p in paths {
        let path_buf = if let Ok(val) = validate_local_path(p, PathAccessMode::Read) {
            dunce::canonicalize(val).unwrap_or_else(|_| PathBuf::from(p))
        } else {
            let mut resolved = p.clone();
            if resolved.starts_with('~') {
                if let Some(h) = dirs::home_dir() {
                    let rest = resolved.trim_start_matches('~').trim_start_matches(|c| c == '/' || c == '\\');
                    resolved = h.join(rest).to_string_lossy().to_string();
                }
            }
            let clean = resolved.trim_start_matches(r"\\?\").replace('/', "\\");
            dunce::canonicalize(&clean).unwrap_or_else(|_| PathBuf::from(clean))
        };
        let clean_str = path_buf.to_string_lossy().trim_start_matches(r"\\?\").replace('/', "\\");
        normalized_paths.push(clean_str);
    }

    let mut wide_chars: Vec<u16> = Vec::new();
    for p in &normalized_paths {
        let os_str = OsStr::new(p);
        wide_chars.extend(os_str.encode_wide());
        wide_chars.push(0);
    }
    wide_chars.push(0);

    let dropfiles_size = std::mem::size_of::<DROPFILES>();
    let total_bytes = dropfiles_size + wide_chars.len() * std::mem::size_of::<u16>();

    unsafe {
        let h_global = GlobalAlloc(GHND, total_bytes)
            .map_err(|e| format!("GlobalAlloc failed: {}", e))?;
        let ptr = GlobalLock(h_global);
        if ptr.is_null() {
            return Err("GlobalLock returned null".to_string());
        }

        let df = ptr as *mut DROPFILES;
        (*df).pFiles = dropfiles_size as u32;
        (*df).fWide = true.into();

        let dest_str = (ptr as *mut u8).add(dropfiles_size) as *mut u16;
        std::ptr::copy_nonoverlapping(wide_chars.as_ptr(), dest_str, wide_chars.len());

        let _ = GlobalUnlock(h_global);

        OpenClipboard(HWND::default()).map_err(|e| format!("Failed to open clipboard: {}", e))?;
        let _ = EmptyClipboard();

        // 1. CF_HDROP format ID is 15
        let handle_hdrop = windows::Win32::Foundation::HANDLE(h_global.0 as _);
        let _ = SetClipboardData(15, handle_hdrop);

        // 2. Preferred DropEffect (DROPEFFECT_COPY = 1)
        let format_dropeffect = RegisterClipboardFormatW(w!("Preferred DropEffect"));
        if format_dropeffect != 0 {
            if let Ok(h_effect) = GlobalAlloc(GHND, std::mem::size_of::<u32>()) {
                let p_effect = GlobalLock(h_effect);
                if !p_effect.is_null() {
                    *(p_effect as *mut u32) = 1;
                    let _ = GlobalUnlock(h_effect);
                    let _ = SetClipboardData(format_dropeffect, windows::Win32::Foundation::HANDLE(h_effect.0 as _));
                }
            }
        }

        // 3. CF_UNICODETEXT (format 13) - text representation of paths
        let text_joined = normalized_paths.join("\r\n");
        let wide_text: Vec<u16> = OsStr::new(&text_joined).encode_wide().chain(std::iter::once(0)).collect();
        let text_bytes = wide_text.len() * std::mem::size_of::<u16>();
        if let Ok(h_text) = GlobalAlloc(GHND, text_bytes) {
            let p_text = GlobalLock(h_text);
            if !p_text.is_null() {
                std::ptr::copy_nonoverlapping(wide_text.as_ptr(), p_text as *mut u16, wide_text.len());
                let _ = GlobalUnlock(h_text);
                let _ = SetClipboardData(13, windows::Win32::Foundation::HANDLE(h_text.0 as _));
            }
        }

        let _ = CloseClipboard();
    }

    Ok(())
}

#[cfg(target_os = "macos")]
pub fn copy_files_to_system_clipboard(paths: &[String]) -> Result<(), String> {
    if paths.is_empty() {
        return Ok(());
    }
    let joined = paths
        .iter()
        .map(|p| format!("POSIX file \"{}\"", p.replace('"', "\\\"")))
        .collect::<Vec<_>>()
        .join(", ");
    let script = format!("set the clipboard to {{{}}}", joined);
    let output = std::process::Command::new("osascript")
        .args(["-e", &script])
        .output()
        .map_err(|e| format!("Failed to execute osascript: {}", e))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(())
}

#[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
pub fn copy_files_to_system_clipboard(paths: &[String]) -> Result<(), String> {
    if paths.is_empty() {
        return Ok(());
    }
    let uris = paths
        .iter()
        .map(|p| format!("file://{}", p))
        .collect::<Vec<_>>()
        .join("\n");
    let mut child = std::process::Command::new("xclip")
        .args(["-selection", "clipboard", "-t", "text/uri-list"])
        .stdin(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn xclip: {}", e))?;
    if let Some(mut stdin) = child.stdin.take() {
        use std::io::Write;
        let _ = stdin.write_all(uris.as_bytes());
    }
    let _ = child.wait();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strip_verbatim_prefix() {
        let win_verbatim = r"\\?\C:\Users\tester";
        let stripped = win_verbatim.strip_prefix(r"\\?\").unwrap();
        assert_eq!(stripped, r"C:\Users\tester");
    }

    #[test]
    fn test_read_local_dir_current() {
        let res = read_local_dir(".", 0, 10);
        assert!(res.is_ok());
        let entries = res.unwrap();
        assert!(!entries.entries.is_empty());
    }

    #[test]
    fn test_local_file_lifecycle() {
        let temp_dir = std::env::temp_dir().join("openterm_test_local_lifecycle");
        let _ = fs::remove_dir_all(&temp_dir);

        // create directory
        assert!(create_local_dir(&temp_dir.to_string_lossy()).is_ok());

        // create file
        let file_path = temp_dir.join("hello.txt");
        assert!(create_local_file(&file_path.to_string_lossy()).is_ok());
        assert!(file_path.exists());

        // rename file
        let new_file_path = temp_dir.join("world.txt");
        assert!(rename_local_path(&file_path.to_string_lossy(), &new_file_path.to_string_lossy()).is_ok());
        assert!(!file_path.exists());
        assert!(new_file_path.exists());

        // remove file
        assert!(remove_local_path(&new_file_path.to_string_lossy(), false).is_ok());
        assert!(!new_file_path.exists());

        // remove dir
        assert!(remove_local_path(&temp_dir.to_string_lossy(), true).is_ok());
        assert!(!temp_dir.exists());
    }

    #[test]
    fn test_local_file_stat() {
        let temp_file = std::env::temp_dir().join("openterm_stat_test.txt");
        let _ = fs::remove_file(&temp_file);

        let stat_nonexistent = stat_local_path(&temp_file.to_string_lossy());
        assert!(!stat_nonexistent.exists);

        fs::write(&temp_file, "hello world").unwrap();
        let stat_exists = stat_local_path(&temp_file.to_string_lossy());
        assert!(stat_exists.exists);
        assert_eq!(stat_exists.size, 11);
        assert!(!stat_exists.is_dir);

        let _ = fs::remove_file(&temp_file);
    }

    #[test]
    fn test_validate_local_path_rejects_null_byte() {
        assert!(validate_local_path("foo\0bar", PathAccessMode::Read).is_err());
    }

    #[test]
    fn test_validate_local_path_rejects_ssh_credentials() {
        let ssh_dir = dirs::home_dir().unwrap().join(".ssh");
        assert!(validate_local_path(&ssh_dir.to_string_lossy(), PathAccessMode::ReadDir).is_err());
        assert!(validate_local_path(&ssh_dir.join("id_rsa").to_string_lossy(), PathAccessMode::Read).is_err());
    }

    #[test]
    fn test_validate_local_path_rejects_shell_rc_write() {
        let home = dirs::home_dir().unwrap();
        assert!(validate_local_path(&home.join(".bashrc").to_string_lossy(), PathAccessMode::Write).is_err());
        assert!(validate_local_path(&home.join(".zshrc").to_string_lossy(), PathAccessMode::Write).is_err());
    }

    #[cfg(windows)]
    #[test]
    fn test_validate_local_path_rejects_startup_dir() {
        let bad_path = r"C:\Users\tester\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\bad.exe";
        assert!(validate_local_path(bad_path, PathAccessMode::Write).is_err());
    }
}
