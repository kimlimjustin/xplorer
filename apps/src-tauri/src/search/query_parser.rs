// Xplorer Search Engine — Query Parser
//
// Parses natural-language and structured queries into a `ParsedQuery` struct.
// Handles: quoted phrases, negations (-term), field:value filters, intent
// detection (multi-language), metadata extraction (size / date / file-type /
// extension), stop-word removal, and keyword tokenisation.

use std::collections::HashSet;
use std::sync::OnceLock;

use regex::Regex;
use serde::{Deserialize, Serialize};

// ===== Public types =====

/// Hint for how search results should be sorted when a NL query implies ordering.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SortHint {
    None,
    SizeDesc,
    SizeAsc,
    DateDesc,
    DateAsc,
}

impl Default for SortHint {
    fn default() -> Self {
        SortHint::None
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedQuery {
    pub raw_query: String,
    pub keywords: Vec<String>,
    pub stemmed_keywords: Vec<String>,
    pub phrases: Vec<String>,
    pub negations: Vec<String>,
    pub field_filters: Vec<FieldFilter>,
    pub metadata: MetadataFilters,
    pub intent: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldFilter {
    pub field: String,
    pub value: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MetadataFilters {
    pub file_type: Option<super::FileTypeCategory>,
    pub size: Option<super::SizeFilter>,
    pub date: Option<super::DateFilter>,
    pub extensions: Vec<String>,
    pub sort_hint: SortHint,
}

// ===== Static helpers =====

fn stop_words() -> &'static HashSet<&'static str> {
    static STOP: OnceLock<HashSet<&str>> = OnceLock::new();
    STOP.get_or_init(|| {
        [
            "the", "be", "to", "of", "and", "a", "in", "that", "have", "i", "it", "for", "not",
            "on", "with", "he", "as", "you", "do", "at", "this", "but", "his", "by", "from",
            "they", "we", "her", "she", "or", "an", "my", "all", "me", "is", "are", "was", "were",
            "been", "will", "would", "could", "should", "can", "may", "might", "shall", "find",
            "show", "get", "list", "files", "file",
        ]
        .iter()
        .copied()
        .collect()
    })
}

fn phrase_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r#""([^"]+)""#).unwrap())
}

fn negation_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(?:^|\s)-(\S+)").unwrap())
}

fn field_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(?i)\b(name|ext|path|content|type):(\S+)").unwrap())
}

fn explicit_size_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(?i)([><])(\d+(?:\.\d+)?)\s*(KB|MB|GB|TB|B)").unwrap())
}

fn date_after_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(?i)after:(\d{4}-\d{2}-\d{2})").unwrap())
}

fn date_before_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(?i)before:(\d{4}-\d{2}-\d{2})").unwrap())
}

fn dot_ext_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"\.([a-zA-Z0-9]+)\s+files?\b").unwrap())
}

// ===== Word-boundary aware matching =====

/// Check whether `text` contains `pattern` as a whole word / phrase.
/// For single-word patterns: splits on whitespace and checks equality.
/// For multi-word patterns: uses substring contains (phrase match).
fn contains_word(text: &str, pattern: &str) -> bool {
    if pattern.contains(' ') {
        // Multi-word patterns: substring match is fine.
        text.contains(pattern)
    } else {
        // Single-word: need word boundary matching.
        text.split_whitespace().any(|w| w == pattern)
    }
}

// ===== Intent detection =====

const INTENT_WORDS: &[(&str, &str)] = &[
    // English
    ("find", "find"),
    ("search", "search"),
    ("show", "show"),
    ("list", "list"),
    ("locate", "locate"),
    ("get", "get"),
    ("open", "open"),
    ("look for", "find"),
    // Spanish
    ("buscar", "search"),
    ("encontrar", "find"),
    ("mostrar", "show"),
    // French
    ("chercher", "search"),
    ("trouver", "find"),
    ("montrer", "show"),
    // German
    ("suchen", "search"),
    ("finden", "find"),
    ("zeigen", "show"),
    // Chinese
    ("\u{641c}\u{7d22}", "search"), // 搜索
    ("\u{67e5}\u{627e}", "find"),   // 查找
    ("\u{663e}\u{793a}", "show"),   // 显示
];

// ===== Time helpers =====

use crate::utils::now_secs;

const DAY: u64 = 86_400;
const WEEK: u64 = 7 * DAY;

