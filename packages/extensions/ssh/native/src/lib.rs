//! SSH Plugin — Native extension plugin for Xplorer
//!
//! Implements the Xplorer native plugin ABI to provide SSH connection management
//! and SFTP file operations via a compiled shared library (.dll/.so/.dylib).

use std::collections::HashMap;
use std::ffi::{CStr, CString, c_char};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use ssh2::{Session, Sftp};

// ─── Types ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: u64,
    pub file_type: String,
    pub mime_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SSHConnectionState {
    Disconnected,
    Connecting,
    Connected,
    Reconnecting,
    Error(String),
    Authenticating,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SSHErrorType {
    NetworkError(String),
    AuthenticationError(String),
    PermissionError(String),
    FileNotFound(String),
    TimeoutError(String),
    ProtocolError(String),
    UnknownError(String),
}

#[derive(Clone, Serialize, Deserialize)]
pub struct SSHConnectionWithAuth {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: Option<String>,
    pub key_path: Option<String>,
    pub timeout: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SSHConnectionInfo {
    pub id: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub state: SSHConnectionState,
    pub last_connected: Option<u64>,
    pub error_message: Option<String>,
    pub retry_count: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SSHConnectionResult {
    pub success: bool,
    pub message: String,
    pub output: String,
    pub connection_id: Option<String>,
    pub error_type: Option<SSHErrorType>,
    pub retry_suggested: bool,
}

// ─── Connection Pool ───────────────────────────────────────────────────────────

pub struct SSHConnection {
    pub session: Session,
    pub sftp: Option<Sftp>,
    pub state: SSHConnectionState,
    pub last_used: Instant,
    pub connection_info: SSHConnectionWithAuth,
    pub retry_count: u32,
}

#[derive(Clone)]
pub struct SSHConnectionPool {
    connections: Arc<RwLock<HashMap<String, SSHConnection>>>,
}

impl SSHConnectionPool {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn get_connection(&self, connection_id: &str) -> Option<SSHConnectionInfo> {
        let connections = self.connections.read().unwrap();
        connections.get(connection_id).map(|conn| SSHConnectionInfo {
            id: connection_id.to_string(),
            host: conn.connection_info.host.clone(),
            port: conn.connection_info.port,
            username: conn.connection_info.username.clone(),
            state: conn.state.clone(),
            last_connected: Some(conn.last_used.elapsed().as_secs()),
            error_message: match &conn.state {
                SSHConnectionState::Error(msg) => Some(msg.clone()),
                _ => None,
            },
            retry_count: conn.retry_count,
        })
    }

    pub fn add_connection(&self, connection_id: String, connection: SSHConnection) {
        let mut connections = self.connections.write().unwrap();
        connections.insert(connection_id, connection);
    }

    pub fn remove_connection(&self, connection_id: &str) {
        let mut connections = self.connections.write().unwrap();
        connections.remove(connection_id);
    }

    pub fn update_connection_state(&self, connection_id: &str, state: SSHConnectionState) {
        let mut connections = self.connections.write().unwrap();
        if let Some(conn) = connections.get_mut(connection_id) {
            conn.state = state;
            conn.last_used = Instant::now();
        }
    }

    pub fn get_all_connections(&self) -> Vec<SSHConnectionInfo> {
        let connections = self.connections.read().unwrap();
        connections
            .iter()
            .map(|(id, conn)| SSHConnectionInfo {
                id: id.clone(),
                host: conn.connection_info.host.clone(),
                port: conn.connection_info.port,
                username: conn.connection_info.username.clone(),
                state: conn.state.clone(),
                last_connected: Some(conn.last_used.elapsed().as_secs()),
                error_message: match &conn.state {
                    SSHConnectionState::Error(msg) => Some(msg.clone()),
                    _ => None,
                },
                retry_count: conn.retry_count,
            })
            .collect()
    }
}

// ─── Global State ──────────────────────────────────────────────────────────────

lazy_static::lazy_static! {
    static ref SSH_POOL: SSHConnectionPool = SSHConnectionPool::new();
    static ref RUNTIME: RwLock<Option<tokio::runtime::Runtime>> = RwLock::new(None);
    static ref PLUGIN_INFO: CString = CString::new(
        serde_json::json!({
            "id": "ssh",
            "name": "SSH Manager",
            "version": "1.0.0"
        }).to_string()
    ).unwrap();
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

fn classify_ssh_error(error: &ssh2::Error) -> SSHErrorType {
    let error_str = error.to_string().to_lowercase();

    if error_str.contains("authentication")
        || error_str.contains("password")
        || error_str.contains("key")
        || error_str.contains("auth")
    {
        SSHErrorType::AuthenticationError(error.to_string())
    } else if error_str.contains("timeout") || error_str.contains("timed out") {
        SSHErrorType::TimeoutError(error.to_string())
    } else if error_str.contains("permission") || error_str.contains("denied") {
        SSHErrorType::PermissionError(error.to_string())
    } else if error_str.contains("connection")
        || error_str.contains("network")
        || error_str.contains("refused")
        || error_str.contains("unreachable")
    {
        SSHErrorType::NetworkError(error.to_string())
    } else if error_str.contains("protocol")
        || error_str.contains("banner")
        || error_str.contains("channel")
    {
        SSHErrorType::ProtocolError(error.to_string())
    } else if error_str.contains("not found") || error_str.contains("no such") {
        SSHErrorType::FileNotFound(error.to_string())
    } else {
        SSHErrorType::UnknownError(error.to_string())
    }
}

fn should_retry_error(error_type: &SSHErrorType) -> bool {
    match error_type {
        SSHErrorType::NetworkError(_) | SSHErrorType::TimeoutError(_) => true,
        SSHErrorType::AuthenticationError(_) | SSHErrorType::PermissionError(_) => false,
        SSHErrorType::ProtocolError(_) => true,
        SSHErrorType::FileNotFound(_) => false,
        SSHErrorType::UnknownError(_) => true,
    }
}

fn format_error(error_type: &SSHErrorType) -> String {
    match error_type {
        SSHErrorType::NetworkError(msg) => format!("Network error: {}", msg),
        SSHErrorType::AuthenticationError(msg) => format!("Authentication failed: {}", msg),
        SSHErrorType::PermissionError(msg) => format!("Permission denied: {}", msg),
        SSHErrorType::TimeoutError(msg) => format!("Connection timeout: {}", msg),
        SSHErrorType::ProtocolError(msg) => format!("Protocol error: {}", msg),
        SSHErrorType::FileNotFound(msg) => format!("File not found: {}", msg),
        SSHErrorType::UnknownError(msg) => format!("Unknown error: {}", msg),
    }
}

fn generate_connection_id(host: &str, port: u16, username: &str) -> String {
    format!("{}@{}:{}", username, host, port)
}

fn resolve_remote_path(sftp: &Sftp, remote_path: &str) -> Result<PathBuf, SSHErrorType> {
    if remote_path == "~" || remote_path.starts_with("~/") {
        let home = sftp
            .realpath(Path::new("."))
            .map_err(|e| {
                SSHErrorType::ProtocolError(format!(
                    "Failed to resolve remote home directory: {}",
                    e
                ))
            })?;
        if remote_path == "~" {
            return Ok(home);
        } else {
            let rest = &remote_path[2..];
            return Ok(home.join(rest));
        }
    }
    if remote_path.is_empty() {
        return sftp.realpath(Path::new(".")).map_err(|e| {
            SSHErrorType::ProtocolError(format!(
                "Failed to resolve remote current directory: {}",
                e
            ))
        });
    }
    Ok(PathBuf::from(remote_path))
}

fn execute_with_connection<F, R>(connection_id: &str, operation: F) -> Result<R, SSHErrorType>
where
    F: FnOnce(&Session, &Sftp) -> Result<R, SSHErrorType>,
{
    let connections = SSH_POOL.connections.read().unwrap();

    if let Some(conn) = connections.get(connection_id) {
        if matches!(conn.state, SSHConnectionState::Connected) {
            if let Some(ref sftp) = conn.sftp {
                return operation(&conn.session, sftp);
            }
        }
    }

    Err(SSHErrorType::NetworkError(
        "Connection not available".to_string(),
    ))
}

fn get_runtime() -> Result<(), String> {
    let guard = RUNTIME.read().map_err(|e| e.to_string())?;
    if guard.is_none() {
        drop(guard);
        let mut wguard = RUNTIME.write().map_err(|e| e.to_string())?;
        if wguard.is_none() {
            *wguard = Some(
                tokio::runtime::Runtime::new()
                    .map_err(|e| format!("Failed to create tokio runtime: {}", e))?,
            );
        }
    }
    Ok(())
}

fn with_runtime<F, R>(f: F) -> Result<R, String>
where
    F: FnOnce(&tokio::runtime::Runtime) -> R,
{
    let guard = RUNTIME.read().map_err(|e| e.to_string())?;
    match guard.as_ref() {
        Some(rt) => Ok(f(rt)),
        None => Err("Runtime not initialized".to_string()),
    }
}

// ─── Async Connection ──────────────────────────────────────────────────────────

async fn create_authenticated_session(
    connection_info: &SSHConnectionWithAuth,
) -> Result<Session, SSHErrorType> {
    let connect_timeout = Duration::from_secs(connection_info.timeout as u64);

    let tcp_stream = tokio::time::timeout(
        connect_timeout,
        tokio::net::TcpStream::connect(format!(
            "{}:{}",
            connection_info.host, connection_info.port
        )),
    )
    .await
    .map_err(|_| SSHErrorType::TimeoutError("Connection timeout".to_string()))?
    .map_err(|e| {
        SSHErrorType::NetworkError(format!(
            "Failed to connect to {}:{} - {}",
            connection_info.host, connection_info.port, e
        ))
    })?
    .into_std()
    .map_err(|e| SSHErrorType::NetworkError(format!("Failed to convert stream: {}", e)))?;

    let mut session = Session::new()
        .map_err(|e| SSHErrorType::ProtocolError(format!("Failed to create SSH session: {}", e)))?;

    session.set_tcp_stream(tcp_stream);
    session.set_timeout(connection_info.timeout * 1000);

    session
        .handshake()
        .map_err(|e| SSHErrorType::ProtocolError(format!("SSH handshake failed: {}", e)))?;

    if let Some(pwd) = &connection_info.password {
        session
            .userauth_password(&connection_info.username, pwd)
            .map_err(|e| {
                SSHErrorType::AuthenticationError(format!(
                    "Password authentication failed: {}",
                    e
                ))
            })?;
    } else if let Some(key) = &connection_info.key_path {
        session
            .userauth_pubkey_file(&connection_info.username, None, Path::new(key), None)
            .map_err(|e| {
                SSHErrorType::AuthenticationError(format!("Key authentication failed: {}", e))
            })?;
    } else {
        return Err(SSHErrorType::AuthenticationError(
            "No authentication method provided".to_string(),
        ));
    }

    if !session.authenticated() {
        return Err(SSHErrorType::AuthenticationError(
            "Authentication failed".to_string(),
        ));
    }

    Ok(session)
}

async fn get_or_create_connection(
    connection_id: &str,
    connection_info: &SSHConnectionWithAuth,
) -> Result<(), SSHErrorType> {
    if let Some(conn_info) = SSH_POOL.get_connection(connection_id) {
        match conn_info.state {
            SSHConnectionState::Connected => {
                SSH_POOL.update_connection_state(connection_id, SSHConnectionState::Connected);
                return Ok(());
            }
            SSHConnectionState::Error(_) | SSHConnectionState::Disconnected => {
                SSH_POOL.remove_connection(connection_id);
            }
            _ => {}
        }
    }

    SSH_POOL.update_connection_state(connection_id, SSHConnectionState::Connecting);

    let session = create_authenticated_session(connection_info).await?;

    let sftp = session
        .sftp()
        .map_err(|e| SSHErrorType::ProtocolError(format!("Failed to initialize SFTP: {}", e)))?;

    let mut stored_info = connection_info.clone();
    stored_info.password = None;

    let ssh_connection = SSHConnection {
        session,
        sftp: Some(sftp),
        state: SSHConnectionState::Connected,
        last_used: Instant::now(),
        connection_info: stored_info,
        retry_count: 0,
    };

    SSH_POOL.add_connection(connection_id.to_string(), ssh_connection);
    SSH_POOL.update_connection_state(connection_id, SSHConnectionState::Connected);

    Ok(())
}

// ─── Command Handlers ──────────────────────────────────────────────────────────

fn handle_connect(args: serde_json::Value) -> Result<serde_json::Value, String> {
    let connection: SSHConnectionWithAuth =
        serde_json::from_value(args).map_err(|e| format!("Invalid args: {}", e))?;

    let connection_id = generate_connection_id(&connection.host, connection.port, &connection.username);

    let result = with_runtime(|rt| {
        rt.block_on(get_or_create_connection(&connection_id, &connection))
    })?;

    match result {
        Ok(()) => Ok(serde_json::to_value(SSHConnectionResult {
            success: true,
            message: "SSH connection established successfully".to_string(),
            output: String::new(),
            connection_id: Some(connection_id),
            error_type: None,
            retry_suggested: false,
        })
        .unwrap()),
        Err(error_type) => {
            let retry_suggested = should_retry_error(&error_type);
            let message = format_error(&error_type);
            SSH_POOL.update_connection_state(
                &connection_id,
                SSHConnectionState::Error(message.clone()),
            );
            Ok(serde_json::to_value(SSHConnectionResult {
                success: false,
                message,
                output: String::new(),
                connection_id: Some(connection_id),
                error_type: Some(error_type),
                retry_suggested,
            })
            .unwrap())
        }
    }
}

fn handle_disconnect(args: serde_json::Value) -> Result<serde_json::Value, String> {
    let connection_id = args
        .get("connection_id")
        .and_then(|v| v.as_str())
        .ok_or("Missing connection_id")?
        .to_string();

    SSH_POOL.remove_connection(&connection_id);

    Ok(serde_json::to_value(SSHConnectionResult {
        success: true,
        message: "SSH connection closed successfully".to_string(),
        output: String::new(),
        connection_id: Some(connection_id),
        error_type: None,
        retry_suggested: false,
    })
    .unwrap())
}

fn handle_get_all_connections(_args: serde_json::Value) -> Result<serde_json::Value, String> {
    Ok(serde_json::to_value(SSH_POOL.get_all_connections()).unwrap())
}

fn handle_get_connection_state(args: serde_json::Value) -> Result<serde_json::Value, String> {
    let connection_id = args
        .get("connection_id")
        .and_then(|v| v.as_str())
        .ok_or("Missing connection_id")?;

    Ok(serde_json::to_value(SSH_POOL.get_connection(connection_id)).unwrap())
}

fn handle_test_connection(args: serde_json::Value) -> Result<serde_json::Value, String> {
    let host = args.get("host").and_then(|v| v.as_str()).ok_or("Missing host")?.to_string();
    let port = args.get("port").and_then(|v| v.as_u64()).unwrap_or(22) as u16;
    let timeout_secs = args.get("timeout").and_then(|v| v.as_u64()).unwrap_or(10) as u64;

    let result = with_runtime(|rt| {
        rt.block_on(async {
            let connect_timeout = Duration::from_secs(timeout_secs);
            match tokio::time::timeout(
                connect_timeout,
                tokio::net::TcpStream::connect(format!("{}:{}", host, port)),
            )
            .await
            {
                Ok(Ok(stream)) => match stream.into_std() {
                    Ok(std_stream) => {
                        let mut session = match Session::new() {
                            Ok(s) => s,
                            Err(e) => {
                                return SSHConnectionResult {
                                    success: false,
                                    message: format!("Failed to create SSH session: {}", e),
                                    output: String::new(),
                                    connection_id: None,
                                    error_type: Some(SSHErrorType::ProtocolError(e.to_string())),
                                    retry_suggested: false,
                                };
                            }
                        };
                        session.set_tcp_stream(std_stream);
                        session.set_timeout(timeout_secs as u32 * 1000);
                        match session.handshake() {
                            Ok(()) => SSHConnectionResult {
                                success: true,
                                message: "SSH server reachable and handshake completed".to_string(),
                                output: String::new(),
                                connection_id: None,
                                error_type: None,
                                retry_suggested: false,
                            },
                            Err(e) => {
                                let et = classify_ssh_error(&e);
                                SSHConnectionResult {
                                    success: false,
                                    message: format!("SSH handshake failed: {}", e),
                                    output: String::new(),
                                    connection_id: None,
                                    error_type: Some(et.clone()),
                                    retry_suggested: should_retry_error(&et),
                                }
                            }
                        }
                    }
                    Err(e) => SSHConnectionResult {
                        success: false,
                        message: format!("Failed to convert stream: {}", e),
                        output: String::new(),
                        connection_id: None,
                        error_type: Some(SSHErrorType::NetworkError(e.to_string())),
                        retry_suggested: true,
                    },
                },
                Ok(Err(e)) => SSHConnectionResult {
                    success: false,
                    message: format!("Failed to connect to {}:{} - {}", host, port, e),
                    output: String::new(),
                    connection_id: None,
                    error_type: Some(SSHErrorType::NetworkError(e.to_string())),
                    retry_suggested: true,
                },
                Err(_) => SSHConnectionResult {
                    success: false,
                    message: format!(
                        "Connection to {}:{} timed out after {} seconds",
                        host, port, timeout_secs
                    ),
                    output: String::new(),
                    connection_id: None,
                    error_type: Some(SSHErrorType::TimeoutError("Connection timeout".to_string())),
                    retry_suggested: true,
                },
            }
        })
    })?;

    Ok(serde_json::to_value(result).unwrap())
}

fn handle_execute_command(args: serde_json::Value) -> Result<serde_json::Value, String> {
    let connection: SSHConnectionWithAuth = serde_json::from_value(
        args.get("connection")
            .cloned()
            .ok_or("Missing connection")?,
    )
    .map_err(|e| format!("Invalid connection: {}", e))?;
    let command = args
        .get("command")
        .and_then(|v| v.as_str())
        .ok_or("Missing command")?
        .to_string();

    let connection_id = generate_connection_id(&connection.host, connection.port, &connection.username);

    let conn_result = with_runtime(|rt| {
        rt.block_on(get_or_create_connection(&connection_id, &connection))
    })?;

    if let Err(error_type) = conn_result {
        let message = format!("Failed to establish connection: {:?}", error_type);
        return Ok(serde_json::to_value(SSHConnectionResult {
            success: false,
            message,
            output: String::new(),
            connection_id: Some(connection_id),
            error_type: Some(error_type.clone()),
            retry_suggested: should_retry_error(&error_type),
        })
        .unwrap());
    }

    let result = execute_with_connection(&connection_id, |session, _sftp| {
        let mut channel = session
            .channel_session()
            .map_err(|e| SSHErrorType::ProtocolError(format!("Failed to create channel: {}", e)))?;

        channel
            .exec(&command)
            .map_err(|e| SSHErrorType::ProtocolError(format!("Failed to execute command: {}", e)))?;

        let mut output = String::new();
        channel.read_to_string(&mut output).map_err(|e| {
            SSHErrorType::ProtocolError(format!("Failed to read command output: {}", e))
        })?;

        let mut stderr = String::new();
        let _ = channel.stderr().read_to_string(&mut stderr);

        let exit_status = channel.exit_status().map_err(|e| {
            SSHErrorType::ProtocolError(format!("Failed to get exit status: {}", e))
        })?;

        let _ = channel.wait_close();

        Ok((output, stderr, exit_status))
    });

    match result {
        Ok((output, stderr, exit_status)) => Ok(serde_json::to_value(SSHConnectionResult {
            success: exit_status == 0,
            message: if exit_status == 0 {
                "Command executed successfully".to_string()
            } else {
                format!("Command failed with exit code {}: {}", exit_status, stderr)
            },
            output: output.trim().to_string(),
            connection_id: Some(connection_id),
            error_type: None,
            retry_suggested: false,
        })
        .unwrap()),
        Err(error_type) => {
            let message = format_error(&error_type);
            Ok(serde_json::to_value(SSHConnectionResult {
                success: false,
                message,
                output: String::new(),
                connection_id: Some(connection_id),
                error_type: Some(error_type.clone()),
                retry_suggested: should_retry_error(&error_type),
            })
            .unwrap())
        }
    }
}

fn handle_open_terminal(args: serde_json::Value) -> Result<serde_json::Value, String> {
    let host = args.get("host").and_then(|v| v.as_str()).ok_or("Missing host")?.to_string();
    let port = args.get("port").and_then(|v| v.as_u64()).unwrap_or(22) as u16;
    let username = args.get("username").and_then(|v| v.as_str()).ok_or("Missing username")?.to_string();
    let key_path = args.get("key_path").and_then(|v| v.as_str()).map(|s| s.to_string());

    let mut ssh_args = vec!["-p".to_string(), port.to_string()];

    if let Some(key) = key_path {
        ssh_args.push("-i".to_string());
        ssh_args.push(key);
    }

    ssh_args.push(format!("{}@{}", username, host));
    let ssh_command = format!("ssh {}", ssh_args.join(" "));

    #[cfg(target_os = "windows")]
    {
        let mut cmd = Command::new("powershell");
        cmd.args(&[
            "-Command",
            &format!(
                "Start-Process powershell -ArgumentList '-NoExit', '-Command', '{}'",
                ssh_command
            ),
        ]);
        cmd.output()
            .map_err(|e| format!("Failed to open SSH terminal: {}", e))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        let mut cmd = Command::new("sh");
        cmd.args(&["-c", &format!("gnome-terminal -- {}", ssh_command)]);
        if cmd.spawn().is_err() {
            let mut cmd = Command::new("xterm");
            cmd.args(&["-e", &ssh_command]);
            cmd.spawn()
                .map_err(|e| format!("Failed to open SSH terminal: {}", e))?;
        }
    }

    Ok(serde_json::json!({ "success": true }))
}

fn handle_check_availability(_args: serde_json::Value) -> Result<serde_json::Value, String> {
    match Command::new("ssh").arg("-V").output() {
        Ok(output) => {
            let version_info = String::from_utf8_lossy(&output.stderr);
            Ok(serde_json::json!(version_info.to_lowercase().contains("openssh")))
        }
        Err(_) => Ok(serde_json::json!(false)),
    }
}

fn handle_get_config_hosts(_args: serde_json::Value) -> Result<serde_json::Value, String> {
    let mut hosts = Vec::new();

    if let Some(home_dir) = dirs::home_dir() {
        let ssh_config_path = home_dir.join(".ssh").join("config");
        if ssh_config_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&ssh_config_path) {
                for line in content.lines() {
                    let trimmed = line.trim();
                    if trimmed.starts_with("Host ") && !trimmed.contains('*') {
                        if let Some(host_name) = trimmed.strip_prefix("Host ") {
                            hosts.push(host_name.trim().to_string());
                        }
                    }
                }
            }
        }
    }

    Ok(serde_json::to_value(hosts).unwrap())
}

fn handle_read_directory(args: serde_json::Value) -> Result<serde_json::Value, String> {
    let host = args.get("host").and_then(|v| v.as_str()).ok_or("Missing host")?.to_string();
    let port = args.get("port").and_then(|v| v.as_u64()).unwrap_or(22) as u16;
    let username = args.get("username").and_then(|v| v.as_str()).ok_or("Missing username")?.to_string();
    let remote_path = args.get("remote_path").and_then(|v| v.as_str()).ok_or("Missing remote_path")?.to_string();
    let password = args.get("password").and_then(|v| v.as_str()).map(|s| s.to_string());
    let key_path = args.get("key_path").and_then(|v| v.as_str()).map(|s| s.to_string());

    if remote_path.is_empty() {
        return Err("remote_path parameter cannot be empty".to_string());
    }

    let connection_id = generate_connection_id(&host, port, &username);
    let connection_info = SSHConnectionWithAuth {
        host,
        port,
        username,
        password,
        key_path,
        timeout: 30,
    };

    let conn_result = with_runtime(|rt| {
        rt.block_on(get_or_create_connection(&connection_id, &connection_info))
    })?;

    if let Err(error_type) = conn_result {
        return Err(format!("Failed to establish connection: {:?}", error_type));
    }

    let result = execute_with_connection(&connection_id, |_session, sftp| {
        let real = resolve_remote_path(sftp, &remote_path)?;

        let entries = sftp.readdir(&real).map_err(|e| {
            SSHErrorType::FileNotFound(format!(
                "Failed to read directory '{}': {}",
                real.display(),
                e
            ))
        })?;

        let mut files: Vec<FileEntry> = Vec::new();

        for (entry_path, stat) in entries {
            let name = entry_path
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();
            if name.is_empty() || name == "." || name == ".." {
                continue;
            }

            let perm = stat.perm.unwrap_or(0);
            let is_dir = (perm & 0o170000) == 0o040000;
            let size = stat.size.unwrap_or(0);
            let modified = stat.mtime.unwrap_or(0) as u64;

            let full_path = if remote_path == "~" || remote_path == "~/" {
                format!("~/{name}")
            } else if remote_path.ends_with('/') {
                format!("{}{}", remote_path, name)
            } else {
                format!("{}/{}", remote_path, name)
            };

            let file_type = if is_dir {
                "directory".to_string()
            } else {
                match PathBuf::from(&name).extension().and_then(|s| s.to_str()) {
                    Some(ext) => ext.to_lowercase(),
                    None => "file".to_string(),
                }
            };

            files.push(FileEntry {
                name,
                path: full_path,
                is_dir,
                size,
                modified,
                file_type,
                mime_type: None,
            });
        }

        files.sort_by(|a, b| match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        });

        Ok(files)
    });

    match result {
        Ok(files) => Ok(serde_json::to_value(files).unwrap()),
        Err(error_type) => Err(format!("SSH operation failed: {:?}", error_type)),
    }
}

fn handle_get_file_content(args: serde_json::Value) -> Result<serde_json::Value, String> {
    let host = args.get("host").and_then(|v| v.as_str()).ok_or("Missing host")?.to_string();
    let port = args.get("port").and_then(|v| v.as_u64()).unwrap_or(22) as u16;
    let username = args.get("username").and_then(|v| v.as_str()).ok_or("Missing username")?.to_string();
    let remote_path = args.get("remote_path").and_then(|v| v.as_str()).ok_or("Missing remote_path")?.to_string();
    let password = args.get("password").and_then(|v| v.as_str()).map(|s| s.to_string());
    let key_path = args.get("key_path").and_then(|v| v.as_str()).map(|s| s.to_string());

    let connection_id = generate_connection_id(&host, port, &username);
    let connection_info = SSHConnectionWithAuth {
        host,
        port,
        username,
        password,
        key_path,
        timeout: 30,
    };

    let conn_result = with_runtime(|rt| {
        rt.block_on(get_or_create_connection(&connection_id, &connection_info))
    })?;

    if let Err(error_type) = conn_result {
        return Err(format!("Failed to establish connection: {:?}", error_type));
    }

    let result = execute_with_connection(&connection_id, |_session, sftp| {
        let real = resolve_remote_path(sftp, &remote_path)?;
        let mut file = sftp.open(&real).map_err(|e| {
            SSHErrorType::FileNotFound(format!(
                "Failed to open remote file '{}': {}",
                real.display(),
                e
            ))
        })?;

        let mut buf = Vec::new();
        file.read_to_end(&mut buf).map_err(|e| {
            SSHErrorType::ProtocolError(format!(
                "Failed to read remote file '{}': {}",
                real.display(),
                e
            ))
        })?;

        Ok(String::from_utf8_lossy(&buf).to_string())
    });

    match result {
        Ok(content) => Ok(serde_json::json!(content)),
        Err(error_type) => Err(format!("SSH operation failed: {:?}", error_type)),
    }
}

fn handle_create_directory(args: serde_json::Value) -> Result<serde_json::Value, String> {
    let host = args.get("host").and_then(|v| v.as_str()).ok_or("Missing host")?.to_string();
    let port = args.get("port").and_then(|v| v.as_u64()).unwrap_or(22) as u16;
    let username = args.get("username").and_then(|v| v.as_str()).ok_or("Missing username")?.to_string();
    let remote_path = args.get("remote_path").and_then(|v| v.as_str()).ok_or("Missing remote_path")?.to_string();
    let password = args.get("password").and_then(|v| v.as_str()).map(|s| s.to_string());
    let key_path = args.get("key_path").and_then(|v| v.as_str()).map(|s| s.to_string());

    let connection_id = generate_connection_id(&host, port, &username);
    let connection_info = SSHConnectionWithAuth { host, port, username, password, key_path, timeout: 30 };

    let conn_result = with_runtime(|rt| rt.block_on(get_or_create_connection(&connection_id, &connection_info)))?;
    if let Err(error_type) = conn_result {
        return Err(format!("Failed to establish connection: {:?}", error_type));
    }

    let result = execute_with_connection(&connection_id, |_session, sftp| {
        let real = resolve_remote_path(sftp, &remote_path)?;
        let mut current = PathBuf::new();
        for component in real.components() {
            current.push(component.as_os_str());
            if current.as_os_str().is_empty() { continue; }
            if let Err(err) = sftp.mkdir(&current, 0o755) {
                if sftp.stat(&current).is_err() {
                    return Err(SSHErrorType::PermissionError(format!(
                        "Failed to create directory '{}': {}",
                        current.display(),
                        err
                    )));
                }
            }
        }
        Ok(())
    });

    match result {
        Ok(()) => Ok(serde_json::json!({ "success": true })),
        Err(error_type) => Err(format!("SSH operation failed: {:?}", error_type)),
    }
}

fn handle_delete_file(args: serde_json::Value) -> Result<serde_json::Value, String> {
    let host = args.get("host").and_then(|v| v.as_str()).ok_or("Missing host")?.to_string();
    let port = args.get("port").and_then(|v| v.as_u64()).unwrap_or(22) as u16;
    let username = args.get("username").and_then(|v| v.as_str()).ok_or("Missing username")?.to_string();
    let remote_path = args.get("remote_path").and_then(|v| v.as_str()).ok_or("Missing remote_path")?.to_string();
    let password = args.get("password").and_then(|v| v.as_str()).map(|s| s.to_string());
    let key_path = args.get("key_path").and_then(|v| v.as_str()).map(|s| s.to_string());

    let connection_id = generate_connection_id(&host, port, &username);
    let connection_info = SSHConnectionWithAuth { host, port, username, password, key_path, timeout: 30 };

    let conn_result = with_runtime(|rt| rt.block_on(get_or_create_connection(&connection_id, &connection_info)))?;
    if let Err(error_type) = conn_result {
        return Err(format!("Failed to establish connection: {:?}", error_type));
    }

    let result = execute_with_connection(&connection_id, |_session, sftp| {
        let real = resolve_remote_path(sftp, &remote_path)?;
        sftp.unlink(&real).map_err(|e| {
            SSHErrorType::PermissionError(format!("Failed to delete remote file '{}': {}", real.display(), e))
        })
    });

    match result {
        Ok(()) => Ok(serde_json::json!({ "success": true })),
        Err(error_type) => Err(format!("SSH operation failed: {:?}", error_type)),
    }
}

fn handle_delete_directory(args: serde_json::Value) -> Result<serde_json::Value, String> {
    let host = args.get("host").and_then(|v| v.as_str()).ok_or("Missing host")?.to_string();
    let port = args.get("port").and_then(|v| v.as_u64()).unwrap_or(22) as u16;
    let username = args.get("username").and_then(|v| v.as_str()).ok_or("Missing username")?.to_string();
    let remote_path = args.get("remote_path").and_then(|v| v.as_str()).ok_or("Missing remote_path")?.to_string();
    let password = args.get("password").and_then(|v| v.as_str()).map(|s| s.to_string());
    let key_path = args.get("key_path").and_then(|v| v.as_str()).map(|s| s.to_string());

    let connection_id = generate_connection_id(&host, port, &username);
    let connection_info = SSHConnectionWithAuth { host, port, username, password, key_path, timeout: 30 };

    let conn_result = with_runtime(|rt| rt.block_on(get_or_create_connection(&connection_id, &connection_info)))?;
    if let Err(error_type) = conn_result {
        return Err(format!("Failed to establish connection: {:?}", error_type));
    }

    let result = execute_with_connection(&connection_id, |_session, sftp| {
        let real = resolve_remote_path(sftp, &remote_path)?;

        fn remove_dir_recursive(sftp: &Sftp, p: &Path) -> Result<(), SSHErrorType> {
            let entries = sftp.readdir(p).map_err(|e| {
                SSHErrorType::FileNotFound(format!("Failed to read directory '{}': {}", p.display(), e))
            })?;
            for (entry_path, stat) in entries {
                let perm = stat.perm.unwrap_or(0);
                let is_dir = (perm & 0o170000) == 0o040000;
                if is_dir {
                    remove_dir_recursive(sftp, &entry_path)?;
                    sftp.rmdir(&entry_path).map_err(|e| {
                        SSHErrorType::PermissionError(format!("Failed to remove directory '{}': {}", entry_path.display(), e))
                    })?;
                } else {
                    sftp.unlink(&entry_path).map_err(|e| {
                        SSHErrorType::PermissionError(format!("Failed to remove file '{}': {}", entry_path.display(), e))
                    })?;
                }
            }
            Ok(())
        }

        remove_dir_recursive(sftp, &real)?;
        sftp.rmdir(&real).map_err(|e| {
            SSHErrorType::PermissionError(format!("Failed to remove directory '{}': {}", real.display(), e))
        })?;
        Ok(())
    });

    match result {
        Ok(()) => Ok(serde_json::json!({ "success": true })),
        Err(error_type) => Err(format!("SSH operation failed: {:?}", error_type)),
    }
}

fn handle_rename(args: serde_json::Value) -> Result<serde_json::Value, String> {
    let host = args.get("host").and_then(|v| v.as_str()).ok_or("Missing host")?.to_string();
    let port = args.get("port").and_then(|v| v.as_u64()).unwrap_or(22) as u16;
    let username = args.get("username").and_then(|v| v.as_str()).ok_or("Missing username")?.to_string();
    let old_path = args.get("old_path").and_then(|v| v.as_str()).ok_or("Missing old_path")?.to_string();
    let new_path = args.get("new_path").and_then(|v| v.as_str()).ok_or("Missing new_path")?.to_string();
    let password = args.get("password").and_then(|v| v.as_str()).map(|s| s.to_string());
    let key_path = args.get("key_path").and_then(|v| v.as_str()).map(|s| s.to_string());

    let connection_id = generate_connection_id(&host, port, &username);
    let connection_info = SSHConnectionWithAuth { host, port, username, password, key_path, timeout: 30 };

    let conn_result = with_runtime(|rt| rt.block_on(get_or_create_connection(&connection_id, &connection_info)))?;
    if let Err(error_type) = conn_result {
        return Err(format!("Failed to establish connection: {:?}", error_type));
    }

    let result = execute_with_connection(&connection_id, |_session, sftp| {
        let old_real = resolve_remote_path(sftp, &old_path)?;
        let new_real = resolve_remote_path(sftp, &new_path)?;
        sftp.rename(&old_real, &new_real, None).map_err(|e| {
            SSHErrorType::PermissionError(format!("Failed to rename '{}' to '{}': {}", old_real.display(), new_real.display(), e))
        })
    });

    match result {
        Ok(()) => Ok(serde_json::json!({ "success": true })),
        Err(error_type) => Err(format!("SSH operation failed: {:?}", error_type)),
    }
}

// ─── C ABI Exports ─────────────────────────────────────────────────────────────

#[no_mangle]
pub extern "C" fn plugin_init() -> *const c_char {
    // Initialize the Tokio runtime
    if let Err(e) = get_runtime() {
        eprintln!("[SSH Plugin] Failed to initialize runtime: {}", e);
    }
    PLUGIN_INFO.as_ptr()
}

#[no_mangle]
pub extern "C" fn plugin_invoke(command: *const c_char, args_json: *const c_char) -> *mut c_char {
    let command_str = unsafe { CStr::from_ptr(command) }
        .to_str()
        .unwrap_or("");
    let args_str = unsafe { CStr::from_ptr(args_json) }
        .to_str()
        .unwrap_or("{}");

    let args: serde_json::Value = serde_json::from_str(args_str).unwrap_or(serde_json::json!({}));

    let result = match command_str {
        "connect" => handle_connect(args),
        "disconnect" => handle_disconnect(args),
        "get_all_connections" => handle_get_all_connections(args),
        "get_connection_state" => handle_get_connection_state(args),
        "test_connection" => handle_test_connection(args),
        "execute_command" => handle_execute_command(args),
        "open_terminal" => handle_open_terminal(args),
        "check_availability" => handle_check_availability(args),
        "get_config_hosts" => handle_get_config_hosts(args),
        "read_directory" => handle_read_directory(args),
        "get_file_content" => handle_get_file_content(args),
        "create_directory" => handle_create_directory(args),
        "delete_file" => handle_delete_file(args),
        "delete_directory" => handle_delete_directory(args),
        "rename" => handle_rename(args),
        _ => Err(format!("Unknown command: {}", command_str)),
    };

    let json = match result {
        Ok(value) => serde_json::json!({ "ok": value }).to_string(),
        Err(err) => serde_json::json!({ "error": err }).to_string(),
    };

    CString::new(json).unwrap().into_raw()
}

#[no_mangle]
pub extern "C" fn plugin_free(ptr: *mut c_char) {
    if !ptr.is_null() {
        unsafe {
            drop(CString::from_raw(ptr));
        }
    }
}

#[no_mangle]
pub extern "C" fn plugin_shutdown() {
    // Drop all SSH connections
    {
        let mut connections = SSH_POOL.connections.write().unwrap();
        connections.clear();
    }
    // Drop the runtime
    {
        let mut rt = RUNTIME.write().unwrap();
        *rt = None;
    }
    println!("[SSH Plugin] Shutdown complete");
}
