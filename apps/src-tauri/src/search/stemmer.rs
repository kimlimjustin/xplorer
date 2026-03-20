// Xplorer Search Engine — Snowball Stemming Module
//
// Wraps the `rust-stemmers` crate to provide language-aware stemming
// for the search pipeline.  Includes a lightweight bigram/trigram
// language-detection heuristic and a global default English stemmer
// accessible via `OnceLock` for hot-path tokenisation.

use rust_stemmers::{Algorithm, Stemmer};
use std::collections::{HashMap, HashSet};
use std::sync::OnceLock;

// ===== Global default stemmer (English) for fast access =====

static DEFAULT_STEMMER: OnceLock<SearchStemmer> = OnceLock::new();

/// Returns a reference to the global default English stemmer.
/// The instance is lazily initialised on first call.
pub fn default_stemmer() -> &'static SearchStemmer {
    DEFAULT_STEMMER.get_or_init(|| SearchStemmer::new("en"))
}

// ===== Language → Algorithm mapping =====

fn language_to_algorithm(lang: &str) -> Algorithm {
    match lang.to_lowercase().as_str() {
        "en" | "english" => Algorithm::English,
        "es" | "spanish" => Algorithm::Spanish,
        "fr" | "french" => Algorithm::French,
        "de" | "german" => Algorithm::German,
        "it" | "italian" => Algorithm::Italian,
        "pt" | "portuguese" => Algorithm::Portuguese,
        "ru" | "russian" => Algorithm::Russian,
        "nl" | "dutch" => Algorithm::Dutch,
        "sv" | "swedish" => Algorithm::Swedish,
        "no" | "norwegian" => Algorithm::Norwegian,
        "da" | "danish" => Algorithm::Danish,
        "ar" | "arabic" => Algorithm::Arabic,
        "tr" | "turkish" => Algorithm::Turkish,
        _ => Algorithm::English, // fallback
    }
}

/// All supported language codes.
pub const SUPPORTED_LANGUAGES: &[&str] = &[
    "en", "es", "fr", "de", "it", "pt", "ru", "nl", "sv", "no", "da", "ar", "tr",
];

// ===== SearchStemmer =====

/// A language-aware Snowball stemmer wrapper.
///
/// Holds the active `rust_stemmers::Stemmer` plus the current language
/// code so callers can inspect or switch languages at runtime.
pub struct SearchStemmer {
    stemmer: Stemmer,
    language: String,
}

impl SearchStemmer {
    /// Create a new stemmer for the given language code (e.g. `"en"`, `"fr"`).
    /// Falls back to English for unrecognised codes.
    pub fn new(lang: &str) -> Self {
        let algorithm = language_to_algorithm(lang);
        Self {
            stemmer: Stemmer::create(algorithm),
            language: normalise_lang_code(lang),
        }
    }

    /// The currently active language code (lowercase, two-letter form).
    pub fn language(&self) -> &str {
        &self.language
    }

    /// Stem a single word.  Returns the stemmed form as an owned `String`.
    /// Empty or very short words (fewer than 2 chars) are returned as-is.
    pub fn stem_word(&self, word: &str) -> String {
        let trimmed = word.trim();
        if trimmed.len() < 2 {
            return trimmed.to_lowercase();
        }
        self.stemmer.stem(&trimmed.to_lowercase()).into_owned()
    }

    /// Stem a list of tokens, returning a de-duplicated `Vec` that
    /// preserves first-occurrence order.
    pub fn stem_tokens(&self, tokens: &[String]) -> Vec<String> {
        let mut seen = HashSet::new();
        let mut result = Vec::with_capacity(tokens.len());
        for token in tokens {
            let stemmed = self.stem_word(token);
            if seen.insert(stemmed.clone()) {
                result.push(stemmed);
            }
        }
        result
    }

    /// Switch the active language.  Rebuilds the internal `Stemmer`.
    pub fn set_language(&mut self, lang: &str) {
        let code = normalise_lang_code(lang);
        if code != self.language {
            let algorithm = language_to_algorithm(&code);
            self.stemmer = Stemmer::create(algorithm);
            self.language = code;
        }
    }
}

// ===== Language detection =====

