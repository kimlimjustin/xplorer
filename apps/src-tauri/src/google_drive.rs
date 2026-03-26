use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, LazyLock, RwLock};
use tracing::warn;

// ---------------------------------------------------------------------------
// Data Structures
// ---------------------------------------------------------------------------

#[derive(Clone, Serialize, Deserialize)]
pub struct GoogleDriveAccount {
    pub id: String,
    pub email: String,
    pub display_name: String,
    #[serde(skip_serializing)]
    pub access_token: String,
    pub refresh_token: String,
    pub token_expiry: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleDriveFile {
    pub id: String,
    pub name: String,
    #[serde(rename = "mimeType")]
    pub mime_type: String,
    pub size: Option<String>,
    #[serde(rename = "modifiedTime")]
    pub modified_time: Option<String>,
    pub parents: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize)]
struct OAuthTokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: u64,
    token_type: String,
}

#[derive(Serialize, Deserialize)]
struct UserInfo {
    email: String,
    name: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct DriveFileList {
    files: Option<Vec<GoogleDriveFile>>,
    #[serde(rename = "nextPageToken")]
    next_page_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GDriveFileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: u64,
    pub file_type: String,
    pub mime_type: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct GDriveAccountInfo {
    pub id: String,
    pub email: String,
    pub display_name: String,
}

// ---------------------------------------------------------------------------
// Account Pool (lazy_static)
// ---------------------------------------------------------------------------

struct GoogleDrivePool {
    accounts: Arc<RwLock<HashMap<String, GoogleDriveAccount>>>,
}

impl GoogleDrivePool {
    fn new() -> Self {
        Self {
            accounts: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    fn add_account(&self, account: GoogleDriveAccount) {
        let mut accounts = self.accounts.write().unwrap_or_else(|e| e.into_inner());
        accounts.insert(account.id.clone(), account);
    }

    fn remove_account(&self, id: &str) {
        let mut accounts = self.accounts.write().unwrap_or_else(|e| e.into_inner());
        accounts.remove(id);
    }

    fn get_account(&self, id: &str) -> Option<GoogleDriveAccount> {
        let accounts = self.accounts.read().unwrap_or_else(|e| e.into_inner());
        accounts.get(id).cloned()
    }

    fn get_all_accounts(&self) -> Vec<GoogleDriveAccount> {
        let accounts = self.accounts.read().unwrap_or_else(|e| e.into_inner());
        accounts.values().cloned().collect()
    }

    fn update_account_token(&self, id: &str, access_token: String, token_expiry: u64) {
        let mut accounts = self.accounts.write().unwrap_or_else(|e| e.into_inner());
        if let Some(account) = accounts.get_mut(id) {
            account.access_token = access_token;
            account.token_expiry = token_expiry;
        }
    }
}

static GDRIVE_POOL: LazyLock<GoogleDrivePool> = LazyLock::new(|| GoogleDrivePool::new());

// ---------------------------------------------------------------------------
// Token Persistence
// ---------------------------------------------------------------------------

fn get_storage_path() -> Result<PathBuf, String> {
    let dir = dirs::data_dir()
        .ok_or("Failed to get data directory")?
        .join("com.xplorer.app");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("google_drive_accounts.json"))
}

fn save_accounts() -> Result<(), String> {
    let path = get_storage_path()?;
    let accounts = GDRIVE_POOL.get_all_accounts();

    // Store tokens in OS keychain, strip from JSON
    for account in &accounts {
        let rt_key = format!("gdrive-refresh-token-{}", account.id);
        crate::secure_credentials::store_secret(&rt_key, &account.refresh_token)
            .unwrap_or_else(|e| warn!("[GDrive] keychain store failed: {}", e));
    }

    // Serialize without refresh_token (access_token already skip_serializing)
    #[derive(serde::Serialize)]
    struct SafeAccount {
        id: String,
        email: String,
        display_name: String,
        token_expiry: u64,
    }
    let safe: Vec<SafeAccount> = accounts
        .iter()
        .map(|a| SafeAccount {
            id: a.id.clone(),
            email: a.email.clone(),
            display_name: a.display_name.clone(),
            token_expiry: a.token_expiry,
        })
        .collect();

    let json = serde_json::to_string_pretty(&safe).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

fn load_accounts() -> Result<(), String> {
    let path = get_storage_path()?;
    if !path.exists() {
        return Ok(());
    }
    let json = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;

    // Try loading full format (migration from old plaintext)
    let accounts: Vec<GoogleDriveAccount> = match serde_json::from_str(&json) {
        Ok(accts) => accts,
        Err(_) => {
            // Try loading safe format (no tokens)
            #[derive(serde::Deserialize)]
            struct SafeAccount {
                id: String,
                email: String,
                display_name: String,
                token_expiry: u64,
            }
            let safe: Vec<SafeAccount> = serde_json::from_str(&json).map_err(|e| e.to_string())?;
            safe.into_iter()
                .map(|s| GoogleDriveAccount {
                    id: s.id,
                    email: s.email,
                    display_name: s.display_name,
                    access_token: String::new(),
                    refresh_token: String::new(),
                    token_expiry: s.token_expiry,
                })
                .collect()
        }
    };

    for mut account in accounts {
        // Retrieve refresh_token from OS keychain
        let rt_key = format!("gdrive-refresh-token-{}", account.id);
        if account.refresh_token.is_empty() {
            if let Ok(Some(token)) = crate::secure_credentials::get_secret(&rt_key) {
                account.refresh_token = token;
            }
        } else {
            // Migrate plaintext token to keychain
            crate::secure_credentials::migrate_to_keychain(&rt_key, &account.refresh_token);
        }
        GDRIVE_POOL.add_account(account);
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// OAuth Settings Persistence
// ---------------------------------------------------------------------------

#[derive(Clone, Serialize, Deserialize)]
pub struct GoogleDriveSettings {
    pub client_id: String,
    pub client_secret: String,
}

fn gdrive_settings_path() -> Result<PathBuf, String> {
    let dir = dirs::data_local_dir()
        .ok_or("Failed to get local data directory")?
        .join("xplorer");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("google_drive_settings.json"))
}

fn load_gdrive_settings() -> Result<GoogleDriveSettings, String> {
    let path = gdrive_settings_path()?;
    if !path.exists() {
        return Err("Google Drive API credentials not configured. Please set them in the Google Drive Accounts page.".to_string());
    }
    let json = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut settings: GoogleDriveSettings = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse Google Drive settings: {}", e))?;

    // Retrieve client_secret from OS keychain
    if settings.client_secret.is_empty() {
        if let Ok(Some(secret)) = crate::secure_credentials::get_secret("gdrive-client-secret") {
            settings.client_secret = secret;
        }
    } else {
        // Migrate plaintext secret to keychain
        crate::secure_credentials::migrate_to_keychain(
            "gdrive-client-secret",
            &settings.client_secret,
        );
    }

    if settings.client_id.is_empty() || settings.client_secret.is_empty() {
        return Err("Google Drive API credentials are incomplete. Please configure them in the Google Drive Accounts page.".to_string());
    }
    Ok(settings)
}

fn save_gdrive_settings(settings: &GoogleDriveSettings) -> Result<(), String> {
    // Store client_secret in OS keychain
    if !settings.client_secret.is_empty() {
        crate::secure_credentials::store_secret("gdrive-client-secret", &settings.client_secret)
            .unwrap_or_else(|e| warn!("[GDrive] keychain store failed: {}", e));
    }

    // Write JSON without the secret
    let safe = GoogleDriveSettings {
        client_id: settings.client_id.clone(),
        client_secret: String::new(),
    };
    let path = gdrive_settings_path()?;
    let json = serde_json::to_string_pretty(&safe).map_err(|e| e.to_string())?;
    std::fs::write(&path, json)
        .map_err(|e| format!("Failed to write Google Drive settings: {}", e))?;
    Ok(())
}

// ---------------------------------------------------------------------------
// PKCE Helpers
// ---------------------------------------------------------------------------

/// Generate a cryptographically secure code verifier using the `rand` crate's
/// thread-local CSPRNG.  Produces 256 bits (32 bytes) of entropy, exceeding
/// RFC 7636's 128-bit minimum.
fn generate_code_verifier() -> String {
    use rand::Rng;
    let bytes: [u8; 32] = rand::thread_rng().gen();
    URL_SAFE_NO_PAD.encode(&bytes)
}

fn generate_code_challenge(verifier: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let hash = hasher.finalize();
    URL_SAFE_NO_PAD.encode(hash)
}

/// Generate a cryptographically random `state` parameter for CSRF protection
/// in the OAuth2 authorization flow (RFC 6749 Section 10.12).
/// Produces 256 bits (32 bytes) of entropy from the OS CSPRNG.
fn generate_oauth_state() -> String {
    use rand::Rng;
    let bytes: [u8; 32] = rand::thread_rng().gen();
    URL_SAFE_NO_PAD.encode(&bytes)
}

// ---------------------------------------------------------------------------
// Token Refresh
// ---------------------------------------------------------------------------

async fn ensure_valid_token(account_id: &str) -> Result<String, String> {
    let account = GDRIVE_POOL
        .get_account(account_id)
        .ok_or("Account not found")?;

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    // If token is still valid (with 60s buffer), return it
    if now < account.token_expiry.saturating_sub(60) {
        return Ok(account.access_token.clone());
    }

    // Refresh the token
    let client = reqwest::Client::new();
    let settings = load_gdrive_settings()?;
    let client_id = settings.client_id;
    let client_secret = settings.client_secret;

    let resp = client
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("client_id", client_id.as_str()),
            ("client_secret", client_secret.as_str()),
            ("refresh_token", account.refresh_token.as_str()),
            ("grant_type", "refresh_token"),
        ])
        .send()
        .await
        .map_err(|e| format!("Token refresh request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!(
            "Token refresh failed with status {}: {}",
            status, body
        ));
    }

    let token_resp: OAuthTokenResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse token response: {}", e))?;

    let new_expiry = now + token_resp.expires_in;
    GDRIVE_POOL.update_account_token(account_id, token_resp.access_token.clone(), new_expiry);
    save_accounts()?;

    Ok(token_resp.access_token)
}

// ---------------------------------------------------------------------------
// Helper: Convert GoogleDriveFile to GDriveFileEntry
// ---------------------------------------------------------------------------

fn to_file_entry(file: &GoogleDriveFile, account_id: &str) -> GDriveFileEntry {
    let is_dir = file.mime_type == "application/vnd.google-apps.folder";
    let size = file
        .size
        .as_ref()
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(0);
    let modified = file
        .modified_time
        .as_ref()
        .and_then(|t| chrono::DateTime::parse_from_rfc3339(t).ok())
        .map(|dt| dt.timestamp() as u64)
        .unwrap_or(0);
    let ext = if is_dir {
        "directory".to_string()
    } else {
        file.name.rsplit('.').next().unwrap_or("").to_string()
    };

    GDriveFileEntry {
        name: file.name.clone(),
        path: format!("gdrive://{}/{}", account_id, file.id),
        is_dir,
        size,
        modified,
        file_type: ext,
        mime_type: Some(file.mime_type.clone()),
    }
}

// ---------------------------------------------------------------------------
// Tauri Commands
// ---------------------------------------------------------------------------

/// 1. OAuth2 PKCE authentication flow.
/// Opens the user's browser, listens for the callback, exchanges the code
/// for tokens, and stores the account.
#[tauri::command]
pub async fn gdrive_authenticate() -> Result<GDriveAccountInfo, String> {
    // Load any previously persisted accounts on first call
    let _ = load_accounts();

    let settings = load_gdrive_settings()?;
    let client_id = settings.client_id;
    let client_secret = settings.client_secret;

    // Generate PKCE codes and CSRF state parameter
    let code_verifier = generate_code_verifier();
    let code_challenge = generate_code_challenge(&code_verifier);
    let oauth_state = generate_oauth_state();

    // Find an available port
    let mut port: u16 = 19823;
    let listener = loop {
        match tokio::net::TcpListener::bind(format!("127.0.0.1:{}", port)).await {
            Ok(l) => break l,
            Err(_) => {
                port += 1;
                if port > 19900 {
                    return Err("Could not find an available port for OAuth callback".to_string());
                }
            }
        }
    };

    let redirect_uri = format!("http://127.0.0.1:{}", port);

    // Build the authorization URL (includes `state` for CSRF protection)
    let scope = urlencoding("https://www.googleapis.com/auth/drive email profile");
    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope={}&code_challenge={}&code_challenge_method=S256&access_type=offline&prompt=consent&state={}",
        urlencoding(&client_id),
        urlencoding(&redirect_uri),
        scope,
        urlencoding(&code_challenge),
        urlencoding(&oauth_state),
    );

    // Open the URL in the user's default browser
    #[cfg(target_os = "windows")]
    {
        // Use rundll32 instead of cmd /C start — the latter treats '&' in URLs
        // as a command separator, truncating the OAuth URL and losing parameters.
        let _ = std::process::Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", &auth_url])
            .spawn();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg(&auth_url).spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open")
            .arg(&auth_url)
            .spawn();
    }

    // Wait for the OAuth callback (120 second timeout)
    let expected_state = oauth_state.clone();
    let auth_code = tokio::time::timeout(std::time::Duration::from_secs(120), async {
        loop {
            let (mut stream, _addr) = listener
                .accept()
                .await
                .map_err(|e| format!("Failed to accept connection: {}", e))?;

            use tokio::io::{AsyncReadExt, AsyncWriteExt};

            let mut buf = vec![0u8; 4096];
            let n = stream
                .read(&mut buf)
                .await
                .map_err(|e| format!("Failed to read from stream: {}", e))?;
            let request = String::from_utf8_lossy(&buf[..n]).to_string();

            // Parse the authorization code and state from the GET request
            if let Some((code, received_state)) = extract_code_and_state_from_request(&request) {
                // Validate the state parameter to prevent CSRF attacks (MED-02)
                match received_state {
                    Some(ref st) if st == &expected_state => {
                        // State matches — authentication is legitimate
                    }
                    Some(_) => {
                        // State mismatch — possible CSRF attack; reject
                        let response = "HTTP/1.1 403 Forbidden\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n<html><body style=\"font-family:sans-serif;text-align:center;padding-top:60px;\"><h2>Authentication failed</h2><p>OAuth state mismatch (possible CSRF attack). Please try again.</p></body></html>";
                        let _ = stream.write_all(response.as_bytes()).await;
                        let _ = stream.shutdown().await;
                        return Err("OAuth state parameter mismatch — possible CSRF attack. Authentication rejected.".to_string());
                    }
                    None => {
                        // State missing — reject the callback
                        let response = "HTTP/1.1 403 Forbidden\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n<html><body style=\"font-family:sans-serif;text-align:center;padding-top:60px;\"><h2>Authentication failed</h2><p>Missing OAuth state parameter. Please try again.</p></body></html>";
                        let _ = stream.write_all(response.as_bytes()).await;
                        let _ = stream.shutdown().await;
                        return Err("OAuth state parameter missing from callback — authentication rejected.".to_string());
                    }
                }

                // Send a success response to the browser
                let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n<html><body style=\"font-family:sans-serif;text-align:center;padding-top:60px;\"><h2>Authentication successful!</h2><p>You can close this window and return to Xplorer.</p></body></html>";
                let _ = stream.write_all(response.as_bytes()).await;
                let _ = stream.shutdown().await;
                return Ok::<String, String>(code);
            } else {
                // Not the request we expected; send a simple response and keep listening
                let response = "HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n";
                let _ = stream.write_all(response.as_bytes()).await;
                let _ = stream.shutdown().await;
            }
        }
    })
    .await
    .map_err(|_| "Authentication timed out after 120 seconds".to_string())??;

    // Exchange authorization code for tokens
    let client = reqwest::Client::new();
    let token_resp = client
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("code", auth_code.as_str()),
            ("client_id", client_id.as_str()),
            ("client_secret", client_secret.as_str()),
            ("redirect_uri", redirect_uri.as_str()),
            ("grant_type", "authorization_code"),
            ("code_verifier", code_verifier.as_str()),
        ])
        .send()
        .await
        .map_err(|e| format!("Token exchange request failed: {}", e))?;

    if !token_resp.status().is_success() {
        let status = token_resp.status();
        let body = token_resp.text().await.unwrap_or_default();
        return Err(format!(
            "Token exchange failed with status {}: {}",
            status, body
        ));
    }

    let tokens: OAuthTokenResponse = token_resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse token response: {}", e))?;

    // Fetch user info
    let user_info: UserInfo = client
        .get("https://www.googleapis.com/oauth2/v2/userinfo")
        .header("Authorization", format!("Bearer {}", tokens.access_token))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch user info: {}", e))?
        .json()
        .await
        .map_err(|e| format!("Failed to parse user info: {}", e))?;

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let account_id = format!("gdrive-{}", now);
    let display_name = user_info.name.unwrap_or_else(|| user_info.email.clone());

    let account = GoogleDriveAccount {
        id: account_id.clone(),
        email: user_info.email.clone(),
        display_name: display_name.clone(),
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token.unwrap_or_default(),
        token_expiry: now + tokens.expires_in,
    };

    GDRIVE_POOL.add_account(account);
    save_accounts()?;

    Ok(GDriveAccountInfo {
        id: account_id,
        email: user_info.email,
        display_name,
    })
}

