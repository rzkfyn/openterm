use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::atomic::Ordering;
use std::thread;

use ssh2::FileStat;
use tauri::{AppHandle, Emitter};

use crate::local_fs::{self, PathAccessMode};
use crate::models::{FileEntry, FileStatInfo, PaginatedEntries, TransferProgress, TransferStatus};
use crate::session::SessionManager;

/// Normalizes a remote path into a clean POSIX path, resolving '.' and relative paths via SFTP realpath.
pub fn normalize_remote_path(sftp: &ssh2::Sftp, remote_path: &str) -> String {
    let clean = remote_path.replace('\\', "/");
    let target = if clean.is_empty() || clean == "." {
        Path::new(".")
    } else {
        Path::new(&clean)
    };

    let resolved = sftp
        .realpath(target)
        .map(|p| p.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| {
            if clean.is_empty() || clean == "." {
                "/".to_string()
            } else {
                clean
            }
        });

    if resolved.is_empty() || resolved == "." {
        "/".to_string()
    } else {
        resolved
    }
}

pub fn list_sftp_dir(
    manager: &SessionManager,
    session_id: &str,
    remote_path: &str,
    offset: usize,
    limit: usize,
) -> Result<PaginatedEntries, String> {
    let session = manager
        .get_session(session_id)
        .ok_or_else(|| format!("Session {} not found", session_id))?;

    let sftp_arc = session
        .sftp
        .as_ref()
        .ok_or_else(|| {
            session
                .sftp_error
                .as_deref()
                .map(|err| format!("SFTP unavailable: {}", err))
                .unwrap_or_else(|| "SFTP subsystem is not available for this host".to_string())
        })?;

    let sftp = sftp_arc.lock();

    let resolved_dir = normalize_remote_path(&sftp, remote_path);
    let path_to_read = Path::new(&resolved_dir);

    let dir_entries = sftp
        .readdir(path_to_read)
        .map_err(|e| format!("Failed to read remote directory '{}': {}", resolved_dir, e))?;

    let mut entries: Vec<FileEntry> = Vec::new();

    for (path_buf, stat) in dir_entries {
        let name = path_buf
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| path_buf.to_string_lossy().to_string());

        // Skip current and parent relative directories
        if name == "." || name == ".." {
            continue;
        }

        let is_dir = stat.is_dir();
        // FileStat in ssh2 doesn't have is_symlink(), permissions type check can be used:
        let is_symlink = stat.perm.map(|p| (p & 0o170000) == 0o120000).unwrap_or(false);
        let size = stat.size.unwrap_or(0);
        let modified = stat.mtime;
        let permissions = stat.perm;

        // Build clean POSIX path for each entry
        let entry_path = if resolved_dir == "/" {
            format!("/{}", name)
        } else {
            format!("{}/{}", resolved_dir.trim_end_matches('/'), name)
        };

        entries.push(FileEntry {
            name,
            path: entry_path,
            size,
            is_dir,
            is_symlink,
            modified,
            permissions,
        });
    }

    // Sort: directories first, then alphabetical
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
        path: resolved_dir,
        entries: paged,
        total,
        offset,
        limit,
        has_more,
    })
}

