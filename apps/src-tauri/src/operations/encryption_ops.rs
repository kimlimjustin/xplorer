use std::fs;
use std::path::Path;
use std::sync::Arc;

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use argon2::{Algorithm, Argon2, Params, Version};
use rand::RngCore;
use tauri::{command, AppHandle, State};

use crate::audit_log::log_operation;
use crate::operations::progress::{generate_operation_id, ProgressManager};
use crate::operations::validate_file_path;

const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 12;
const KEY_LEN: usize = 32;

// Encrypted file layout:
//   [salt: 16 bytes][nonce: 12 bytes][ciphertext: variable]
//
// - salt   : random bytes fed to Argon2id for key derivation
// - nonce  : random 96-bit value for AES-256-GCM
// - ciphertext : AES-256-GCM authenticated ciphertext (includes 16-byte tag)

/// Minimum password length for encryption operations.
const MIN_PASSWORD_LENGTH: usize = 8;

fn derive_key(password: &str, salt: &[u8]) -> Result<[u8; KEY_LEN], String> {
    let mut key = [0u8; KEY_LEN];
    let argon2 = Argon2::new(
        Algorithm::Argon2id,
        Version::V0x13,
        Params::new(65536, 3, 4, Some(32)).map_err(|e| format!("Argon2 params error: {}", e))?,
    );
    argon2
        .hash_password_into(password.as_bytes(), salt, &mut key)
        .map_err(|e| format!("Key derivation failed: {}", e))?;
    Ok(key)
}