/// 2. Disconnect / remove a Google Drive account.
#[tauri::command]
pub async fn gdrive_disconnect(account_id: String) -> Result<(), String> {
    GDRIVE_POOL.remove_account(&account_id);
    save_accounts()?;
    Ok(())
}

/// 3. List all connected Google Drive accounts (without tokens).
#[tauri::command]
pub async fn gdrive_list_accounts() -> Result<Vec<GDriveAccountInfo>, String> {
    let _ = load_accounts();
    let accounts = GDRIVE_POOL.get_all_accounts();
    Ok(accounts
        .into_iter()
        .map(|a| GDriveAccountInfo {
            id: a.id,
            email: a.email,
            display_name: a.display_name,
        })
        .collect())
}

/// 4. List files in a Google Drive folder.
#[tauri::command]
pub async fn gdrive_list_files(
    account_id: String,
    folder_id: String,
) -> Result<Vec<GDriveFileEntry>, String> {
    let token = ensure_valid_token(&account_id).await?;
    let client = reqwest::Client::new();

    let query = format!(
        "'{}' in parents and trashed = false",
        folder_id.replace('\'', "\\'")
    );

    let resp = client
        .get("https://www.googleapis.com/drive/v3/files")
        .header("Authorization", format!("Bearer {}", token))
        .query(&[
            ("q", query.as_str()),
            (
                "fields",
                "files(id,name,mimeType,size,modifiedTime,parents),nextPageToken",
            ),
            ("pageSize", "1000"),
            ("orderBy", "folder,name"),
        ])
        .send()
        .await
        .map_err(|e| format!("Failed to list files: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!(
            "List files failed with status {}: {}",
            status, body
        ));
    }

    let file_list: DriveFileList = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse file list: {}", e))?;

    let files = file_list.files.unwrap_or_default();
    Ok(files
        .iter()
        .map(|f| to_file_entry(f, &account_id))
        .collect())
}

