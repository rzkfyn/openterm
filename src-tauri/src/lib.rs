pub mod local_fs;
pub mod models;
pub mod session;
pub mod sftp;
pub mod ssh;
pub mod storage;
pub mod totp;
pub mod vault;

use models::{PaginatedEntries, SessionConfig};
use session::SessionManager;
use storage::SavedConnection;
use tauri::{AppHandle, Manager, State};
use totp::{TotpConfig, TotpSetupInfo};
use vault::{VaultState, VaultStatus};

#[tauri::command]
fn ping() -> &'static str {
    "pong"
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("Only http and https URLs are allowed".to_string());
    }
    if url.chars().any(|c| c.is_control() || c == '"' || c == '\'' || c == '`') {
        return Err("URL contains invalid characters".to_string());
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", &url])
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
fn list_connections(vault_state: State<VaultState>) -> Result<Vec<SavedConnection>, String> {
    vault::list_vault_connections(&vault_state)
}

#[tauri::command]
fn save_connection(
    vault_state: State<VaultState>,
    connection: SavedConnection,
) -> Result<SavedConnection, String> {
    vault::save_vault_connection(&vault_state, connection)
}

#[tauri::command]
fn delete_connection(vault_state: State<VaultState>, id: String) -> Result<(), String> {
    vault::delete_vault_connection(&vault_state, &id)
}

#[tauri::command]
fn vault_get_status(vault_state: State<VaultState>) -> Result<VaultStatus, String> {
    vault::get_status(&vault_state)
}

#[tauri::command]
fn vault_unlock(
    vault_state: State<VaultState>,
    master_password: String,
) -> Result<Vec<SavedConnection>, String> {
    vault::unlock_vault(&vault_state, &master_password)
}

#[tauri::command]
fn vault_lock(vault_state: State<VaultState>) -> Result<(), String> {
    vault::lock_vault(&vault_state)
}

#[tauri::command]
fn vault_set_password(
    vault_state: State<VaultState>,
    old_password: Option<String>,
    new_password: String,
) -> Result<String, String> {
    vault::set_master_password(
        &vault_state,
        old_password.as_deref(),
        &new_password,
    )
}

#[tauri::command]
fn vault_recover(
    vault_state: State<VaultState>,
    recovery_key: String,
    totp_code: Option<String>,
    new_password: String,
) -> Result<String, String> {
    vault::recover_vault(
        &vault_state,
        &recovery_key,
        totp_code.as_deref(),
        &new_password,
    )
}

#[tauri::command]
fn vault_remove_password(
    vault_state: State<VaultState>,
    current_password: String,
) -> Result<(), String> {
    vault::remove_master_password(&vault_state, &current_password)
}

#[tauri::command]
fn totp_get_config() -> TotpConfig {
    totp::get_config()
}

#[tauri::command]
fn totp_generate_secret() -> TotpSetupInfo {
    totp::generate_new_totp_secret()
}

#[tauri::command]
fn totp_update_idle_timeout(mins: u32) -> Result<(), String> {
    totp::update_idle_timeout(mins)
}

#[tauri::command]
fn totp_enable(secret: String, code: String) -> Result<Vec<String>, String> {
    totp::enable_totp(&secret, &code)
}

#[tauri::command]
fn totp_disable(code_or_backup: String) -> Result<(), String> {
    totp::disable_totp(&code_or_backup)
}

#[tauri::command]
fn totp_validate_login(code_or_backup: String) -> Result<bool, String> {
    totp::validate_login_code(&code_or_backup)
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

#[tauri::command]
fn local_stat(path: String) -> models::FileStatInfo {
    local_fs::stat_local_path(&path)
}

#[tauri::command]
fn sftp_stat(
    manager: State<SessionManager>,
    session_id: String,
    path: String,
) -> Result<models::FileStatInfo, String> {
    sftp::stat_sftp_path(&manager, &session_id, &path)
}

#[tauri::command]
fn local_remove(path: String, is_dir: bool) -> Result<(), String> {
    local_fs::remove_local_path(&path, is_dir)
}

#[tauri::command]
fn local_rename(old_path: String, new_path: String) -> Result<(), String> {
    local_fs::rename_local_path(&old_path, &new_path)
}

#[tauri::command]
fn local_mkdir(path: String) -> Result<(), String> {
    local_fs::create_local_dir(&path)
}

#[tauri::command]
fn local_touch(path: String) -> Result<(), String> {
    local_fs::create_local_file(&path)
}

#[tauri::command]
fn sftp_remove(
    manager: State<SessionManager>,
    session_id: String,
    path: String,
    is_dir: bool,
) -> Result<(), String> {
    sftp::remove_sftp_path(&manager, &session_id, &path, is_dir)
}

#[tauri::command]
fn sftp_rename(
    manager: State<SessionManager>,
    session_id: String,
    old_path: String,
    new_path: String,
) -> Result<(), String> {
    sftp::rename_sftp_path(&manager, &session_id, &old_path, &new_path)
}

#[tauri::command]
fn sftp_mkdir(
    manager: State<SessionManager>,
    session_id: String,
    path: String,
) -> Result<(), String> {
    sftp::mkdir_sftp(&manager, &session_id, &path)
}

#[tauri::command]
fn sftp_touch(
    manager: State<SessionManager>,
    session_id: String,
    path: String,
) -> Result<(), String> {
    sftp::touch_sftp(&manager, &session_id, &path)
}

#[tauri::command]
fn sftp_chmod(
    manager: State<SessionManager>,
    session_id: String,
    path: String,
    mode: u32,
) -> Result<(), String> {
    sftp::chmod_sftp(&manager, &session_id, &path, mode)
}

#[tauri::command]
fn sftp_read_text_file(
    manager: State<SessionManager>,
    session_id: String,
    path: String,
    max_bytes: Option<usize>,
) -> Result<String, String> {
    let limit = max_bytes.unwrap_or(2 * 1024 * 1024); // default 2MB
    sftp::read_sftp_text_file(&manager, &session_id, &path, limit)
}

#[tauri::command]
fn sftp_write_text_file(
    manager: State<SessionManager>,
    session_id: String,
    path: String,
    content: String,
) -> Result<(), String> {
    sftp::write_sftp_text_file(&manager, &session_id, &path, &content)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let session_manager = SessionManager::new();
    let vault_state = VaultState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(move |app| {
            app.manage(session_manager);
            app.manage(vault_state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ping,
            open_url,
            list_connections,
            save_connection,
            delete_connection,
            vault_get_status,
            vault_unlock,
            vault_lock,
            vault_set_password,
            vault_recover,
            vault_remove_password,
            totp_get_config,
            totp_generate_secret,
            totp_update_idle_timeout,
            totp_enable,
            totp_disable,
            totp_validate_login,
            ssh_connect,
            ssh_disconnect,
            ssh_write,
            ssh_resize_pty,
            local_list_dir,
            sftp_list_dir,
            sftp_download,
            sftp_upload,
            sftp_cancel_transfer,
            local_remove,
            local_rename,
            local_mkdir,
            local_touch,
            local_stat,
            sftp_stat,
            sftp_remove,
            sftp_rename,
            sftp_mkdir,
            sftp_touch,
            sftp_chmod,
            sftp_read_text_file,
            sftp_write_text_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
