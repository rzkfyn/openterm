pub mod local_fs;
pub mod models;
pub mod session;
pub mod sftp;
pub mod ssh;
pub mod storage;

use models::{PaginatedEntries, SessionConfig};
use session::SessionManager;
use storage::SavedConnection;
use tauri::{AppHandle, Manager, State};

#[tauri::command]
fn ping() -> &'static str {
    "pong"
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", &url])
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
fn list_connections() -> Result<Vec<SavedConnection>, String> {
    storage::list()
}

#[tauri::command]
fn save_connection(connection: SavedConnection) -> Result<SavedConnection, String> {
    storage::save(connection)
}

#[tauri::command]
fn delete_connection(id: String) -> Result<(), String> {
    storage::delete(&id)
}

#[tauri::command]
async fn ssh_connect(
    app: AppHandle,
    manager: State<'_, SessionManager>,
    config: SessionConfig,
) -> Result<String, String> {
    eprintln!("[ssh_connect] Connecting to {}:{} as {}", config.host, config.port, config.username);
    let mgr = manager.inner().clone();
    tokio::task::spawn_blocking(move || ssh::connect_ssh(app, &mgr, config))
        .await
        .map_err(|e| format!("Task failed: {}", e))?
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
fn ssh_resize_pty(
    manager: State<SessionManager>,
    session_id: String,
    cols: u32,
    rows: u32,
) -> Result<(), String> {
    ssh::resize_pty(&manager, &session_id, cols, rows)
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
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            app.manage(session_manager);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ping,
            open_url,
            list_connections,
            save_connection,
            delete_connection,
            ssh_connect,
            ssh_disconnect,
            ssh_write,
            ssh_resize_pty,
            local_list_dir,
            sftp_list_dir,
            sftp_download,
            sftp_upload,
            sftp_cancel_transfer,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
