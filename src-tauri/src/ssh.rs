use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use parking_lot::Mutex;
use ssh2::{CheckResult, KnownHostFileKind, Session};
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc::unbounded_channel;
use uuid::Uuid;

use crate::models::{AuthType, SessionConfig};
use crate::session::{ActiveSession, SessionManager};

/// Resolve an existing public key associated with a private key path if available.
/// Checks `<path>.pub` (direct append, e.g. `id_ed25519` -> `id_ed25519.pub`)
/// and extension replacement if an extension exists (e.g. `id_rsa.pem` -> `id_rsa.pub`).
fn resolve_public_key_path(priv_path: &Path) -> Option<PathBuf> {
    let pub_direct = PathBuf::from(format!("{}.pub", priv_path.display()));
    if pub_direct.is_file() {
        return Some(pub_direct);
    }
    if priv_path.extension().is_some() {
        let pub_ext = priv_path.with_extension("pub");
        if pub_ext.is_file() {
            return Some(pub_ext);
        }
    }
    None
}

/// Authenticate an SSH session using public key.
/// Supports PuTTY (.ppk v2/v3), OpenSSH format, and traditional OpenSSL PEM keys.
fn authenticate_pubkey(
    sess: &Session,
    username: &str,
    key_path: &Path,
    passphrase: Option<&str>,
) -> Result<(), String> {
    // 1. Read key file content
    let content = std::fs::read_to_string(key_path)
        .map_err(|e| format!("Failed to read private key file '{}': {}", key_path.display(), e))?;

    let trimmed = content.trim_start();

    // Strategy 1: PuTTY PPK format (.ppk, PuTTY-User-Key-File-2 or 3)
    if trimmed.starts_with("PuTTY-User-Key-File") {
        let priv_key = ssh_key::PrivateKey::from_ppk(
            &content,
            passphrase.filter(|s| !s.is_empty()).map(str::to_string),
        )
        .map_err(|e| {
            let err_str = e.to_string();
            if err_str.contains("MAC") || err_str.contains("password") || err_str.contains("passphrase") {
                "Passphrase incorrect or missing for encrypted PuTTY (.ppk) key".to_string()
            } else {
                format!("Failed to parse PuTTY (.ppk) key: {}", e)
            }
        })?;

        let openssh_priv = priv_key
            .to_openssh(ssh_key::LineEnding::LF)
            .map_err(|e| format!("Failed to export private key from PPK: {}", e))?;
        let openssh_pub = priv_key
            .public_key()
            .to_openssh()
            .map_err(|e| format!("Failed to export public key from PPK: {}", e))?;

        return sess
            .userauth_pubkey_memory(username, Some(&openssh_pub), &openssh_priv, None)
            .map_err(|e| format!("Public key authentication failed with PPK: {}", e));
    }

    // Strategy 2: Modern OpenSSH format (-----BEGIN OPENSSH PRIVATE KEY-----)
    if trimmed.contains("BEGIN OPENSSH PRIVATE KEY") {
        let priv_key = match ssh_key::PrivateKey::from_openssh(&content) {
            Ok(key) => {
                if key.is_encrypted() {
                    let pass = passphrase.unwrap_or("");
                    key.decrypt(pass).map_err(|e| {
                        format!("Passphrase incorrect or decryption failed for OpenSSH key: {}", e)
                    })?
                } else {
                    key
                }
            }
            Err(_) => {
                // If direct parse failed, let libssh2 fallback try
                return sess
                    .userauth_pubkey_file(
                        username,
                        resolve_public_key_path(key_path).as_deref(),
                        key_path,
                        passphrase,
                    )
                    .map_err(|e| format!("Public key authentication failed: {}", e));
            }
        };

        let openssh_priv = priv_key
            .to_openssh(ssh_key::LineEnding::LF)
            .map_err(|e| format!("Failed to export OpenSSH private key: {}", e))?;
        let openssh_pub = priv_key
            .public_key()
            .to_openssh()
            .map_err(|e| format!("Failed to export OpenSSH public key: {}", e))?;

        // Attempt in-memory auth first
        if let Ok(()) = sess.userauth_pubkey_memory(username, Some(&openssh_pub), &openssh_priv, None) {
            return Ok(());
        }
    }

    // Strategy 3: Standard OpenSSL PEM / PKCS#8 file auth with companion .pub if exists
    let pub_key = resolve_public_key_path(key_path);
    if let Ok(()) = sess.userauth_pubkey_file(username, pub_key.as_deref(), key_path, passphrase) {
        return Ok(());
    }

    // Strategy 4: Direct in-memory raw fallback
    let pub_content = pub_key.and_then(|p| std::fs::read_to_string(p).ok());
    sess.userauth_pubkey_memory(username, pub_content.as_deref(), &content, passphrase)
        .map_err(|e| format!("Public key authentication failed: {}", e))
}

