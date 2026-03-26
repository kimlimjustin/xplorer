// Shared async Ollama HTTP client module.
// Provides a reusable singleton client for AI indexer (vision) and vector store (embeddings),
// replacing scattered reqwest calls across ai_indexer.rs and vector_store.rs.

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::OnceLock;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

// ===== Constants =====

const OLLAMA_BASE_URL: &str = "http://localhost:11434";

const VISION_MODELS: &[&str] = &[
    "llava",
    "bakllava",
    "moondream",
    "llava-llama3",
    "llava:13b",
    "llava:7b",
];

const EMBEDDING_MODELS: &[&str] = &["nomic-embed-text", "all-minilm", "mxbai-embed-large"];

const VISION_TIMEOUT_SECS: u64 = 120;
const EMBEDDING_TIMEOUT_SECS: u64 = 30;
const LIST_TIMEOUT_SECS: u64 = 5;

/// How long (in seconds) an availability check result is cached before re-probing.
const AVAILABILITY_CACHE_SECS: u64 = 30;

/// Timeout (in milliseconds) for the synchronous availability probe.
const AVAILABILITY_PROBE_TIMEOUT_MS: u64 = 500;

// ===== Request / Response types (private) =====

#[derive(Debug, Serialize)]
struct OllamaGenerateRequest {
    model: String,
    prompt: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    images: Option<Vec<String>>,
    stream: bool,
}

#[derive(Debug, Deserialize)]
struct OllamaGenerateResponse {
    response: String,
    #[allow(dead_code)]
    done: bool,
}

#[derive(Debug, Serialize)]
struct OllamaEmbeddingRequest {
    model: String,
    prompt: String,
}

#[derive(Debug, Deserialize)]
struct OllamaEmbeddingResponse {
    embedding: Vec<f32>,
}

#[derive(Debug, Deserialize)]
struct OllamaModelList {
    models: Vec<OllamaModel>,
}

#[derive(Debug, Deserialize)]
struct OllamaModel {
    name: String,
}

// ===== Singleton =====

static INSTANCE: OnceLock<OllamaClient> = OnceLock::new();

/// Return a reference to the global `OllamaClient` singleton.
/// The client is lazily created on first call and lives for the process lifetime.
pub fn get_client() -> &'static OllamaClient {
    INSTANCE.get_or_init(OllamaClient::new)
}

// ===== OllamaClient =====

pub struct OllamaClient {
    /// General-purpose async client (no per-request timeout — set per call).
    client: reqwest::Client,
    /// Cached availability flag.
    available: AtomicBool,
    /// Unix timestamp (seconds) of the last availability probe.
    available_checked_at: AtomicU64,
}

impl OllamaClient {
    fn new() -> Self {
        let client = reqwest::Client::builder()
            .pool_max_idle_per_host(2)
            .build()
            .unwrap_or_else(|e| {
                tracing::error!("Failed to build reqwest::Client: {}", e);
                reqwest::Client::new()
            });

        Self {
            client,
            available: AtomicBool::new(false),
            available_checked_at: AtomicU64::new(0),
        }
    }

    // ----- Public API -----

    /// POST `/api/generate` with base64-encoded images and return the response text.
    pub async fn generate_vision(
        &self,
        model: &str,
        prompt: &str,
        images: &[String],
    ) -> Result<String, String> {
        let url = format!("{}/api/generate", OLLAMA_BASE_URL);

        let body = OllamaGenerateRequest {
            model: model.to_string(),
            prompt: prompt.to_string(),
            images: if images.is_empty() {
                None
            } else {
                Some(images.to_vec())
            },
            stream: false,
        };

        let response = self
            .client
            .post(&url)
            .timeout(Duration::from_secs(VISION_TIMEOUT_SECS))
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Ollama vision request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(format!("Ollama vision error ({}): {}", status, text));
        }

        let parsed: OllamaGenerateResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse vision response: {}", e))?;