/// Very lightweight language detection based on characteristic
/// bigram/trigram frequencies.  Analyses the first ~500 characters
/// of `text` and returns a two-letter language code.
///
/// This is intentionally simple — it covers the common Latin-script
/// languages plus Russian (Cyrillic) and Arabic reasonably well.
/// Defaults to `"en"` when no strong signal is found.
pub fn detect_language(text: &str) -> &'static str {
    let sample: String = text
        .chars()
        .filter(|c| c.is_alphabetic() || c.is_whitespace())
        .take(500)
        .collect::<String>()
        .to_lowercase();

    if sample.trim().is_empty() {
        return "en";
    }

    // Quick script-level checks
    let cyrillic_count = sample.chars().filter(|c| ('\u{0400}'..='\u{04FF}').contains(c)).count();
    if cyrillic_count as f64 / sample.chars().count().max(1) as f64 > 0.3 {
        return "ru";
    }

    let arabic_count = sample.chars().filter(|c| ('\u{0600}'..='\u{06FF}').contains(c)).count();
    if arabic_count as f64 / sample.chars().count().max(1) as f64 > 0.3 {
        return "ar";
    }

    // Bigram / trigram scoring for Latin-script languages
    let profiles = build_language_profiles();
    let mut scores: HashMap<&str, f64> = HashMap::new();

    let chars: Vec<char> = sample.chars().collect();

    // Score bigrams
    for window in chars.windows(2) {
        let bigram: String = window.iter().collect();
        for (lang, profile) in &profiles {
            if let Some(&weight) = profile.get(bigram.as_str()) {
                *scores.entry(lang).or_default() += weight;
            }
        }
    }

    // Score trigrams
    for window in chars.windows(3) {
        let trigram: String = window.iter().collect();
        for (lang, profile) in &profiles {
            if let Some(&weight) = profile.get(trigram.as_str()) {
                *scores.entry(lang).or_default() += weight;
            }
        }
    }

    scores
        .into_iter()
        .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal))
        .map(|(lang, _)| lang)
        .unwrap_or("en")
}

// ===== Internal helpers =====

fn normalise_lang_code(lang: &str) -> String {
    match lang.to_lowercase().as_str() {
        "english" => "en",
        "spanish" => "es",
        "french" => "fr",
        "german" => "de",
        "italian" => "it",
        "portuguese" => "pt",
        "russian" => "ru",
        "dutch" => "nl",
        "swedish" => "sv",
        "norwegian" => "no",
        "danish" => "da",
        "arabic" => "ar",
        "turkish" => "tr",
        other => other,
    }
    .to_string()
}