/// Parse an ISO-8601 date string (YYYY-MM-DD) into a unix timestamp (UTC midnight).
fn parse_date(s: &str) -> Option<u64> {
    let parts: Vec<&str> = s.split('-').collect();
    if parts.len() != 3 {
        return None;
    }
    let year: i64 = parts[0].parse().ok()?;
    let month: u64 = parts[1].parse().ok()?;
    let day: u64 = parts[2].parse().ok()?;
    if month < 1 || month > 12 || day < 1 || day > 31 {
        return None;
    }
    // Simple days-from-epoch calculation (good enough for filter purposes).
    // We compute days from 1970-01-01 using the same algorithm as chrono.
    let y = if month <= 2 { year - 1 } else { year };
    let m = if month <= 2 { month + 9 } else { month - 3 };
    let c = y / 100;
    let ya = y - 100 * c;
    let days = (146097 * c) / 4 + (1461 * ya) / 4 + (153 * m as i64 + 2) / 5 + day as i64 - 719469;
    if days < 0 {
        return None;
    }
    Some(days as u64 * DAY)
}

/// Parse a size string like "100MB" into bytes.
fn parse_size_value(amount: f64, unit: &str) -> u64 {
    let multiplier: f64 = match unit.to_uppercase().as_str() {
        "B" => 1.0,
        "KB" => 1024.0,
        "MB" => 1024.0 * 1024.0,
        "GB" => 1024.0 * 1024.0 * 1024.0,
        "TB" => 1024.0 * 1024.0 * 1024.0 * 1024.0,
        _ => 1.0,
    };
    (amount * multiplier) as u64
}

/// Return the start-of-day timestamp for today (approx — truncates to midnight UTC).
fn today_start() -> u64 {
    let now = now_secs();
    now - (now % DAY)
}

// ===== Main parse function =====