/// 5. Download a file from Google Drive to a local path.
#[tauri::command]
pub async fn gdrive_download_file(
    account_id: String,
    file_id: String,
    local_path: String,
) -> Result<(), String> {
    let token = ensure_valid_token(&account_id).await?;
    let client = reqwest::Client::new();

    let url = format!(
        "https://www.googleapis.com/drive/v3/files/{}?alt=media",
        file_id
    );

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("Failed to download file: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Download failed with status {}: {}", status, body));
    }

    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("Failed to read download body: {}", e))?;

    // Ensure parent directory exists
    if let Some(parent) = std::path::Path::new(&local_path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    std::fs::write(&local_path, &bytes).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

/// 6. Upload a local file to Google Drive (multipart upload).
#[tauri::command]
pub async fn gdrive_upload_file(
    account_id: String,
    local_path: String,
    parent_folder_id: String,
) -> Result<GDriveFileEntry, String> {
    let token = ensure_valid_token(&account_id).await?;
    let client = reqwest::Client::new();

    let path = std::path::Path::new(&local_path);
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("untitled")
        .to_string();

    let file_bytes =
        std::fs::read(&local_path).map_err(|e| format!("Failed to read local file: {}", e))?;

    // Build multipart form
    let metadata = serde_json::json!({
        "name": file_name,
        "parents": [parent_folder_id]
    });
    let metadata_json = serde_json::to_string(&metadata).map_err(|e| e.to_string())?;

    // Use a boundary for multipart
    let boundary = {
        use rand::Rng;
        let rand_bytes: [u8; 16] = rand::thread_rng().gen();
        format!("xplorer_{}", URL_SAFE_NO_PAD.encode(&rand_bytes))
    };

    let mut body = Vec::new();
    // Metadata part
    body.extend_from_slice(format!("--{}\r\n", boundary).as_bytes());
    body.extend_from_slice(b"Content-Type: application/json; charset=UTF-8\r\n\r\n");
    body.extend_from_slice(metadata_json.as_bytes());
    body.extend_from_slice(b"\r\n");
    // File content part
    body.extend_from_slice(format!("--{}\r\n", boundary).as_bytes());
    body.extend_from_slice(b"Content-Type: application/octet-stream\r\n\r\n");
    body.extend_from_slice(&file_bytes);
    body.extend_from_slice(b"\r\n");
    // End boundary
    body.extend_from_slice(format!("--{}--\r\n", boundary).as_bytes());

    let resp = client
        .post("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart")
        .header("Authorization", format!("Bearer {}", token))
        .header(
            "Content-Type",
            format!("multipart/related; boundary={}", boundary),
        )
        .body(body)
        .send()
        .await
        .map_err(|e| format!("Upload request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Upload failed with status {}: {}", status, body));
    }

    let uploaded_file: GoogleDriveFile = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse upload response: {}", e))?;

    Ok(to_file_entry(&uploaded_file, &account_id))
}

