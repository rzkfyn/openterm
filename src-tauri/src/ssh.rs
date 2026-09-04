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

    // Switch PTY channel to non-blocking so read() doesn't hang the thread/session
    sess.set_blocking(false);

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

        eprintln!("[PTY Reader] Thread started for session {}", s_id_reader);

        while is_alive_reader.load(Ordering::SeqCst) {
            let read_result = {
                let mut ch = channel_reader.lock();
                ch.read(&mut buf)
            };

            match read_result {
                Ok(0) => {
                    let is_eof = {
                        let ch = channel_reader.lock();
                        ch.eof()
                    };
                    if is_eof {
                        eprintln!("[OpenTerm] Remote channel reported EOF");
                        break;
                    }
                    thread::sleep(Duration::from_millis(15));
                }
                Ok(n) => {
                    let chunk = String::from_utf8_lossy(&buf[..n]).to_string();
                    eprintln!("[PTY Reader] Emitting {} bytes to {}", n, event_name);
                    let _ = app_reader.emit(&event_name, chunk);
                }
                Err(e) => {
                    if e.kind() == std::io::ErrorKind::WouldBlock {
                        thread::sleep(Duration::from_millis(15));
                    } else {
                        eprintln!("[OpenTerm] SSH read error: {}", e);
                        break;
                    }
                }
            }
        }

        is_alive_reader.store(false, Ordering::SeqCst);
        let _ = app_reader.emit(&closed_event, ());
        eprintln!("[PTY Reader] Thread finished for session {}", s_id_reader);
    });

    // 6. Spawn PTY Writer Thread
    thread::spawn(move || {
        eprintln!("[PTY Writer] Thread started for session");
        while is_alive_writer.load(Ordering::SeqCst) {
            if let Some(bytes) = write_rx.blocking_recv() {
                eprintln!("[PTY Writer] Received {} bytes to write to channel", bytes.len());
                let mut written = 0;
                while written < bytes.len() && is_alive_writer.load(Ordering::SeqCst) {
                    let write_res = {
                        let mut ch = channel_writer.lock();
                        ch.write(&bytes[written..])
                    };
                    match write_res {
                        Ok(n) if n > 0 => {
                            written += n;
                            eprintln!("[PTY Writer] Successfully wrote {} bytes", n);
                        }
                        Ok(_) => {
                            thread::sleep(Duration::from_millis(10));
                        }
                        Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                            thread::sleep(Duration::from_millis(10));
                        }
                        Err(e) => {
                            eprintln!("[PTY Writer] SSH write error: {}", e);
                            break;
                        }
                    }
                }
                let mut ch = channel_writer.lock();
                let _ = ch.flush();
            } else {
                break;
            }
        }
        is_alive_writer.store(false, Ordering::SeqCst);
        eprintln!("[PTY Writer] Thread finished");
    });

    // Helper to connect an isolated SSH session for SFTP
    let sftp_sess_opt = match (|| -> Result<(Session, ssh2::Sftp), String> {
        let sftp_tcp = TcpStream::connect_timeout(
            &addr
                .parse()
                .or_else(|_| {
                    use std::net::ToSocketAddrs;
                    addr.to_socket_addrs()?
                        .next()
                        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "Host not found"))
                })
                .map_err(|e| format!("{}", e))?,
            Duration::from_secs(10),
        )
        .map_err(|e| format!("{}", e))?;

        sftp_tcp.set_nodelay(true).ok();

        let mut sftp_sess = Session::new().map_err(|e| format!("{}", e))?;
        sftp_sess.set_tcp_stream(sftp_tcp);
        sftp_sess.handshake().map_err(|e| format!("{}", e))?;

        match config.auth_type {
            AuthType::Password => {
                let pass = config.password.as_deref().unwrap_or("");
                sftp_sess.userauth_password(&config.username, pass)
                    .map_err(|e| format!("{}", e))?;
            }
            AuthType::Key => {
                let key_path_str = config.private_key_path.as_deref().unwrap_or("");
                let key_path = Path::new(key_path_str);
                sftp_sess.userauth_pubkey_file(
                    &config.username,
                    None,
                    key_path,
                    config.passphrase.as_deref(),
                )
                .map_err(|e| format!("{}", e))?;
            }
        }

        let sftp_handle = sftp_sess.sftp().map_err(|e| format!("{}", e))?;
        Ok((sftp_sess, sftp_handle))
    })() {
        Ok((s, sftp)) => Some((Arc::new(Mutex::new(s)), Arc::new(Mutex::new(sftp)))),
        Err(e) => {
            eprintln!("[OpenTerm] SFTP initialization skipped/failed: {}", e);
            None
        }
    };

    let (sftp_session, sftp) = match sftp_sess_opt {
        Some((s, sftp)) => (Some(s), Some(sftp)),
        None => (None, None),
    };

    // 7. Store Active Session in Manager
    let active_session = ActiveSession {
        id: session_id.clone(),
        name: config.name,
        session: sess_arc,
        sftp_session,
        sftp,
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
        if let Some(ref sftp_sess) = session.sftp_session {
            let sftp_lock = sftp_sess.lock();
            let _ = sftp_lock.disconnect(None, "User disconnected", None);
        }
        Ok(())
    } else {
        Err(format!("Session {} not found", session_id))
    }
}
