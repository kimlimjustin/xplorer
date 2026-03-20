use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use std::time::{Instant, SystemTime};
use tauri::{AppHandle, Emitter};
use crate::operations::types::{FileOperationProgress, OperationProgress, OperationStatus};

pub type ProgressCallback = Arc<dyn Fn(FileOperationProgress) + Send + Sync>;

#[derive(Clone)]
pub struct ProgressManager {
    app_handle: Option<AppHandle>,
    operations: Arc<Mutex<HashMap<String, OperationProgress>>>,
    file_operations: Arc<Mutex<HashMap<String, FileOperationProgress>>>,
    callbacks: Arc<Mutex<HashMap<String, ProgressCallback>>>,
}

impl ProgressManager {
    pub fn new() -> Self {
        Self {
            app_handle: None,
            operations: Arc::new(Mutex::new(HashMap::new())),
            file_operations: Arc::new(Mutex::new(HashMap::new())),
            callbacks: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn with_app_handle(mut self, app_handle: AppHandle) -> Self {
        self.app_handle = Some(app_handle);
        self
    }

    pub fn start_operation(
        &self,
        operation_id: String,
        operation_type: String,
        total_count: u64,
        total_bytes: u64,
    ) -> String {
        let progress = OperationProgress {
            operation_id: operation_id.clone(),
            operation_type,
            current_file: String::new(),
            processed_count: 0,
            total_count,
            bytes_processed: 0,
            total_bytes,
            status: OperationStatus::Starting,
            error_message: None,
            progress_percentage: 0.0,
            estimated_remaining: None,
            start_time: Some(Instant::now()),
        };

        if let Ok(mut operations) = self.operations.lock() {
            operations.insert(operation_id.clone(), progress.clone());
        }

        self.notify_progress(&progress);
        operation_id
    }

    pub fn update_progress(
        &self,
        operation_id: &str,
        current_file: String,
        processed_count: u64,
        bytes_processed: u64,
    ) {
        if let Ok(mut operations) = self.operations.lock() {
            if let Some(progress) = operations.get_mut(operation_id) {
                progress.current_file = current_file;
                progress.processed_count = processed_count;
                progress.bytes_processed = bytes_processed;
                progress.status = OperationStatus::InProgress;
                
                // Calculate progress percentage
                if progress.total_count > 0 {
                    progress.progress_percentage = 
                        (processed_count as f64 / progress.total_count as f64) * 100.0;
                }

                // Estimate remaining time based on processing rate
                if processed_count > 0 && progress.total_count > processed_count {
                    let elapsed = progress.start_time
                        .map(|t| t.elapsed().as_secs())
                        .unwrap_or(0);

                    if elapsed > 0 {
                        let rate = processed_count as f64 / elapsed as f64;
                        if rate > 0.0 {
                            let remaining_items = progress.total_count - processed_count;
                            progress.estimated_remaining = Some((remaining_items as f64 / rate) as u64);
                        }
                    }
                }

                self.notify_progress(progress);
            }
        }
    }

    pub fn complete_operation(&self, operation_id: &str) {
        if let Ok(mut operations) = self.operations.lock() {
            if let Some(progress) = operations.get_mut(operation_id) {
                progress.status = OperationStatus::Completed;
                progress.progress_percentage = 100.0;
                progress.estimated_remaining = Some(0);
                
                self.notify_progress(progress);
            }
        }
    }

    pub fn fail_operation(&self, operation_id: &str, error_message: String) {
        if let Ok(mut operations) = self.operations.lock() {
            if let Some(progress) = operations.get_mut(operation_id) {
                progress.status = OperationStatus::Failed;
                progress.error_message = Some(error_message);
                
                self.notify_progress(progress);
            }
        }
    }

    fn notify_progress(&self, progress: &OperationProgress) {
        // Convert to FileOperationProgress so the frontend receives a consistent shape
        let file_progress = FileOperationProgress {
            operation_id: progress.operation_id.clone(),
            operation_type: progress.operation_type.clone(),
            source_path: String::new(),
            destination_path: None,
            current_file: progress.current_file.clone(),
            bytes_processed: progress.bytes_processed,
            total_bytes: progress.total_bytes,
            files_processed: progress.processed_count,
            total_files: progress.total_count,
            progress_percentage: progress.progress_percentage,
            speed_bytes_per_second: 0.0,
            estimated_remaining_seconds: progress.estimated_remaining,
            status: progress.status.clone(),
            error_message: progress.error_message.clone(),
            copy_strategy: None,
            hardware_acceleration: false,
        };

        if let Some(app_handle) = &self.app_handle {
            let _ = app_handle.emit("file-operation-progress", &file_progress);
        }
    }

    // New methods for accelerated file operations
    pub fn start_file_operation(
        &self,
        operation_id: String,
        operation_type: String,
        source_path: String,
        destination_path: Option<String>,
        total_files: u64,
        total_bytes: u64,
    ) -> String {
        let progress = FileOperationProgress {
            operation_id: operation_id.clone(),
            operation_type,
            source_path,
            destination_path,
            current_file: String::new(),
            bytes_processed: 0,
            total_bytes,
            files_processed: 0,
            total_files,
            progress_percentage: 0.0,
            speed_bytes_per_second: 0.0,
            estimated_remaining_seconds: None,
            status: OperationStatus::Starting,
            error_message: None,
            copy_strategy: None,
            hardware_acceleration: false,
        };

        if let Ok(mut operations) = self.file_operations.lock() {
            operations.insert(operation_id.clone(), progress.clone());
        }

        self.notify_file_progress(&progress);
        operation_id
    }

    pub fn update_file_progress(
        &self,
        operation_id: &str,
        current_file: String,
        files_processed: u64,
        bytes_processed: u64,
        copy_strategy: Option<String>,
        hardware_acceleration: bool,
        speed_bytes_per_second: f64,
    ) {
        if let Ok(mut operations) = self.file_operations.lock() {
            if let Some(progress) = operations.get_mut(operation_id) {
                progress.current_file = current_file;
                progress.files_processed = files_processed;
                progress.bytes_processed = bytes_processed;
                progress.status = OperationStatus::InProgress;
                progress.copy_strategy = copy_strategy;
                progress.hardware_acceleration = hardware_acceleration;
                progress.speed_bytes_per_second = speed_bytes_per_second;
                
                // Calculate progress percentage
                if progress.total_files > 0 {
                    progress.progress_percentage = 
                        (files_processed as f64 / progress.total_files as f64) * 100.0;
                }

                // Estimate remaining time
                if speed_bytes_per_second > 0.0 && progress.total_bytes > bytes_processed {
                    let remaining_bytes = progress.total_bytes - bytes_processed;
                    progress.estimated_remaining_seconds = Some((remaining_bytes as f64 / speed_bytes_per_second) as u64);
                }

                self.notify_file_progress(progress);
            }
        }
    }

    pub fn complete_file_operation(&self, operation_id: &str) {
        if let Ok(mut operations) = self.file_operations.lock() {
            if let Some(progress) = operations.get_mut(operation_id) {
                progress.status = OperationStatus::Completed;
                progress.progress_percentage = 100.0;
                progress.estimated_remaining_seconds = Some(0);
                
                self.notify_file_progress(progress);
            }
        }
    }

    pub fn fail_file_operation(&self, operation_id: &str, error_message: String) {
        if let Ok(mut operations) = self.file_operations.lock() {
            if let Some(progress) = operations.get_mut(operation_id) {
                progress.status = OperationStatus::Failed;
                progress.error_message = Some(error_message);
                
                self.notify_file_progress(progress);
            }
        }
    }

    fn notify_file_progress(&self, progress: &FileOperationProgress) {
        // Emit to frontend via Tauri
        if let Some(app_handle) = &self.app_handle {
            let _ = app_handle.emit("file-operation-progress", progress);
        }

        // Call registered callbacks
        if let Ok(callbacks) = self.callbacks.lock() {
            if let Some(callback) = callbacks.get(&progress.operation_id) {
                callback(progress.clone());
            }
        }
    }
}

pub fn generate_operation_id() -> String {
    format!(
        "op_{}",
        SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    )
}