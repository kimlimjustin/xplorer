use std::path::PathBuf;
pub fn read_to_serde_json(path: PathBuf) -> serde_json::Value {
  let file: Result<serde_json::Value, serde_json::Error> =
    serde_json::from_str(std::fs::read_to_string(path).unwrap().as_str());
  let file = match file {
    Ok(file) => file,
    Err(_) => {
      panic!("Error parsing file");
    }
  };
  file
}