#[command]
pub async fn encrypt_file(
    path: String,
    password: String,
    delete_original: Option<bool>,
    _app_handle: AppHandle,
    progress_manager: State<'_, Arc<ProgressManager>>,
) -> Result<String, String> {
    validate_file_path(&path)?;

    let src = Path::new(&path);
    if !src.exists() {
        return Err(format!("File not found: {}", path));
    }
    if src.is_dir() {
        return Err("Cannot encrypt a directory".to_string());
    }
    if password.len() < MIN_PASSWORD_LENGTH {
        return Err(format!(
            "Password must be at least {} characters long",
            MIN_PASSWORD_LENGTH
        ));
    }

    let output_path = format!("{}.enc", path);
    let dest = Path::new(&output_path);
    if dest.exists() {
        return Err(format!("Output file already exists: {}", output_path));
    }

    let file_size = fs::metadata(&path)
        .map_err(|e| format!("Failed to read file metadata: {}", e))?
        .len();

    let op_id = generate_operation_id();
    progress_manager.start_file_operation(
        op_id.clone(),
        "encrypt".to_string(),
        path.clone(),
        Some(output_path.clone()),
        1,
        file_size,
    );

    let pm = progress_manager.inner().clone();
    let op_id_clone = op_id.clone();
    let path_for_log = path.clone();

    let result = tokio::task::spawn_blocking(move || {
        let plaintext = fs::read(&path).map_err(|e| format!("Failed to read file: {}", e))?;

        pm.update_file_progress(
            &op_id_clone,
            path.clone(),
            0,
            plaintext.len() as u64 / 3,
            None,
            false,
            0.0,
        );

        let mut salt = [0u8; SALT_LEN];
        rand::thread_rng().fill_bytes(&mut salt);

        let mut nonce_bytes = [0u8; NONCE_LEN];
        rand::thread_rng().fill_bytes(&mut nonce_bytes);

        let key = derive_key(&password, &salt)?;

        pm.update_file_progress(
            &op_id_clone,
            path.clone(),
            0,
            plaintext.len() as u64 / 2,
            None,
            false,
            0.0,
        );

        let cipher =
            Aes256Gcm::new_from_slice(&key).map_err(|e| format!("Cipher init failed: {}", e))?;
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher
            .encrypt(nonce, plaintext.as_ref())
            .map_err(|e| format!("Encryption failed: {}", e))?;

        let mut output = Vec::with_capacity(SALT_LEN + NONCE_LEN + ciphertext.len());
        output.extend_from_slice(&salt);
        output.extend_from_slice(&nonce_bytes);
        output.extend_from_slice(&ciphertext);

        fs::write(&output_path, &output)
            .map_err(|e| format!("Failed to write encrypted file: {}", e))?;

        Ok::<String, String>(output_path)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?;

    match &result {
        Ok(out) => {
            progress_manager.complete_file_operation(&op_id);
            log_operation(
                "encrypt",
                vec![path_for_log.clone(), out.clone()],
                None,
                true,
            );

            // Securely delete original if requested
            if delete_original.unwrap_or(false) {
                let original = Path::new(&path_for_log);
                if original.exists() {
                    // Overwrite with zeros before deleting
                    if let Ok(metadata) = fs::metadata(&path_for_log) {
                        let size = metadata.len() as usize;
                        let zeros = vec![0u8; size];
                        let _ = fs::write(&path_for_log, &zeros);
                    }
                    let _ = fs::remove_file(&path_for_log);
                }
            }
        }
        Err(msg) => {
            progress_manager.fail_file_operation(&op_id, msg.clone());
            log_operation(
                "encrypt",
                vec![path_for_log.clone()],
                Some(msg.clone()),
                false,
            );
        }
    }

    result
}

#[command]
pub async fn decrypt_file(
    path: String,
    password: String,
    _app_handle: AppHandle,
    progress_manager: State<'_, Arc<ProgressManager>>,
) -> Result<String, String> {
    validate_file_path(&path)?;

    let src = Path::new(&path);
    if !src.exists() {
        return Err(format!("File not found: {}", path));
    }
    if src.is_dir() {
        return Err("Cannot decrypt a directory".to_string());
    }
    if password.len() < MIN_PASSWORD_LENGTH {
        return Err(format!(
            "Password must be at least {} characters long",
            MIN_PASSWORD_LENGTH
        ));
    }
    if !path.ends_with(".enc") {
        return Err("File does not have .enc extension".to_string());
    }

    let output_path = path
        .strip_suffix(".enc")
        .ok_or_else(|| "File does not have .enc extension".to_string())?
        .to_string();
    let dest = Path::new(&output_path);
    if dest.exists() {
        return Err(format!("Output file already exists: {}", output_path));
    }

    let file_size = fs::metadata(&path)
        .map_err(|e| format!("Failed to read file metadata: {}", e))?
        .len();

    let min_size = (SALT_LEN + NONCE_LEN) as u64;
    if file_size < min_size {
        return Err("File is too small to be a valid encrypted file".to_string());
    }

    let op_id = generate_operation_id();
    progress_manager.start_file_operation(
        op_id.clone(),
        "decrypt".to_string(),
        path.clone(),
        Some(output_path.clone()),
        1,
        file_size,
    );

    let pm = progress_manager.inner().clone();
    let op_id_clone = op_id.clone();
    let path_for_log = path.clone();

    let result = tokio::task::spawn_blocking(move || {
        let data = fs::read(&path).map_err(|e| format!("Failed to read file: {}", e))?;

        if data.len() < SALT_LEN + NONCE_LEN {
            return Err("File is too small to be a valid encrypted file".to_string());
        }

        pm.update_file_progress(
            &op_id_clone,
            path.clone(),
            0,
            data.len() as u64 / 3,
            None,
            false,
            0.0,
        );

        let salt = &data[..SALT_LEN];
        let nonce_bytes = &data[SALT_LEN..SALT_LEN + NONCE_LEN];
        let ciphertext = &data[SALT_LEN + NONCE_LEN..];

        let key = derive_key(&password, salt)?;

        pm.update_file_progress(
            &op_id_clone,
            path.clone(),
            0,
            data.len() as u64 / 2,
            None,
            false,
            0.0,
        );

        let cipher =
            Aes256Gcm::new_from_slice(&key).map_err(|e| format!("Cipher init failed: {}", e))?;
        let nonce = Nonce::from_slice(nonce_bytes);

        let plaintext = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|_| "Decryption failed: wrong password or corrupted file".to_string())?;

        fs::write(&output_path, &plaintext)
            .map_err(|e| format!("Failed to write decrypted file: {}", e))?;

        Ok::<String, String>(output_path)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?;

    match &result {
        Ok(out) => {
            progress_manager.complete_file_operation(&op_id);
            log_operation(
                "decrypt",
                vec![path_for_log.clone(), out.clone()],
                None,
                true,
            );
        }
        Err(msg) => {
            progress_manager.fail_file_operation(&op_id, msg.clone());
            log_operation(
                "decrypt",
                vec![path_for_log.clone()],
                Some(msg.clone()),
                false,
            );
        }
    }

    result
}

#[command]
pub fn is_encrypted_file(path: String) -> bool {
    path.ends_with(".enc")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_derive_key_produces_correct_length() {
        let salt = [0u8; SALT_LEN];
        let key = derive_key("test_password", &salt).unwrap();
        assert_eq!(key.len(), KEY_LEN);
    }

    #[test]
    fn test_derive_key_deterministic() {
        let salt = [42u8; SALT_LEN];
        let key1 = derive_key("password123", &salt).unwrap();
        let key2 = derive_key("password123", &salt).unwrap();
        assert_eq!(key1, key2);
    }

    #[test]
    fn test_derive_key_different_passwords_different_keys() {
        let salt = [1u8; SALT_LEN];
        let key1 = derive_key("password_a", &salt).unwrap();
        let key2 = derive_key("password_b", &salt).unwrap();
        assert_ne!(key1, key2);
    }

    #[test]
    fn test_derive_key_different_salts_different_keys() {
        let salt1 = [1u8; SALT_LEN];
        let salt2 = [2u8; SALT_LEN];
        let key1 = derive_key("same_password", &salt1).unwrap();
        let key2 = derive_key("same_password", &salt2).unwrap();
        assert_ne!(key1, key2);
    }

    #[test]
    fn test_is_encrypted_file_positive() {
        assert!(is_encrypted_file("document.pdf.enc".to_string()));
        assert!(is_encrypted_file("/path/to/file.txt.enc".to_string()));
    }

    #[test]
    fn test_is_encrypted_file_negative() {
        assert!(!is_encrypted_file("document.pdf".to_string()));
        assert!(!is_encrypted_file("file.encrypted".to_string()));
        assert!(!is_encrypted_file("file.enc.bak".to_string()));
    }

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let dir = tempdir().unwrap();
        let src_path = dir.path().join("test.txt");
        let enc_path = dir.path().join("test.txt.enc");
        let dec_path = dir.path().join("test.txt");

        let original = b"Hello, this is a secret message for testing AES-256-GCM encryption!";
        fs::write(&src_path, original).unwrap();

        let password = "strong_password_123";

        // Encrypt manually (without Tauri command machinery)
        let plaintext = fs::read(&src_path).unwrap();

        let mut salt = [0u8; SALT_LEN];
        rand::thread_rng().fill_bytes(&mut salt);

        let mut nonce_bytes = [0u8; NONCE_LEN];
        rand::thread_rng().fill_bytes(&mut nonce_bytes);

        let key = derive_key(password, &salt).unwrap();
        let cipher = Aes256Gcm::new_from_slice(&key).unwrap();
        let nonce = Nonce::from_slice(&nonce_bytes);
        let ciphertext = cipher.encrypt(nonce, plaintext.as_ref()).unwrap();

        let mut output = Vec::with_capacity(SALT_LEN + NONCE_LEN + ciphertext.len());
        output.extend_from_slice(&salt);
        output.extend_from_slice(&nonce_bytes);
        output.extend_from_slice(&ciphertext);

        fs::write(&enc_path, &output).unwrap();

        // Verify ciphertext is different from plaintext
        assert_ne!(&output[SALT_LEN + NONCE_LEN..], original.as_slice());

        // Decrypt manually
        let data = fs::read(&enc_path).unwrap();
        let d_salt = &data[..SALT_LEN];
        let d_nonce_bytes = &data[SALT_LEN..SALT_LEN + NONCE_LEN];
        let d_ciphertext = &data[SALT_LEN + NONCE_LEN..];

        let d_key = derive_key(password, d_salt).unwrap();
        let d_cipher = Aes256Gcm::new_from_slice(&d_key).unwrap();
        let d_nonce = Nonce::from_slice(d_nonce_bytes);
        let d_plaintext = d_cipher.decrypt(d_nonce, d_ciphertext).unwrap();

        assert_eq!(d_plaintext, original);
    }

    #[test]
    fn test_wrong_password_fails_decryption() {
        let dir = tempdir().unwrap();
        let src_path = dir.path().join("secret.dat");

        let original = b"Top secret data";
        fs::write(&src_path, original).unwrap();

        let plaintext = fs::read(&src_path).unwrap();

        let mut salt = [0u8; SALT_LEN];
        rand::thread_rng().fill_bytes(&mut salt);

        let mut nonce_bytes = [0u8; NONCE_LEN];
        rand::thread_rng().fill_bytes(&mut nonce_bytes);

        let key = derive_key("correct_password", &salt).unwrap();
        let cipher = Aes256Gcm::new_from_slice(&key).unwrap();
        let nonce = Nonce::from_slice(&nonce_bytes);
        let ciphertext = cipher.encrypt(nonce, plaintext.as_ref()).unwrap();

        let mut output = Vec::new();
        output.extend_from_slice(&salt);
        output.extend_from_slice(&nonce_bytes);
        output.extend_from_slice(&ciphertext);

        // Try to decrypt with wrong password
        let d_salt = &output[..SALT_LEN];
        let d_nonce_bytes = &output[SALT_LEN..SALT_LEN + NONCE_LEN];
        let d_ciphertext = &output[SALT_LEN + NONCE_LEN..];

        let wrong_key = derive_key("wrong_password", d_salt).unwrap();
        let d_cipher = Aes256Gcm::new_from_slice(&wrong_key).unwrap();
        let d_nonce = Nonce::from_slice(d_nonce_bytes);
        let result = d_cipher.decrypt(d_nonce, d_ciphertext);

        assert!(result.is_err());
    }

    #[test]
    fn test_file_header_layout() {
        let mut salt = [0u8; SALT_LEN];
        rand::thread_rng().fill_bytes(&mut salt);

        let mut nonce_bytes = [0u8; NONCE_LEN];
        rand::thread_rng().fill_bytes(&mut nonce_bytes);

        let key = derive_key("pw", &salt).unwrap();
        let cipher = Aes256Gcm::new_from_slice(&key).unwrap();
        let nonce = Nonce::from_slice(&nonce_bytes);
        let ciphertext = cipher.encrypt(nonce, b"data".as_ref()).unwrap();

        let mut output = Vec::new();
        output.extend_from_slice(&salt);
        output.extend_from_slice(&nonce_bytes);
        output.extend_from_slice(&ciphertext);

        // Verify the header is correctly structured
        assert_eq!(&output[..SALT_LEN], &salt);
        assert_eq!(&output[SALT_LEN..SALT_LEN + NONCE_LEN], &nonce_bytes);
        assert!(output.len() > SALT_LEN + NONCE_LEN);
    }
}
