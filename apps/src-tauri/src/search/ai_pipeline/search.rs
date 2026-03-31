use crate::search::cosine_similarity;
use crate::search::hybrid::EmbeddingEntry;

use super::{is_image_path, ExpandedQuery};

// ---------------------------------------------------------------------------
// Sentence-aware chunking (Tier 3b)
// ---------------------------------------------------------------------------

/// Split `text` into overlapping chunks that respect sentence boundaries.
///
/// * `target_size`  — approximate number of **words** per chunk (default 300).
/// * `min_overlap`  — number of **words** carried over from the end of the
///   previous chunk into the start of the next (default 40).
///
/// Sentence boundaries recognised: `. `, `! `, `? `, `\n\n`.
pub fn chunk_text_sentences(text: &str, target_size: usize, min_overlap: usize) -> Vec<String> {
    if text.trim().is_empty() {
        return Vec::new();
    }

    let sentences = split_sentences(text);
    if sentences.is_empty() {
        return Vec::new();
    }

    let mut chunks: Vec<String> = Vec::new();
    let mut current_words: Vec<&str> = Vec::new();

    for sentence in &sentences {
        let words: Vec<&str> = sentence.split_whitespace().collect();
        if words.is_empty() {
            continue;
        }

        current_words.extend_from_slice(&words);

        if current_words.len() >= target_size {
            chunks.push(current_words.join(" "));

            // Overlap: keep the last `min_overlap` words for the next chunk.
            let overlap_start = if current_words.len() > min_overlap {
                current_words.len() - min_overlap
            } else {
                0
            };
            let overlap: Vec<&str> = current_words[overlap_start..].to_vec();
            current_words = overlap;
        }
    }

    // Flush remaining words.
    if !current_words.is_empty() {
        let remaining = current_words.join(" ");
        // If this leftover is very short and we already have chunks, append it
        // to the last chunk instead of creating a tiny trailing chunk.
        if chunks.is_empty() || current_words.len() > min_overlap {
            chunks.push(remaining);
        } else if let Some(last) = chunks.last_mut() {
            last.push(' ');
            last.push_str(&remaining);
        }
    }

    chunks
}

/// Naive sentence splitter.  Splits on `. `, `! `, `? `, and `\n\n`.
fn split_sentences(text: &str) -> Vec<String> {
    let mut sentences: Vec<String> = Vec::new();
    let mut current = String::new();

    let chars: Vec<char> = text.chars().collect();
    let len = chars.len();
    let mut i = 0;

    while i < len {
        let ch = chars[i];
        current.push(ch);

        // Check for double newline.
        if ch == '\n' && i + 1 < len && chars[i + 1] == '\n' {
            current.push('\n');
            i += 2;
            let trimmed = current.trim().to_string();
            if !trimmed.is_empty() {
                sentences.push(trimmed);
            }
            current = String::new();
            continue;
        }

        // Check for sentence-ending punctuation followed by a space.
        if (ch == '.' || ch == '!' || ch == '?') && i + 1 < len && chars[i + 1] == ' ' {
            let trimmed = current.trim().to_string();
            if !trimmed.is_empty() {
                sentences.push(trimmed);
            }
            current = String::new();
            i += 1; // skip the trailing space
                    // Advance past any additional whitespace.
            while i < len && chars[i] == ' ' {
                i += 1;
            }
            continue;
        }

        i += 1;
    }

    // Flush.
    let trimmed = current.trim().to_string();
    if !trimmed.is_empty() {
        sentences.push(trimmed);
    }

    sentences
}

// ---------------------------------------------------------------------------
// Query expansion (Tier 4a)
// ---------------------------------------------------------------------------

/// Build the prompt that will be sent to an Ollama LLM to expand a
/// natural-language search query into structured search parameters.
pub fn expand_query_prompt(query: &str) -> String {
    format!(
        r#"You are a search query analyzer. Given the following natural language search query, extract structured search parameters and return them as JSON.

Query: "{query}"

Return a JSON object with these fields:
- "keywords": array of relevant search keywords (strings)
- "file_type": optional file type filter (e.g. "image", "document", "pdf", "video", or null)
- "date_hint": optional date hint (e.g. "last week", "2024-01", "recent", or null)
- "size_hint": optional size hint (e.g. "large", "small", ">10MB", or null)

Respond ONLY with the JSON object, no extra text."#
    )
}

/// Parse the JSON response from the LLM query expansion prompt into an
/// `ExpandedQuery`.  Falls back to treating the entire original query as a
/// single keyword when the response is not valid JSON.
pub fn parse_expansion_response(response: &str) -> ExpandedQuery {
    // Try to extract JSON from the response (the LLM may wrap it in markdown
    // fences).
    let trimmed = response.trim();
    let json_str = if let Some(start) = trimmed.find('{') {
        if let Some(end) = trimmed.rfind('}') {
            &trimmed[start..=end]
        } else {
            trimmed
        }
    } else {
        trimmed
    };

    serde_json::from_str::<ExpandedQuery>(json_str).unwrap_or_default()
}

// ---------------------------------------------------------------------------
// Image similarity (Tier 4c)
// ---------------------------------------------------------------------------

