use keyring::Entry;
use tracing::{info, warn};

const SERVICE_NAME: &str = "xplorer-file-manager";

/// Store a secret in the OS keychain
pub fn store_secret(key: &str, value: &str) -> Result<(), String> {
    if value.is_empty() {
        // Don't store empty values — delete instead
        delete_secret(key).ok();
        return Ok(());
    }
    let entry = Entry::new(SERVICE_NAME, key).map_err(|e| format!("Keyring init error: {}", e))?;
    entry
        .set_password(value)
        .map_err(|e| format!("Failed to store secret '{}': {}", key, e))
}

/// Retrieve a secret from the OS keychain
pub fn get_secret(key: &str) -> Result<Option<String>, String> {
    let entry = Entry::new(SERVICE_NAME, key).map_err(|e| format!("Keyring init error: {}", e))?;
    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Failed to retrieve secret '{}': {}", key, e)),
    }
}

/// Delete a secret from the OS keychain
pub fn delete_secret(key: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, key).map_err(|e| format!("Keyring init error: {}", e))?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()), // Already gone
        Err(e) => Err(format!("Failed to delete secret '{}': {}", key, e)),
    }
}

/// Migrate a plaintext value to the keychain.
/// Returns the value (from keychain if migrated, or from plaintext if migration fails).
pub fn migrate_to_keychain(key: &str, plaintext_value: &str) -> String {
    if plaintext_value.is_empty() {
        // Check if already in keychain
        return get_secret(key).ok().flatten().unwrap_or_default();
    }
    // Try to store in keychain
    match store_secret(key, plaintext_value) {
        Ok(()) => {
            info!("[SecureCredentials] Migrated '{}' to OS keychain", key);
            plaintext_value.to_string()
        }
        Err(e) => {
            warn!(
                "[SecureCredentials] could not migrate '{}' to keychain: {}. Using plaintext fallback.",
                key, e
            );
            plaintext_value.to_string()
        }
    }
}