/// Build characteristic n-gram profiles for each supported Latin-script
/// language.  These are small hand-picked sets of high-frequency bigrams
/// and trigrams that help distinguish the languages.
fn build_language_profiles() -> HashMap<&'static str, HashMap<&'static str, f64>> {
    let mut profiles: HashMap<&str, HashMap<&str, f64>> = HashMap::new();

    // English
    let mut en: HashMap<&str, f64> = HashMap::new();
    for &ng in &[
        "th", "he", "in", "er", "an", "re", "on", "at", "en", "nd",
        "the", "ing", "and", "ion", "tio", "ent", "for", "tion",
        "her", "hat", "his", "tha", "ere", "ate", "ter", "ith",
    ] {
        en.insert(ng, 1.0);
    }
    profiles.insert("en", en);

    // Spanish
    let mut es: HashMap<&str, f64> = HashMap::new();
    for &ng in &[
        "de", "en", "el", "la", "os", "es", "ar", "ue", "ci", "on",
        "que", "los", "del", "las", "por", "con", "una", "nte",
        "ado", "est", "cion", "ment",
    ] {
        es.insert(ng, 1.0);
    }
    // Spanish-specific accented patterns
    for &ng in &["ci\u{f3}n", "aci", "ado", "ido"] {
        es.insert(ng, 1.5);
    }
    profiles.insert("es", es);

    // French
    let mut fr: HashMap<&str, f64> = HashMap::new();
    for &ng in &[
        "le", "de", "es", "en", "ou", "ai", "qu", "nt", "re", "ur",
        "les", "des", "que", "ent", "est", "ait", "une", "sur",
        "ous", "eur", "aux", "eux", "tion", "ment",
    ] {
        fr.insert(ng, 1.0);
    }
    // French-specific accented patterns
    for &ng in &["\u{e9}e", "\u{e8}r", "\u{ea}t", "oi", "eau"] {
        fr.insert(ng, 1.5);
    }
    profiles.insert("fr", fr);

    // German
    let mut de: HashMap<&str, f64> = HashMap::new();
    for &ng in &[
        "er", "en", "ch", "ei", "ie", "de", "ge", "nd", "te", "un",
        "ein", "ich", "die", "und", "der", "den", "sch", "ver",
        "ung", "auf", "aus", "ber", "lich",
    ] {
        de.insert(ng, 1.0);
    }
    for &ng in &["\u{fc}r", "\u{fc}b", "\u{e4}t", "\u{f6}r", "sch"] {
        de.insert(ng, 1.5);
    }
    profiles.insert("de", de);

    // Italian
    let mut it: HashMap<&str, f64> = HashMap::new();
    for &ng in &[
        "re", "er", "to", "la", "le", "di", "ta", "no", "ti", "co",
        "che", "per", "del", "ell", "ato", "ita", "gli", "con",
        "zione", "ment",
    ] {
        it.insert(ng, 1.0);
    }
    for &ng in &["\u{e0}", "gli", "zio", "zione"] {
        it.insert(ng, 1.5);
    }
    profiles.insert("it", it);

    // Portuguese
    let mut pt: HashMap<&str, f64> = HashMap::new();
    for &ng in &[
        "de", "os", "do", "da", "as", "em", "er", "ar", "es", "ra",
        "que", "dos", "das", "uma", "com", "por", "par", "ent",
        "\u{e3}o", "mente",
    ] {
        pt.insert(ng, 1.0);
    }
    for &ng in &["\u{e3}o", "\u{e7}\u{e3}", "nh", "lh"] {
        pt.insert(ng, 1.5);
    }
    profiles.insert("pt", pt);

    // Dutch
    let mut nl: HashMap<&str, f64> = HashMap::new();
    for &ng in &[
        "de", "en", "et", "ee", "an", "er", "ij", "aa", "ge", "va",
        "van", "een", "het", "der", "oor", "aar", "ver", "ijk",
    ] {
        nl.insert(ng, 1.0);
    }
    for &ng in &["ij", "ijk", "oor", "aat"] {
        nl.insert(ng, 1.5);
    }
    profiles.insert("nl", nl);

    // Swedish
    let mut sv: HashMap<&str, f64> = HashMap::new();
    for &ng in &[
        "en", "er", "de", "ar", "et", "an", "at", "or", "nd", "om",
        "och", "som", "att", "det", "den", "med", "var", "ing",
    ] {
        sv.insert(ng, 1.0);
    }
    for &ng in &["\u{e5}", "\u{e4}", "\u{f6}", "och"] {
        sv.insert(ng, 1.5);
    }
    profiles.insert("sv", sv);

    // Norwegian
    let mut no: HashMap<&str, f64> = HashMap::new();
    for &ng in &[
        "en", "er", "de", "et", "ar", "an", "or", "om", "me", "ti",
        "det", "som", "den", "med", "var", "til", "kan", "for",
    ] {
        no.insert(ng, 1.0);
    }
    for &ng in &["\u{e5}", "\u{e6}", "\u{f8}", "og"] {
        no.insert(ng, 1.5);
    }
    profiles.insert("no", no);

    // Danish
    let mut da: HashMap<&str, f64> = HashMap::new();
    for &ng in &[
        "er", "en", "de", "et", "ar", "an", "or", "ge", "re", "me",
        "det", "den", "som", "med", "har", "til", "var", "kan",
    ] {
        da.insert(ng, 1.0);
    }
    for &ng in &["\u{e5}", "\u{e6}", "\u{f8}", "og"] {
        da.insert(ng, 1.5);
    }
    profiles.insert("da", da);

    // Turkish
    let mut tr: HashMap<&str, f64> = HashMap::new();
    for &ng in &[
        "ar", "la", "er", "le", "in", "an", "en", "ir", "da", "bi",
        "lar", "ler", "bir", "ile", "den", "ini", "yor", "dan",
    ] {
        tr.insert(ng, 1.0);
    }
    for &ng in &[
        "\u{131}", "\u{15f}", "\u{e7}", "\u{f6}", "\u{fc}", "yor", "lar", "ler",
    ] {
        tr.insert(ng, 1.5);
    }
    profiles.insert("tr", tr);

    profiles
}