/// 7. Delete (trash) a file on Google Drive.
#[tauri::command]
pub async fn gdrive_delete_file(account_id: String, file_id: String) -> Result<(), String> {
    let token = ensure_valid_token(&account_id).await?;
    let client = reqwest::Client::new();

    let url = format!("https://www.googleapis.com/drive/v3/files/{}", file_id);

    let resp = client
        .patch(&url)
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({ "trashed": true }))
        .send()
        .await
        .map_err(|e| format!("Delete request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Delete failed with status {}: {}", status, body));
    }

    Ok(())
}

/// 8. Rename a file on Google Drive.
#[tauri::command]
pub async fn gdrive_rename_file(
    account_id: String,
    file_id: String,
    new_name: String,
) -> Result<(), String> {
    let token = ensure_valid_token(&account_id).await?;
    let client = reqwest::Client::new();

    let url = format!("https://www.googleapis.com/drive/v3/files/{}", file_id);

    let resp = client
        .patch(&url)
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({ "name": new_name }))
        .send()
        .await
        .map_err(|e| format!("Rename request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Rename failed with status {}: {}", status, body));
    }

    Ok(())
}

/// 9. Move a file to a different folder on Google Drive.
#[tauri::command]
pub async fn gdrive_move_file(
    account_id: String,
    file_id: String,
    new_parent_id: String,
    old_parent_id: String,
) -> Result<(), String> {
    let token = ensure_valid_token(&account_id).await?;
    let client = reqwest::Client::new();

    let url = format!(
        "https://www.googleapis.com/drive/v3/files/{}?addParents={}&removeParents={}",
        file_id, new_parent_id, old_parent_id
    );

    let resp = client
        .patch(&url)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("Move request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Move failed with status {}: {}", status, body));
    }

    Ok(())
}

