use std::fs;
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

    let canonical = target_path
        .canonicalize()
        .map_err(|e| format!("Failed to read path '{}': {}", path_str, e))?;

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
                let permissions = Some(m.permissions().mode());
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
