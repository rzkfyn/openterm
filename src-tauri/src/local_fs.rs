use std::fs;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::PathBuf;
use std::time::UNIX_EPOCH;

use crate::models::{FileEntry, PaginatedEntries};

pub fn read_local_dir(
    path_str: &str,
    offset: usize,
    limit: usize,
) -> Result<PaginatedEntries, String> {
    let target_path = if path_str.is_empty() || path_str == "~" {
        dirs::home_dir().unwrap_or_else(|| PathBuf::from("/"))
    } else {
        PathBuf::from(path_str)
    };

    #[allow(unused_mut)]
    let mut canonical = target_path
        .canonicalize()
        .map_err(|e| format!("Failed to read path '{}': {}", path_str, e))?;

    // Strip Windows verbatim prefix (\\?\) to avoid invalid path errors downstream
    #[cfg(windows)]
    {
        let canonical_str = canonical.to_string_lossy();
        if let Some(stripped) = canonical_str.strip_prefix(r"\\?\") {
            canonical = PathBuf::from(stripped);
        }
    }

    let read_dir = fs::read_dir(&canonical)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    let mut entries: Vec<FileEntry> = Vec::new();

    for entry_res in read_dir {
        if let Ok(entry) = entry_res {
            let file_name = entry.file_name().to_string_lossy().to_string();
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

pub fn remove_local_path(path_str: &str, is_dir: bool) -> Result<(), String> {
    let p = PathBuf::from(path_str);
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
    let from = PathBuf::from(old_path);
    let to = PathBuf::from(new_path);
    if !from.exists() {
        return Err(format!("Source path does not exist: {}", old_path));
    }
    fs::rename(&from, &to).map_err(|e| format!("Failed to rename '{}' to '{}': {}", old_path, new_path, e))
}

pub fn create_local_dir(path_str: &str) -> Result<(), String> {
    let p = PathBuf::from(path_str);
    fs::create_dir_all(&p).map_err(|e| format!("Failed to create directory '{}': {}", path_str, e))
}

pub fn create_local_file(path_str: &str) -> Result<(), String> {
    let p = PathBuf::from(path_str);
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
}