pub fn parse(input: &str) -> ParsedQuery {
    let raw = input.to_string();
    let mut remaining = input.to_string();

    // -- 1. Extract quoted phrases -----------------------------------------
    let mut phrases: Vec<String> = Vec::new();
    {
        let re = phrase_regex();
        for cap in re.captures_iter(input) {
            if let Some(m) = cap.get(1) {
                phrases.push(m.as_str().to_string());
            }
        }
        remaining = re.replace_all(&remaining, " ").to_string();
    }

    // -- 2. Extract negations (-term) --------------------------------------
    let mut negations: Vec<String> = Vec::new();
    {
        let re = negation_regex();
        for cap in re.captures_iter(&remaining.clone()) {
            if let Some(m) = cap.get(1) {
                negations.push(m.as_str().to_lowercase());
            }
        }
        remaining = re.replace_all(&remaining, " ").to_string();
    }

    // -- 3. Extract field:value filters ------------------------------------
    let mut field_filters: Vec<FieldFilter> = Vec::new();
    {
        let re = field_regex();
        for cap in re.captures_iter(&remaining.clone()) {
            let field = cap[1].to_lowercase();
            let value = cap[2].to_string();
            field_filters.push(FieldFilter { field, value });
        }
        remaining = re.replace_all(&remaining, " ").to_string();
    }

    // -- 4. Extract explicit date filters (after:/before:) -----------------
    let mut date_filter: Option<super::DateFilter> = None;
    {
        let re_after = date_after_regex();
        let re_before = date_before_regex();

        let mut after_ts: Option<u64> = None;
        let mut before_ts: Option<u64> = None;

        if let Some(cap) = re_after.captures(&remaining) {
            if let Some(ts) = parse_date(&cap[1]) {
                after_ts = Some(ts);
            }
        }
        remaining = re_after.replace_all(&remaining, " ").to_string();

        if let Some(cap) = re_before.captures(&remaining) {
            if let Some(ts) = parse_date(&cap[1]) {
                before_ts = Some(ts);
            }
        }
        remaining = re_before.replace_all(&remaining, " ").to_string();

        if after_ts.is_some() || before_ts.is_some() {
            date_filter = Some(super::DateFilter {
                after: after_ts,
                before: before_ts,
            });
        }
    }

    // -- 5. Extract explicit size filters (>100MB, <1KB, etc.) -------------
    let mut size_filter: Option<super::SizeFilter> = None;
    {
        let re = explicit_size_regex();
        if let Some(cap) = re.captures(&remaining) {
            let op = &cap[1];
            let amount: f64 = cap[2].parse().unwrap_or(0.0);
            let unit = &cap[3];
            let bytes = parse_size_value(amount, unit);
            size_filter = Some(match op {
                ">" => super::SizeFilter {
                    min_bytes: Some(bytes),
                    max_bytes: None,
                },
                "<" => super::SizeFilter {
                    min_bytes: None,
                    max_bytes: Some(bytes),
                },
                _ => super::SizeFilter {
                    min_bytes: None,
                    max_bytes: None,
                },
            });
        }
        remaining = re.replace_all(&remaining, " ").to_string();
    }

    // -- 6. Extract dot-extension patterns (.py files, .rs files, etc.) ----
    let mut extensions: Vec<String> = Vec::new();
    {
        let re = dot_ext_regex();
        for cap in re.captures_iter(&remaining.clone()) {
            extensions.push(cap[1].to_lowercase());
        }
        remaining = re.replace_all(&remaining, " ").to_string();
    }

    // -- 7. Detect intent (first word / phrase) ----------------------------
    let mut intent: Option<String> = None;
    {
        let lower = remaining.trim().to_lowercase();
        // Try multi-word intents first ("look for"), then single-word.
        let mut matched_len = 0usize;
        for &(pattern, canonical) in INTENT_WORDS {
            if lower.starts_with(pattern) {
                // Ensure it's a word boundary (followed by whitespace, end, or for CJK just match).
                let after = &lower[pattern.len()..];
                let is_boundary = after.is_empty()
                    || after.starts_with(' ')
                    || pattern.chars().next().map_or(false, |c| c > '\u{2E7F}');
                if is_boundary && pattern.len() > matched_len {
                    intent = Some(canonical.to_string());
                    matched_len = pattern.len();
                }
            }
        }
        if matched_len > 0 {
            remaining = remaining.trim().to_string();
            // Remove the intent prefix (case-insensitive).
            if remaining.len() >= matched_len {
                remaining = remaining[matched_len..].trim_start().to_string();
            }
        }
    }

    // -- 7b. Normalize word variants and detect sort hint -----------------
    //    Maps "largest"→"large", "newest"→"recent", etc. so the existing
    //    step 8 exact-word matching works. Also sets a sort_hint.

    let mut sort_hint = SortHint::None;

    {
        // (original_word, replacement, sort_hint)
        let normalizations: &[(&str, &str, SortHint)] = &[
            ("largest", "large", SortHint::SizeDesc),
            ("biggest", "big", SortHint::SizeDesc),
            ("heaviest", "large", SortHint::SizeDesc),
            ("smallest", "small", SortHint::SizeAsc),
            ("lightest", "small", SortHint::SizeAsc),
            ("newest", "recent", SortHint::DateDesc),
            ("latest", "recent", SortHint::DateDesc),
            ("oldest", "old", SortHint::DateAsc),
        ];

        let lr = remaining.to_lowercase();
        for &(original, replacement, hint) in normalizations {
            if contains_word(&lr, original) {
                remaining = remove_word(&remaining, original);
                // Insert the normalized word so step 8 can match it.
                if !remaining.is_empty() {
                    remaining = format!("{} {}", replacement, remaining);
                } else {
                    remaining = replacement.to_string();
                }
                sort_hint = hint;
                break;
            }
        }

        // Also set sort_hint for words that DON'T need normalization.
        if sort_hint == SortHint::None {
            let lr2 = remaining.to_lowercase();
            let hint_words: &[(&str, SortHint)] = &[
                ("huge", SortHint::SizeDesc),
                ("large", SortHint::SizeDesc),
                ("big", SortHint::SizeDesc),
                ("small", SortHint::SizeAsc),
                ("tiny", SortHint::SizeAsc),
                ("recent", SortHint::DateDesc),
                ("recently", SortHint::DateDesc),
                ("old", SortHint::DateAsc),
            ];
            for &(word, hint) in hint_words {
                if contains_word(&lr2, word) {
                    sort_hint = hint;
                    break;
                }
            }
        }
    }

    // -- 8. Extract word-based metadata filters (with word boundary) -------
    //    Only apply these if not already set by explicit syntax.

    let lower_remaining = remaining.to_lowercase();

    // 8a. Size keywords
    if size_filter.is_none() {
        let size_patterns: &[(&str, Option<u64>, Option<u64>)] = &[
            ("huge", Some(1024 * 1024 * 1024), None),
            ("large", Some(100 * 1024 * 1024), None),
            ("big", Some(100 * 1024 * 1024), None),
            ("small", None, Some(1024 * 1024)),
            ("tiny", None, Some(100 * 1024)),
        ];
        for &(pat, min, max) in size_patterns {
            if contains_word(&lower_remaining, pat) {
                size_filter = Some(super::SizeFilter {
                    min_bytes: min,
                    max_bytes: max,
                });
                remaining = remove_word(&remaining, pat);
                break;
            }
        }
    }

    // 8b. Date keywords
    if date_filter.is_none() {
        let now = now_secs();
        let today = today_start();

        let date_keywords: &[(&str, Option<u64>, Option<u64>)] = &[
            ("today", Some(today), None),
            ("yesterday", Some(today - DAY), Some(today)),
            ("last week", Some(now - WEEK), None),
            ("this week", Some(now - WEEK), None),
            ("last month", Some(now - 30 * DAY), None),
            ("this month", Some(now - 30 * DAY), None),
            ("this year", Some(now - 365 * DAY), None),
            (
                "last year",
                Some(now - 2 * 365 * DAY),
                Some(now - 365 * DAY),
            ),
            ("recently", Some(now - 7 * DAY), None),
            ("recent", Some(now - 7 * DAY), None),
            ("old", None, Some(now - 365 * DAY)),
        ];
        for &(pat, after, before) in date_keywords {
            if contains_word(&lower_remaining, pat) {
                date_filter = Some(super::DateFilter { after, before });
                remaining = remove_word(&remaining, pat);
                break;
            }
        }
    }

    // 8c. File type keywords
    let mut file_type: Option<super::FileTypeCategory> = None;
    {
        let type_keywords: &[(&[&str], super::FileTypeCategory)] = &[
            (
                &["videos", "video", "movies", "movie"],
                super::FileTypeCategory::Videos,
            ),
            (
                &["images", "image", "photo", "photos", "picture", "pictures"],
                super::FileTypeCategory::Images,
            ),
            (
                &["documents", "document", "docs", "doc", "pdfs", "pdf"],
                super::FileTypeCategory::Documents,
            ),
            (
                &["code", "scripts", "source code"],
                super::FileTypeCategory::Code,
            ),
            (
                &["audio", "music", "songs", "song"],
                super::FileTypeCategory::Audio,
            ),
            (
                &["archives", "archive", "compressed", "zips", "zip"],
                super::FileTypeCategory::Archives,
            ),
        ];

        let lr = remaining.to_lowercase();
        'outer: for &(patterns, ref category) in type_keywords {
            for &pat in patterns {
                if contains_word(&lr, pat) {
                    file_type = Some(category.clone());
                    remaining = remove_word(&remaining, pat);
                    break 'outer;
                }
            }
        }
    }

    // -- 9. Tokenize remaining into keywords (stop-word removal) -----------
    let stops = stop_words();
    let keywords: Vec<String> = remaining
        .split_whitespace()
        .map(|w| w.to_lowercase())
        .filter(|w| w.len() >= 2 && !stops.contains(w.as_str()))
        .collect();

    // -- 10. Assemble result -----------------------------------------------
    ParsedQuery {
        raw_query: raw,
        keywords,
        stemmed_keywords: Vec::new(),
        phrases,
        negations,
        field_filters,
        metadata: MetadataFilters {
            file_type,
            size: size_filter,
            date: date_filter,
            extensions,
            sort_hint,
        },
        intent,
    }
}