/// 10. Create a new folder on Google Drive.
#[tauri::command]
pub async fn gdrive_create_folder(
    account_id: String,
    name: String,
    parent_folder_id: String,
) -> Result<GDriveFileEntry, String> {
    let token = ensure_valid_token(&account_id).await?;
    let client = reqwest::Client::new();

    let metadata = serde_json::json!({
        "name": name,
        "mimeType": "application/vnd.google-apps.folder",
        "parents": [parent_folder_id]
    });

    let resp = client
        .post("https://www.googleapis.com/drive/v3/files")
        .header("Authorization", format!("Bearer {}", token))
        .json(&metadata)
        .send()
        .await
        .map_err(|e| format!("Create folder request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!(
            "Create folder failed with status {}: {}",
            status, body
        ));
    }

    let created: GoogleDriveFile = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse create folder response: {}", e))?;

    Ok(to_file_entry(&created, &account_id))
}

/// 11. Get file content as a UTF-8 string from Google Drive.
#[tauri::command]
pub async fn gdrive_get_file_content(
    account_id: String,
    file_id: String,
) -> Result<String, String> {
    let token = ensure_valid_token(&account_id).await?;
    let client = reqwest::Client::new();

    let url = format!(
        "https://www.googleapis.com/drive/v3/files/{}?alt=media",
        file_id
    );

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("Failed to get file content: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!(
            "Get file content failed with status {}: {}",
            status, body
        ));
    }

    let text = resp
        .text()
        .await
        .map_err(|e| format!("Failed to read file content: {}", e))?;

    Ok(text)
}

