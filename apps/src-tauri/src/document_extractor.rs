// Phase 2: Document text extraction for PDF, DOCX, XLSX, PPTX
// Extracts searchable text content from document formats using lightweight methods.

use std::io::Read;
use std::path::Path;
use regex::Regex;
use tracing::warn;

/// Extract text from a document file based on its extension.
/// Supports: .pdf (via pdf-extract), .docx, .xlsx, .pptx (via zip + XML parsing)
pub fn extract_text(file_path: &str) -> Result<String, String> {
    let path = Path::new(file_path);
    let extension = path.extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    match extension.as_str() {
        "pdf" => extract_pdf_text(file_path),
        "doc" => extract_doc_text(file_path),
        "docx" => extract_docx_text(file_path),
        "xls" => extract_xls_text(file_path),
        "xlsx" => extract_xlsx_text(file_path),
        "ppt" => extract_ppt_text(file_path),
        "pptx" => extract_pptx_text(file_path),
        "rtf" => extract_rtf_text(file_path),
        _ => Err(format!("Unsupported document format: .{}", extension)),
    }
}

/// Extract text from PDF using pdf-extract crate
fn extract_pdf_text(file_path: &str) -> Result<String, String> {
    let bytes = std::fs::read(file_path)
        .map_err(|e| format!("Failed to read PDF file: {}", e))?;

    match pdf_extract::extract_text_from_mem(&bytes) {
        Ok(text) => {
            // Clean up extracted text
            let cleaned = clean_extracted_text(&text);
            Ok(cleaned)
        }
        Err(e) => {
            // PDF might be image-based (scanned) - return empty, Phase 3 handles OCR
            warn!("[DocExtract] PDF text extraction failed for {} (may be scanned): {}", file_path, e);
            Ok(String::new())
        }
    }
}

/// Extract text from DOCX (Office Open XML) by reading word/document.xml from the zip
fn extract_docx_text(file_path: &str) -> Result<String, String> {
    let file = std::fs::File::open(file_path)
        .map_err(|e| format!("Failed to open DOCX: {}", e))?;

    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("Failed to read DOCX as ZIP: {}", e))?;

    let mut text = String::new();

    // Read word/document.xml
    if let Ok(mut doc_xml) = archive.by_name("word/document.xml") {
        let mut xml_content = String::new();
        doc_xml.read_to_string(&mut xml_content)
            .map_err(|e| format!("Failed to read document.xml: {}", e))?;
        text.push_str(&strip_xml_tags(&xml_content));
    }

    // Also try headers and footers
    for i in 0..archive.len() {
        if let Ok(file) = archive.by_index(i) {
            let name = file.name().to_string();
            if (name.starts_with("word/header") || name.starts_with("word/footer"))
                && name.ends_with(".xml")
            {
                let mut xml_content = String::new();
                let mut file = file;
                if file.read_to_string(&mut xml_content).is_ok() {
                    text.push(' ');
                    text.push_str(&strip_xml_tags(&xml_content));
                }
            }
        }
    }

    Ok(clean_extracted_text(&text))
}

/// Extract text from XLSX by reading xl/sharedStrings.xml from the zip
fn extract_xlsx_text(file_path: &str) -> Result<String, String> {
    let file = std::fs::File::open(file_path)
        .map_err(|e| format!("Failed to open XLSX: {}", e))?;

    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("Failed to read XLSX as ZIP: {}", e))?;

    let mut text = String::new();

    // Read shared strings
    if let Ok(mut shared_strings) = archive.by_name("xl/sharedStrings.xml") {
        let mut xml_content = String::new();
        shared_strings.read_to_string(&mut xml_content)
            .map_err(|e| format!("Failed to read sharedStrings.xml: {}", e))?;

        // Extract <t> tag contents (shared string values)
        let t_regex = Regex::new(r"<t[^>]*>(.*?)</t>").unwrap();
        for cap in t_regex.captures_iter(&xml_content) {
            if let Some(value) = cap.get(1) {
                text.push_str(value.as_str());
                text.push(' ');
            }
        }
    }

    // Also try to read sheet names and inline strings from sheet files
    use std::sync::OnceLock;
    static INLINE_STR_RE: OnceLock<Regex> = OnceLock::new();
    let is_regex = INLINE_STR_RE.get_or_init(|| Regex::new(r"<is><t>(.*?)</t></is>").unwrap());

    for i in 0..archive.len() {
        if let Ok(file) = archive.by_index(i) {
            let name = file.name().to_string();
            if name.starts_with("xl/worksheets/sheet") && name.ends_with(".xml") {
                let mut xml_content = String::new();
                let mut file = file;
                if file.read_to_string(&mut xml_content).is_ok() {
                    // Extract inline string values
                    for cap in is_regex.captures_iter(&xml_content) {
                        if let Some(value) = cap.get(1) {
                            text.push_str(value.as_str());
                            text.push(' ');
                        }
                    }
                }
            }
        }
    }

    Ok(clean_extracted_text(&text))
}

