use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use parking_lot::Mutex;
use ssh2::Session;
use tokio::sync::mpsc::UnboundedSender;

pub struct ActiveSession {
    pub id: String,
    pub name: String,
    pub session: Arc<Mutex<Session>>,
    pub pty_write_tx: Option<UnboundedSender<Vec<u8>>>,
    pub is_alive: Arc<AtomicBool>,
}

#[derive(Default, Clone)]
pub struct SessionManager {
    sessions: Arc<Mutex<HashMap<String, Arc<ActiveSession>>>>,
    transfer_cancel_tokens: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            transfer_cancel_tokens: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn insert_session(&self, session: ActiveSession) {
        let mut map = self.sessions.lock();
        map.insert(session.id.clone(), Arc::new(session));
    }

    pub fn get_session(&self, session_id: &str) -> Option<Arc<ActiveSession>> {
        let map = self.sessions.lock();
        map.get(session_id).cloned()
    }

    pub fn remove_session(&self, session_id: &str) -> Option<Arc<ActiveSession>> {
        let mut map = self.sessions.lock();
        if let Some(sess) = map.remove(session_id) {
            sess.is_alive.store(false, Ordering::SeqCst);
            Some(sess)
        } else {
            None
        }
    }

    pub fn register_transfer(&self, transfer_id: String) -> Arc<AtomicBool> {
        let cancel_flag = Arc::new(AtomicBool::new(false));
        let mut map = self.transfer_cancel_tokens.lock();
        map.insert(transfer_id, cancel_flag.clone());
        cancel_flag
    }

    pub fn cancel_transfer(&self, transfer_id: &str) -> bool {
        let map = self.transfer_cancel_tokens.lock();
        if let Some(flag) = map.get(transfer_id) {
            flag.store(true, Ordering::SeqCst);
            true
        } else {
            false
        }
    }

    pub fn remove_transfer(&self, transfer_id: &str) {
        let mut map = self.transfer_cancel_tokens.lock();
        map.remove(transfer_id);
    }
}
