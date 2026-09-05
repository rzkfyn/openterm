use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::atomic::Ordering;
use std::thread;

use tauri::{AppHandle, Emitter};

use crate::models::{FileEntry, PaginatedEntries, TransferProgress, TransferStatus};
use crate::session::SessionManager;

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

    let path_to_read = if remote_path.is_empty() || remote_path == "." {
        Path::new(".")
    } else {
        Path::new(remote_path)
    };

    let dir_entries = sftp
        .readdir(path_to_read)
        .map_err(|e| format!("Failed to read remote directory '{}': {}", remote_path, e))?;

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

        entries.push(FileEntry {
            name,
            path: path_buf.to_string_lossy().to_string(),
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
        path: remote_path.to_string(),
        entries: paged,
        total,
        offset,
        limit,
        has_more,
    })
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
    let session = manager
        .get_session(session_id)
        .ok_or_else(|| format!("Session {} not found", session_id))?;

    let cancel_token = manager.register_transfer(transfer_id.to_string());
    let session_clone = session.clone();
    let remote_path_buf = remote_path.to_string();
    let local_path_buf = local_path.to_string();
    let transfer_id_buf = transfer_id.to_string();
    let app_handle = app.clone();
    let manager_clone = manager.clone();

    thread::spawn(move || {
        let event_name = format!("transfer:progress:{}", transfer_id_buf);

        let run_transfer = || -> Result<(), String> {
            let sftp_arc = session_clone
                .sftp
                .as_ref()
                .ok_or_else(|| "SFTP subsystem not initialized".to_string())?;
            let sftp = sftp_arc.lock();

            let mut remote_file = sftp
                .open(Path::new(&remote_path_buf))
                .map_err(|e| format!("Failed to open remote file '{}': {}", remote_path_buf, e))?;

            let stat = remote_file
                .stat()
                .map_err(|e| format!("Failed to stat remote file: {}", e))?;
            let total_bytes = stat.size.unwrap_or(0);

            let mut local_file = File::create(Path::new(&local_path_buf))
                .map_err(|e| format!("Failed to create local file '{}': {}", local_path_buf, e))?;

            let mut buffer = [0u8; 131072]; // 128 KB buffer for optimal throughput
            let mut bytes_transferred: u64 = 0;

            let file_name = Path::new(&remote_path_buf)
                .file_name()
                .map(|f| f.to_string_lossy().to_string())
                .unwrap_or_else(|| remote_path_buf.clone());

            let mut last_percent_reported = -1;

            loop {
                if cancel_token.load(Ordering::SeqCst) {
                    let _ = app_handle.emit(
                        &event_name,
                        TransferProgress {
                            transfer_id: transfer_id_buf.clone(),
                            file_name: file_name.clone(),
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
                        &event_name,
                        TransferProgress {
                            transfer_id: transfer_id_buf.clone(),
                            file_name: file_name.clone(),
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

            // Emit completion
            let _ = app_handle.emit(
                &event_name,
                TransferProgress {
                    transfer_id: transfer_id_buf.clone(),
                    file_name,
                    bytes_transferred,
                    total_bytes,
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
    let session = manager
        .get_session(session_id)
        .ok_or_else(|| format!("Session {} not found", session_id))?;

    let cancel_token = manager.register_transfer(transfer_id.to_string());
    let session_clone = session.clone();
    let local_path_buf = local_path.to_string();
    let remote_path_buf = remote_path.to_string();
    let transfer_id_buf = transfer_id.to_string();
    let app_handle = app.clone();
    let manager_clone = manager.clone();

    thread::spawn(move || {
        let event_name = format!("transfer:progress:{}", transfer_id_buf);

        let run_transfer = || -> Result<(), String> {
            let mut local_file = File::open(Path::new(&local_path_buf))
                .map_err(|e| format!("Failed to open local file '{}': {}", local_path_buf, e))?;

            let meta = local_file
                .metadata()
                .map_err(|e| format!("Failed to read metadata: {}", e))?;
            let total_bytes = meta.len();

            let sftp_arc = session_clone
                .sftp
                .as_ref()
                .ok_or_else(|| "SFTP subsystem not initialized".to_string())?;
            let sftp = sftp_arc.lock();

            let mut remote_file = sftp
                .create(Path::new(&remote_path_buf))
                .map_err(|e| format!("Failed to create remote file '{}': {}", remote_path_buf, e))?;

            let mut buffer = [0u8; 131072]; // 128 KB buffer
            let mut bytes_transferred: u64 = 0;

            let file_name = Path::new(&local_path_buf)
                .file_name()
                .map(|f| f.to_string_lossy().to_string())
                .unwrap_or_else(|| local_path_buf.clone());

            let mut last_percent_reported = -1;

            loop {
                if cancel_token.load(Ordering::SeqCst) {
                    let _ = app_handle.emit(
                        &event_name,
                        TransferProgress {
                            transfer_id: transfer_id_buf.clone(),
                            file_name: file_name.clone(),
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
                        &event_name,
                        TransferProgress {
                            transfer_id: transfer_id_buf.clone(),
                            file_name: file_name.clone(),
                            bytes_transferred,
                            total_bytes,
                            percentage,
                            status: TransferStatus::Transferring,
                            error: None,
                        },
                    );
                }
            }

            // Emit completion
            let _ = app_handle.emit(
                &event_name,
                TransferProgress {
                    transfer_id: transfer_id_buf.clone(),
                    file_name,
                    bytes_transferred,
                    total_bytes,
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
