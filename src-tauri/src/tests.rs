#[cfg(test)]
mod tests {
    use crate::files_api::*;

    #[test]
    fn test_get_basename() {
        assert_eq!(
            FileSystemUtils::get_basename("/home/user/file.txt"),
            "file.txt"
        );
        assert_eq!(
            FileSystemUtils::get_basename("/home/user/file.txt/"),
            "file.txt"
        );
        assert_eq!(FileSystemUtils::get_basename("C://a/b/c"), "c");
    }

    #[cfg(unix)]
    #[test]
    fn test_is_hidden() {
        assert!(FileSystemUtils::check_is_hidden(
            "/home/user/.hidden_file.txt"
        ));
        assert!(!FileSystemUtils::check_is_hidden("/home/user/file.txt"));
    }

    #[cfg(windows)]
    #[test]
    fn test_is_hidden() {
        assert!(FileSystemUtils::check_is_hidden(
            std::fs::canonicalize(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../.git"))
                .unwrap()
                .to_str()
                .unwrap()
        ));
    }

    #[test]
    fn test_is_dir() {
        assert!(is_dir(std::path::Path::new(env!("CARGO_MANIFEST_DIR"))).unwrap(),);
        assert!(
            !is_dir(&std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("cargo.toml")).unwrap(),
        );
    }

    #[test]
    fn test_file_exist() {
        assert!(file_exist(
            &std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .to_str()
                .unwrap()
        ),);
        assert!(file_exist(
            std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("Cargo.toml")
                .to_str()
                .unwrap()
        ),);
        assert!(!file_exist(
            std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("cargo.toml.bak")
                .to_str()
                .unwrap()
        ),);
    }

    #[tokio::test]
    async fn test_file_operation() {
        let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../temp/a/b")
            .to_str()
            .unwrap()
            .to_string();
        create_dir_recursive(dir.clone()).await;
        assert!(is_dir(std::path::Path::new(dir.as_str())).unwrap());
        assert_eq!(file_exist(&dir), true);

        let file = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../temp/a/b/c.txt")
            .to_str()
            .unwrap()
            .to_string();
        create_file(file.clone()).await;
        assert!(file_exist(&file));
        assert!(!is_dir(std::path::Path::new(file.as_str())).unwrap());

        let mut files = Vec::new();
        files.push(file.clone());
        delete_file(files).await;
        assert!(!file_exist(&file));

        let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../temp")
            .to_str()
            .unwrap()
            .to_string();
        let mut dirs = Vec::new();
        dirs.push(dir.clone());
        delete_file(dirs.clone()).await;
        assert!(!file_exist(&dir));
    }
}