// ===== Tests =====

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_english_stemming() {
        let s = SearchStemmer::new("en");
        assert_eq!(s.stem_word("running"), "run");
        assert_eq!(s.stem_word("documents"), "document");
        assert_eq!(s.stem_word("configuration"), "configur");
    }

    #[test]
    fn test_english_stemming_more() {
        let s = SearchStemmer::new("en");
        assert_eq!(s.stem_word("fishing"), "fish");
        assert_eq!(s.stem_word("fished"), "fish");
        assert_eq!(s.stem_word("happiness"), "happi");
        assert_eq!(s.stem_word("caresses"), "caress");
    }

    #[test]
    fn test_spanish_stemming() {
        let s = SearchStemmer::new("es");
        // "documentos" → "document"
        let stemmed = s.stem_word("documentos");
        assert!(!stemmed.is_empty());
        assert!(stemmed.starts_with("document"));
        // "corriendo" (running)
        let stemmed = s.stem_word("corriendo");
        assert!(!stemmed.is_empty());
        assert_ne!(stemmed, "corriendo");
    }

    #[test]
    fn test_french_stemming() {
        let s = SearchStemmer::new("fr");
        // "documents" → should stem to something shorter
        let stemmed = s.stem_word("documents");
        assert!(!stemmed.is_empty());
        assert!(
            stemmed.len() <= "documents".len(),
            "French stem of 'documents' should not be longer: got '{stemmed}'"
        );
        // "configuration" → should reduce
        let stemmed = s.stem_word("configuration");
        assert!(!stemmed.is_empty());
        assert_ne!(stemmed, "configuration");
    }

    #[test]
    fn test_empty_and_short_words() {
        let s = SearchStemmer::new("en");
        assert_eq!(s.stem_word(""), "");
        assert_eq!(s.stem_word("a"), "a");
        assert_eq!(s.stem_word("I"), "i");
        assert_eq!(s.stem_word("  "), "");
        assert_eq!(s.stem_word(" x "), "x");
    }

    #[test]
    fn test_stem_tokens_dedup() {
        let s = SearchStemmer::new("en");
        let tokens: Vec<String> = vec![
            "running".into(),
            "runs".into(),
            "run".into(),
            "document".into(),
            "documents".into(),
        ];
        let stemmed = s.stem_tokens(&tokens);
        // "running", "runs", "run" all stem to "run" — should appear once
        assert_eq!(stemmed.iter().filter(|t| t.as_str() == "run").count(), 1);
        // "document" and "documents" both stem to "document"
        assert_eq!(
            stemmed.iter().filter(|t| t.as_str() == "document").count(),
            1
        );
        assert_eq!(stemmed.len(), 2);
    }

    #[test]
    fn test_stem_tokens_empty() {
        let s = SearchStemmer::new("en");
        let empty: Vec<String> = vec![];
        assert!(s.stem_tokens(&empty).is_empty());
    }

    #[test]
    fn test_set_language() {
        let mut s = SearchStemmer::new("en");
        assert_eq!(s.language(), "en");

        s.set_language("fr");
        assert_eq!(s.language(), "fr");

        s.set_language("french");
        assert_eq!(s.language(), "fr"); // normalised

        // Stemming should now use French rules
        let stemmed = s.stem_word("documents");
        assert!(!stemmed.is_empty());
    }

    #[test]
    fn test_set_language_same_noop() {
        let mut s = SearchStemmer::new("en");
        s.set_language("en"); // should not rebuild
        assert_eq!(s.language(), "en");
        assert_eq!(s.stem_word("running"), "run");
    }

    #[test]
    fn test_detect_language_english() {
        let text = "The quick brown fox jumps over the lazy dog. \
                     This is a sentence written in the English language \
                     with common words and phrases that should be detected.";
        assert_eq!(detect_language(text), "en");
    }

    #[test]
    fn test_detect_language_empty() {
        assert_eq!(detect_language(""), "en");
        assert_eq!(detect_language("   "), "en");
    }

    #[test]
    fn test_detect_language_spanish() {
        let text = "El r\u{e1}pido zorro marr\u{f3}n salta sobre el perro perezoso. \
                     Esta es una oraci\u{f3}n escrita en el idioma espa\u{f1}ol \
                     con palabras y frases comunes que deben ser detectadas.";
        let lang = detect_language(text);
        assert!(
            lang == "es" || lang == "pt",
            "Expected 'es' or 'pt' for Spanish text, got '{}'",
            lang
        );
    }

    #[test]
    fn test_detect_language_french() {
        let text = "Le renard brun rapide saute par-dessus le chien paresseux. \
                     Ceci est une phrase \u{e9}crite dans la langue fran\u{e7}aise \
                     avec des mots et des phrases courants qui doivent \u{ea}tre d\u{e9}tect\u{e9}s.";
        let lang = detect_language(text);
        assert_eq!(lang, "fr", "Expected 'fr' for French text, got '{}'", lang);
    }

    #[test]
    fn test_detect_language_russian() {
        let text = "\u{411}\u{44b}\u{441}\u{442}\u{440}\u{430}\u{44f} \
                     \u{43a}\u{43e}\u{440}\u{438}\u{447}\u{43d}\u{435}\u{432}\u{430}\u{44f} \
                     \u{43b}\u{438}\u{441}\u{430} \u{43f}\u{435}\u{440}\u{435}\u{43f}\u{440}\u{44b}\u{433}\u{438}\u{432}\u{430}\u{435}\u{442} \
                     \u{447}\u{435}\u{440}\u{435}\u{437} \u{43b}\u{435}\u{43d}\u{438}\u{432}\u{443}\u{44e} \u{441}\u{43e}\u{431}\u{430}\u{43a}\u{443}.";
        assert_eq!(detect_language(text), "ru");
    }

    #[test]
    fn test_detect_language_arabic() {
        let text = "\u{627}\u{644}\u{62b}\u{639}\u{644}\u{628} \u{627}\u{644}\u{628}\u{646}\u{64a} \
                     \u{627}\u{644}\u{633}\u{631}\u{64a}\u{639} \u{64a}\u{642}\u{641}\u{632} \
                     \u{641}\u{648}\u{642} \u{627}\u{644}\u{643}\u{644}\u{628} \u{627}\u{644}\u{643}\u{633}\u{648}\u{644}.";
        assert_eq!(detect_language(text), "ar");
    }

    #[test]
    fn test_default_stemmer() {
        let s = default_stemmer();
        assert_eq!(s.language(), "en");
        assert_eq!(s.stem_word("running"), "run");

        // Calling again returns the same instance
        let s2 = default_stemmer();
        assert_eq!(s2.stem_word("documents"), "document");
    }

    #[test]
    fn test_unknown_language_falls_back_to_english() {
        let s = SearchStemmer::new("xx_unknown");
        // Should fall back to English
        assert_eq!(s.stem_word("running"), "run");
    }

    #[test]
    fn test_case_insensitive_stemming() {
        let s = SearchStemmer::new("en");
        assert_eq!(s.stem_word("Running"), s.stem_word("running"));
        assert_eq!(s.stem_word("DOCUMENTS"), s.stem_word("documents"));
    }

    #[test]
    fn test_supported_languages_list() {
        assert!(SUPPORTED_LANGUAGES.contains(&"en"));
        assert!(SUPPORTED_LANGUAGES.contains(&"es"));
        assert!(SUPPORTED_LANGUAGES.contains(&"fr"));
        assert!(SUPPORTED_LANGUAGES.contains(&"de"));
        assert!(SUPPORTED_LANGUAGES.contains(&"ar"));
        assert!(SUPPORTED_LANGUAGES.contains(&"tr"));
        assert_eq!(SUPPORTED_LANGUAGES.len(), 13);
    }
}