/// Extract text from PPTX by reading ppt/slides/slide*.xml files
fn extract_pptx_text(file_path: &str) -> Result<String, String> {
    let file = std::fs::File::open(file_path)
        .map_err(|e| format!("Failed to open PPTX: {}", e))?;

    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("Failed to read PPTX as ZIP: {}", e))?;

    let mut text = String::new();

    // Collect slide file names first
    let slide_names: Vec<String> = (0..archive.len())
        .filter_map(|i| {
            archive.by_index(i).ok().and_then(|f| {
                let name = f.name().to_string();
                if name.starts_with("ppt/slides/slide") && name.ends_with(".xml") {
                    Some(name)
                } else {
                    None
                }
            })
        })
        .collect();

    // Sort slide names numerically
    let mut slide_names = slide_names;
    slide_names.sort_by(|a, b| {
        let num_a = extract_slide_number(a);
        let num_b = extract_slide_number(b);
        num_a.cmp(&num_b)
    });

    // Read each slide
    for slide_name in &slide_names {
        if let Ok(mut slide_file) = archive.by_name(slide_name) {
            let mut xml_content = String::new();
            if slide_file.read_to_string(&mut xml_content).is_ok() {
                text.push_str(&strip_xml_tags(&xml_content));
                text.push('\n');
            }
        }
    }

    // Also read notes
    for i in 0..archive.len() {
        if let Ok(file) = archive.by_index(i) {
            let name = file.name().to_string();
            if name.starts_with("ppt/notesSlides/") && name.ends_with(".xml") {
                let mut xml_content = String::new();
                let mut file = file;
                if file.read_to_string(&mut xml_content).is_ok() {
                    text.push_str(&strip_xml_tags(&xml_content));
                    text.push('\n');
                }
            }
        }
    }

    Ok(clean_extracted_text(&text))
}

/// Extract text from legacy .doc (Word 97-2003 binary format).
/// Uses heuristic: scans the OLE2 binary for UTF-16LE and ASCII text runs.
fn extract_doc_text(file_path: &str) -> Result<String, String> {
    let bytes = std::fs::read(file_path)
        .map_err(|e| format!("Failed to read .doc file: {}", e))?;

    // Check OLE2 magic number
    if bytes.len() < 8 || bytes[0..8] != [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1] {
        return Err("Not a valid .doc file (missing OLE2 signature)".to_string());
    }

    // Try UTF-16LE extraction (handles CJK/Unicode content in .doc files)
    let utf16_text = extract_utf16le_runs(&bytes);
    // Try ASCII extraction
    let ascii_text = extract_ascii_runs(&bytes);

    // Use whichever produced more meaningful content
    let text = if utf16_text.chars().count() >= ascii_text.chars().count() {
        utf16_text
    } else {
        ascii_text
    };

    if text.trim().is_empty() {
        Err("Could not extract text from .doc file. File may be encrypted or image-only.".to_string())
    } else {
        Ok(clean_extracted_text(&text))
    }
}