/// Verify SSH host key against known_hosts (prevents MITM)
fn verify_host_key(sess: &Session, host: &str, port: u16) -> Result<(), String> {
    let mut known_hosts = sess
        .known_hosts()
        .map_err(|e| format!("Failed to initialize known hosts: {}", e))?;

    let known_hosts_path = dirs::home_dir().map(|h| h.join(".ssh").join("known_hosts"));

    if let Some(ref path) = known_hosts_path {
        if path.exists() {
            let _ = known_hosts.read_file(path, KnownHostFileKind::OpenSSH);
        }
    }

    let (key, key_type) = sess
        .host_key()
        .ok_or_else(|| "Failed to get remote host key".to_string())?;

    match known_hosts.check_port(host, port, key) {
        CheckResult::Match => Ok(()),
        CheckResult::NotFound => {
            let host_entry = if port == 22 {
                host.to_string()
            } else {
                format!("[{}]:{}", host, port)
            };
            let _ = known_hosts.add(
                &host_entry,
                key,
                &format!("OpenTerm host key for {}:{}", host, port),
                key_type.into(),
            );
            if let Some(ref path) = known_hosts_path {
                if let Some(parent) = path.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }
                let _ = known_hosts.write_file(path, KnownHostFileKind::OpenSSH);
            }
            Ok(())
        }
        CheckResult::Mismatch => Err(format!(
            "Host key verification failed for {}:{}. Remote host identification has changed! Possible man-in-the-middle attack.",
            host, port
        )),
        CheckResult::Failure => Err(format!(
            "Host key check error for {}:{}",
            host, port
        )),
    }
}

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

    // Host key verification (MITM protection)
    verify_host_key(&sess, &config.host, config.port)?;

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
            authenticate_pubkey(
                &sess,
                &config.username,
                key_path,
                config.passphrase.as_deref(),
            )?;
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

    // Enable TCP/SSH keepalive: send probe every 15 seconds
    sess.set_keepalive(true, 15);

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
                    let _ = app_reader.emit(&event_name, chunk);
                }
                Err(e) => {
                    if e.kind() == std::io::ErrorKind::WouldBlock
                        || e.kind() == std::io::ErrorKind::Interrupted
                        || e.kind() == std::io::ErrorKind::TimedOut
                    {
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
        while is_alive_writer.load(Ordering::SeqCst) {
            if let Some(bytes) = write_rx.blocking_recv() {
                let mut chunk = bytes;
                // Coalesce any already-queued writes to minimize per-packet overhead during key repeats
                while let Ok(more) = write_rx.try_recv() {
                    chunk.extend_from_slice(&more);
                }

                let mut written = 0;
                while written < chunk.len() && is_alive_writer.load(Ordering::SeqCst) {
                    let write_res = {
                        let mut ch = channel_writer.lock();
                        ch.write(&chunk[written..])
                    };
                    match write_res {
                        Ok(n) if n > 0 => {
                            written += n;
                        }
                        Ok(_) => {
                            thread::sleep(Duration::from_millis(5));
                        }
                        Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                            thread::sleep(Duration::from_millis(5));
                        }
                        Err(e) => {
                            eprintln!("[PTY Writer] SSH write error: {}", e);
                            break;
                        }
                    }
                }
                // NOTE: Do NOT call ch.flush() here. In ssh2 / libssh2, channel.flush()
                // invokes libssh2_channel_flush_ex, which discards incoming unread data
                // packets and corrupts the receive window, causing remote drops during rapid input.
            } else {
                break;
            }
        }
        is_alive_writer.store(false, Ordering::SeqCst);
    });

    // 7. Spawn Keepalive Heartbeat Thread (15s interval)
    let sess_keepalive = sess_arc.clone();
    let is_alive_keepalive = is_alive.clone();
    thread::spawn(move || {
        while is_alive_keepalive.load(Ordering::SeqCst) {
            thread::sleep(Duration::from_secs(15));
            if !is_alive_keepalive.load(Ordering::SeqCst) {
                break;
            }
            let s = sess_keepalive.lock();
            let _ = s.keepalive_send();
        }
    });

    // Helper to connect an isolated SSH session for SFTP
    let (sftp_sess_opt, sftp_init_error) = match (|| -> Result<(Session, ssh2::Sftp), String> {
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
        verify_host_key(&sftp_sess, &config.host, config.port)?;

        match config.auth_type {
            AuthType::Password => {
                let pass = config.password.as_deref().unwrap_or("");
                sftp_sess.userauth_password(&config.username, pass)
                    .map_err(|e| format!("{}", e))?;
            }
            AuthType::Key => {
                let key_path_str = config.private_key_path.as_deref().unwrap_or("");
                let key_path = Path::new(key_path_str);
                authenticate_pubkey(
                    &sftp_sess,
                    &config.username,
                    key_path,
                    config.passphrase.as_deref(),
                )?;
            }
        }

        let sftp_handle = sftp_sess.sftp().map_err(|e| format!("{}", e))?;
        Ok((sftp_sess, sftp_handle))
    })() {
        Ok((s, sftp)) => (Some((Arc::new(Mutex::new(s)), Arc::new(Mutex::new(sftp)))), None),
        Err(e) => {
            eprintln!("[OpenTerm] SFTP initialization skipped/failed: {}", e);
            (None, Some(e))
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
        channel: channel_arc,
        sftp_session,
        sftp,
        sftp_error: sftp_init_error,
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

pub fn resize_pty(manager: &SessionManager, session_id: &str, cols: u32, rows: u32) -> Result<(), String> {
    let active = manager
        .get_session(session_id)
        .ok_or_else(|| format!("Session {} not found", session_id))?;

    let sess = active.session.lock();
    sess.set_blocking(true);
    let mut ch = active.channel.lock();
    let res = ch.request_pty_size(cols, rows, None, None)
        .map_err(|e| format!("PTY resize failed: {}", e));
    sess.set_blocking(false);
    res
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_resolve_public_key_path_direct_pub() {
        let temp_dir = std::env::temp_dir().join("openterm_key_test_direct");
        let _ = fs::create_dir_all(&temp_dir);
        let priv_key = temp_dir.join("id_ed25519");
        let pub_key = temp_dir.join("id_ed25519.pub");
        fs::write(&priv_key, "private").unwrap();
        fs::write(&pub_key, "public").unwrap();

        let resolved = resolve_public_key_path(&priv_key);
        assert_eq!(resolved, Some(pub_key));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_resolve_public_key_path_with_extension() {
        let temp_dir = std::env::temp_dir().join("openterm_key_test_ext");
        let _ = fs::create_dir_all(&temp_dir);
        let priv_key = temp_dir.join("server.pem");
        let pub_key = temp_dir.join("server.pub");
        fs::write(&priv_key, "private").unwrap();
        fs::write(&pub_key, "public").unwrap();

        let resolved = resolve_public_key_path(&priv_key);
        assert_eq!(resolved, Some(pub_key));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_resolve_public_key_path_nonexistent() {
        let temp_dir = std::env::temp_dir().join("openterm_key_test_none");
        let _ = fs::create_dir_all(&temp_dir);
        let priv_key = temp_dir.join("id_rsa");
        fs::write(&priv_key, "private").unwrap();

        let resolved = resolve_public_key_path(&priv_key);
        assert_eq!(resolved, None);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_parse_ppk_format_error() {
        let fake_ppk = "PuTTY-User-Key-File-3: ssh-ed25519\nEncryption: none\nComment: test\nPublic-Lines: 0\nPrivate-Lines: 0\n";
        let res = ssh_key::PrivateKey::from_ppk(fake_ppk, None);
        assert!(res.is_err());
    }

    #[test]
    fn test_openssh_key_load_and_to_memory() {
        use ssh_key::PrivateKey;
        use ssh_key::LineEnding;

        // Test unencrypted OpenSSH format key
        let openssh_content = "-----BEGIN OPENSSH PRIVATE KEY-----\n\
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW\n\
QyNTUxOQAAACBObuKoQh6rEKnx66+X4usXRXg5BHsRWpPj8MeXch8DUAAAAIgy3urLMt7q\n\
ywAAAAtzc2gtZWQyNTUxOQAAACBObuKoQh6rEKnx66+X4usXRXg5BHsRWpPj8MeXch8DUA\n\
AAAEAx2y59MX8iKVKTcrHPw7iXImOJF278X18G1Tin57uHNk5u4qhCHqsQqfHrr5fi6xdF\n\
eDkEexFak+Pwx5dyHwNQAAAABHRlc3QB\n\
-----END OPENSSH PRIVATE KEY-----\n";

        let priv_key = PrivateKey::from_openssh(openssh_content).unwrap();
        let pub_str = priv_key.public_key().to_openssh().unwrap();
        let priv_str = priv_key.to_openssh(LineEnding::LF).unwrap();

        assert!(pub_str.starts_with("ssh-ed25519 "));
        assert!(priv_str.starts_with("-----BEGIN OPENSSH PRIVATE KEY-----"));
    }


}
