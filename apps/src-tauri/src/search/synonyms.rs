// Xplorer Search Engine — Synonym Dictionary
// Provides query expansion via bidirectional synonym lookup.

use std::collections::{HashMap, HashSet};
use std::sync::LazyLock;

/// Master synonym dictionary.
///
/// Each key maps to a slice of related words. Lookup is bidirectional
/// via `get_all_related` — a word that appears only as a *value* can
/// still reach every other member of its family.
pub static SYNONYMS: LazyLock<HashMap<&'static str, &'static [&'static str]>> =
    LazyLock::new(|| {
        let mut m: HashMap<&'static str, &'static [&'static str]> = HashMap::new();

        // ===================================================================
        // Documents (16 families)
        // ===================================================================
        m.insert("document", &["doc", "file", "text", "paper", "page"]);
        m.insert(
            "report",
            &["summary", "analysis", "review", "assessment", "brief"],
        );
        m.insert(
            "readme",
            &["readme", "read_me", "about", "info", "information"],
        );
        m.insert("note", &["notes", "memo", "jot", "annotation", "remark"]);
        m.insert(
            "draft",
            &[
                "wip",
                "work_in_progress",
                "unfinished",
                "preliminary",
                "sketch",
            ],
        );
        m.insert("letter", &["correspondence", "mail", "message", "epistle"]);
        m.insert("memo", &["memorandum", "note", "bulletin", "notice"]);
        m.insert(
            "manual",
            &[
                "handbook",
                "guide",
                "reference",
                "documentation",
                "instructions",
            ],
        );
        m.insert(
            "guide",
            &["tutorial", "howto", "walkthrough", "handbook", "manual"],
        );
        m.insert(
            "tutorial",
            &["lesson", "guide", "howto", "course", "walkthrough"],
        );
        m.insert(
            "summary",
            &["abstract", "overview", "synopsis", "brief", "recap"],
        );
        m.insert(
            "presentation",
            &["slides", "ppt", "deck", "slideshow", "keynote"],
        );
        m.insert(
            "spreadsheet",
            &["excel", "xls", "xlsx", "csv", "worksheet", "workbook"],
        );
        m.insert(
            "invoice",
            &["bill", "receipt", "statement", "charge", "tab"],
        );
        m.insert("contract", &["agreement", "deal", "pact", "terms", "legal"]);
        m.insert("resume", &["cv", "curriculum_vitae", "bio", "portfolio"]);

        // ===================================================================
        // Media (11 families)
        // ===================================================================
        m.insert(
            "photo",
            &["image", "picture", "pic", "snapshot", "photograph", "img"],
        );
        m.insert(
            "video",
            &["movie", "film", "clip", "recording", "footage", "stream"],
        );
        m.insert(
            "audio",
            &["sound", "music", "track", "song", "recording", "podcast"],
        );
        m.insert("icon", &["favicon", "symbol", "glyph", "badge", "emblem"]);
        m.insert(
            "animation",
            &["gif", "animated", "motion", "sprite", "lottie"],
        );
        m.insert("thumbnail", &["thumb", "preview", "miniature", "tile"]);
        m.insert("wallpaper", &["background", "backdrop", "desktop", "bg"]);
        m.insert(
            "screenshot",
            &["screencap", "capture", "screen_grab", "snap", "printscreen"],
        );
        m.insert(
            "diagram",
            &[
                "schematic",
                "flowchart",
                "blueprint",
                "sketch",
                "illustration",
            ],
        );
        m.insert(
            "chart",
            &["graph", "plot", "visualization", "figure", "infographic"],
        );
        m.insert("render", &["output", "export", "composition", "frame"]);

        // ===================================================================
        // Code / Dev (16 families)
        // ===================================================================
        m.insert(
            "code",
            &["source", "src", "script", "program", "implementation"],
        );
        m.insert(
            "test",
            &[
                "spec",
                "unittest",
                "test_case",
                "assert",
                "check",
                "verification",
            ],
        );
        m.insert(
            "config",
            &[
                "configuration",
                "settings",
                "preferences",
                "options",
                "ini",
                "env",
                "dotfile",
            ],
        );
        m.insert(
            "build",
            &["compile", "make", "bundle", "assemble", "package"],
        );
        m.insert(
            "deploy",
            &["release", "publish", "ship", "rollout", "launch"],
        );
        m.insert(
            "library",
            &[
                "lib",
                "package",
                "crate",
                "module",
                "dependency",
                "gem",
                "jar",
            ],
        );
        m.insert(
            "template",
            &[
                "boilerplate",
                "scaffold",
                "skeleton",
                "starter",
                "blueprint",
            ],
        );
        m.insert(
            "api",
            &[
                "endpoint",
                "interface",
                "route",
                "service",
                "rest",
                "graphql",
            ],
        );
        m.insert(
            "database",
            &["db", "datastore", "sql", "nosql", "schema", "table"],
        );
        m.insert("server", &["backend", "host", "daemon", "node", "instance"]);
        m.insert("client", &["frontend", "ui", "browser", "consumer", "app"]);
        m.insert(
            "component",
            &["widget", "element", "control", "part", "block"],
        );
        m.insert("module", &["mod", "unit", "package", "chunk", "segment"]);
        m.insert(
            "function",
            &[
                "func",
                "fn",
                "method",
                "procedure",
                "routine",
                "subroutine",
                "handler",
            ],
        );
        m.insert(
            "variable",
            &[
                "var",
                "param",
                "parameter",
                "argument",
                "field",
                "property",
                "prop",
            ],
        );
        m.insert(
            "error",
            &[
                "bug",
                "issue",
                "defect",
                "fault",
                "exception",
                "failure",
                "crash",
            ],
        );

        // ===================================================================
        // File Operations (9 families)
        // ===================================================================
        m.insert(
            "delete",
            &[
                "remove", "erase", "trash", "discard", "purge", "destroy", "unlink",
            ],
        );
        m.insert("copy", &["duplicate", "clone", "replicate", "dupe"]);
        m.insert("rename", &["name", "relabel", "retitle"]);
        m.insert("move", &["transfer", "relocate", "migrate", "shift"]);
        m.insert(
            "compress",
            &["zip", "archive", "pack", "gzip", "deflate", "squash"],
        );
        m.insert(
            "extract",
            &["unzip", "decompress", "unpack", "expand", "inflate"],
        );
        m.insert(
            "merge",
            &["combine", "join", "concat", "concatenate", "unify"],
        );
        m.insert(
            "split",
            &["divide", "separate", "partition", "chunk", "slice"],
        );
        m.insert(
            "create",
            &["new", "add", "make", "generate", "init", "initialize"],
        );

        // ===================================================================
        // Data / Storage (10 families)
        // ===================================================================
        m.insert(
            "data",
            &["dataset", "information", "content", "payload", "records"],
        );
        m.insert(
            "log",
            &["logs", "journal", "history", "audit", "trace", "event"],
        );
        m.insert(
            "backup",
            &["bak", "snapshot", "checkpoint", "archive", "save"],
        );
        m.insert("cache", &["cached", "tmp", "buffer", "store", "stash"]);
        m.insert(
            "temp",
            &["temporary", "tmp", "scratch", "transient", "ephemeral"],
        );
        m.insert("download", &["downloads", "fetched", "saved", "pulled"]);
        m.insert("upload", &["uploads", "pushed", "sent", "submitted"]);
        m.insert("export", &["exported", "output", "dump", "emit"]);
        m.insert("import", &["imported", "input", "ingest", "load"]);
        m.insert(
            "storage",
            &["disk", "drive", "volume", "partition", "filesystem", "fs"],
        );

        // ===================================================================
        // Descriptors (12 families)
        // ===================================================================
        m.insert(
            "old",
            &[
                "legacy",
                "outdated",
                "deprecated",
                "obsolete",
                "ancient",
                "vintage",
            ],
        );
        m.insert(
            "new",
            &["recent", "latest", "fresh", "modern", "current", "updated"],
        );
        m.insert(
            "large",
            &["big", "huge", "massive", "oversized", "gigantic", "heavy"],
        );
        m.insert(
            "small",
            &[
                "tiny",
                "mini",
                "compact",
                "little",
                "lightweight",
                "minimal",
            ],
        );
        m.insert(
            "important",
            &[
                "critical",
                "essential",
                "key",
                "vital",
                "priority",
                "urgent",
                "significant",
            ],
        );
        m.insert(
            "final",
            &[
                "complete",
                "finished",
                "done",
                "released",
                "stable",
                "production",
            ],
        );
        m.insert(
            "public",
            &["shared", "open", "published", "accessible", "visible"],
        );
        m.insert(
            "private",
            &["secret", "hidden", "confidential", "restricted", "internal"],
        );
        m.insert(
            "encrypted",
            &["secure", "protected", "locked", "cipher", "encoded"],
        );
        m.insert(
            "broken",
            &["corrupt", "damaged", "invalid", "malformed", "bad"],
        );
        m.insert(
            "empty",
            &["blank", "vacant", "void", "null", "zero", "bare"],
        );
        m.insert(
            "favorite",
            &["starred", "bookmarked", "pinned", "saved", "liked"],
        );

        // ===================================================================
        // System (9 families)
        // ===================================================================
        m.insert("system", &["os", "platform", "environment", "runtime"]);
        m.insert(
            "network",
            &["net", "internet", "lan", "wifi", "ethernet", "connection"],
        );
        m.insert(
            "driver",
            &["device_driver", "hardware", "peripheral", "adapter"],
        );
        m.insert("process", &["task", "thread", "worker", "job", "pid"]);
        m.insert(
            "service",
            &["daemon", "agent", "microservice", "background"],
        );
        m.insert("registry", &["reg", "hive", "store", "catalog"]);
        m.insert("kernel", &["core", "sys", "ring0", "bootloader"]);
        m.insert("firmware", &["bios", "uefi", "rom", "flash", "embedded"]);
        m.insert(
            "permission",
            &[
                "access",
                "acl",
                "privilege",
                "rights",
                "auth",
                "authorization",
            ],
        );

        m
    });

/// Reverse index: maps every value back to the key(s) it belongs to.
/// Built once at first access by scanning the entire SYNONYMS map.
static REVERSE_INDEX: LazyLock<HashMap<&'static str, Vec<&'static str>>> = LazyLock::new(|| {
    let mut rev: HashMap<&'static str, Vec<&'static str>> = HashMap::new();
    for (&key, &values) in SYNONYMS.iter() {
        for &val in values {
            rev.entry(val).or_default().push(key);
        }
    }
    rev
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Returns the direct synonyms for `word` (i.e. the slice stored under that key).
/// Returns an empty vec if the word is not a key in the dictionary.
pub fn get_synonyms(word: &str) -> Vec<&'static str> {
    let lower = word.to_lowercase();
    SYNONYMS
        .get(lower.as_str())
        .map(|s| s.to_vec())
        .unwrap_or_default()
}

/// Returns **all** related words for `word`, regardless of whether it appears
/// as a *key* or only as a *value* in the synonym map.
///
/// The result includes every member of every family the word belongs to,
/// **excluding the word itself**.
pub fn get_all_related(word: &str) -> Vec<&'static str> {
    let lower = word.to_lowercase();
    let mut related: HashSet<&'static str> = HashSet::new();

    // 1. If the word is a key, add all its values.
    if let Some(&values) = SYNONYMS.get(lower.as_str()) {
        for &v in values {
            related.insert(v);
        }
    }

    // 2. If the word appears as a value, walk back to the key(s) and collect
    //    sibling values + the key itself.
    if let Some(keys) = REVERSE_INDEX.get(lower.as_str()) {
        for &key in keys {
            related.insert(key);
            if let Some(&siblings) = SYNONYMS.get(key) {
                for &s in siblings {
                    related.insert(s);
                }
            }
        }
    }

    // Remove the query word itself from the result set.
    related.remove(lower.as_str());
    related.into_iter().collect()
}

/// Expands a list of search keywords by appending all synonyms for each word.
/// The result is deduplicated and preserves the original keywords at the front.
pub fn expand_query(keywords: &[String]) -> Vec<String> {
    let mut seen: HashSet<String> = HashSet::new();
    let mut expanded: Vec<String> = Vec::new();

    // Original keywords first.
    for kw in keywords {
        let lower = kw.to_lowercase();
        if seen.insert(lower.clone()) {
            expanded.push(lower);
        }
    }

    // Expand each original keyword.
    for kw in keywords {
        let lower = kw.to_lowercase();
        // Direct synonyms (word is a key).
        if let Some(&syns) = SYNONYMS.get(lower.as_str()) {
            for &syn in syns {
                if seen.insert(syn.to_string()) {
                    expanded.push(syn.to_string());
                }
            }
        }
        // Reverse synonyms (word appears as a value).
        if let Some(keys) = REVERSE_INDEX.get(lower.as_str()) {
            for &key in keys {
                if seen.insert(key.to_string()) {
                    expanded.push(key.to_string());
                }
                if let Some(&siblings) = SYNONYMS.get(key) {
                    for &s in siblings {
                        if seen.insert(s.to_string()) {
                            expanded.push(s.to_string());
                        }
                    }
                }
            }
        }
    }

    expanded
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn document_returns_expected_synonyms() {
        let syns = get_synonyms("document");
        assert!(
            syns.contains(&"doc"),
            "expected 'doc' in synonyms for 'document'"
        );
        assert!(
            syns.contains(&"file"),
            "expected 'file' in synonyms for 'document'"
        );
        assert!(
            syns.contains(&"text"),
            "expected 'text' in synonyms for 'document'"
        );
        assert!(
            syns.contains(&"paper"),
            "expected 'paper' in synonyms for 'document'"
        );
    }

    #[test]
    fn photo_returns_expected_synonyms() {
        let syns = get_synonyms("photo");
        assert!(
            syns.contains(&"image"),
            "expected 'image' in synonyms for 'photo'"
        );
        assert!(
            syns.contains(&"picture"),
            "expected 'picture' in synonyms for 'photo'"
        );
        assert!(
            syns.contains(&"snapshot"),
            "expected 'snapshot' in synonyms for 'photo'"
        );
        assert!(
            syns.contains(&"img"),
            "expected 'img' in synonyms for 'photo'"
        );
    }

    #[test]
    fn expand_query_database_and_config() {
        let expanded = expand_query(&["database".to_string(), "config".to_string()]);

        // Original keywords are present.
        assert!(expanded.contains(&"database".to_string()));
        assert!(expanded.contains(&"config".to_string()));

        // Synonyms of "database".
        assert!(expanded.contains(&"db".to_string()));
        assert!(expanded.contains(&"sql".to_string()));
        assert!(expanded.contains(&"schema".to_string()));

        // Synonyms of "config".
        assert!(expanded.contains(&"configuration".to_string()));
        assert!(expanded.contains(&"settings".to_string()));
        assert!(expanded.contains(&"preferences".to_string()));

        // No duplicates.
        let set: HashSet<_> = expanded.iter().collect();
        assert_eq!(
            set.len(),
            expanded.len(),
            "expand_query produced duplicates"
        );
    }

    #[test]
    fn unknown_word_returns_empty() {
        let syns = get_synonyms("xyzzy_nonexistent_word");
        assert!(syns.is_empty(), "expected empty vec for unknown word");

        let related = get_all_related("xyzzy_nonexistent_word");
        assert!(
            related.is_empty(),
            "expected empty vec for unknown word in get_all_related"
        );
    }

    #[test]
    fn get_all_related_finds_reverse_lookups() {
        // "image" is a value under the key "photo", not a key itself.
        let related = get_all_related("image");
        assert!(
            related.contains(&"photo"),
            "expected 'photo' in related words for 'image' (reverse lookup)"
        );
        assert!(
            related.contains(&"picture"),
            "expected 'picture' as a sibling of 'image' via 'photo'"
        );
        assert!(
            related.contains(&"snapshot"),
            "expected 'snapshot' as a sibling of 'image' via 'photo'"
        );
        // "image" itself should NOT be in the output.
        assert!(
            !related.contains(&"image"),
            "'image' should not appear in its own related set"
        );
    }

    #[test]
    fn case_insensitive_lookup() {
        let syns_lower = get_synonyms("photo");
        let syns_upper = get_synonyms("PHOTO");
        let syns_mixed = get_synonyms("Photo");

        assert_eq!(syns_lower.len(), syns_upper.len());
        assert_eq!(syns_lower.len(), syns_mixed.len());

        for s in &syns_lower {
            assert!(syns_upper.contains(s));
            assert!(syns_mixed.contains(s));
        }
    }

    #[test]
    fn expand_query_deduplicates_overlapping_families() {
        // "guide" and "tutorial" share several synonyms.
        let expanded = expand_query(&["guide".to_string(), "tutorial".to_string()]);

        let set: HashSet<_> = expanded.iter().collect();
        assert_eq!(
            set.len(),
            expanded.len(),
            "expand_query produced duplicates"
        );

        // Both "howto" and "walkthrough" appear in both families.
        assert!(expanded.contains(&"howto".to_string()));
        assert!(expanded.contains(&"walkthrough".to_string()));
    }

    #[test]
    fn synonym_map_has_at_least_80_families() {
        assert!(
            SYNONYMS.len() >= 80,
            "Expected at least 80 synonym families, got {}",
            SYNONYMS.len()
        );
    }

    #[test]
    fn expand_query_preserves_originals_first() {
        let expanded = expand_query(&["photo".to_string(), "delete".to_string()]);

        // The original keywords should be at index 0 and 1.
        assert_eq!(expanded[0], "photo");
        assert_eq!(expanded[1], "delete");
    }

    #[test]
    fn reverse_index_coverage() {
        // Every value in the SYNONYMS map should be in the REVERSE_INDEX.
        for (&_key, &values) in SYNONYMS.iter() {
            for &val in values {
                assert!(
                    REVERSE_INDEX.contains_key(val),
                    "Value '{}' missing from REVERSE_INDEX",
                    val
                );
            }
        }
    }
}
