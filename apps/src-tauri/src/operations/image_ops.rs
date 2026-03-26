use image::imageops::FilterType;
use image::{self, DynamicImage, GenericImageView, ImageFormat};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::{command, AppHandle, Emitter};

use crate::operations::validate_file_path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResizeOp {
    pub width: u32,
    pub height: u32,
    pub maintain_aspect: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConvertOp {
    pub format: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageOperations {
    pub resize: Option<ResizeOp>,
    pub convert: Option<ConvertOp>,
    pub quality: Option<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageInfo {
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub file_size: u64,
    pub color_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchImageProgress {
    pub current_file: String,
    pub processed: usize,
    pub total: usize,
    pub progress_percentage: f64,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchImageResult {
    pub path: String,
    pub output_path: String,
    pub success: bool,
    pub error: Option<String>,
    pub original_size: u64,
    pub new_size: u64,
}

fn parse_image_format(format_str: &str) -> Result<ImageFormat, String> {
    match format_str.to_uppercase().as_str() {
        "PNG" => Ok(ImageFormat::Png),
        "JPEG" | "JPG" => Ok(ImageFormat::Jpeg),
        "WEBP" => Ok(ImageFormat::WebP),
        "BMP" => Ok(ImageFormat::Bmp),
        "TIFF" | "TIF" => Ok(ImageFormat::Tiff),
        "GIF" => Ok(ImageFormat::Gif),
        _ => Err(format!(
            "Unsupported image format: {}. Supported: PNG, JPEG, WebP, BMP, TIFF, GIF",
            format_str
        )),
    }
}

fn format_to_extension(format: ImageFormat) -> &'static str {
    match format {
        ImageFormat::Png => "png",
        ImageFormat::Jpeg => "jpg",
        ImageFormat::WebP => "webp",
        ImageFormat::Bmp => "bmp",
        ImageFormat::Tiff => "tiff",
        ImageFormat::Gif => "gif",
        _ => "bin",
    }
}

fn format_to_string(format: ImageFormat) -> &'static str {
    match format {
        ImageFormat::Png => "PNG",
        ImageFormat::Jpeg => "JPEG",
        ImageFormat::WebP => "WebP",
        ImageFormat::Bmp => "BMP",
        ImageFormat::Tiff => "TIFF",
        ImageFormat::Gif => "GIF",
        _ => "Unknown",
    }
}

fn color_type_to_string(color: image::ColorType) -> &'static str {
    match color {
        image::ColorType::L8 => "Grayscale 8-bit",
        image::ColorType::La8 => "Grayscale+Alpha 8-bit",
        image::ColorType::Rgb8 => "RGB 8-bit",
        image::ColorType::Rgba8 => "RGBA 8-bit",
        image::ColorType::L16 => "Grayscale 16-bit",
        image::ColorType::La16 => "Grayscale+Alpha 16-bit",
        image::ColorType::Rgb16 => "RGB 16-bit",
        image::ColorType::Rgba16 => "RGBA 16-bit",
        image::ColorType::Rgb32F => "RGB 32-bit float",
        image::ColorType::Rgba32F => "RGBA 32-bit float",
        _ => "Unknown",
    }
}

fn save_image_with_quality(
    img: &DynamicImage,
    output_path: &str,
    format: ImageFormat,
    quality: Option<u8>,
) -> Result<(), String> {
    match format {
        ImageFormat::Jpeg => {
            let q = quality.unwrap_or(85).min(100);
            let mut writer = fs::File::create(output_path)
                .map_err(|e| format!("Failed to create output file: {}", e))?;
            let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut writer, q);
            img.write_with_encoder(encoder)
                .map_err(|e| format!("Failed to encode JPEG: {}", e))?;
        }
        ImageFormat::WebP => {
            // WebP through the image crate uses lossless by default;
            // we save directly and rely on the crate's default encoder.
            img.save(output_path)
                .map_err(|e| format!("Failed to save WebP: {}", e))?;
        }
        _ => {
            img.save(output_path)
                .map_err(|e| format!("Failed to save image: {}", e))?;
        }
    }
    Ok(())
}

fn compute_resize_dimensions(
    orig_width: u32,
    orig_height: u32,
    target_width: u32,
    target_height: u32,
    maintain_aspect: bool,
) -> (u32, u32) {
    if !maintain_aspect {
        return (target_width, target_height);
    }

    let w_ratio = target_width as f64 / orig_width as f64;
    let h_ratio = target_height as f64 / orig_height as f64;
    let ratio = w_ratio.min(h_ratio);

    let new_w = (orig_width as f64 * ratio).round() as u32;
    let new_h = (orig_height as f64 * ratio).round() as u32;

    (new_w.max(1), new_h.max(1))
}

#[command]
pub async fn resize_image(
    path: String,
    width: u32,
    height: u32,
    maintain_aspect: bool,
    output_path: String,
) -> Result<String, String> {
    validate_file_path(&path)?;
    validate_file_path(&output_path)?;

    if width == 0 || height == 0 {
        return Err("Width and height must be greater than 0".to_string());
    }

    let img = image::open(&path).map_err(|e| format!("Failed to open image '{}': {}", path, e))?;

    let (orig_w, orig_h) = img.dimensions();
    let (new_w, new_h) = compute_resize_dimensions(orig_w, orig_h, width, height, maintain_aspect);

    let resized = img.resize_exact(new_w, new_h, FilterType::Lanczos3);

    // Determine output format from extension
    let out_ext = Path::new(&output_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png");
    let format = parse_image_format(out_ext)?;

    save_image_with_quality(&resized, &output_path, format, None)?;

    Ok(output_path)
}

#[command]
pub async fn convert_image(
    path: String,
    output_format: String,
    quality: u8,
    output_path: String,
) -> Result<String, String> {
    validate_file_path(&path)?;
    validate_file_path(&output_path)?;

    let format = parse_image_format(&output_format)?;

    let img = image::open(&path).map_err(|e| format!("Failed to open image '{}': {}", path, e))?;

    save_image_with_quality(&img, &output_path, format, Some(quality))?;

    Ok(output_path)
}

#[command]
pub async fn get_image_info(path: String) -> Result<ImageInfo, String> {
    validate_file_path(&path)?;

    let file_size = fs::metadata(&path)
        .map_err(|e| format!("Failed to read file metadata: {}", e))?
        .len();

    let format = image::ImageFormat::from_path(&path)
        .map_err(|e| format!("Failed to detect image format: {}", e))?;

    let img = image::open(&path).map_err(|e| format!("Failed to open image '{}': {}", path, e))?;

    let (width, height) = img.dimensions();

    Ok(ImageInfo {
        width,
        height,
        format: format_to_string(format).to_string(),
        file_size,
        color_type: color_type_to_string(img.color()).to_string(),
    })
}

#[command]
pub async fn batch_process_images(
    app: AppHandle,
    paths: Vec<String>,
    operations: ImageOperations,
    output_dir: String,
) -> Result<Vec<BatchImageResult>, String> {
    validate_file_path(&output_dir)?;

    // Ensure output directory exists
    fs::create_dir_all(&output_dir)
        .map_err(|e| format!("Failed to create output directory: {}", e))?;

    let total = paths.len();
    let mut results: Vec<BatchImageResult> = Vec::with_capacity(total);

    for (i, file_path) in paths.iter().enumerate() {
        let file_name = Path::new(file_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown");

        // Emit progress
        let _ = app.emit(
            "batch-image-progress",
            BatchImageProgress {
                current_file: file_name.to_string(),
                processed: i,
                total,
                progress_percentage: (i as f64 / total as f64) * 100.0,
                status: format!("Processing {}", file_name),
            },
        );

        let original_size = fs::metadata(file_path).map(|m| m.len()).unwrap_or(0);

        let result = process_single_image(file_path, &operations, &output_dir);

        match result {
            Ok(output_path) => {
                let new_size = fs::metadata(&output_path).map(|m| m.len()).unwrap_or(0);

                results.push(BatchImageResult {
                    path: file_path.clone(),
                    output_path,
                    success: true,
                    error: None,
                    original_size,
                    new_size,
                });
            }
            Err(err) => {
                results.push(BatchImageResult {
                    path: file_path.clone(),
                    output_path: String::new(),
                    success: false,
                    error: Some(err),
                    original_size,
                    new_size: 0,
                });
            }
        }
    }

    // Emit completion
    let _ = app.emit(
        "batch-image-progress",
        BatchImageProgress {
            current_file: String::new(),
            processed: total,
            total,
            progress_percentage: 100.0,
            status: "Complete".to_string(),
        },
    );

    Ok(results)
}

#[command]
pub async fn rotate_image(
    path: String,
    degrees: i32,
    output_path: String,
) -> Result<String, String> {
    validate_file_path(&path)?;
    validate_file_path(&output_path)?;

    let img = image::open(&path).map_err(|e| format!("Failed to open image '{}': {}", path, e))?;

    let rotated = match degrees {
        90 => img.rotate90(),
        180 => img.rotate180(),
        270 => img.rotate270(),
        _ => {
            return Err(format!(
                "Unsupported rotation: {}. Use 90, 180, or 270 degrees.",
                degrees
            ))
        }
    };

    let out_ext = Path::new(&output_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png");
    let format = parse_image_format(out_ext)?;
    save_image_with_quality(&rotated, &output_path, format, None)?;

    Ok(output_path)
}

#[command]
pub async fn flip_image(
    path: String,
    direction: String,
    output_path: String,
) -> Result<String, String> {
    validate_file_path(&path)?;
    validate_file_path(&output_path)?;

    let img = image::open(&path).map_err(|e| format!("Failed to open image '{}': {}", path, e))?;

    let flipped = match direction.to_lowercase().as_str() {
        "horizontal" => img.fliph(),
        "vertical" => img.flipv(),
        _ => {
            return Err(format!(
                "Unsupported flip direction: '{}'. Use 'horizontal' or 'vertical'.",
                direction
            ))
        }
    };

    let out_ext = Path::new(&output_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png");
    let format = parse_image_format(out_ext)?;
    save_image_with_quality(&flipped, &output_path, format, None)?;

    Ok(output_path)
}

#[command]
pub async fn crop_image(
    path: String,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
    output_path: String,
) -> Result<String, String> {
    validate_file_path(&path)?;
    validate_file_path(&output_path)?;

    if width == 0 || height == 0 {
        return Err("Crop width and height must be greater than 0".to_string());
    }

    let img = image::open(&path).map_err(|e| format!("Failed to open image '{}': {}", path, e))?;

    let (img_w, img_h) = img.dimensions();
    if x + width > img_w || y + height > img_h {
        return Err(format!(
            "Crop region ({}+{}, {}+{}) exceeds image dimensions ({}x{})",
            x, width, y, height, img_w, img_h
        ));
    }

    let cropped = img.crop_imm(x, y, width, height);

    let out_ext = Path::new(&output_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png");
    let format = parse_image_format(out_ext)?;
    save_image_with_quality(&cropped, &output_path, format, None)?;

    Ok(output_path)
}

#[command]
pub async fn adjust_brightness(
    path: String,
    value: i32,
    output_path: String,
) -> Result<String, String> {
    validate_file_path(&path)?;
    validate_file_path(&output_path)?;

    let clamped = value.clamp(-100, 100);

    let img = image::open(&path).map_err(|e| format!("Failed to open image '{}': {}", path, e))?;

    let adjusted = img.brighten(clamped);

    let out_ext = Path::new(&output_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png");
    let format = parse_image_format(out_ext)?;
    save_image_with_quality(&adjusted, &output_path, format, None)?;

    Ok(output_path)
}

#[command]
pub async fn adjust_contrast(
    path: String,
    value: f32,
    output_path: String,
) -> Result<String, String> {
    validate_file_path(&path)?;
    validate_file_path(&output_path)?;

    let clamped = value.clamp(0.0, 3.0);
    // The image crate's adjust_contrast takes a value where positive increases
    // contrast and negative decreases it. We map 0.0..3.0 to -100..+100 range
    // with 1.0 meaning no change.
    let contrast_value = (clamped - 1.0) * 50.0;

    let img = image::open(&path).map_err(|e| format!("Failed to open image '{}': {}", path, e))?;

    let adjusted = img.adjust_contrast(contrast_value);

    let out_ext = Path::new(&output_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png");
    let format = parse_image_format(out_ext)?;
    save_image_with_quality(&adjusted, &output_path, format, None)?;

    Ok(output_path)
}

#[command]
pub async fn grayscale_image(path: String, output_path: String) -> Result<String, String> {
    validate_file_path(&path)?;
    validate_file_path(&output_path)?;

    let img = image::open(&path).map_err(|e| format!("Failed to open image '{}': {}", path, e))?;

    let gray = img.grayscale();

    let out_ext = Path::new(&output_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png");
    let format = parse_image_format(out_ext)?;
    save_image_with_quality(&gray, &output_path, format, None)?;

    Ok(output_path)
}

fn process_single_image(
    path: &str,
    operations: &ImageOperations,
    output_dir: &str,
) -> Result<String, String> {
    if let Err(e) = validate_file_path(path) {
        return Err(e);
    }

    let img = image::open(path).map_err(|e| format!("Failed to open image '{}': {}", path, e))?;

    let mut processed = img;

    // Apply resize if specified
    if let Some(ref resize) = operations.resize {
        if resize.width == 0 || resize.height == 0 {
            return Err("Resize width and height must be greater than 0".to_string());
        }
        let (orig_w, orig_h) = processed.dimensions();
        let (new_w, new_h) = compute_resize_dimensions(
            orig_w,
            orig_h,
            resize.width,
            resize.height,
            resize.maintain_aspect,
        );
        processed = processed.resize_exact(new_w, new_h, FilterType::Lanczos3);
    }

    // Determine output format
    let source_path = Path::new(path);
    let stem = source_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("output");

    let output_format = if let Some(ref conv) = operations.convert {
        parse_image_format(&conv.format)?
    } else {
        ImageFormat::from_path(path).unwrap_or(ImageFormat::Png)
    };

    let ext = format_to_extension(output_format);
    let output_path = Path::new(output_dir)
        .join(format!("{}.{}", stem, ext))
        .to_string_lossy()
        .to_string();

    save_image_with_quality(&processed, &output_path, output_format, operations.quality)?;

    Ok(output_path)
}