        Ok(parsed.response)
    }

    /// POST `/api/embeddings` and return the embedding vector.
    pub async fn get_embedding(&self, model: &str, text: &str) -> Result<Vec<f32>, String> {
        let url = format!("{}/api/embeddings", OLLAMA_BASE_URL);

        let body = OllamaEmbeddingRequest {
            model: model.to_string(),
            prompt: text.to_string(),
        };

        let response = self
            .client
            .post(&url)
            .timeout(Duration::from_secs(EMBEDDING_TIMEOUT_SECS))
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Embedding request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(format!("Embedding error ({}): {}", status, text));
        }

        let parsed: OllamaEmbeddingResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse embedding response: {}", e))?;

        Ok(parsed.embedding)
    }

    /// GET `/api/tags` and return a list of installed model names.
    pub async fn list_models(&self) -> Result<Vec<String>, String> {
        let url = format!("{}/api/tags", OLLAMA_BASE_URL);

        let response = self
            .client
            .get(&url)
            .timeout(Duration::from_secs(LIST_TIMEOUT_SECS))
            .send()
            .await
            .map_err(|e| format!("Failed to list Ollama models: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(format!("Model list error ({}): {}", status, text));
        }

        let parsed: OllamaModelList = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse model list: {}", e))?;

        Ok(parsed.models.into_iter().map(|m| m.name).collect())
    }

    /// Find the first available vision-capable model from the installed list.
    pub async fn detect_vision_model(&self) -> Option<String> {
        let models = self.list_models().await.ok()?;
        for model_name in &models {
            if is_vision_model(model_name) {
                return Some(model_name.clone());
            }
        }
        None
    }

    /// Find the first available embedding model from the installed list.
    pub async fn detect_embedding_model(&self) -> Option<String> {
        let models = self.list_models().await.ok()?;
        for model_name in &models {
            if is_embedding_model(model_name) {
                return Some(model_name.clone());
            }
        }
        None
    }

    /// Quick check whether Ollama is reachable. The result is cached for
    /// [`AVAILABILITY_CACHE_SECS`] seconds so repeated calls are cheap.
    pub fn is_available(&self) -> bool {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let last_check = self.available_checked_at.load(Ordering::Relaxed);

        if now.saturating_sub(last_check) < AVAILABILITY_CACHE_SECS {
            return self.available.load(Ordering::Relaxed);
        }

        // Probe synchronously with a very short timeout.
        // This is intentionally blocking so callers that only need a bool
        // do not have to be async.
        let reachable = reqwest::blocking::Client::builder()
            .timeout(Duration::from_millis(AVAILABILITY_PROBE_TIMEOUT_MS))
            .build()
            .ok()
            .and_then(|c| c.get(&format!("{}/api/tags", OLLAMA_BASE_URL)).send().ok())
            .map(|r| r.status().is_success())
            .unwrap_or(false);

        self.available.store(reachable, Ordering::Relaxed);
        self.available_checked_at.store(now, Ordering::Relaxed);

        reachable
    }
}

// ===== Helpers (public so they can be reused and tested) =====

/// Check whether a model name looks like a vision model by partial matching
/// against the known [`VISION_MODELS`] list.
pub fn is_vision_model(name: &str) -> bool {
    let lower = name.to_lowercase();
    VISION_MODELS.iter().any(|v| lower.contains(v))
}

/// Check whether a model name looks like an embedding model by partial matching
/// against the known [`EMBEDDING_MODELS`] list.
pub fn is_embedding_model(name: &str) -> bool {
    let lower = name.to_lowercase();
    EMBEDDING_MODELS.iter().any(|e| lower.contains(e))
}

/// Build the full URL for an Ollama API endpoint.
pub fn build_url(endpoint: &str) -> String {
    format!("{}{}", OLLAMA_BASE_URL, endpoint)
}

// ===== Tests =====

#[cfg(test)]
mod tests {
    use super::*;

    // --- is_vision_model ---

    #[test]
    fn test_is_vision_model_exact() {
        assert!(is_vision_model("llava"));
        assert!(is_vision_model("bakllava"));
        assert!(is_vision_model("moondream"));
    }

    #[test]
    fn test_is_vision_model_case_insensitive() {
        assert!(is_vision_model("LLaVA"));
        assert!(is_vision_model("BAKLLAVA"));
        assert!(is_vision_model("MoonDream"));
    }

    #[test]
    fn test_is_vision_model_partial_match() {
        // Ollama often appends tags like ":latest" or ":13b"
        assert!(is_vision_model("llava:latest"));
        assert!(is_vision_model("llava:13b"));
        assert!(is_vision_model("llava:7b"));
        assert!(is_vision_model("llava-llama3:latest"));
        assert!(is_vision_model("bakllava:7b-q4_0"));
        assert!(is_vision_model("moondream:1.8b-v2-fp16"));
    }

    #[test]
    fn test_is_vision_model_negative() {
        assert!(!is_vision_model("mistral"));
        assert!(!is_vision_model("nomic-embed-text"));
        assert!(!is_vision_model("codellama"));
        assert!(!is_vision_model(""));
    }

    // --- is_embedding_model ---

    #[test]
    fn test_is_embedding_model_exact() {
        assert!(is_embedding_model("nomic-embed-text"));
        assert!(is_embedding_model("all-minilm"));
        assert!(is_embedding_model("mxbai-embed-large"));
    }

    #[test]
    fn test_is_embedding_model_partial_match() {
        assert!(is_embedding_model("nomic-embed-text:latest"));
        assert!(is_embedding_model("all-minilm:l6-v2"));
        assert!(is_embedding_model("mxbai-embed-large:latest"));
    }

    #[test]
    fn test_is_embedding_model_negative() {
        assert!(!is_embedding_model("llava"));
        assert!(!is_embedding_model("mistral"));
        assert!(!is_embedding_model("codellama"));
        assert!(!is_embedding_model(""));
    }

    // --- Default client creation ---

    #[test]
    fn test_get_client_returns_same_instance() {
        let a = get_client() as *const OllamaClient;
        let b = get_client() as *const OllamaClient;
        assert_eq!(a, b, "get_client() must return the same singleton");
    }

    // --- URL construction ---

    #[test]
    fn test_build_url_generate() {
        assert_eq!(
            build_url("/api/generate"),
            "http://localhost:11434/api/generate"
        );
    }

    #[test]
    fn test_build_url_embeddings() {
        assert_eq!(
            build_url("/api/embeddings"),
            "http://localhost:11434/api/embeddings"
        );
    }

    #[test]
    fn test_build_url_tags() {
        assert_eq!(build_url("/api/tags"), "http://localhost:11434/api/tags");
    }
}
