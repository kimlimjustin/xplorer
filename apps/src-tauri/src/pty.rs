//! Multi-instance PTY module — each terminal tab gets its own PTY session
//! identified by a unique `session_id`.

use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Mutex;
use tauri::{command, Emitter};
use tracing::warn;

struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    _reader_handle: std::thread::JoinHandle<()>,
    child: Box<dyn portable_pty::Child + Send>,
}

static PTY_SESSIONS: Mutex<Option<HashMap<String, PtySession>>> = Mutex::new(None);

fn sessions() -> std::sync::MutexGuard<'static, Option<HashMap<String, PtySession>>> {
    let mut guard = PTY_SESSIONS.lock().unwrap_or_else(|e| e.into_inner());
    if guard.is_none() {
        *guard = Some(HashMap::new());
    }
    guard
}

#[command]
pub async fn pty_spawn(
    app_handle: tauri::AppHandle,
    session_id: String,
    cwd: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    kill_session(&session_id);

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    let mut cmd = CommandBuilder::new(default_shell());
    cmd.cwd(&cwd);
    cmd.env("TERM", "xterm-256color");

    let child = pair.slave.spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {}", e))?;

    let writer = pair.master.take_writer()
        .map_err(|e| format!("Failed to take PTY writer: {}", e))?;

    let mut reader = pair.master.try_clone_reader()
        .map_err(|e| format!("Failed to clone PTY reader: {}", e))?;

    let handle = app_handle.clone();
    let sid = session_id.clone();
    let reader_handle = std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let payload = serde_json::json!({ "session_id": sid, "data": data });
                    if let Err(e) = handle.emit("pty-output", &payload) {
                        warn!("Failed to emit pty-output: {}", e);
                        break;
                    }
                }
                Err(e) => {
                    let kind = e.kind();
                    if kind == std::io::ErrorKind::Other
                        || kind == std::io::ErrorKind::BrokenPipe
                        || kind == std::io::ErrorKind::UnexpectedEof
                    {
                        break;
                    }
                    warn!("PTY read error ({}): {}", sid, e);
                    break;
                }
            }
        }
        let _ = handle.emit("pty-exit", &sid);
    });

    let mut guard = sessions();
    let map = guard.as_mut().unwrap();
    map.insert(session_id, PtySession {
        master: pair.master,
        writer,
        _reader_handle: reader_handle,
        child,
    });

    Ok(())
}

#[command]
pub fn pty_write(session_id: String, data: String) -> Result<(), String> {
    let mut guard = sessions();
    let map = guard.as_mut().unwrap();
    if let Some(session) = map.get_mut(&session_id) {
        session.writer.write_all(data.as_bytes())
            .map_err(|e| format!("PTY write error: {}", e))?;
        session.writer.flush()
            .map_err(|e| format!("PTY flush error: {}", e))?;
        Ok(())
    } else {
        Err(format!("No PTY session '{}'", session_id))
    }
}

#[command]
pub fn pty_resize(session_id: String, cols: u16, rows: u16) -> Result<(), String> {
    let guard = sessions();
    let map = guard.as_ref().unwrap();
    if let Some(session) = map.get(&session_id) {
        session.master
            .resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
            .map_err(|e| format!("PTY resize error: {}", e))?;
        Ok(())
    } else {
        Err(format!("No PTY session '{}'", session_id))
    }
}

#[command]
pub fn pty_kill(session_id: String) -> Result<(), String> {
    kill_session(&session_id);
    Ok(())
}

#[command]
pub fn pty_kill_all() -> Result<(), String> {
    let mut guard = sessions();
    if let Some(map) = guard.as_mut() {
        for (_, mut session) in map.drain() {
            let _ = session.child.kill();
            drop(session.writer);
        }
    }
    Ok(())
}

fn kill_session(session_id: &str) {
    let mut guard = sessions();
    if let Some(map) = guard.as_mut() {
        if let Some(mut session) = map.remove(session_id) {
            let _ = session.child.kill();
            drop(session.writer);
        }
    }
}

fn default_shell() -> &'static str {
    #[cfg(target_os = "windows")]
    { "cmd.exe" }
    #[cfg(target_os = "macos")]
    { "zsh" }
    #[cfg(target_os = "linux")]
    { "bash" }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    { "sh" }
}
