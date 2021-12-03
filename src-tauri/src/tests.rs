#[cfg(test)]
mod tests {
  use crate::files_api::*;
  extern crate path_absolutize;
  #[test]
  fn test_get_basename() {
    assert_eq!(get_basename("/home/user/file.txt".to_string()), "file.txt");
    assert_eq!(get_basename("/home/user/file.txt/".to_string()), "file.txt");
    assert_eq!(get_basename("C://a/b/c".to_string()), "c");
  }

  #[cfg(unix)]
  #[test]
  fn test_is_hidden() {
    assert_eq!(
      check_is_hidden("/home/user/.hidden_file.txt".to_string()),
      true
    );
    assert_eq!(check_is_hidden("/home/user/file.txt".to_string()), false);
  }

  #[cfg(windows)]
  #[test]
  fn test_is_hidden() {
    assert_eq!(
      check_is_hidden(
        std::fs::canonicalize(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../.git"))
          .unwrap()
          .to_str()
          .unwrap()
          .to_string()
      ),
      true
    );
  }

  #[test]
  fn test_is_dir() {
    assert_eq!(
      is_dir(std::path::Path::new(env!("CARGO_MANIFEST_DIR"))).unwrap(),
      true
    );
    assert_eq!(
      is_dir(&std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("cargo.toml")).unwrap(),
      false
    );
  }
  #[test]
  fn test_file_exist() {
    assert_eq!(
      file_exist(
        std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
          .to_str()
          .unwrap()
          .to_string()
      ),
      true
    );
    assert_eq!(
      file_exist(
        std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
          .join("Cargo.toml")
          .to_str()
          .unwrap()
          .to_string()
      ),
      true
    );
    assert_eq!(
      file_exist(
        std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
          .join("cargo.toml.bak")
          .to_str()
          .unwrap()
          .to_string()
      ),
      false
    );
  }
  #[tokio::test]
  async fn test_file_operation() {
    let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
      .join("../temp/a/b")
      .to_str()
      .unwrap()
      .to_string();
    create_dir_recursive(dir.clone()).await;
    assert_eq!(is_dir(std::path::Path::new(dir.as_str())).unwrap(), true);
    assert_eq!(file_exist(dir.clone()), true);

    let file = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
      .join("../temp/a/b/c.txt")
      .to_str()
      .unwrap()
      .to_string();
    create_file(file.clone()).await;
    assert_eq!(file_exist(file.clone()), true);
    assert_eq!(is_dir(std::path::Path::new(file.as_str())).unwrap(), false);

    let mut files = Vec::new();
    files.push(file.clone());
    delete_file(files).await;
    assert_eq!(file_exist(file.clone()), false);

    let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
      .join("../temp")
      .to_str()
      .unwrap()
      .to_string();
    let mut dirs = Vec::new();
    dirs.push(dir.clone());
    delete_file(dirs.clone()).await;
    assert_eq!(file_exist(dir.clone()), false);
  }
}