fn extract_filename(path: &str) -> String {
    let cleaned = path.trim_start_matches(r"\\?\");
    cleaned
        .split(|c| c == '/' || c == '\\')
        .filter(|s| !s.is_empty())
        .last()
        .unwrap_or(cleaned)
        .to_string()
}

fn upload_single_file(
    sftp: &ssh2::Sftp,
    local_path: &Path,
    remote_path: &str,
    cancel_token: &std::sync::atomic::AtomicBool,
    app_handle: &AppHandle,
    event_name: &str,
    transfer_id: &str,
    file_name: &str,
) -> Result<(), String> {
    let mut local_file = File::open(local_path)
        .map_err(|e| format!("Failed to open local file '{}': {}", local_path.display(), e))?;

    let meta = local_file
        .metadata()
        .map_err(|e| format!("Failed to read metadata: {}", e))?;
    let total_bytes = meta.len();

    let mut remote_file = sftp
        .create(Path::new(remote_path))
        .map_err(|e| format!("Failed to create remote file '{}': {}", remote_path, e))?;

    let mut buffer = [0u8; 131072]; // 128 KB buffer
    let mut bytes_transferred: u64 = 0;
    let mut last_percent_reported = -1;

    loop {
        if cancel_token.load(Ordering::SeqCst) {
            let _ = app_handle.emit(
                event_name,
                TransferProgress {
                    transfer_id: transfer_id.to_string(),
                    file_name: file_name.to_string(),
                    bytes_transferred,
                    total_bytes,
                    percentage: if total_bytes > 0 {
                        (bytes_transferred as f32 / total_bytes as f32) * 100.0
                    } else {
                        0.0
                    },
                    status: TransferStatus::Cancelled,
                    error: None,
                },
            );
            return Err("Transfer cancelled by user".to_string());
        }

        let n = local_file
            .read(&mut buffer)
            .map_err(|e| format!("Local read error: {}", e))?;

        if n == 0 {
            break;
        }

        remote_file
            .write_all(&buffer[..n])
            .map_err(|e| format!("Remote write error: {}", e))?;

        bytes_transferred += n as u64;

        let percentage = if total_bytes > 0 {
            (bytes_transferred as f32 / total_bytes as f32) * 100.0
        } else {
            0.0
        };

        let current_percent_int = percentage as i32;
        if current_percent_int != last_percent_reported || bytes_transferred == total_bytes {
            last_percent_reported = current_percent_int;
            let _ = app_handle.emit(
                event_name,
                TransferProgress {
                    transfer_id: transfer_id.to_string(),
                    file_name: file_name.to_string(),
                    bytes_transferred,
                    total_bytes,
                    percentage,
                    status: TransferStatus::Transferring,
                    error: None,
                },
            );
        }
    }

    remote_file.flush().ok();
    Ok(())
}

fn upload_dir_recursive(
    sftp: &ssh2::Sftp,
    local_dir: &Path,
    remote_dir: &str,
    cancel_token: &std::sync::atomic::AtomicBool,
    app_handle: &AppHandle,
    event_name: &str,
    transfer_id: &str,
) -> Result<(), String> {
    let _ = sftp.mkdir(Path::new(remote_dir), 0o755);

    if let Ok(entries) = std::fs::read_dir(local_dir) {
        for entry_res in entries {
            if cancel_token.load(Ordering::SeqCst) {
                return Err("Transfer cancelled by user".to_string());
            }
            if let Ok(entry) = entry_res {
                let Ok(file_type) = entry.file_type() else {
                    continue;
                };
                // Skip symlinks to prevent traversal attacks
                if file_type.is_symlink() {
                    continue;
                }
                let entry_path = entry.path();
                let child_name = entry.file_name().to_string_lossy().to_string();
                let remote_child = format!("{}/{}", remote_dir.trim_end_matches('/'), child_name);

                if file_type.is_dir() {
                    upload_dir_recursive(
                        sftp,
                        &entry_path,
                        &remote_child,
                        cancel_token,
                        app_handle,
                        event_name,
                        transfer_id,
                    )?;
                } else if file_type.is_file() {
                    let _ = upload_single_file(
                        sftp,
                        &entry_path,
                        &remote_child,
                        cancel_token,
                        app_handle,
                        event_name,
                        transfer_id,
                        &child_name,
                    );
                }
            }
        }
    }
    Ok(())
}

fn download_single_file(
    sftp: &ssh2::Sftp,
    remote_path: &str,
    local_path: &Path,
    cancel_token: &std::sync::atomic::AtomicBool,
    app_handle: &AppHandle,
    event_name: &str,
    transfer_id: &str,
    file_name: &str,
) -> Result<(), String> {
    local_fs::validate_local_path(local_path.to_str().unwrap_or_default(), PathAccessMode::Write)?;

    if let Some(parent) = local_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| {
            format!("Failed to create local destination directory '{}': {}", parent.display(), e)
        })?;
    }

    let mut remote_file = sftp
        .open(Path::new(remote_path))
        .map_err(|e| format!("Failed to open remote file '{}': {}", remote_path, e))?;

    let stat = remote_file
        .stat()
        .map_err(|e| format!("Failed to stat remote file: {}", e))?;
    let total_bytes = stat.size.unwrap_or(0);

    let mut local_file = File::create(local_path)
        .map_err(|e| format!("Failed to create local file '{}': {}", local_path.display(), e))?;

    let mut buffer = [0u8; 131072]; // 128 KB buffer
    let mut bytes_transferred: u64 = 0;
    let mut last_percent_reported = -1;

    loop {
        if cancel_token.load(Ordering::SeqCst) {
            let _ = app_handle.emit(
                event_name,
                TransferProgress {
                    transfer_id: transfer_id.to_string(),
                    file_name: file_name.to_string(),
                    bytes_transferred,
                    total_bytes,
                    percentage: if total_bytes > 0 {
                        (bytes_transferred as f32 / total_bytes as f32) * 100.0
                    } else {
                        0.0
                    },
                    status: TransferStatus::Cancelled,
                    error: None,
                },
            );
            return Err("Transfer cancelled by user".to_string());
        }

        let n = remote_file
            .read(&mut buffer)
            .map_err(|e| format!("Remote read error: {}", e))?;

        if n == 0 {
            break;
        }

        local_file
            .write_all(&buffer[..n])
            .map_err(|e| format!("Local write error: {}", e))?;

        bytes_transferred += n as u64;

        let percentage = if total_bytes > 0 {
            (bytes_transferred as f32 / total_bytes as f32) * 100.0
        } else {
            0.0
        };

        let current_percent_int = percentage as i32;
        if current_percent_int != last_percent_reported || bytes_transferred == total_bytes {
            last_percent_reported = current_percent_int;
            let _ = app_handle.emit(
                event_name,
                TransferProgress {
                    transfer_id: transfer_id.to_string(),
                    file_name: file_name.to_string(),
                    bytes_transferred,
                    total_bytes,
                    percentage,
                    status: TransferStatus::Transferring,
                    error: None,
                },
            );
        }
    }

    local_file.flush().ok();
    Ok(())
}

