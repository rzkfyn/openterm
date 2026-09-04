pub mod local_fs;
pub mod models;
pub mod session;
pub mod sftp;
pub mod ssh;

use models::{PaginatedEntries, SessionConfig};
use session::SessionManager;
use tauri::{AppHandle, Manager, State};

#[tauri::command]
fn ping() -> &'static str {
    "pong"
}

#[tauri::command]
fn ssh_connect(
    app: AppHandle,
    manager: State<SessionManager>,
    config: SessionConfig,
) -> Result<String, String> {
    eprintln!("[ssh_connect] Connecting to {}:{} as {}", config.host, config.port, config.username);
    ssh::connect_ssh(app, &manager, config)
}

#[tauri::command]
fn ssh_disconnect(manager: State<SessionManager>, session_id: String) -> Result<(), String> {
    eprintln!("[ssh_disconnect] Disconnecting {}", session_id);
    ssh::disconnect_ssh(&manager, &session_id)
}

#[tauri::command]
fn ssh_write(
    manager: State<SessionManager>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    eprintln!("[ssh_write] session_id: {}, len: {}, bytes: {:?}", session_id, data.len(), data.as_bytes());
    ssh::write_ssh(&manager, &session_id, data.as_bytes())
}

#[tauri::command]
fn local_list_dir(
    path: String,
    offset: usize,
    limit: usize,
) -> Result<PaginatedEntries, String> {
    local_fs::read_local_dir(&path, offset, limit)
}

#[tauri::command]
fn sftp_list_dir(
    manager: State<SessionManager>,
    session_id: String,
    remote_path: String,
    offset: usize,
    limit: usize,
) -> Result<PaginatedEntries, String> {
    sftp::list_sftp_dir(&manager, &session_id, &remote_path, offset, limit)
}

#[tauri::command]
fn sftp_download(
    app: AppHandle,
    manager: State<SessionManager>,
    session_id: String,
    remote_path: String,
    local_path: String,
    transfer_id: String,
) -> Result<(), String> {
    sftp::download_sftp_file(
        app,
        &manager,
        &session_id,
        &remote_path,
        &local_path,
        &transfer_id,
    )
}

#[tauri::command]
fn sftp_upload(
    app: AppHandle,
    manager: State<SessionManager>,
    session_id: String,
    local_path: String,
    remote_path: String,
    transfer_id: String,
) -> Result<(), String> {
    sftp::upload_sftp_file(
        app,
        &manager,
        &session_id,
        &local_path,
        &remote_path,
        &transfer_id,
    )
}

#[tauri::command]
fn sftp_cancel_transfer(
    manager: State<SessionManager>,
    transfer_id: String,
) -> Result<(), String> {
    if manager.cancel_transfer(&transfer_id) {
        Ok(())
    } else {
        Err(format!("Transfer {} not active", transfer_id))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let session_manager = SessionManager::new();

    tauri::Builder::default()
        .setup(|app| {
            app.manage(session_manager);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ping,
            ssh_connect,
            ssh_disconnect,
            ssh_write,
            local_list_dir,
            sftp_list_dir,
            sftp_download,
            sftp_upload,
            sftp_cancel_transfer,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
