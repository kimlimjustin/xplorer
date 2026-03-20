// Common test utilities

/// Helper to generate unique test identifiers
pub fn generate_test_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    format!("test_{}", timestamp)
}

/// Helper to create temporary test directories
pub fn create_temp_test_dir() -> tempfile::TempDir {
    tempfile::tempdir().expect("Failed to create temporary directory")
}

/// Performance testing helpers
pub struct PerformanceTimer {
    start: std::time::Instant,
}

impl PerformanceTimer {
    pub fn start() -> Self {
        Self {
            start: std::time::Instant::now(),
        }
    }

    pub fn elapsed_ms(&self) -> u128 {
        self.start.elapsed().as_millis()
    }

    pub fn assert_completed_within_ms(&self, max_ms: u128) {
        let elapsed = self.elapsed_ms();
        assert!(elapsed <= max_ms,
               "Operation took {}ms, expected <= {}ms", elapsed, max_ms);
    }
}

/// Async test helpers
pub async fn run_with_timeout<F, T>(future: F, timeout_ms: u64) -> Result<T, &'static str>
where
    F: std::future::Future<Output = T>,
{
    match tokio::time::timeout(
        tokio::time::Duration::from_millis(timeout_ms),
        future
    ).await {
        Ok(result) => Ok(result),
        Err(_) => Err("Operation timed out"),
    }
}

/// Logging helpers for tests
#[allow(dead_code)]
pub fn log_test_info(test_name: &str, message: &str) {
    println!("[TEST: {}] {}", test_name, message);
}

#[allow(dead_code)]
pub fn log_test_result(test_name: &str, success: bool, details: &str) {
    let status = if success { "PASS" } else { "FAIL" };
    println!("[TEST: {} - {}] {}", test_name, status, details);
}