fn download_dir_recursive(
    sftp: &ssh2::Sftp,
    remote_dir: &str,
    local_dir: &Path,
    cancel_token: &std::sync::atomic::AtomicBool,
    app_handle: &AppHandle,
    event_name: &str,
    transfer_id: &str,
) -> Result<(), String> {
    std::fs::create_dir_all(local_dir).map_err(|e| {
        format!("Failed to create local directory '{}': {}", local_dir.display(), e)
    })?;

    if let Ok(entries) = sftp.readdir(Path::new(remote_dir)) {
        for (child_path, child_stat) in entries {
            if cancel_token.load(Ordering::SeqCst) {
                return Err("Transfer cancelled by user".to_string());
            }
            let child_name = child_path
                .file_name()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();
            if child_name == "." || child_name == ".." || child_name.is_empty() {
                continue;
            }

            let remote_child = format!("{}/{}", remote_dir.trim_end_matches('/'), child_name);
            let local_child = local_dir.join(&child_name);

            if child_stat.is_dir() {
                download_dir_recursive(
                    sftp,
                    &remote_child,
                    &local_child,
                    cancel_token,
                    app_handle,
                    event_name,
                    transfer_id,
                )?;
            } else {
                let _ = download_single_file(
                    sftp,
                    &remote_child,
                    &local_child,
                    cancel_token,
                    app_handle,
                    event_name,
                    transfer_id,
                    &child_name,
                );
            }
        }
    }
    Ok(())
}