/// Remove a word or phrase from `text` (case-insensitive), collapsing extra spaces.
fn remove_word(text: &str, word: &str) -> String {
    if word.contains(' ') {
        // Multi-word: simple case-insensitive replace.
        let lower = text.to_lowercase();
        if let Some(pos) = lower.find(word) {
            let mut result = String::with_capacity(text.len());
            result.push_str(&text[..pos]);
            result.push(' ');
            result.push_str(&text[pos + word.len()..]);
            return collapse_spaces(&result);
        }
        text.to_string()
    } else {
        // Single word: rebuild without matching tokens.
        let out: Vec<&str> = text
            .split_whitespace()
            .filter(|w| !w.eq_ignore_ascii_case(word))
            .collect();
        out.join(" ")
    }
}

/// Collapse runs of whitespace into single spaces and trim.
fn collapse_spaces(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut prev_space = true;
    for c in s.chars() {
        if c.is_whitespace() {
            if !prev_space {
                result.push(' ');
                prev_space = true;
            }
        } else {
            result.push(c);
            prev_space = false;
        }
    }
    result.trim().to_string()
}

// ===== Tests =====

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_query() {
        let q = parse("hello world");
        assert_eq!(q.keywords, vec!["hello", "world"]);
        assert!(q.phrases.is_empty());
        assert!(q.negations.is_empty());
        assert!(q.field_filters.is_empty());
        assert!(q.intent.is_none());
    }

    #[test]
    fn test_phrase_extraction() {
        let q = parse(r#"find "annual report" 2024"#);
        assert_eq!(q.phrases, vec!["annual report"]);
        assert!(q.keywords.contains(&"2024".to_string()));
        assert!(!q.keywords.contains(&"annual".to_string()));
        assert!(!q.keywords.contains(&"report".to_string()));
        assert_eq!(q.intent, Some("find".to_string()));
    }

    #[test]
    fn test_negation_extraction() {
        let q = parse("python files -test -draft");
        assert!(q.negations.contains(&"test".to_string()));
        assert!(q.negations.contains(&"draft".to_string()));
        assert!(q.keywords.contains(&"python".to_string()));
        // "files" is a stop word, should be removed.
        assert!(!q.keywords.contains(&"files".to_string()));
    }

    #[test]
    fn test_field_filters() {
        let q = parse("name:config ext:yaml");
        assert_eq!(q.field_filters.len(), 2);
        assert_eq!(q.field_filters[0].field, "name");
        assert_eq!(q.field_filters[0].value, "config");
        assert_eq!(q.field_filters[1].field, "ext");
        assert_eq!(q.field_filters[1].value, "yaml");
        assert!(q.keywords.is_empty());
    }

    #[test]
    fn test_metadata_size_type_date() {
        let q = parse("large images from last week");
        assert!(q.metadata.size.is_some());
        let sz = q.metadata.size.as_ref().unwrap();
        assert_eq!(sz.min_bytes, Some(100 * 1024 * 1024));
        assert!(sz.max_bytes.is_none());

        assert_eq!(
            q.metadata.file_type,
            Some(super::super::FileTypeCategory::Images)
        );

        assert!(q.metadata.date.is_some());
        let d = q.metadata.date.as_ref().unwrap();
        assert!(d.after.is_some());
    }

    #[test]
    fn test_word_boundary_old() {
        // "bold" should NOT trigger the "old" date filter.
        let q = parse("bold text");
        assert!(q.metadata.date.is_none());
        assert!(q.keywords.contains(&"bold".to_string()));
        assert!(q.keywords.contains(&"text".to_string()));
    }

    #[test]
    fn test_word_boundary_large() {
        // "enlargement" should NOT trigger the "large" size filter.
        let q = parse("enlargement");
        assert!(q.metadata.size.is_none());
        assert!(q.keywords.contains(&"enlargement".to_string()));
    }

    #[test]
    fn test_combined_query() {
        let q = parse(r#""error log" -debug large code files after:2024-01-01"#);
        assert_eq!(q.phrases, vec!["error log"]);
        assert!(q.negations.contains(&"debug".to_string()));
        assert!(q.metadata.size.is_some());
        let sz = q.metadata.size.as_ref().unwrap();
        assert_eq!(sz.min_bytes, Some(100 * 1024 * 1024));
        assert_eq!(
            q.metadata.file_type,
            Some(super::super::FileTypeCategory::Code)
        );
        assert!(q.metadata.date.is_some());
        let d = q.metadata.date.as_ref().unwrap();
        assert!(d.after.is_some());
    }

    #[test]
    fn test_stop_words_removed() {
        let q = parse("find me all the files");
        // "find" is intent, "me", "all", "the", "files" are stop words.
        assert!(q.keywords.is_empty());
        assert_eq!(q.intent, Some("find".to_string()));
    }

    #[test]
    fn test_explicit_size_filter() {
        let q = parse(">100MB videos");
        assert!(q.metadata.size.is_some());
        let sz = q.metadata.size.as_ref().unwrap();
        assert_eq!(sz.min_bytes, Some(100 * 1024 * 1024));
        assert!(sz.max_bytes.is_none());
        assert_eq!(
            q.metadata.file_type,
            Some(super::super::FileTypeCategory::Videos)
        );
    }

    #[test]
    fn test_intent_detection() {
        let q = parse("find large files");
        assert_eq!(q.intent, Some("find".to_string()));
        // "large" triggers size filter, "files" is stop word.
        assert!(q.metadata.size.is_some());
        assert!(q.keywords.is_empty());
    }

    #[test]
    fn test_intent_spanish() {
        let q = parse("buscar documentos");
        assert_eq!(q.intent, Some("search".to_string()));
    }

    #[test]
    fn test_intent_chinese() {
        let q = parse("\u{641c}\u{7d22} hello");
        assert_eq!(q.intent, Some("search".to_string()));
        assert!(q.keywords.contains(&"hello".to_string()));
    }

    #[test]
    fn test_dot_extension() {
        let q = parse(".py files");
        assert_eq!(q.metadata.extensions, vec!["py"]);
    }

    #[test]
    fn test_explicit_size_less_than() {
        let q = parse("<1KB documents");
        assert!(q.metadata.size.is_some());
        let sz = q.metadata.size.as_ref().unwrap();
        assert!(sz.min_bytes.is_none());
        assert_eq!(sz.max_bytes, Some(1024));
    }

    #[test]
    fn test_date_before_filter() {
        let q = parse("before:2025-06-01 reports");
        assert!(q.metadata.date.is_some());
        let d = q.metadata.date.as_ref().unwrap();
        assert!(d.before.is_some());
        assert!(d.after.is_none());
        assert!(q.keywords.contains(&"reports".to_string()));
    }

    #[test]
    fn test_date_after_and_before() {
        let q = parse("after:2024-01-01 before:2025-01-01");
        assert!(q.metadata.date.is_some());
        let d = q.metadata.date.as_ref().unwrap();
        assert!(d.after.is_some());
        assert!(d.before.is_some());
    }

    #[test]
    fn test_stemmed_keywords_left_empty() {
        let q = parse("running fast");
        assert!(q.stemmed_keywords.is_empty());
    }

    #[test]
    fn test_raw_query_preserved() {
        let input = r#"find "hello world" -bad ext:rs"#;
        let q = parse(input);
        assert_eq!(q.raw_query, input);
    }

    #[test]
    fn test_multiple_phrases() {
        let q = parse(r#""first phrase" something "second phrase""#);
        assert_eq!(q.phrases.len(), 2);
        assert_eq!(q.phrases[0], "first phrase");
        assert_eq!(q.phrases[1], "second phrase");
        assert!(q.keywords.contains(&"something".to_string()));
    }

    #[test]
    fn test_look_for_intent() {
        let q = parse("look for config files");
        assert_eq!(q.intent, Some("find".to_string()));
    }

    #[test]
    fn test_largest_images_from_last_month() {
        let q = parse("largest images from last month");
        // "largest" normalized to "large" → size filter >100MB
        assert!(q.metadata.size.is_some());
        let sz = q.metadata.size.as_ref().unwrap();
        assert_eq!(sz.min_bytes, Some(100 * 1024 * 1024));
        // file type = Images
        assert_eq!(
            q.metadata.file_type,
            Some(super::super::FileTypeCategory::Images)
        );
        // date = last month
        assert!(q.metadata.date.is_some());
        assert!(q.metadata.date.as_ref().unwrap().after.is_some());
        // sort hint = SizeDesc (from "largest")
        assert_eq!(q.metadata.sort_hint, SortHint::SizeDesc);
        // No leftover keywords (all consumed by filters)
        assert!(
            q.keywords.is_empty(),
            "expected no keywords, got: {:?}",
            q.keywords
        );
    }

    #[test]
    fn test_newest_code() {
        let q = parse("newest code");
        // "newest" → normalized to "recent" → date filter (last 7 days)
        assert!(q.metadata.date.is_some());
        // file type = Code
        assert_eq!(
            q.metadata.file_type,
            Some(super::super::FileTypeCategory::Code)
        );
        // sort hint = DateDesc
        assert_eq!(q.metadata.sort_hint, SortHint::DateDesc);
    }

    #[test]
    fn test_sort_hint_existing_words() {
        // Words that don't need normalization should still set sort_hint
        let q = parse("large videos");
        assert_eq!(q.metadata.sort_hint, SortHint::SizeDesc);
        assert_eq!(
            q.metadata.file_type,
            Some(super::super::FileTypeCategory::Videos)
        );

        let q2 = parse("old documents");
        assert_eq!(q2.metadata.sort_hint, SortHint::DateAsc);
    }

    #[test]
    fn test_latest_picture() {
        let q = parse("latest picture");
        // "latest" normalized to "recent" → date filter
        assert!(q.metadata.date.is_some());
        assert!(q.metadata.date.as_ref().unwrap().after.is_some());
        // "picture" → file type Images
        assert_eq!(
            q.metadata.file_type,
            Some(super::super::FileTypeCategory::Images)
        );
        // sort hint = DateDesc
        assert_eq!(q.metadata.sort_hint, SortHint::DateDesc);
        // No leftover keywords
        assert!(
            q.keywords.is_empty(),
            "expected no keywords, got: {:?}",
            q.keywords
        );
    }
}
