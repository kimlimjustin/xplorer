#[cfg(test)]
mod tests {
    use crate::extensions::functions;
    #[tokio::test]
    async fn test_execute_javascript() {
        let platform = v8::new_default_platform(0, false).make_shared();
        v8::V8::initialize_platform(platform);
        v8::V8::initialize();
        let js_src = std::fs::read_to_string(
            std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src/tests/src/js/fibonacci.js"),
        )
        .unwrap();
        assert_eq!(functions::execute_script(js_src).await, "55".to_string());
    }
}
