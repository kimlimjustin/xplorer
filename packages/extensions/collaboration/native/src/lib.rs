//! Collaboration Plugin — Native extension for Xplorer
//!
//! Embeds a WebSocket server (host mode) or client (member mode) for real-time
//! multi-user collaboration: presence, navigation sync, file transfer, chat,
//! and shared workspace (bookmarks, tags, notes).

use std::collections::HashMap;
use std::ffi::{CStr, CString, c_char};
use std::fs;
use std::net::SocketAddr;
use std::sync::Arc;

use base64::Engine as _;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{Mutex, RwLock, broadcast, mpsc};
use tokio_tungstenite::tungstenite::Message;
use uuid::Uuid;

// ─── Types ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Member {
    pub user_id: String,
    pub username: String,
    pub role: String, // "owner", "admin", "member"
    pub avatar_color: String,
    pub online: bool,
    pub current_path: String,
    pub selected_files: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Company {
    pub id: String,
    pub name: String,
    pub invite_code: String,
    pub created_by: String,
    pub members: Vec<CompanyMember>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompanyMember {
    pub user_id: String,
    pub username: String,
    pub role: String,
    pub avatar_color: String,
    pub joined_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMsg {
    pub user_id: String,
    pub username: String,
    pub text: String,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileTransfer {
    pub id: String,
    pub from_user: String,
    pub from_username: String,
    pub to_user: String,
    pub file_name: String,
    pub file_size: u64,
    pub status: String, // "pending", "accepted", "rejected", "transferring", "complete"
    pub progress: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WsMsg {
    // Presence
    Hello { user_id: String, username: String, avatar_color: String },
    Welcome { user_id: String, members: Vec<Member> },
    UserJoined { user_id: String, username: String, avatar_color: String },
    UserLeft { user_id: String },
    Heartbeat { user_id: String },

    // Navigation sync
    NavigationChanged { user_id: String, path: String },
    SelectionChanged { user_id: String, files: Vec<String> },

    // File transfer
    FileTransferRequest { transfer_id: String, from_user: String, from_username: String, to_user: String, file_name: String, file_size: u64 },
    FileTransferAccept { transfer_id: String },
    FileTransferReject { transfer_id: String },
    FileChunk { transfer_id: String, chunk_index: u32, data: String, is_last: bool },
    FileTransferComplete { transfer_id: String },

    // Shared workspace
    BookmarkSync { bookmarks: serde_json::Value },
    TagSync { tags: serde_json::Value },
    NoteSync { notes: serde_json::Value },

    // Chat
    Chat { user_id: String, username: String, text: String, timestamp: u64 },

    // Error
    Error { message: String },
}

// ─── Events (polled by frontend) ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event")]
pub enum CollabEvent {
    MemberJoined { member: Member },
    MemberLeft { user_id: String },
    MemberNavigated { user_id: String, path: String },
    MemberSelected { user_id: String, files: Vec<String> },
    ChatReceived { msg: ChatMsg },
    TransferRequest { transfer: FileTransfer },
    TransferProgress { transfer_id: String, progress: f64 },
    TransferComplete { transfer_id: String },
    TransferRejected { transfer_id: String },
    BookmarksUpdated { bookmarks: serde_json::Value },
    TagsUpdated { tags: serde_json::Value },
    NotesUpdated { notes: serde_json::Value },
    Connected,
    Disconnected { reason: String },
}

// ─── Server State ────────────────────────────────────────────────────────────

struct ServerState {
    members: HashMap<String, Member>,
    chat_history: Vec<ChatMsg>,
    shared_bookmarks: serde_json::Value,
    shared_tags: serde_json::Value,
    shared_notes: serde_json::Value,
    transfers: HashMap<String, FileTransfer>,
    broadcast_tx: broadcast::Sender<String>,
}

// ─── Global State ────────────────────────────────────────────────────────────

struct CollabState {
    role: String, // "none", "host", "member"
    user_id: String,
    username: String,
    avatar_color: String,
    port: u16,
    invite_code: String,
    server: Option<Arc<RwLock<ServerState>>>,
    events: Vec<CollabEvent>,
    members: Vec<Member>,
    chat_history: Vec<ChatMsg>,
    transfers: HashMap<String, FileTransfer>,
    // For client mode: sender to WS write task
    client_tx: Option<mpsc::UnboundedSender<String>>,
    company: Option<Company>,
    shutdown_tx: Option<mpsc::Sender<()>>,
}

impl CollabState {
    fn new() -> Self {
        Self {
            role: "none".into(),
            user_id: Uuid::new_v4().to_string(),
            username: String::new(),
            avatar_color: random_color(),
            port: 9847,
            invite_code: String::new(),
            server: None,
            events: Vec::new(),
            members: Vec::new(),
            chat_history: Vec::new(),
            transfers: HashMap::new(),
            client_tx: None,
            company: None,
            shutdown_tx: None,
        }
    }
}

lazy_static::lazy_static! {
    static ref STATE: Arc<Mutex<CollabState>> = Arc::new(Mutex::new(CollabState::new()));
    static ref RUNTIME: tokio::runtime::Runtime = tokio::runtime::Runtime::new().unwrap();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn random_color() -> String {
    let colors = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];
    let idx = rand::random::<usize>() % colors.len();
    colors[idx].to_string()
}

fn random_invite_code() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    (0..6).map(|_| {
        let idx = rng.gen_range(0..36);
        if idx < 10 { (b'0' + idx) as char } else { (b'A' + idx - 10) as char }
    }).collect()
}

fn encode_invite(addr: &str) -> String {
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(addr)
}

fn decode_invite(code: &str) -> Option<String> {
    // Try direct decode first (base64 encoded ip:port)
    if let Ok(bytes) = base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(code) {
        if let Ok(s) = String::from_utf8(bytes) {
            return Some(s);
        }
    }
    // Try as raw ip:port
    if code.contains(':') {
        return Some(code.to_string());
    }
    None
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn ok_json(val: impl Serialize) -> String {
    serde_json::to_string(&serde_json::json!({ "success": true, "data": val })).unwrap()
}

fn err_json(msg: &str) -> String {
    serde_json::to_string(&serde_json::json!({ "success": false, "error": msg })).unwrap()
}

// ─── Host: WebSocket Server ─────────────────────────────────────────────────

async fn run_server(port: u16, state: Arc<RwLock<ServerState>>, global: Arc<Mutex<CollabState>>, mut shutdown_rx: mpsc::Receiver<()>) {
    let addr = format!("0.0.0.0:{}", port);
    let listener = match TcpListener::bind(&addr).await {
        Ok(l) => l,
        Err(e) => {
            let mut g = global.lock().await;
            g.events.push(CollabEvent::Disconnected { reason: format!("Failed to bind: {}", e) });
            return;
        }
    };

    loop {
        tokio::select! {
            accept = listener.accept() => {
                match accept {
                    Ok((stream, addr)) => {
                        let state = state.clone();
                        let global = global.clone();
                        tokio::spawn(handle_connection(stream, addr, state, global));
                    }
                    Err(_) => continue,
                }
            }
            _ = shutdown_rx.recv() => {
                break;
            }
        }
    }
}

async fn handle_connection(stream: TcpStream, _addr: SocketAddr, state: Arc<RwLock<ServerState>>, global: Arc<Mutex<CollabState>>) {
    let ws_stream = match tokio_tungstenite::accept_async(stream).await {
        Ok(ws) => ws,
        Err(_) => return,
    };

    let (mut ws_tx, mut ws_rx) = ws_stream.split();
    let mut rx = { state.read().await.broadcast_tx.subscribe() };
    let mut user_id = String::new();

    // Read first message (Hello)
    if let Some(Ok(msg)) = ws_rx.next().await {
        if let Message::Text(text) = msg {
            if let Ok(WsMsg::Hello { user_id: uid, username, avatar_color }) = serde_json::from_str(&text) {
                user_id = uid.clone();
                let member = Member {
                    user_id: uid.clone(),
                    username: username.clone(),
                    role: "member".into(),
                    avatar_color,
                    online: true,
                    current_path: String::new(),
                    selected_files: Vec::new(),
                };

                // Add member
                {
                    let mut s = state.write().await;
                    s.members.insert(uid.clone(), member.clone());
                    let join_msg = serde_json::to_string(&WsMsg::UserJoined {
                        user_id: uid.clone(),
                        username: username.clone(),
                        avatar_color: member.avatar_color.clone(),
                    }).unwrap();
                    let _ = s.broadcast_tx.send(join_msg);
                }

                // Send Welcome with member list
                {
                    let s = state.read().await;
                    let members: Vec<Member> = s.members.values().cloned().collect();
                    let welcome = serde_json::to_string(&WsMsg::Welcome {
                        user_id: uid.clone(),
                        members,
                    }).unwrap();
                    let _ = ws_tx.send(Message::Text(welcome.into())).await;
                }

                // Push event
                {
                    let mut g = global.lock().await;
                    let s = state.read().await;
                    g.members = s.members.values().cloned().collect();
                    g.events.push(CollabEvent::MemberJoined { member: member.clone() });
                }
            }
        }
    }

    if user_id.is_empty() {
        return;
    }

    let uid = user_id.clone();

    // Spawn task to forward broadcasts to this client
    let forward_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if ws_tx.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    // Read incoming messages
    while let Some(Ok(msg)) = ws_rx.next().await {
        if let Message::Text(text) = msg {
            let text_str: &str = &text;
            if let Ok(ws_msg) = serde_json::from_str::<WsMsg>(text_str) {
                match ws_msg {
                    WsMsg::NavigationChanged { user_id: uid, path } => {
                        let mut s = state.write().await;
                        if let Some(m) = s.members.get_mut(&uid) {
                            m.current_path = path.clone();
                        }
                        let _ = s.broadcast_tx.send(text.to_string());
                        drop(s);
                        let mut g = global.lock().await;
                        g.events.push(CollabEvent::MemberNavigated { user_id: uid, path });
                        let s = state.read().await;
                        g.members = s.members.values().cloned().collect();
                    }
                    WsMsg::SelectionChanged { user_id: uid, files } => {
                        let mut s = state.write().await;
                        if let Some(m) = s.members.get_mut(&uid) {
                            m.selected_files = files.clone();
                        }
                        let _ = s.broadcast_tx.send(text.to_string());
                        drop(s);
                        let mut g = global.lock().await;
                        g.events.push(CollabEvent::MemberSelected { user_id: uid, files });
                    }
                    WsMsg::Chat { user_id: uid, username, text: chat_text, timestamp } => {
                        let msg = ChatMsg { user_id: uid, username, text: chat_text, timestamp };
                        let mut s = state.write().await;
                        s.chat_history.push(msg.clone());
                        if s.chat_history.len() > 200 { s.chat_history.remove(0); }
                        let _ = s.broadcast_tx.send(text.to_string());
                        drop(s);
                        let mut g = global.lock().await;
                        g.chat_history.push(msg.clone());
                        g.events.push(CollabEvent::ChatReceived { msg });
                    }
                    WsMsg::BookmarkSync { bookmarks } => {
                        let mut s = state.write().await;
                        s.shared_bookmarks = bookmarks.clone();
                        let _ = s.broadcast_tx.send(text.to_string());
                        drop(s);
                        let mut g = global.lock().await;
                        g.events.push(CollabEvent::BookmarksUpdated { bookmarks });
                    }
                    WsMsg::TagSync { tags } => {
                        let mut s = state.write().await;
                        s.shared_tags = tags.clone();
                        let _ = s.broadcast_tx.send(text.to_string());
                        drop(s);
                        let mut g = global.lock().await;
                        g.events.push(CollabEvent::TagsUpdated { tags });
                    }
                    WsMsg::NoteSync { notes } => {
                        let mut s = state.write().await;
                        s.shared_notes = notes.clone();
                        let _ = s.broadcast_tx.send(text.to_string());
                        drop(s);
                        let mut g = global.lock().await;
                        g.events.push(CollabEvent::NotesUpdated { notes });
                    }
                    WsMsg::FileTransferRequest { transfer_id, from_user, from_username, to_user, file_name, file_size } => {
                        let transfer = FileTransfer {
                            id: transfer_id.clone(),
                            from_user, from_username, to_user: to_user.clone(),
                            file_name, file_size,
                            status: "pending".into(), progress: 0.0,
                        };
                        let mut s = state.write().await;
                        s.transfers.insert(transfer_id.clone(), transfer.clone());
                        let _ = s.broadcast_tx.send(text.to_string());
                        drop(s);
                        let mut g = global.lock().await;
                        g.transfers.insert(transfer_id, transfer.clone());
                        g.events.push(CollabEvent::TransferRequest { transfer });
                    }
                    WsMsg::FileTransferAccept { .. } | WsMsg::FileTransferReject { .. } => {
                        let s = state.read().await;
                        let _ = s.broadcast_tx.send(text.to_string());
                    }
                    WsMsg::FileChunk { .. } => {
                        let s = state.read().await;
                        let _ = s.broadcast_tx.send(text.to_string());
                    }
                    WsMsg::FileTransferComplete { transfer_id } => {
                        let s = state.read().await;
                        let _ = s.broadcast_tx.send(text.to_string());
                        drop(s);
                        let mut g = global.lock().await;
                        g.events.push(CollabEvent::TransferComplete { transfer_id });
                    }
                    WsMsg::Heartbeat { .. } => {}
                    _ => {}
                }
            }
        }
    }

    // User disconnected
    forward_task.abort();
    {
        let mut s = state.write().await;
        s.members.remove(&uid);
        let leave_msg = serde_json::to_string(&WsMsg::UserLeft { user_id: uid.clone() }).unwrap();
        let _ = s.broadcast_tx.send(leave_msg);
    }
    {
        let mut g = global.lock().await;
        g.members.retain(|m| m.user_id != uid);
        g.events.push(CollabEvent::MemberLeft { user_id: uid });
    }
}

// ─── Client: WebSocket Connection ────────────────────────────────────────────

async fn run_client(addr: String, global: Arc<Mutex<CollabState>>) {
    let url = format!("ws://{}", addr);
    let ws_stream = match tokio_tungstenite::connect_async(&url).await {
        Ok((ws, _)) => ws,
        Err(e) => {
            let mut g = global.lock().await;
            g.events.push(CollabEvent::Disconnected { reason: format!("Connection failed: {}", e) });
            g.role = "none".into();
            return;
        }
    };

    let (mut ws_tx, mut ws_rx) = ws_stream.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<String>();

    // Store sender for commands
    {
        let mut g = global.lock().await;
        g.client_tx = Some(tx);
        g.events.push(CollabEvent::Connected);
    }

    // Send Hello
    {
        let g = global.lock().await;
        let hello = serde_json::to_string(&WsMsg::Hello {
            user_id: g.user_id.clone(),
            username: g.username.clone(),
            avatar_color: g.avatar_color.clone(),
        }).unwrap();
        let _ = ws_tx.send(Message::Text(hello.into())).await;
    }

    // Spawn write task
    let write_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if ws_tx.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    // Read messages
    while let Some(Ok(msg)) = ws_rx.next().await {
        if let Message::Text(text) = msg {
            let text_str: &str = &text;
            if let Ok(ws_msg) = serde_json::from_str::<WsMsg>(text_str) {
                let mut g = global.lock().await;
                match ws_msg {
                    WsMsg::Welcome { members, .. } => {
                        g.members = members;
                    }
                    WsMsg::UserJoined { user_id, username, avatar_color } => {
                        let member = Member {
                            user_id: user_id.clone(), username, role: "member".into(),
                            avatar_color, online: true, current_path: String::new(), selected_files: Vec::new(),
                        };
                        g.members.push(member.clone());
                        g.events.push(CollabEvent::MemberJoined { member });
                    }
                    WsMsg::UserLeft { user_id } => {
                        g.members.retain(|m| m.user_id != user_id);
                        g.events.push(CollabEvent::MemberLeft { user_id });
                    }
                    WsMsg::NavigationChanged { user_id, path } => {
                        if let Some(m) = g.members.iter_mut().find(|m| m.user_id == user_id) {
                            m.current_path = path.clone();
                        }
                        g.events.push(CollabEvent::MemberNavigated { user_id, path });
                    }
                    WsMsg::SelectionChanged { user_id, files } => {
                        if let Some(m) = g.members.iter_mut().find(|m| m.user_id == user_id) {
                            m.selected_files = files.clone();
                        }
                        g.events.push(CollabEvent::MemberSelected { user_id, files });
                    }
                    WsMsg::Chat { user_id, username, text: chat_text, timestamp } => {
                        let msg = ChatMsg { user_id, username, text: chat_text, timestamp };
                        g.chat_history.push(msg.clone());
                        g.events.push(CollabEvent::ChatReceived { msg });
                    }
                    WsMsg::FileTransferRequest { transfer_id, from_user, from_username, to_user, file_name, file_size } => {
                        let transfer = FileTransfer {
                            id: transfer_id.clone(), from_user, from_username, to_user,
                            file_name, file_size, status: "pending".into(), progress: 0.0,
                        };
                        g.transfers.insert(transfer_id, transfer.clone());
                        g.events.push(CollabEvent::TransferRequest { transfer });
                    }
                    WsMsg::FileTransferComplete { transfer_id } => {
                        g.events.push(CollabEvent::TransferComplete { transfer_id });
                    }
                    WsMsg::BookmarkSync { bookmarks } => {
                        g.events.push(CollabEvent::BookmarksUpdated { bookmarks });
                    }
                    WsMsg::TagSync { tags } => {
                        g.events.push(CollabEvent::TagsUpdated { tags });
                    }
                    WsMsg::NoteSync { notes } => {
                        g.events.push(CollabEvent::NotesUpdated { notes });
                    }
                    _ => {}
                }
            }
        }
    }

    write_task.abort();
    let mut g = global.lock().await;
    g.role = "none".into();
    g.client_tx = None;
    g.members.clear();
    g.events.push(CollabEvent::Disconnected { reason: "Connection closed".into() });
}

// ─── Command Dispatch ────────────────────────────────────────────────────────

fn handle_command(command: &str, args: &str) -> String {
    RUNTIME.block_on(async {
        dispatch(command, args).await
    })
}

async fn dispatch(command: &str, args: &str) -> String {
    match command {
        "start_server" => cmd_start_server(args).await,
        "stop_server" => cmd_stop_server().await,
        "join_server" => cmd_join_server(args).await,
        "leave_server" => cmd_leave_server().await,
        "get_status" => cmd_get_status().await,
        "get_members" => cmd_get_members().await,
        "get_events" => cmd_get_events().await,
        "broadcast_path" => cmd_broadcast_path(args).await,
        "broadcast_selection" => cmd_broadcast_selection(args).await,
        "send_chat" => cmd_send_chat(args).await,
        "get_chat_history" => cmd_get_chat_history().await,
        "send_file" => cmd_send_file(args).await,
        "accept_transfer" => cmd_accept_transfer(args).await,
        "reject_transfer" => cmd_reject_transfer(args).await,
        "sync_bookmarks" => cmd_sync_workspace(args, "bookmarks").await,
        "sync_tags" => cmd_sync_workspace(args, "tags").await,
        "sync_notes" => cmd_sync_workspace(args, "notes").await,
        "create_company" => cmd_create_company(args).await,
        "get_company" => cmd_get_company().await,
        _ => err_json(&format!("Unknown command: {}", command)),
    }
}

// ─── Commands ────────────────────────────────────────────────────────────────

async fn cmd_start_server(args: &str) -> String {
    #[derive(Deserialize)]
    struct Args { port: Option<u16>, username: String }
    let parsed: Args = match serde_json::from_str(args) {
        Ok(a) => a,
        Err(e) => return err_json(&format!("Invalid args: {}", e)),
    };

    let mut g = STATE.lock().await;
    if g.role != "none" {
        return err_json("Already in a session");
    }

    let port = parsed.port.unwrap_or(9847);
    g.username = parsed.username;
    g.port = port;
    g.role = "host".into();

    let (broadcast_tx, _) = broadcast::channel(256);
    let server_state = Arc::new(RwLock::new(ServerState {
        members: HashMap::new(),
        chat_history: Vec::new(),
        shared_bookmarks: serde_json::Value::Array(vec![]),
        shared_tags: serde_json::Value::Array(vec![]),
        shared_notes: serde_json::Value::Array(vec![]),
        transfers: HashMap::new(),
        broadcast_tx,
    }));

    // Add self as member
    {
        let mut s = server_state.write().await;
        s.members.insert(g.user_id.clone(), Member {
            user_id: g.user_id.clone(),
            username: g.username.clone(),
            role: "owner".into(),
            avatar_color: g.avatar_color.clone(),
            online: true,
            current_path: String::new(),
            selected_files: Vec::new(),
        });
    }

    g.server = Some(server_state.clone());
    let invite_code = encode_invite(&format!("127.0.0.1:{}", port));
    g.invite_code = invite_code.clone();

    // Update members list
    {
        let s = server_state.read().await;
        g.members = s.members.values().cloned().collect();
    }

    let (shutdown_tx, shutdown_rx) = mpsc::channel(1);
    g.shutdown_tx = Some(shutdown_tx);

    let global = STATE.clone();
    tokio::spawn(run_server(port, server_state, global, shutdown_rx));

    ok_json(serde_json::json!({
        "port": port,
        "invite_code": invite_code,
        "user_id": g.user_id,
    }))
}

async fn cmd_stop_server() -> String {
    let mut g = STATE.lock().await;
    if g.role != "host" {
        return err_json("Not hosting");
    }
    if let Some(tx) = g.shutdown_tx.take() {
        let _ = tx.send(()).await;
    }
    g.role = "none".into();
    g.server = None;
    g.members.clear();
    g.invite_code.clear();
    ok_json("Server stopped")
}

async fn cmd_join_server(args: &str) -> String {
    #[derive(Deserialize)]
    struct Args { invite_code: String, username: String }
    let parsed: Args = match serde_json::from_str(args) {
        Ok(a) => a,
        Err(e) => return err_json(&format!("Invalid args: {}", e)),
    };

    let addr = match decode_invite(&parsed.invite_code) {
        Some(a) => a,
        None => return err_json("Invalid invite code"),
    };

    let mut g = STATE.lock().await;
    if g.role != "none" {
        return err_json("Already in a session");
    }
    g.username = parsed.username;
    g.role = "member".into();
    g.invite_code = parsed.invite_code;

    let global = STATE.clone();
    tokio::spawn(run_client(addr, global));

    ok_json(serde_json::json!({ "user_id": g.user_id }))
}

async fn cmd_leave_server() -> String {
    let mut g = STATE.lock().await;
    if g.role == "none" {
        return err_json("Not in a session");
    }
    g.client_tx = None;
    g.role = "none".into();
    g.members.clear();
    ok_json("Disconnected")
}

async fn cmd_get_status() -> String {
    let g = STATE.lock().await;
    ok_json(serde_json::json!({
        "role": g.role,
        "user_id": g.user_id,
        "username": g.username,
        "invite_code": g.invite_code,
        "member_count": g.members.len(),
    }))
}

async fn cmd_get_members() -> String {
    let g = STATE.lock().await;
    ok_json(&g.members)
}

async fn cmd_get_events() -> String {
    let mut g = STATE.lock().await;
    let events: Vec<CollabEvent> = g.events.drain(..).collect();
    ok_json(&events)
}

async fn cmd_broadcast_path(args: &str) -> String {
    #[derive(Deserialize)]
    struct Args { path: String }
    let parsed: Args = match serde_json::from_str(args) {
        Ok(a) => a,
        Err(_) => return err_json("Invalid args"),
    };

    let g = STATE.lock().await;
    let msg = serde_json::to_string(&WsMsg::NavigationChanged {
        user_id: g.user_id.clone(),
        path: parsed.path,
    }).unwrap();

    if g.role == "host" {
        if let Some(server) = &g.server {
            let s = server.read().await;
            let _ = s.broadcast_tx.send(msg);
        }
    } else if let Some(tx) = &g.client_tx {
        let _ = tx.send(msg);
    }
    ok_json("ok")
}

async fn cmd_broadcast_selection(args: &str) -> String {
    #[derive(Deserialize)]
    struct Args { files: Vec<String> }
    let parsed: Args = match serde_json::from_str(args) {
        Ok(a) => a,
        Err(_) => return err_json("Invalid args"),
    };

    let g = STATE.lock().await;
    let msg = serde_json::to_string(&WsMsg::SelectionChanged {
        user_id: g.user_id.clone(),
        files: parsed.files,
    }).unwrap();

    if g.role == "host" {
        if let Some(server) = &g.server {
            let s = server.read().await;
            let _ = s.broadcast_tx.send(msg);
        }
    } else if let Some(tx) = &g.client_tx {
        let _ = tx.send(msg);
    }
    ok_json("ok")
}

async fn cmd_send_chat(args: &str) -> String {
    #[derive(Deserialize)]
    struct Args { text: String }
    let parsed: Args = match serde_json::from_str(args) {
        Ok(a) => a,
        Err(_) => return err_json("Invalid args"),
    };

    let g = STATE.lock().await;
    let msg = serde_json::to_string(&WsMsg::Chat {
        user_id: g.user_id.clone(),
        username: g.username.clone(),
        text: parsed.text,
        timestamp: now_secs(),
    }).unwrap();

    if g.role == "host" {
        if let Some(server) = &g.server {
            let s = server.read().await;
            let _ = s.broadcast_tx.send(msg);
        }
    } else if let Some(tx) = &g.client_tx {
        let _ = tx.send(msg);
    }
    ok_json("ok")
}

async fn cmd_get_chat_history() -> String {
    let g = STATE.lock().await;
    ok_json(&g.chat_history)
}

async fn cmd_send_file(args: &str) -> String {
    #[derive(Deserialize)]
    struct Args { to_user_id: String, file_path: String }
    let parsed: Args = match serde_json::from_str(args) {
        Ok(a) => a,
        Err(_) => return err_json("Invalid args"),
    };

    let file_name = std::path::Path::new(&parsed.file_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".into());

    let file_size = fs::metadata(&parsed.file_path).map(|m| m.len()).unwrap_or(0);
    let transfer_id = Uuid::new_v4().to_string();

    let g = STATE.lock().await;
    let msg = serde_json::to_string(&WsMsg::FileTransferRequest {
        transfer_id: transfer_id.clone(),
        from_user: g.user_id.clone(),
        from_username: g.username.clone(),
        to_user: parsed.to_user_id,
        file_name,
        file_size,
    }).unwrap();

    if g.role == "host" {
        if let Some(server) = &g.server {
            let s = server.read().await;
            let _ = s.broadcast_tx.send(msg);
        }
    } else if let Some(tx) = &g.client_tx {
        let _ = tx.send(msg);
    }

    ok_json(serde_json::json!({ "transfer_id": transfer_id }))
}

async fn cmd_accept_transfer(args: &str) -> String {
    #[derive(Deserialize)]
    struct Args { transfer_id: String }
    let parsed: Args = match serde_json::from_str(args) {
        Ok(a) => a,
        Err(_) => return err_json("Invalid args"),
    };

    let g = STATE.lock().await;
    let msg = serde_json::to_string(&WsMsg::FileTransferAccept {
        transfer_id: parsed.transfer_id,
    }).unwrap();

    if g.role == "host" {
        if let Some(server) = &g.server {
            let s = server.read().await;
            let _ = s.broadcast_tx.send(msg);
        }
    } else if let Some(tx) = &g.client_tx {
        let _ = tx.send(msg);
    }
    ok_json("ok")
}

async fn cmd_reject_transfer(args: &str) -> String {
    #[derive(Deserialize)]
    struct Args { transfer_id: String }
    let parsed: Args = match serde_json::from_str(args) {
        Ok(a) => a,
        Err(_) => return err_json("Invalid args"),
    };

    let g = STATE.lock().await;
    let msg = serde_json::to_string(&WsMsg::FileTransferReject {
        transfer_id: parsed.transfer_id,
    }).unwrap();

    if g.role == "host" {
        if let Some(server) = &g.server {
            let s = server.read().await;
            let _ = s.broadcast_tx.send(msg);
        }
    } else if let Some(tx) = &g.client_tx {
        let _ = tx.send(msg);
    }
    ok_json("ok")
}

async fn cmd_sync_workspace(args: &str, kind: &str) -> String {
    let g = STATE.lock().await;
    let data: serde_json::Value = serde_json::from_str(args).unwrap_or_default();

    let msg = match kind {
        "bookmarks" => serde_json::to_string(&WsMsg::BookmarkSync { bookmarks: data }),
        "tags" => serde_json::to_string(&WsMsg::TagSync { tags: data }),
        "notes" => serde_json::to_string(&WsMsg::NoteSync { notes: data }),
        _ => return err_json("Invalid sync kind"),
    }.unwrap();

    if g.role == "host" {
        if let Some(server) = &g.server {
            let s = server.read().await;
            let _ = s.broadcast_tx.send(msg);
        }
    } else if let Some(tx) = &g.client_tx {
        let _ = tx.send(msg);
    }
    ok_json("ok")
}

async fn cmd_create_company(args: &str) -> String {
    #[derive(Deserialize)]
    struct Args { name: String }
    let parsed: Args = match serde_json::from_str(args) {
        Ok(a) => a,
        Err(_) => return err_json("Invalid args"),
    };

    let mut g = STATE.lock().await;
    let company = Company {
        id: Uuid::new_v4().to_string(),
        name: parsed.name,
        invite_code: random_invite_code(),
        created_by: g.user_id.clone(),
        members: vec![CompanyMember {
            user_id: g.user_id.clone(),
            username: g.username.clone(),
            role: "owner".into(),
            avatar_color: g.avatar_color.clone(),
            joined_at: now_secs(),
        }],
    };
    g.company = Some(company.clone());
    ok_json(&company)
}

async fn cmd_get_company() -> String {
    let g = STATE.lock().await;
    match &g.company {
        Some(c) => ok_json(c),
        None => ok_json(serde_json::Value::Null),
    }
}

// ─── Plugin ABI ──────────────────────────────────────────────────────────────

#[no_mangle]
pub extern "C" fn plugin_init() -> *mut c_char {
    let info = serde_json::json!({
        "name": "collab-plugin",
        "version": "1.0.0",
        "description": "Multi-user collaboration: real-time sync, file transfer, chat"
    });
    CString::new(serde_json::to_string(&info).unwrap()).unwrap().into_raw()
}

#[no_mangle]
pub extern "C" fn plugin_call(command: *const c_char, args: *const c_char) -> *mut c_char {
    let command = unsafe { CStr::from_ptr(command) }.to_str().unwrap_or("");
    let args = unsafe { CStr::from_ptr(args) }.to_str().unwrap_or("{}");
    let result = handle_command(command, args);
    CString::new(result).unwrap_or_else(|_| CString::new("{}").unwrap()).into_raw()
}

#[no_mangle]
pub extern "C" fn plugin_free(ptr: *mut c_char) {
    if !ptr.is_null() {
        unsafe { let _ = CString::from_raw(ptr); }
    }
}

#[no_mangle]
pub extern "C" fn plugin_shutdown() -> *mut c_char {
    RUNTIME.block_on(async {
        let mut g = STATE.lock().await;
        if let Some(tx) = g.shutdown_tx.take() {
            let _ = tx.send(()).await;
        }
        g.role = "none".into();
        g.server = None;
        g.client_tx = None;
        g.members.clear();
    });
    CString::new("{}").unwrap().into_raw()
}