// ---------------------------------------------------------------------------
// Settings Commands
// ---------------------------------------------------------------------------

/// Return the current Google Drive OAuth settings.
/// The client_secret is masked for security.
#[tauri::command]
pub async fn get_gdrive_settings() -> Result<GoogleDriveSettings, String> {
    match load_gdrive_settings() {
        Ok(mut settings) => {
            // Mask the secret for display
            if settings.client_secret.len() > 8 {
                let visible = &settings.client_secret[..4];
                settings.client_secret = format!("{}***", visible);
            }
            Ok(settings)
        }
        Err(_) => {
            // Return empty settings if not configured yet
            Ok(GoogleDriveSettings {
                client_id: String::new(),
                client_secret: String::new(),
            })
        }
    }
}

/// Save Google Drive OAuth credentials.
#[tauri::command]
pub async fn update_gdrive_settings(
    client_id: String,
    client_secret: String,
) -> Result<(), String> {
    if client_id.trim().is_empty() || client_secret.trim().is_empty() {
        return Err("Both Client ID and Client Secret are required.".to_string());
    }

    // If the secret is masked (user didn't change it), preserve the existing one
    let actual_secret = if client_secret.ends_with("***") {
        let existing = load_gdrive_settings()
            .map(|s| s.client_secret)
            .unwrap_or_default();
        if existing.is_empty() {
            return Err("Please enter the full Client Secret.".to_string());
        }
        existing
    } else {
        client_secret.trim().to_string()
    };

    let settings = GoogleDriveSettings {
        client_id: client_id.trim().to_string(),
        client_secret: actual_secret,
    };
    save_gdrive_settings(&settings)?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/// Simple percent-encoding for URL query parameters.
fn urlencoding(s: &str) -> String {
    let mut result = String::with_capacity(s.len() * 2);
    for byte in s.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                result.push(byte as char);
            }
            _ => {
                result.push('%');
                result.push_str(&format!("{:02X}", byte));
            }
        }
    }
    result
}

