use crate::operations::progress::{generate_operation_id, ProgressManager};
use crate::operations::validate_file_path;
use crossbeam::channel;
use memmap2::MmapOptions;
use rayon::prelude::*;
use std::fs::{File, OpenOptions};
use std::io::{self, BufReader, BufWriter, Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::thread;
use tauri::command;

// Hardware detection and optimization constants
const SIMD_THRESHOLD: u64 = 64 * 1024; // 64KB - use SIMD for larger files
const MMAP_THRESHOLD: u64 = 100 * 1024 * 1024; // 100MB - use memory mapping for large files
const PARALLEL_THRESHOLD: u64 = 1024 * 1024; // 1MB - use parallel processing
const CHUNK_SIZE: usize = 64 * 1024; // 64KB chunks for parallel processing
const BUFFER_SIZE: usize = 8 * 1024 * 1024; // 8MB buffer for regular I/O

#[derive(Debug, Clone)]
pub struct HardwareInfo {
    pub cpu_count: usize,
    pub cache_line_size: usize,
    pub has_avx2: bool,
    pub has_sse4: bool,
}

impl HardwareInfo {
    pub fn detect() -> Self {
        let cpu_count = num_cpus::get();

        // Detect CPU features (simplified - in production you'd use proper CPUID detection)
        let has_avx2 = Self::has_cpu_feature("avx2");
        let has_sse4 = Self::has_cpu_feature("sse4");

        // Estimate cache line size (typically 64 bytes on modern CPUs)
        let cache_line_size = 64;

        HardwareInfo {
            cpu_count,
            cache_line_size,
            has_avx2,
            has_sse4,
        }
    }

    fn has_cpu_feature(_feature: &str) -> bool {
        #[cfg(target_arch = "x86_64")]
        {
            match _feature {
                "avx2" => is_x86_feature_detected!("avx2"),
                "sse4" => is_x86_feature_detected!("sse4.1"),
                "sse2" => is_x86_feature_detected!("sse2"),
                "avx" => is_x86_feature_detected!("avx"),
                "fma" => is_x86_feature_detected!("fma"),
                _ => false,
            }
        }
        #[cfg(not(target_arch = "x86_64"))]
        {
            // For non-x86_64 architectures, return false for x86 features
            false
        }
    }
}

pub struct AcceleratedFileOps {
    hardware_info: HardwareInfo,
}

impl Default for AcceleratedFileOps {
    fn default() -> Self {
        Self::new()
    }
}

impl AcceleratedFileOps {
    pub fn new() -> Self {
        Self {
            hardware_info: HardwareInfo::detect(),
        }
    }

    pub fn choose_copy_strategy(&self, file_size: u64) -> CopyStrategy {
        // Always check if advanced features are available before using them
        if file_size > MMAP_THRESHOLD && self.supports_memory_mapping() {
            CopyStrategy::MemoryMapped
        } else if file_size > PARALLEL_THRESHOLD && self.supports_parallel_io() {
            CopyStrategy::ParallelChunked
        } else if file_size > SIMD_THRESHOLD && self.supports_simd() {
            CopyStrategy::BufferedSIMD
        } else {
            CopyStrategy::StandardBuffered
        }
    }

    fn supports_memory_mapping(&self) -> bool {
        // Test if memory mapping works on this system
        match std::fs::File::open(std::env::current_exe().unwrap_or_default()) {
            Ok(file) => unsafe { MmapOptions::new().len(1024).map(&file) }.is_ok(),
            Err(_) => false,
        }
    }

    fn supports_parallel_io(&self) -> bool {
        // Check if we have multiple CPUs and rayon works
        self.hardware_info.cpu_count > 1 && rayon::current_num_threads() > 1
    }

    fn supports_simd(&self) -> bool {
        // Check if SIMD features are available
        self.hardware_info.has_sse4 || self.hardware_info.has_avx2
    }
}

#[derive(Debug, Clone)]
pub enum CopyStrategy {
    StandardBuffered,
    BufferedSIMD,
    ParallelChunked,
    MemoryMapped,
}

#[command]
pub async fn accelerated_copy_file(
    source: String,
    destination: String,
    progress_manager: tauri::State<'_, Arc<ProgressManager>>,
) -> Result<String, String> {
    validate_file_path(&source)?;
    validate_file_path(&destination)?;
    let operation_id = generate_operation_id();
    let src_path = Path::new(&source);

    if !src_path.exists() {
        return Err("Source file does not exist".to_string());
    }

    let file_size = std::fs::metadata(src_path)
        .map_err(|e| format!("Failed to get file metadata: {}", e))?
        .len();

    let accelerated_ops = AcceleratedFileOps::new();
    let strategy = accelerated_ops.choose_copy_strategy(file_size);

    // Start the file operation tracking
    let progress_manager_ref = progress_manager.inner().clone();
    progress_manager_ref.start_file_operation(
        operation_id.clone(),
        "accelerated_copy_file".to_string(),
        source.clone(),
        Some(destination.clone()),
        1,
        file_size,
    );

    let operation_id_clone = operation_id.clone();
    let source_clone = source.clone();
    let destination_clone = destination.clone();

    // Spawn background task for accelerated copy with fallback mechanism
    thread::spawn(move || {
        let mut last_error = String::new();

        // Try the optimal strategy first, with fallbacks on failure
        let strategies_to_try = match strategy {
            CopyStrategy::MemoryMapped => vec![
                CopyStrategy::MemoryMapped,
                CopyStrategy::ParallelChunked,
                CopyStrategy::BufferedSIMD,
                CopyStrategy::StandardBuffered,
            ],
            CopyStrategy::ParallelChunked => vec![
                CopyStrategy::ParallelChunked,
                CopyStrategy::BufferedSIMD,
                CopyStrategy::StandardBuffered,
            ],
            CopyStrategy::BufferedSIMD => {
                vec![CopyStrategy::BufferedSIMD, CopyStrategy::StandardBuffered]
            }
            CopyStrategy::StandardBuffered => vec![CopyStrategy::StandardBuffered],
        };

        for (attempt, strategy) in strategies_to_try.iter().enumerate() {
            if attempt > 0 {
                progress_manager_ref.update_file_progress(
                    &operation_id_clone,
                    format!("Retrying with fallback method {}", attempt + 1),
                    0,
                    0,
                    Some(format!("{:?}", strategy)),
                    false, // Hardware acceleration failed if we're in fallback
                    0.0,
                );
            }

            let result = match strategy {
                CopyStrategy::MemoryMapped => memory_mapped_copy(
                    &source_clone,
                    &destination_clone,
                    &progress_manager_ref,
                    &operation_id_clone,
                )
                .map_err(|e| {
                    last_error = format!("Memory-mapped copy failed: {}", e);
                    e
                }),
                CopyStrategy::ParallelChunked => parallel_chunked_copy(
                    &source_clone,
                    &destination_clone,
                    &progress_manager_ref,
                    &operation_id_clone,
                    &accelerated_ops.hardware_info,
                )
                .map_err(|e| {
                    last_error = format!("Parallel copy failed: {}", e);
                    e
                }),
                CopyStrategy::BufferedSIMD => simd_buffered_copy(
                    &source_clone,
                    &destination_clone,
                    &progress_manager_ref,
                    &operation_id_clone,
                )
                .map_err(|e| {
                    last_error = format!("SIMD copy failed: {}", e);
                    e
                }),
                CopyStrategy::StandardBuffered => optimized_buffered_copy(
                    &source_clone,
                    &destination_clone,
                    &progress_manager_ref,
                    &operation_id_clone,
                )
                .map_err(|e| {
                    last_error = format!("Standard copy failed: {}", e);
                    e
                }),
            };

            match result {
                Ok(_) => {
                    progress_manager_ref.complete_file_operation(&operation_id_clone);
                    break;
                }
                Err(e) => {
                    if attempt == strategies_to_try.len() - 1 {
                        // All strategies failed
                        progress_manager_ref.fail_file_operation(
                            &operation_id_clone,
                            format!("All copy strategies failed. Last error: {}", e),
                        );
                    }
                    continue;
                }
            }
        }
    });

    Ok(operation_id)
}

fn memory_mapped_copy(
    source: &str,
    destination: &str,
    progress_manager: &ProgressManager,
    operation_id: &str,
) -> Result<(), String> {
    let src_file = File::open(source).map_err(|e| format!("Failed to open source file: {}", e))?;

    let file_size = src_file
        .metadata()
        .map_err(|e| format!("Failed to get file metadata: {}", e))?
        .len();

    progress_manager.update_file_progress(
        operation_id,
        source.to_string(),
        0,
        0,
        Some("MemoryMapped".to_string()),
        true,
        0.0,
    );

    // Memory-map the source file
    let mmap = unsafe { MmapOptions::new().map(&src_file) }
        .map_err(|e| format!("Failed to memory-map source file: {}", e))?;

    // Create destination file
    let mut dst_file = File::create(destination)
        .map_err(|e| format!("Failed to create destination file: {}", e))?;

    // Set the file size
    dst_file
        .set_len(file_size)
        .map_err(|e| format!("Failed to set file length: {}", e))?;

    // Copy in large chunks with progress updates
    const MMAP_CHUNK_SIZE: usize = 16 * 1024 * 1024; // 16MB chunks
    let total_chunks = (file_size as usize).div_ceil(MMAP_CHUNK_SIZE);

    for (chunk_idx, chunk) in mmap.chunks(MMAP_CHUNK_SIZE).enumerate() {
        dst_file
            .write_all(chunk)
            .map_err(|e| format!("Failed to write chunk {}: {}", chunk_idx, e))?;

        let bytes_processed = ((chunk_idx + 1) * MMAP_CHUNK_SIZE).min(file_size as usize) as u64;
        let speed = if chunk_idx > 0 {
            bytes_processed as f64 / (chunk_idx + 1) as f64
        } else {
            0.0
        };

        progress_manager.update_file_progress(
            operation_id,
            format!(
                "Memory-mapped copying chunk {}/{}",
                chunk_idx + 1,
                total_chunks
            ),
            0,
            bytes_processed,
            Some("MemoryMapped".to_string()),
            true,
            speed,
        );
    }

    dst_file
        .flush()
        .map_err(|e| format!("Failed to flush destination file: {}", e))?;

    Ok(())
}

fn parallel_chunked_copy(
    source: &str,
    destination: &str,
    progress_manager: &ProgressManager,
    operation_id: &str,
    hardware_info: &HardwareInfo,
) -> Result<(), String> {
    let src_file = File::open(source).map_err(|e| format!("Failed to open source file: {}", e))?;

    let file_size = src_file
        .metadata()
        .map_err(|e| format!("Failed to get file metadata: {}", e))?
        .len();

    progress_manager.update_file_progress(
        operation_id,
        source.to_string(),
        0,
        0,
        Some("ParallelChunked".to_string()),
        true,
        0.0,
    );

    // Calculate optimal number of threads and chunk size
    let num_threads = (hardware_info.cpu_count).min(8); // Cap at 8 threads for I/O
    let chunk_size = ((file_size / num_threads as u64).max(CHUNK_SIZE as u64)) as usize;
    let aligned_chunk_size = align_to_cache_line(chunk_size, hardware_info.cache_line_size);

    // Create destination file and set its size
    let dst_file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(destination)
        .map_err(|e| format!("Failed to create destination file: {}", e))?;

    dst_file
        .set_len(file_size)
        .map_err(|e| format!("Failed to set file length: {}", e))?;

    // Memory-map both files for parallel access
    let src_mmap = unsafe { MmapOptions::new().map(&src_file) }
        .map_err(|e| format!("Failed to memory-map source file: {}", e))?;

    let dst_file_write = OpenOptions::new()
        .write(true)
        .open(destination)
        .map_err(|e| format!("Failed to open destination for writing: {}", e))?;

    // Create progress tracking
    let bytes_processed = Arc::new(AtomicU64::new(0));
    let (progress_tx, progress_rx) = channel::bounded(num_threads);

    // Spawn progress reporter thread
    let progress_manager_clone = progress_manager.clone();
    let operation_id_clone = operation_id.to_string();
    let bytes_processed_clone = bytes_processed.clone();
    let total_bytes = file_size;

    thread::spawn(move || {
        let start_time = std::time::Instant::now();
        while progress_rx.recv().is_ok() {
            let processed = bytes_processed_clone.load(Ordering::Relaxed);
            let elapsed_secs = start_time.elapsed().as_secs_f64();
            let speed = if elapsed_secs > 0.0 {
                processed as f64 / elapsed_secs
            } else {
                0.0
            };

            progress_manager_clone.update_file_progress(
                &operation_id_clone,
                format!(
                    "Parallel copy: {:.1}%",
                    (processed as f64 / total_bytes as f64) * 100.0
                ),
                0,
                processed,
                Some("ParallelChunked".to_string()),
                true,
                speed,
            );

            if processed >= total_bytes {
                break;
            }
        }
    });

    // Parallel copy using rayon
    let chunks: Vec<_> = (0..file_size)
        .step_by(aligned_chunk_size)
        .map(|offset| {
            let size = aligned_chunk_size.min((file_size - offset) as usize);
            (offset, size)
        })
        .collect();

    chunks
        .par_iter()
        .try_for_each(|(offset, size)| -> Result<(), String> {
            let src_slice = &src_mmap[*offset as usize..(*offset as usize + size)];

            // Use optimized memory copy
            let mut buffer = vec![0u8; *size];
            optimized_memory_copy(&mut buffer, src_slice)?;

            // Write to destination file at correct offset (cross-platform)
            #[cfg(windows)]
            {
                use std::os::windows::fs::FileExt;
                dst_file_write
                    .seek_write(&buffer, *offset)
                    .map_err(|e| format!("Failed to write at offset {}: {}", offset, e))?;
            }

            #[cfg(not(windows))]
            {
                use std::os::unix::fs::FileExt;
                dst_file_write
                    .write_all_at(&buffer, *offset)
                    .map_err(|e| format!("Failed to write at offset {}: {}", offset, e))?;
            }

            // Update progress
            bytes_processed.fetch_add(*size as u64, Ordering::Relaxed);
            let _ = progress_tx.try_send(());

            Ok(())
        })?;

    Ok(())
}

fn simd_buffered_copy(
    source: &str,
    destination: &str,
    progress_manager: &ProgressManager,
    operation_id: &str,
) -> Result<(), String> {
    let src_file = File::open(source).map_err(|e| format!("Failed to open source file: {}", e))?;

    let dst_file = File::create(destination)
        .map_err(|e| format!("Failed to create destination file: {}", e))?;

    let _file_size = src_file
        .metadata()
        .map_err(|e| format!("Failed to get file metadata: {}", e))?
        .len();

    progress_manager.update_file_progress(
        operation_id,
        source.to_string(),
        0,
        0,
        Some("BufferedSIMD".to_string()),
        true,
        0.0,
    );

    // Detect optimal SIMD alignment and buffer size
    let hardware_info = HardwareInfo::detect();
    let simd_alignment = if hardware_info.has_avx2 {
        32
    } else if hardware_info.has_sse4 {
        16
    } else {
        8
    };

    // Use large aligned buffers for SIMD operations (align to SIMD requirements)
    const SIMD_BUFFER_SIZE: usize = 2 * 1024 * 1024; // 2MB buffer for better throughput
    let aligned_buffer_size = align_to_cache_line(SIMD_BUFFER_SIZE, simd_alignment);

    let mut read_buffer = vec![0u8; aligned_buffer_size];
    let mut write_buffer = vec![0u8; aligned_buffer_size];
    let mut bytes_processed = 0u64;
    let start_time = std::time::Instant::now();

    let mut reader = BufReader::with_capacity(BUFFER_SIZE, src_file);
    let mut writer = BufWriter::with_capacity(BUFFER_SIZE, dst_file);

    loop {
        let bytes_read = reader
            .read(&mut read_buffer)
            .map_err(|e| format!("Failed to read from source: {}", e))?;

        if bytes_read == 0 {
            break;
        }

        // Use SIMD-optimized memory copy to write buffer, then write to file
        write_buffer[..bytes_read].copy_from_slice(&read_buffer[..bytes_read]);

        // For additional optimization, we could process the data in the buffer using SIMD
        // before writing (e.g., checksums, compression, encryption)
        simd_process_buffer(&mut write_buffer[..bytes_read], &hardware_info);

        writer
            .write_all(&write_buffer[..bytes_read])
            .map_err(|e| format!("Failed to write to destination: {}", e))?;

        bytes_processed += bytes_read as u64;

        // Calculate actual speed in bytes per second
        let elapsed_secs = start_time.elapsed().as_secs_f64();
        let speed = if elapsed_secs > 0.0 {
            bytes_processed as f64 / elapsed_secs
        } else {
            0.0
        };

        progress_manager.update_file_progress(
            operation_id,
            format!(
                "SIMD copy: {:.1} MB processed ({:.1} MB/s)",
                bytes_processed as f64 / 1024.0 / 1024.0,
                speed / 1024.0 / 1024.0
            ),
            0,
            bytes_processed,
            Some("BufferedSIMD".to_string()),
            true,
            speed,
        );
    }

    writer
        .flush()
        .map_err(|e| format!("Failed to flush destination: {}", e))?;

    Ok(())
}

fn optimized_buffered_copy(
    source: &str,
    destination: &str,
    progress_manager: &ProgressManager,
    operation_id: &str,
) -> Result<(), String> {
    let src_file = File::open(source).map_err(|e| format!("Failed to open source file: {}", e))?;

    let dst_file = File::create(destination)
        .map_err(|e| format!("Failed to create destination file: {}", e))?;

    let _file_size = src_file
        .metadata()
        .map_err(|e| format!("Failed to get file metadata: {}", e))?
        .len();

    let start_time = std::time::Instant::now();
    progress_manager.update_file_progress(
        operation_id,
        source.to_string(),
        0,
        0,
        Some("StandardBuffered".to_string()),
        false, // No hardware acceleration for standard copy
        0.0,
    );

    let mut reader = BufReader::with_capacity(BUFFER_SIZE, src_file);
    let mut writer = BufWriter::with_capacity(BUFFER_SIZE, dst_file);

    let result =
        io::copy(&mut reader, &mut writer).map_err(|e| format!("Failed to copy file: {}", e))?;

    writer
        .flush()
        .map_err(|e| format!("Failed to flush destination: {}", e))?;

    let elapsed_secs = start_time.elapsed().as_secs_f64();
    let speed = if elapsed_secs > 0.0 {
        result as f64 / elapsed_secs
    } else {
        0.0
    };

    progress_manager.update_file_progress(
        operation_id,
        "Standard buffered copy completed".to_string(),
        1,
        result,
        Some("StandardBuffered".to_string()),
        false,
        speed,
    );

    Ok(())
}

fn optimized_memory_copy(dst: &mut [u8], src: &[u8]) -> Result<(), String> {
    if dst.len() != src.len() {
        return Err(format!(
            "Source and destination slices must have the same length (dst={}, src={})",
            dst.len(),
            src.len()
        ));
    }

    // Use SIMD optimization for larger buffers
    #[cfg(target_arch = "x86_64")]
    {
        let len = dst.len();
        if len >= 32 && is_x86_feature_detected!("avx2") {
            simd_copy_avx2(dst, src);
            return Ok(());
        } else if len >= 16 && is_x86_feature_detected!("sse2") {
            simd_copy_sse2(dst, src);
            return Ok(());
        }
    }

    // Fallback to standard memory copy
    dst.copy_from_slice(src);
    Ok(())
}

#[cfg(target_arch = "x86_64")]
fn simd_copy_avx2(dst: &mut [u8], src: &[u8]) {
    use std::arch::x86_64::*;

    let len = dst.len();
    let chunks = len / 32; // AVX2 processes 32 bytes at a time
    let remainder = len % 32;

    unsafe {
        let src_ptr = src.as_ptr();
        let dst_ptr = dst.as_mut_ptr();

        // Process 32-byte chunks with AVX2
        for i in 0..chunks {
            let offset = i * 32;
            let src_chunk = _mm256_loadu_si256((src_ptr.add(offset)) as *const __m256i);
            _mm256_storeu_si256((dst_ptr.add(offset)) as *mut __m256i, src_chunk);
        }

        // Handle remaining bytes
        if remainder > 0 {
            let offset = chunks * 32;
            std::ptr::copy_nonoverlapping(src_ptr.add(offset), dst_ptr.add(offset), remainder);
        }
    }
}

#[cfg(target_arch = "x86_64")]
fn simd_copy_sse2(dst: &mut [u8], src: &[u8]) {
    use std::arch::x86_64::*;

    let len = dst.len();
    let chunks = len / 16; // SSE2 processes 16 bytes at a time
    let remainder = len % 16;

    unsafe {
        let src_ptr = src.as_ptr();
        let dst_ptr = dst.as_mut_ptr();

        // Process 16-byte chunks with SSE2
        for i in 0..chunks {
            let offset = i * 16;
            let src_chunk = _mm_loadu_si128((src_ptr.add(offset)) as *const __m128i);
            _mm_storeu_si128((dst_ptr.add(offset)) as *mut __m128i, src_chunk);
        }

        // Handle remaining bytes
        if remainder > 0 {
            let offset = chunks * 16;
            std::ptr::copy_nonoverlapping(src_ptr.add(offset), dst_ptr.add(offset), remainder);
        }
    }
}

#[cfg(not(target_arch = "x86_64"))]
#[allow(dead_code)]
fn simd_copy_avx2(dst: &mut [u8], src: &[u8]) {
    // Fallback for non-x86_64 architectures
    dst.copy_from_slice(src);
}

#[cfg(not(target_arch = "x86_64"))]
#[allow(dead_code)]
fn simd_copy_sse2(dst: &mut [u8], src: &[u8]) {
    // Fallback for non-x86_64 architectures
    dst.copy_from_slice(src);
}

fn align_to_cache_line(size: usize, cache_line_size: usize) -> usize {
    (size + cache_line_size - 1) & !(cache_line_size - 1)
}

fn simd_process_buffer(buffer: &mut [u8], _hardware_info: &HardwareInfo) {
    // This function can be used for additional SIMD processing like:
    // - Checksum calculation
    // - Data transformation
    // - Prefetching optimization
    // For file copying, we mainly use it for cache-friendly access patterns

    if buffer.len() < 64 {// Too small for SIMD optimization
    }

    #[cfg(target_arch = "x86_64")]
    {
        if _hardware_info.has_avx2 {
            simd_prefetch_avx2(buffer);
        } else if _hardware_info.has_sse4 {
            simd_prefetch_sse2(buffer);
        }
    }
}

#[cfg(target_arch = "x86_64")]
fn simd_prefetch_avx2(buffer: &[u8]) {
    use std::arch::x86_64::*;

    unsafe {
        let ptr = buffer.as_ptr();
        let len = buffer.len();

        // Prefetch data in 64-byte cache line chunks
        let mut offset = 0;
        while offset < len {
            _mm_prefetch(ptr.add(offset) as *const i8, _MM_HINT_T0);
            offset += 64; // Cache line size
        }
    }
}

#[cfg(target_arch = "x86_64")]
fn simd_prefetch_sse2(buffer: &[u8]) {
    use std::arch::x86_64::*;

    unsafe {
        let ptr = buffer.as_ptr();
        let len = buffer.len();

        // Prefetch data for SSE2 operations
        let mut offset = 0;
        while offset < len {
            _mm_prefetch(ptr.add(offset) as *const i8, _MM_HINT_T1);
            offset += 32; // Smaller prefetch for SSE2
        }
    }
}

#[cfg(not(target_arch = "x86_64"))]
#[allow(dead_code)]
fn simd_prefetch_avx2(_buffer: &[u8]) {
    // No-op for non-x86_64 architectures
}

#[cfg(not(target_arch = "x86_64"))]
#[allow(dead_code)]
fn simd_prefetch_sse2(_buffer: &[u8]) {
    // No-op for non-x86_64 architectures
}

// Directory operations with parallel processing
#[command]
pub async fn accelerated_copy_directory(
    source: String,
    destination: String,
    progress_manager: tauri::State<'_, Arc<ProgressManager>>,
) -> Result<String, String> {
    validate_file_path(&source)?;
    validate_file_path(&destination)?;
    let operation_id = generate_operation_id();
    let src_path = Path::new(&source);

    if !src_path.exists() || !src_path.is_dir() {
        return Err("Source directory does not exist".to_string());
    }

    let progress_manager_ref = progress_manager.inner().clone();

    // Start file operation tracking
    progress_manager_ref.start_file_operation(
        operation_id.clone(),
        "accelerated_copy_directory".to_string(),
        source.clone(),
        Some(destination.clone()),
        0, // Will be updated after counting files
        0, // Will be updated after calculating total size
    );

    let operation_id_clone = operation_id.clone();
    let source_clone = source.clone();
    let destination_clone = destination.clone();

    // Spawn background task for accelerated directory copy
    thread::spawn(move || {
        let result = accelerated_copy_dir_impl(
            &source_clone,
            &destination_clone,
            &progress_manager_ref,
            &operation_id_clone,
        );

        match result {
            Ok(_) => progress_manager_ref.complete_file_operation(&operation_id_clone),
            Err(e) => progress_manager_ref.fail_file_operation(&operation_id_clone, e),
        }
    });

    Ok(operation_id)
}

fn accelerated_copy_dir_impl(
    source: &str,
    destination: &str,
    progress_manager: &ProgressManager,
    operation_id: &str,
) -> Result<(), String> {
    use std::fs;

    // First pass: count total files and size
    let (total_files, total_size) = count_directory_contents_parallel(source)?;

    // Update the operation with actual totals
    progress_manager.update_file_progress(
        operation_id,
        format!(
            "Copying {} files ({:.1} MB)",
            total_files,
            total_size as f64 / 1024.0 / 1024.0
        ),
        0,
        0,
        Some("DirectoryCopy".to_string()),
        true,
        0.0,
    );

    // Create destination directory
    fs::create_dir_all(destination)
        .map_err(|e| format!("Failed to create destination directory: {}", e))?;

    // Collect all file operations
    let mut file_operations = Vec::new();
    collect_file_operations(source, destination, &mut file_operations)?;

    // Process files in parallel using rayon
    let processed_files = Arc::new(AtomicU64::new(0));
    let processed_bytes = Arc::new(AtomicU64::new(0));

    file_operations.par_iter().try_for_each(
        |(src_path, dst_path, file_size)| -> Result<(), String> {
            let accelerated_ops = AcceleratedFileOps::new();
            let strategy = accelerated_ops.choose_copy_strategy(*file_size);

            // Copy individual file using optimal strategy
            match strategy {
                CopyStrategy::MemoryMapped if *file_size > MMAP_THRESHOLD => {
                    copy_single_file_mmap(src_path, dst_path)?;
                }
                _ => {
                    fs::copy(src_path, dst_path)
                        .map_err(|e| format!("Failed to copy {}: {}", src_path, e))?;
                }
            }

            // Update progress
            let files_done = processed_files.fetch_add(1, Ordering::Relaxed) + 1;
            let bytes_done = processed_bytes.fetch_add(*file_size, Ordering::Relaxed) + file_size;
            let speed = bytes_done as f64; // Simplified speed calculation

            progress_manager.update_file_progress(
                operation_id,
                format!("Copied: {}", dst_path),
                files_done,
                bytes_done,
                Some("DirectoryCopy".to_string()),
                true,
                speed,
            );

            Ok(())
        },
    )?;

    Ok(())
}

fn count_directory_contents_parallel(dir: &str) -> Result<(u64, u64), String> {
    use rayon::prelude::*;
    use std::fs;

    let entries: Vec<_> = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory: {}", e))?
        .filter_map(|entry| entry.ok())
        .collect();

    let (files, bytes): (u64, u64) = entries
        .par_iter()
        .map(|entry| {
            let path = entry.path();
            if path.is_file() {
                let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                (1u64, size)
            } else if path.is_dir() {
                count_directory_contents_parallel(&path.to_string_lossy()).unwrap_or((0, 0))
            } else {
                (0u64, 0u64)
            }
        })
        .reduce(|| (0, 0), |a, b| (a.0 + b.0, a.1 + b.1));

    Ok((files, bytes))
}

fn collect_file_operations(
    source_dir: &str,
    dest_dir: &str,
    operations: &mut Vec<(String, String, u64)>,
) -> Result<(), String> {
    use std::fs;

    for entry in fs::read_dir(source_dir).map_err(|e| format!("Failed to read directory: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let src_path = entry.path();
        let file_name = entry.file_name();
        let dst_path = Path::new(dest_dir).join(&file_name);

        if src_path.is_file() {
            let file_size = entry
                .metadata()
                .map_err(|e| format!("Failed to get metadata: {}", e))?
                .len();

            operations.push((
                src_path.to_string_lossy().to_string(),
                dst_path.to_string_lossy().to_string(),
                file_size,
            ));
        } else if src_path.is_dir() {
            fs::create_dir_all(&dst_path)
                .map_err(|e| format!("Failed to create directory: {}", e))?;

            collect_file_operations(
                &src_path.to_string_lossy(),
                &dst_path.to_string_lossy(),
                operations,
            )?;
        }
    }

    Ok(())
}

fn copy_single_file_mmap(source: &str, destination: &str) -> Result<(), String> {
    let src_file = File::open(source).map_err(|e| format!("Failed to open source: {}", e))?;

    let mmap = unsafe { MmapOptions::new().map(&src_file) }
        .map_err(|e| format!("Failed to mmap source: {}", e))?;

    let mut dst_file =
        File::create(destination).map_err(|e| format!("Failed to create destination: {}", e))?;

    dst_file
        .write_all(&mmap)
        .map_err(|e| format!("Failed to write: {}", e))?;

    Ok(())
}