/// Extract text from legacy .xls (Excel 97-2003 binary format).
fn extract_xls_text(file_path: &str) -> Result<String, String> {
    let bytes = std::fs::read(file_path)
        .map_err(|e| format!("Failed to read .xls file: {}", e))?;

    if bytes.len() < 8 || bytes[0..8] != [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1] {
        return Err("Not a valid .xls file (missing OLE2 signature)".to_string());
    }

    let utf16_text = extract_utf16le_runs(&bytes);
    let ascii_text = extract_ascii_runs(&bytes);
    let text = if utf16_text.chars().count() >= ascii_text.chars().count() {
        utf16_text
    } else {
        ascii_text
    };

    if text.trim().is_empty() {
        Err("Could not extract text from .xls file.".to_string())
    } else {
        Ok(clean_extracted_text(&text))
    }
}

/// Extract text from legacy .ppt (PowerPoint 97-2003 binary format).
fn extract_ppt_text(file_path: &str) -> Result<String, String> {
    let bytes = std::fs::read(file_path)
        .map_err(|e| format!("Failed to read .ppt file: {}", e))?;

    if bytes.len() < 8 || bytes[0..8] != [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1] {
        return Err("Not a valid .ppt file (missing OLE2 signature)".to_string());
    }

    let utf16_text = extract_utf16le_runs(&bytes);
    let ascii_text = extract_ascii_runs(&bytes);
    let text = if utf16_text.chars().count() >= ascii_text.chars().count() {
        utf16_text
    } else {
        ascii_text
    };

    if text.trim().is_empty() {
        Err("Could not extract text from .ppt file.".to_string())
    } else {
        Ok(clean_extracted_text(&text))
    }
}

/// Extract text from RTF files by stripping control words.
fn extract_rtf_text(file_path: &str) -> Result<String, String> {
    let content = std::fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read .rtf file: {}", e))?;

    // Strip RTF control words and groups
    let mut result = String::new();
    let mut depth = 0i32;
    let mut chars = content.chars().peekable();
    while let Some(ch) = chars.next() {
        match ch {
            '{' => depth += 1,
            '}' => depth -= 1,
            '\\' => {
                // Skip control word
                if let Some(&next) = chars.peek() {
                    if next == '\'' {
                        // Hex escape \'xx - skip 3 chars
                        chars.next(); chars.next(); chars.next();
                    } else if next.is_alphabetic() {
                        while chars.peek().map_or(false, |c| c.is_alphabetic()) {
                            chars.next();
                        }
                        // Skip optional numeric parameter
                        if chars.peek() == Some(&'-') { chars.next(); }
                        while chars.peek().map_or(false, |c| c.is_ascii_digit()) {
                            chars.next();
                        }
                        // Skip trailing space
                        if chars.peek() == Some(&' ') { chars.next(); }
                    } else {
                        chars.next(); // skip escaped char like \\ \{ \}
                    }
                }
            }
            '\r' | '\n' => {} // skip raw newlines
            _ if depth <= 1 => result.push(ch),
            _ => {}
        }
    }

    if result.trim().is_empty() {
        Err("Could not extract text from .rtf file.".to_string())
    } else {
        Ok(clean_extracted_text(&result))
    }
}

