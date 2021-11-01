use std::fs;
use std::path::Path;
use std::process::Command;
use std::time::SystemTime;
extern crate open;

#[cfg(windows)]
use std::os::windows::prelude::*;

#[derive(serde::Serialize)]
pub struct FileMetaData {
  file_path: String,
  basename: String,
  is_dir: bool,
  is_hidden: bool,
  is_file: bool,
  is_system: bool,
  size: u64,
  readonly: bool,
  last_modified: SystemTime,
  last_accessed: SystemTime,
  created: SystemTime,
}

#[derive(serde::Serialize)]
pub struct FolderInformation {
  number_of_files: u16,
  files: Vec<FileMetaData>,
  skipped_files: Vec<String>,
}

fn get_basename(file_path: String) -> String {
  Path::new(&file_path)
    .file_name()
    .unwrap()
    .to_str()
    .unwrap()
    .to_string()
}

#[cfg(windows)]
fn check_is_hidden(file_path: String) -> bool {
  let metadata = fs::metadata(file_path).unwrap();
  let attributes = metadata.file_attributes();
  (attributes & 0x2) > 0
}

#[cfg(unix)]
fn check_is_hidden(file_path: String) -> bool {
  let basename = get_basename(file_path);
  basename.clone().starts_with(".")
}

#[cfg(windows)]
fn check_is_system_file(file_path: String) -> bool {
  let metadata = fs::metadata(file_path).unwrap();
  let attributes = metadata.file_attributes();
  (attributes & 0x4) > 0
}

#[cfg(unix)]
fn check_is_system_file(_: String) -> bool {
  false
}

fn get_file_properties(file_path: String) -> Result<FileMetaData, std::io::Error> {
  let metadata = fs::metadata(file_path.clone());
  let metadata = match metadata {
    Ok(result) => result,
    Err(e) => return Err(e),
  };
  let is_dir = metadata.is_dir();
  let is_file = metadata.is_file();
  let size = metadata.len();
  let readonly = metadata.permissions().readonly();
  let last_modified = metadata.modified();
  let last_modified = match last_modified {
    Ok(result) => result,
    Err(e) => return Err(e),
  };
  let last_accessed = metadata.accessed();
  let last_accessed = match last_accessed {
    Ok(result) => result,
    Err(e) => return Err(e),
  };
  let created = metadata.created();
  let created = match created {
    Ok(result) => result,
    Err(e) => return Err(e),
  };
  let basename = get_basename(file_path.clone());
  let is_hidden = check_is_hidden(file_path.clone());
  let is_system = check_is_system_file(file_path.clone());
  Ok(FileMetaData {
    is_system,
    is_hidden,
    is_dir,
    is_file,
    size,
    readonly,
    last_modified,
    last_accessed,
    created,
    file_path,
    basename,
  })
}

#[tauri::command]
pub fn get_file_meta_data(file_path: String) -> Result<FileMetaData, String> {
  let properties = get_file_properties(file_path);
  if properties.is_err() {
    Err("Error reading meta data".into())
  } else {
    Ok(properties.unwrap())
  }
}
#[tauri::command]
pub fn is_dir(path: &Path) -> Result<bool, String> {
  if !Path::new(path).exists() {
    Ok(false)
  } else {
    let md = fs::metadata(path).unwrap();
    Ok(md.is_dir())
  }
}
#[tauri::command]
pub fn read_directory(dir: &Path) -> Result<FolderInformation, String> {
  let paths = fs::read_dir(dir).map_err(|err| err.to_string())?;
  let mut number_of_files: u16 = 0;
  let mut files = Vec::new();
  let mut skipped_files = Vec::new();
  for path in paths {
    number_of_files += 1;
    let file_name = path.unwrap().path().display().to_string();
    let file_info = get_file_properties(file_name.clone());
    if file_info.is_err() {
      skipped_files.push(file_name);
      continue;
    } else {
      files.push(file_info.unwrap())
    };
  }
  Ok(FolderInformation {
    number_of_files,
    files,
    skipped_files,
  })
}

#[tauri::command]
pub fn open_file(file_path: String) -> bool {
  open::that(file_path).is_ok()
}
#[tauri::command]
pub fn file_exist(file_path: String) -> bool {
  fs::metadata(file_path).is_ok()
}

#[tauri::command]
pub fn create_dir_recursive(dir_path: String) -> bool {
  fs::create_dir_all(dir_path).is_ok()
}

#[tauri::command]
pub fn create_file(file_path: String) -> bool {
  fs::write(file_path, "").is_ok()
}
#[tauri::command]
pub fn open_in_terminal(folder_path: String) {
  if cfg!(target_os = "windows") {
    let result = Command::new("cmd")
      .args([
        "/C",
        format!(
          "{drive} && cd {folderPath} && start cmd",
          drive = folder_path.split("/").next().unwrap(),
          folderPath = folder_path
        )
        .as_str(),
      ])
      .output()
      .expect("failed to execute process");
    println!("{:?}", result);
  } else if cfg!(target_os = "linux") {
    Command::new("sh")
      .arg("-c")
      .arg(
        format!(
          "gnome-terminal --working-directory={folderPath}",
          folderPath = folder_path
        )
        .as_str(),
      )
      .output()
      .expect("failed to execute process");
  } else {
    Command::new("sh")
      .arg("-c")
      .arg(format!("open -a Terminal {folderPath}", folderPath = folder_path).as_str())
      .output()
      .expect("failed to execute process");
  }
}

#[tauri::command]
pub fn open_in_vscode(path: String) {
  if cfg!(target_os = "windows") {
    Command::new("cmd")
      .args(["/C", format!("code {path}", path = path).as_str()])
      .output()
      .expect("failed to execute process")
  } else {
    Command::new("sh")
      .arg("-c")
      .arg(format!("code {path}", path = path).as_str())
      .output()
      .expect("failed to execute process")
  };
}
