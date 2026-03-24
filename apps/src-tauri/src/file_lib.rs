// File library utilities
use std::path::Path;

pub fn get_file_type(path: &Path, is_dir: bool) -> String {
    if is_dir {
        "directory".to_string()
    } else {
        match path.extension() {
            Some(ext) => match ext.to_str() {
                Some("txt") | Some("md") | Some("log") => "text".to_string(),
                Some("jpg") | Some("jpeg") | Some("png") | Some("gif") | Some("bmp") => "image".to_string(),
                Some("mp4") | Some("avi") | Some("mkv") | Some("mov") => "video".to_string(),
                Some("mp3") | Some("wav") | Some("flac") | Some("aac") => "audio".to_string(),
                Some("pdf") => "pdf".to_string(),
                Some("zip") | Some("rar") | Some("7z") | Some("tar") | Some("gz") => "archive".to_string(),
                Some("exe") | Some("msi") | Some("deb") | Some("rpm") => "executable".to_string(),
                _ => "file".to_string(),
            },
            None => "file".to_string(),
        }
    }
}

pub fn get_mime_type(path: &Path) -> Option<String> {
    match path.extension()?.to_str()? {
        "txt" => Some("text/plain".to_string()),
        "md" => Some("text/markdown".to_string()),
        "html" => Some("text/html".to_string()),
        "css" => Some("text/css".to_string()),
        "js" => Some("application/javascript".to_string()),
        "json" => Some("application/json".to_string()),
        "jpg" | "jpeg" => Some("image/jpeg".to_string()),
        "png" => Some("image/png".to_string()),
        "gif" => Some("image/gif".to_string()),
        "svg" => Some("image/svg+xml".to_string()),
        "mp4" => Some("video/mp4".to_string()),
        "mp3" => Some("audio/mpeg".to_string()),
        "pdf" => Some("application/pdf".to_string()),
        "zip" => Some("application/zip".to_string()),
        _ => None,
    }
}