/// Scan binary data for contiguous runs of UTF-16LE text.
/// Returns extracted text with runs separated by newlines.
fn extract_utf16le_runs(bytes: &[u8]) -> String {
    let mut runs: Vec<String> = Vec::new();
    let mut current_run: Vec<char> = Vec::new();
    let min_run_length = 8; // minimum chars for a meaningful run

    let mut i = 0;
    while i + 1 < bytes.len() {
        let lo = bytes[i];
        let hi = bytes[i + 1];
        let code_unit = u16::from_le_bytes([lo, hi]);

        if let Some(ch) = char::from_u32(code_unit as u32) {
            let is_text = ch.is_alphanumeric()
                || ch.is_whitespace()
                || ch == '.' || ch == ',' || ch == ';' || ch == ':'
                || ch == '!' || ch == '?' || ch == '-' || ch == '_'
                || ch == '(' || ch == ')' || ch == '[' || ch == ']'
                || ch == '/' || ch == '\'' || ch == '"'
                || (code_unit >= 0x2000 && code_unit <= 0x9FFF)   // CJK + symbols
                || (code_unit >= 0xAC00 && code_unit <= 0xD7AF)   // Korean
                || (code_unit >= 0x3000 && code_unit <= 0x30FF)   // CJK punctuation + Katakana
                || (code_unit >= 0xFF00 && code_unit <= 0xFFEF);  // Fullwidth forms

            if is_text && code_unit != 0 {
                current_run.push(ch);
            } else {
                if current_run.len() >= min_run_length {
                    let s: String = current_run.iter().collect();
                    // Filter out runs that are mostly whitespace/punctuation
                    let alpha_count = s.chars().filter(|c| c.is_alphanumeric()).count();
                    if alpha_count >= min_run_length / 2 {
                        runs.push(s);
                    }
                }
                current_run.clear();
            }
        } else {
            if current_run.len() >= min_run_length {
                let s: String = current_run.iter().collect();
                let alpha_count = s.chars().filter(|c| c.is_alphanumeric()).count();
                if alpha_count >= min_run_length / 2 {
                    runs.push(s);
                }
            }
            current_run.clear();
        }

        i += 2;
    }

    // Flush last run
    if current_run.len() >= min_run_length {
        let s: String = current_run.iter().collect();
        let alpha_count = s.chars().filter(|c| c.is_alphanumeric()).count();
        if alpha_count >= min_run_length / 2 {
            runs.push(s);
        }
    }

    runs.join("\n")
}

/// Scan binary data for contiguous runs of printable ASCII text.
fn extract_ascii_runs(bytes: &[u8]) -> String {
    let mut runs: Vec<String> = Vec::new();
    let mut current_run: Vec<u8> = Vec::new();
    let min_run_length = 12; // minimum bytes for a meaningful run

    for &b in bytes {
        if (b >= 0x20 && b <= 0x7E) || b == b'\t' || b == b'\n' || b == b'\r' {
            current_run.push(b);
        } else {
            if current_run.len() >= min_run_length {
                if let Ok(s) = String::from_utf8(current_run.clone()) {
                    let alpha_count = s.chars().filter(|c| c.is_alphanumeric()).count();
                    if alpha_count >= min_run_length / 3 {
                        runs.push(s);
                    }
                }
            }
            current_run.clear();
        }
    }

    if current_run.len() >= min_run_length {
        if let Ok(s) = String::from_utf8(current_run) {
            let alpha_count = s.chars().filter(|c| c.is_alphanumeric()).count();
            if alpha_count >= min_run_length / 3 {
                runs.push(s);
            }
        }
    }

    runs.join("\n")
}

/// Strip XML tags from content, keeping text
fn strip_xml_tags(xml: &str) -> String {
    let tag_regex = Regex::new(r"<[^>]+>").unwrap();
    let result = tag_regex.replace_all(xml, " ");
    result.to_string()
}

/// Clean up extracted text: normalize whitespace, remove control chars
fn clean_extracted_text(text: &str) -> String {
    // Remove XML entities
    let text = text
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .replace("&#xA;", "\n")
        .replace("&#xD;", "");

    // Normalize whitespace
    let whitespace_regex = Regex::new(r"\s+").unwrap();
    let cleaned = whitespace_regex.replace_all(&text, " ");

    cleaned.trim().to_string()
}

/// Extract slide number from filename like "ppt/slides/slide1.xml"
fn extract_slide_number(name: &str) -> u32 {
    let num_regex = Regex::new(r"slide(\d+)\.xml").unwrap();
    num_regex.captures(name)
        .and_then(|c| c.get(1))
        .and_then(|m| m.as_str().parse().ok())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strip_xml_tags() {
        let xml = "<p><t>Hello</t> <t>World</t></p>";
        let result = strip_xml_tags(xml);
        assert!(result.contains("Hello"));
        assert!(result.contains("World"));
    }

    #[test]
    fn test_clean_extracted_text() {
        let text = "  Hello   &amp;   World  \n\n  Test  ";
        let result = clean_extracted_text(text);
        assert_eq!(result, "Hello & World Test");
    }
}