/// Direct-to-Disk SFTP Download (Zero Binary in JavaScript)
pub fn download_sftp_file(
    app: AppHandle,
    manager: &SessionManager,
    session_id: &str,
    remote_path: &str,
    local_path: &str,
    transfer_id: &str,
) -> Result<(), String> {
    let validated_local = local_fs::validate_local_path(local_path, PathAccessMode::Write)?;
    let session = manager
        .get_session(session_id)
        .ok_or_else(|| format!("Session {} not found", session_id))?;

    let cancel_token = manager.register_transfer(transfer_id.to_string());
    let session_clone = session.clone();
    let remote_path_buf = remote_path.replace('\\', "/");
    let local_path_buf = validated_local.to_string_lossy().to_string();
    let transfer_id_buf = transfer_id.to_string();
    let app_handle = app.clone();
    let manager_clone = manager.clone();

    thread::spawn(move || {
        let event_name = format!("transfer:progress:{}", transfer_id_buf);
        let file_name = extract_filename(&remote_path_buf);

        let run_transfer = || -> Result<(), String> {
            let sftp_arc = session_clone
                .sftp
                .as_ref()
                .ok_or_else(|| "SFTP subsystem not initialized".to_string())?;
            let sftp = sftp_arc.lock();

            let local_clean = local_path_buf.trim_start_matches(r"\\?\");
            let local_path_obj = Path::new(local_clean);

            let remote_stat = sftp.stat(Path::new(&remote_path_buf)).ok();
            let is_remote_dir = remote_stat.map(|s| s.is_dir()).unwrap_or(false);

            if is_remote_dir {
                download_dir_recursive(
                    &sftp,
                    &remote_path_buf,
                    local_path_obj,
                    &cancel_token,
                    &app_handle,
                    &event_name,
                    &transfer_id_buf,
                )?;
            } else {
                download_single_file(
                    &sftp,
                    &remote_path_buf,
                    local_path_obj,
                    &cancel_token,
                    &app_handle,
                    &event_name,
                    &transfer_id_buf,
                    &file_name,
                )?;
            }

            // Emit completion
            let _ = app_handle.emit(
                &event_name,
                TransferProgress {
                    transfer_id: transfer_id_buf.clone(),
                    file_name: file_name.clone(),
                    bytes_transferred: 0,
                    total_bytes: 0,
                    percentage: 100.0,
                    status: TransferStatus::Completed,
                    error: None,
                },
            );

            Ok(())
        };

        if let Err(err_msg) = run_transfer() {
            let _ = app_handle.emit(
                &event_name,
                TransferProgress {
                    transfer_id: transfer_id_buf.clone(),
                    file_name: remote_path_buf,
                    bytes_transferred: 0,
                    total_bytes: 0,
                    percentage: 0.0,
                    status: TransferStatus::Failed,
                    error: Some(err_msg),
                },
            );
        }

        manager_clone.remove_transfer(&transfer_id_buf);
    });

    Ok(())
}

/// Direct-to-Disk SFTP Upload (Zero Binary in JavaScript)
pub fn upload_sftp_file(
    app: AppHandle,
    manager: &SessionManager,
    session_id: &str,
    local_path: &str,
    remote_path: &str,
    transfer_id: &str,
) -> Result<(), String> {
    let validated_local = local_fs::validate_local_path(local_path, PathAccessMode::Read)?;
    let session = manager
        .get_session(session_id)
        .ok_or_else(|| format!("Session {} not found", session_id))?;

    let cancel_token = manager.register_transfer(transfer_id.to_string());
    let session_clone = session.clone();
    let local_path_buf = validated_local.to_string_lossy().to_string();
    let remote_path_buf = remote_path.replace('\\', "/");
    let transfer_id_buf = transfer_id.to_string();
    let app_handle = app.clone();
    let manager_clone = manager.clone();

    thread::spawn(move || {
        let event_name = format!("transfer:progress:{}", transfer_id_buf);
        let file_name = extract_filename(&local_path_buf);

        let run_transfer = || -> Result<(), String> {
            let sftp_arc = session_clone
                .sftp
                .as_ref()
                .ok_or_else(|| "SFTP subsystem not initialized".to_string())?;
            let sftp = sftp_arc.lock();

            let local_clean = local_path_buf.trim_start_matches(r"\\?\");
            let local_path_obj = Path::new(local_clean);

            if local_path_obj.is_dir() {
                upload_dir_recursive(
                    &sftp,
                    local_path_obj,
                    &remote_path_buf,
                    &cancel_token,
                    &app_handle,
                    &event_name,
                    &transfer_id_buf,
                )?;
            } else {
                upload_single_file(
                    &sftp,
                    local_path_obj,
                    &remote_path_buf,
                    &cancel_token,
                    &app_handle,
                    &event_name,
                    &transfer_id_buf,
                    &file_name,
                )?;
            }

            // Emit completion
            let _ = app_handle.emit(
                &event_name,
                TransferProgress {
                    transfer_id: transfer_id_buf.clone(),
                    file_name: file_name.clone(),
                    bytes_transferred: 0,
                    total_bytes: 0,
                    percentage: 100.0,
                    status: TransferStatus::Completed,
                    error: None,
                },
            );

            Ok(())
        };

        if let Err(err_msg) = run_transfer() {
            let _ = app_handle.emit(
                &event_name,
                TransferProgress {
                    transfer_id: transfer_id_buf.clone(),
                    file_name: local_path_buf,
                    bytes_transferred: 0,
                    total_bytes: 0,
                    percentage: 0.0,
                    status: TransferStatus::Failed,
                    error: Some(err_msg),
                },
            );
        }

        manager_clone.remove_transfer(&transfer_id_buf);
    });

    Ok(())
}

fn remove_remote_dir_recursive(sftp: &ssh2::Sftp, remote_dir: &str) -> Result<(), String> {
    let path = Path::new(remote_dir);
    let entries = sftp
        .readdir(path)
        .map_err(|e| format!("Failed to read remote directory '{}': {}", remote_dir, e))?;

    for (child_path, stat) in entries {
        let name = child_path
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();
        if name == "." || name == ".." {
            continue;
        }

        let child_str = child_path.to_string_lossy().replace('\\', "/");
        if stat.is_dir() {
            remove_remote_dir_recursive(sftp, &child_str)?;
        } else {
            sftp.unlink(Path::new(&child_str))
                .map_err(|e| format!("Failed to delete remote file '{}': {}", child_str, e))?;
        }
    }

    sftp.rmdir(path)
        .map_err(|e| format!("Failed to delete remote directory '{}': {}", remote_dir, e))?;
    Ok(())
}

pub fn stat_sftp_path(
    manager: &SessionManager,
    session_id: &str,
    path: &str,
) -> Result<FileStatInfo, String> {
    let session = manager
        .get_session(session_id)
        .ok_or_else(|| format!("Session {} not found", session_id))?;
    let sftp_arc = session
        .sftp
        .as_ref()
        .ok_or_else(|| "SFTP subsystem is not available".to_string())?;
    let sftp = sftp_arc.lock();

    let clean = path.replace('\\', "/");
    let p = Path::new(&clean);
    match sftp.stat(p) {
        Ok(stat) => Ok(FileStatInfo {
            exists: true,
            size: stat.size.unwrap_or(0),
            modified: stat.mtime,
            is_dir: stat.is_dir(),
        }),
        Err(_) => Ok(FileStatInfo {
            exists: false,
            size: 0,
            modified: None,
            is_dir: false,
        }),
    }
}

pub fn rename_sftp_path(
    manager: &SessionManager,
    session_id: &str,
    old_path: &str,
    new_path: &str,
) -> Result<(), String> {
    let session = manager
        .get_session(session_id)
        .ok_or_else(|| format!("Session {} not found", session_id))?;
    let sftp_arc = session
        .sftp
        .as_ref()
        .ok_or_else(|| "SFTP subsystem is not available".to_string())?;
    let sftp = sftp_arc.lock();

    let clean_old = old_path.replace('\\', "/");
    let clean_new = new_path.replace('\\', "/");
    sftp.rename(Path::new(&clean_old), Path::new(&clean_new), None)
        .map_err(|e| format!("Failed to rename '{}' to '{}': {}", clean_old, clean_new, e))
}

pub fn remove_sftp_path(
    manager: &SessionManager,
    session_id: &str,
    path: &str,
    is_dir: bool,
) -> Result<(), String> {
    let session = manager
        .get_session(session_id)
        .ok_or_else(|| format!("Session {} not found", session_id))?;
    let sftp_arc = session
        .sftp
        .as_ref()
        .ok_or_else(|| "SFTP subsystem is not available".to_string())?;
    let sftp = sftp_arc.lock();

    let clean = path.replace('\\', "/");
    if is_dir {
        remove_remote_dir_recursive(&sftp, &clean)
    } else {
        sftp.unlink(Path::new(&clean))
            .map_err(|e| format!("Failed to delete remote file '{}': {}", clean, e))
    }
}

pub fn mkdir_sftp(
    manager: &SessionManager,
    session_id: &str,
    path: &str,
) -> Result<(), String> {
    let session = manager
        .get_session(session_id)
        .ok_or_else(|| format!("Session {} not found", session_id))?;
    let sftp_arc = session
        .sftp
        .as_ref()
        .ok_or_else(|| "SFTP subsystem is not available".to_string())?;
    let sftp = sftp_arc.lock();

    let clean = path.replace('\\', "/");
    sftp.mkdir(Path::new(&clean), 0o755)
        .map_err(|e| format!("Failed to create remote directory '{}': {}", clean, e))
}

pub fn touch_sftp(
    manager: &SessionManager,
    session_id: &str,
    path: &str,
) -> Result<(), String> {
    let session = manager
        .get_session(session_id)
        .ok_or_else(|| format!("Session {} not found", session_id))?;
    let sftp_arc = session
        .sftp
        .as_ref()
        .ok_or_else(|| "SFTP subsystem is not available".to_string())?;
    let sftp = sftp_arc.lock();

    let clean = path.replace('\\', "/");
    let _file = sftp
        .create(Path::new(&clean))
        .map_err(|e| format!("Failed to create remote file '{}': {}", clean, e))?;
    Ok(())
}

pub fn chmod_sftp(
    manager: &SessionManager,
    session_id: &str,
    path: &str,
    mode: u32,
) -> Result<(), String> {
    let session = manager
        .get_session(session_id)
        .ok_or_else(|| format!("Session {} not found", session_id))?;
    let sftp_arc = session
        .sftp
        .as_ref()
        .ok_or_else(|| "SFTP subsystem is not available".to_string())?;
    let sftp = sftp_arc.lock();

    let clean = path.replace('\\', "/");
    let stat = FileStat {
        size: None,
        uid: None,
        gid: None,
        perm: Some(mode),
        atime: None,
        mtime: None,
    };
    sftp.setstat(Path::new(&clean), stat)
        .map_err(|e| format!("Failed to change permissions for '{}': {}", clean, e))
}

pub fn read_sftp_text_file(
    manager: &SessionManager,
    session_id: &str,
    path: &str,
    max_bytes: usize,
) -> Result<String, String> {
    let session = manager
        .get_session(session_id)
        .ok_or_else(|| format!("Session {} not found", session_id))?;
    let sftp_arc = session
        .sftp
        .as_ref()
        .ok_or_else(|| "SFTP subsystem is not available".to_string())?;
    let sftp = sftp_arc.lock();

    let clean = path.replace('\\', "/");
    let mut remote_file = sftp
        .open(Path::new(&clean))
        .map_err(|e| format!("Failed to open remote file '{}': {}", clean, e))?;

    let stat = remote_file
        .stat()
        .map_err(|e| format!("Failed to stat remote file '{}': {}", path, e))?;

    if let Some(sz) = stat.size {
        if sz > max_bytes as u64 {
            return Err(format!(
                "File size ({} bytes) exceeds maximum editor limit ({} bytes)",
                sz, max_bytes
            ));
        }
    }

    let mut buffer = Vec::new();
    let mut chunk = [0u8; 16384];
    let mut total_read = 0;

    loop {
        let n = remote_file
            .read(&mut chunk)
            .map_err(|e| format!("Failed reading remote file '{}': {}", path, e))?;
        if n == 0 {
            break;
        }
        total_read += n;
        if total_read > max_bytes {
            return Err(format!(
                "File exceeds maximum allowable size ({} bytes)",
                max_bytes
            ));
        }
        buffer.extend_from_slice(&chunk[..n]);
    }

    String::from_utf8(buffer)
        .map_err(|_| "File appears to be binary (non UTF-8 content)".to_string())
}

pub fn write_sftp_text_file(
    manager: &SessionManager,
    session_id: &str,
    path: &str,
    content: &str,
) -> Result<(), String> {
    let session = manager
        .get_session(session_id)
        .ok_or_else(|| format!("Session {} not found", session_id))?;
    let sftp_arc = session
        .sftp
        .as_ref()
        .ok_or_else(|| "SFTP subsystem is not available".to_string())?;
    let sftp = sftp_arc.lock();

    let clean = path.replace('\\', "/");
    let mut remote_file = sftp
        .create(Path::new(&clean))
        .map_err(|e| format!("Failed to open remote file for writing '{}': {}", clean, e))?;

    remote_file
        .write_all(content.as_bytes())
        .map_err(|e| format!("Failed to write to remote file '{}': {}", clean, e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_filename_windows() {
        assert_eq!(extract_filename(r"C:\Users\tester\file.txt"), "file.txt");
        assert_eq!(extract_filename(r"\\?\C:\Users\tester\file.txt"), "file.txt");
        assert_eq!(extract_filename(r"folder\nested\test.zip"), "test.zip");
    }

    #[test]
    fn test_extract_filename_unix() {
        assert_eq!(extract_filename("/var/log/nginx.log"), "nginx.log");
        assert_eq!(extract_filename("relative/path/test.tar.gz"), "test.tar.gz");
    }

    #[test]
    fn test_extract_filename_mixed() {
        assert_eq!(extract_filename(r"C:/Users/tester\nested/file.bin"), "file.bin");
    }

    #[test]
    fn test_clean_remote_path_normalization() {
        let windows_style = r"\var\www\html\sub";
        assert_eq!(windows_style.replace('\\', "/"), "/var/www/html/sub");

        let mixed_style = r"/var/www\html/assets\img";
        assert_eq!(mixed_style.replace('\\', "/"), "/var/www/html/assets/img");
    }
}