/// Find the most similar images to a reference embedding by cosine similarity.
///
/// Only entries whose path ends with a recognised image extension are
/// considered.  Returns up to `limit` results as `(path, similarity)` pairs,
/// sorted descending by similarity.
pub fn find_similar_images(
    reference_embedding: &[f32],
    entries: &[EmbeddingEntry],
    limit: usize,
) -> Vec<(String, f64)> {
    if reference_embedding.is_empty() || entries.is_empty() {
        return Vec::new();
    }

    let mut scored: Vec<(String, f64)> = entries
        .iter()
        .filter(|e| is_image_path(&e.path))
        .filter(|e| !e.embedding.is_empty())
        .map(|e| {
            let sim = cosine_similarity(reference_embedding, &e.embedding);
            (e.path.clone(), sim)
        })
        .collect();

    scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(limit);
    scored
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // -- chunk_text_sentences -----------------------------------------------

    #[test]
    fn test_chunk_text_sentences_basic() {
        let text = "The quick brown fox jumped over the lazy dog. \
                     The rain in Spain falls mainly on the plain. \
                     Pack my box with five dozen liquor jugs. \
                     How vexingly quick daft zebras jump.";

        let chunks = chunk_text_sentences(text, 10, 3);
        assert!(!chunks.is_empty(), "should produce at least one chunk");
        // Every chunk should be non-empty.
        for chunk in &chunks {
            assert!(!chunk.trim().is_empty());
        }
    }

    #[test]
    fn test_chunk_text_sentences_short() {
        let text = "Hello world. Goodbye world.";
        let chunks = chunk_text_sentences(text, 300, 40);
        assert_eq!(chunks.len(), 1, "short text should produce a single chunk");
        assert!(chunks[0].contains("Hello"));
        assert!(chunks[0].contains("Goodbye"));
    }

    #[test]
    fn test_chunk_text_sentences_single_sentence() {
        let text = "This is a single sentence with no period at the end";
        let chunks = chunk_text_sentences(text, 300, 40);
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0], text);
    }

    #[test]
    fn test_chunk_text_sentences_empty() {
        let chunks = chunk_text_sentences("", 300, 40);
        assert!(chunks.is_empty());
    }

    // -- query expansion ----------------------------------------------------

    #[test]
    fn test_expand_query_prompt_format() {
        let prompt = expand_query_prompt("photos from last week larger than 5MB");
        assert!(prompt.contains("photos from last week larger than 5MB"));
        assert!(prompt.contains("keywords"));
        assert!(prompt.contains("file_type"));
        assert!(prompt.contains("date_hint"));
        assert!(prompt.contains("size_hint"));
        assert!(prompt.contains("JSON"));
    }

    #[test]
    fn test_parse_expansion_response() {
        let json = r#"{"keywords":["sunset","beach"],"file_type":"image","date_hint":"last week","size_hint":">5MB"}"#;
        let eq = parse_expansion_response(json);
        assert_eq!(eq.keywords, vec!["sunset", "beach"]);
        assert_eq!(eq.file_type.as_deref(), Some("image"));
        assert_eq!(eq.date_hint.as_deref(), Some("last week"));
        assert_eq!(eq.size_hint.as_deref(), Some(">5MB"));
    }

    #[test]
    fn test_parse_expansion_response_wrapped_in_fences() {
        let response = "```json\n{\"keywords\":[\"report\"],\"file_type\":\"pdf\",\"date_hint\":null,\"size_hint\":null}\n```";
        let eq = parse_expansion_response(response);
        assert_eq!(eq.keywords, vec!["report"]);
        assert_eq!(eq.file_type.as_deref(), Some("pdf"));
    }

    #[test]
    fn test_parse_expansion_response_invalid() {
        let eq = parse_expansion_response("not json at all");
        assert!(eq.keywords.is_empty());
        assert!(eq.file_type.is_none());
    }

    // -- find_similar_images ------------------------------------------------

    #[test]
    fn test_find_similar_images_empty() {
        let result = find_similar_images(&[1.0, 0.0], &[], 5);
        assert!(result.is_empty());
    }

    #[test]
    fn test_find_similar_images_filters_non_images() {
        let entries = vec![
            EmbeddingEntry {
                path: "doc.pdf".to_string(),
                chunk_id: 0,
                chunk_text: "a document".to_string(),
                embedding: vec![1.0, 0.0],
                model: "test".to_string(),
            },
            EmbeddingEntry {
                path: "photo.jpg".to_string(),
                chunk_id: 0,
                chunk_text: "a photo".to_string(),
                embedding: vec![1.0, 0.0],
                model: "test".to_string(),
            },
        ];
        let result = find_similar_images(&[1.0, 0.0], &entries, 5);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].0, "photo.jpg");
    }

    #[test]
    fn test_find_similar_images_ordering() {
        let entries = vec![
            EmbeddingEntry {
                path: "a.png".to_string(),
                chunk_id: 0,
                chunk_text: String::new(),
                embedding: vec![1.0, 0.0],
                model: "test".to_string(),
            },
            EmbeddingEntry {
                path: "b.jpg".to_string(),
                chunk_id: 0,
                chunk_text: String::new(),
                embedding: vec![0.0, 1.0],
                model: "test".to_string(),
            },
        ];
        let result = find_similar_images(&[1.0, 0.0], &entries, 5);
        // a.png should be most similar (identical direction).
        assert_eq!(result[0].0, "a.png");
        assert!(result[0].1 > result[1].1);
    }
}
