use std::fs;
use std::path::Path;

#[derive(serde::Serialize)]
struct FolderInformation{
  number_of_files: u16,
  array_of_files: Vec<String>,
}

#[tauri::command]
fn read_directory(dir: &Path) -> Result<FolderInformation, String> {
  let paths = fs::read_dir(dir).map_err(|err| err.to_string())?;
  
  let mut number_of_files: u16 = 0;
  let mut array_of_files = Vec::new();
  for path in paths{
    number_of_files+=1;
    array_of_files.push(path.unwrap().path().display().to_string());
  }

  Ok(FolderInformation {
    number_of_files,
    array_of_files: array_of_files
  })
}