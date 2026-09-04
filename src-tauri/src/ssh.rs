use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use parking_lot::Mutex;
use ssh2::Session;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc::unbounded_channel;
use uuid::Uuid;

use crate::models::{AuthType, SessionConfig};
use crate::session::{ActiveSession, SessionManager};

pub fn connect_ssh(
    app: AppHandle,
    manager: &SessionManager,
    config: SessionConfig,
) -> Result<String, String> {
    let session_id = config
        .id
        .clone()
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    let addr = format!("{}:{}", config.host, config.port);

    // 1. Establish TCP Stream with 10s timeout
    let tcp = TcpStream::connect_timeout(
        &addr
            .parse()
            .or_else(|_| {
                use std::net::ToSocketAddrs;
                addr.to_socket_addrs()?
                    .next()
                    .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "Host not found"))
            })
            .map_err(|e| format!("Failed to resolve or parse address {}: {}", addr, e))?,
        Duration::from_secs(10),
    )
    .map_err(|e| format!("Failed to connect to {}: {}", addr, e))?;

    tcp.set_nodelay(true).ok();

    // 2. Init SSH Session
    let mut sess = Session::new().map_err(|e| format!("Failed to init SSH session: {}", e))?;
    sess.set_tcp_stream(tcp);
    sess.handshake()
        .map_err(|e| format!("SSH handshake failed: {}", e))?;

    // 3. Authenticate
    match config.auth_type {
        AuthType::Password => {
            let pass = config
                .password
                .as_deref()
                .ok_or_else(|| "Password is required for password authentication".to_string())?;
            sess.userauth_password(&config.username, pass)
                .map_err(|e| format!("Password authentication failed: {}", e))?;
        }
        AuthType::Key => {
            let key_path_str = config
                .private_key_path
                .as_deref()
                .ok_or_else(|| "Private key path is required".to_string())?;
            let key_path = Path::new(key_path_str);
            if !key_path.exists() {
                return Err(format!("Private key does not exist at: {}", key_path_str));
            }
            sess.userauth_pubkey_file(
                &config.username,
                None,
                key_path,
                config.passphrase.as_deref(),
            )
            .map_err(|e| format!("Public key authentication failed: {}", e))?;
        }
    }

    if !sess.authenticated() {
        return Err("Authentication failed: invalid credentials".to_string());
    }

    // 4. Open Interactive PTY Channel
    let mut channel = sess
        .channel_session()
        .map_err(|e| format!("Failed to open session channel: {}", e))?;

    channel
        .request_pty("xterm-256color", None, Some((80, 24, 0, 0)))
        .map_err(|e| format!("Failed to request PTY: {}", e))?;

    channel
        .shell()
        .map_err(|e| format!("Failed to start shell: {}", e))?;

    let is_alive = Arc::new(AtomicBool::new(true));
    let is_alive_reader = is_alive.clone();
    let is_alive_writer = is_alive.clone();

    let (write_tx, mut write_rx) = unbounded_channel::<Vec<u8>>();
    let sess_arc = Arc::new(Mutex::new(sess));

    // Shared thread-safe channel reference for reading & writing
    let channel_arc = Arc::new(Mutex::new(channel));
    let channel_reader = channel_arc.clone();
    let channel_writer = channel_arc.clone();

    // 5. Spawn PTY Reader Thread -> Tauri Event Emitter
    let app_reader = app.clone();
    let s_id_reader = session_id.clone();
    thread::spawn(move || {
        let mut buf = [0u8; 8192];
        let event_name = format!("ssh:data:{}", s_id_reader);
        let closed_event = format!("ssh:closed:{}", s_id_reader);

        while is_alive_reader.load(Ordering::SeqCst) {
            let read_result = {
                let mut ch = channel_reader.lock();
                ch.read(&mut buf)
            };

            match read_result {
                Ok(0) => {
                    // EOF reached
                    break;
                }
                Ok(n) => {
                    // Emit raw text or lossy UTF-8
                    let chunk = String::from_utf8_lossy(&buf[..n]).to_string();
                    if let Err(e) = app_reader.emit(&event_name, chunk) {
                        eprintln!("Failed to emit SSH data event: {}", e);
                        break;
                    }
                }
                Err(e) => {
                    // WouldBlock might happen if nonblocking, but in blocking mode it's an error/disconnect
                    if e.kind() != std::io::ErrorKind::WouldBlock {
                        eprintln!("SSH read error: {}", e);
                        break;
                    }
                    thread::sleep(Duration::from_millis(10));
                }
            }
        }

        is_alive_reader.store(false, Ordering::SeqCst);
        let _ = app_reader.emit(&closed_event, ());
    });

    // 6. Spawn PTY Writer Thread
    thread::spawn(move || {
        while is_alive_writer.load(Ordering::SeqCst) {
            if let Some(bytes) = write_rx.blocking_recv() {
                let mut ch = channel_writer.lock();
                if let Err(e) = ch.write_all(&bytes) {
                    eprintln!("SSH write error: {}", e);
                    break;
                }
                let _ = ch.flush();
            } else {
                break;
            }
        }
        is_alive_writer.store(false, Ordering::SeqCst);
    });

    // 7. Store Active Session in Manager
    let active_session = ActiveSession {
        id: session_id.clone(),
        name: config.name,
        session: sess_arc,
        pty_write_tx: Some(write_tx),
        is_alive,
    };

    manager.insert_session(active_session);

    Ok(session_id)
}

pub fn write_ssh(manager: &SessionManager, session_id: &str, data: &[u8]) -> Result<(), String> {
    let session = manager
        .get_session(session_id)
        .ok_or_else(|| format!("Session {} not found", session_id))?;

    if let Some(ref tx) = session.pty_write_tx {
        tx.send(data.to_vec())
            .map_err(|e| format!("Failed to send data to PTY writer: {}", e))?;
        Ok(())
    } else {
        Err("No active PTY writer channel for this session".to_string())
    }
}

pub fn disconnect_ssh(manager: &SessionManager, session_id: &str) -> Result<(), String> {
    if let Some(session) = manager.remove_session(session_id) {
        session.is_alive.store(false, Ordering::SeqCst);
        let sess_lock = session.session.lock();
        let _ = sess_lock.disconnect(None, "User disconnected", None);
        Ok(())
    } else {
        Err(format!("Session {} not found", session_id))
    }
}