/// Extract the `code` and `state` query parameters from an HTTP GET request line.
/// Returns `Some((code, Option<state>))` if a `code` parameter is present,
/// or `None` if this is not an OAuth callback request.
fn extract_code_and_state_from_request(request: &str) -> Option<(String, Option<String>)> {
    // Typical: "GET /?code=4/0AY0e-...&state=abc123&scope=... HTTP/1.1\r\n..."
    let first_line = request.lines().next()?;
    let path = first_line.split_whitespace().nth(1)?;
    let query = path.split('?').nth(1)?;

    let mut code: Option<String> = None;
    let mut state: Option<String> = None;

    for param in query.split('&') {
        let mut parts = param.splitn(2, '=');
        let key = parts.next()?;
        let value = parts.next().unwrap_or("");
        match key {
            "code" => code = Some(url_decode(value)),
            "state" => state = Some(url_decode(value)),
            _ => {}
        }
    }

    code.map(|c| (c, state))
}

/// Basic URL decoding for the authorization code.
fn url_decode(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut chars = s.chars();
    while let Some(c) = chars.next() {
        if c == '%' {
            let hex: String = chars.by_ref().take(2).collect();
            if let Ok(byte) = u8::from_str_radix(&hex, 16) {
                result.push(byte as char);
            } else {
                result.push('%');
                result.push_str(&hex);
            }
        } else if c == '+' {
            result.push(' ');
        } else {
            result.push(c);
        }
    }
    result
}
