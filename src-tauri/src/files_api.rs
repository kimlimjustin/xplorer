use std::fs;
use std::path::Path;
use std::process::Command;
use std::time::SystemTime;
extern crate notify;
extern crate open;
extern crate trash;
use crate::file_lib;
use crate::storage;
use glob::{glob_with, MatchOptions};
#[cfg(not(target_os = "macos"))]
use normpath::PathExt;
use notify::{raw_watcher, RawEvent, RecursiveMode, Watcher};
use serde_json::Value;
use std::sync::mpsc::channel;
use tauri::api::path::local_data_dir;
use tauri::Manager;

#[cfg(windows)]
use std::os::windows::prelude::*;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[derive(serde::Serialize, Clone)]
pub struct FileMetaData {
  file_path: String,
  basename: String,
  file_type: String,
  is_dir: bool,
  is_hidden: bool,
  is_file: bool,
  is_system: bool,
  size: u64,
  readonly: bool,
  last_modified: SystemTime,
  last_accessed: SystemTime,
  created: SystemTime,
  is_trash: bool,
}

#[derive(serde::Serialize)]
pub struct TrashMetaData {
  file_path: String,
  basename: String,
  file_type: String,
  original_parent: String,
  time_deleted: i64,
  is_trash: bool,
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

#[derive(serde::Serialize)]
pub struct TrashInformation {
  files: Vec<TrashMetaData>,
}

#[derive(serde::Serialize)]
pub struct Event {
  pub path: String,
  pub event: String,
}

#[derive(serde::Serialize)]
pub struct ReturnInformation {
  pub status: bool,
  pub message: String,
  pub request_confirmation: bool,
}

fn get_basename(file_path: String) -> String {
  let basename = Path::new(&file_path).file_name();
  match basename {
    Some(basename) => basename.to_str().unwrap().to_string(),
    None => file_path,
  }
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

#[tauri::command]
pub async fn get_file_properties(file_path: String) -> Result<FileMetaData, String> {
  let metadata = fs::metadata(file_path.clone());
  let metadata = match metadata {
    Ok(result) => result,
    Err(e) => return Err(e.to_string()),
  };
  let is_dir = metadata.is_dir();
  let is_file = metadata.is_file();
  let size = metadata.len();
  let readonly = metadata.permissions().readonly();
  let last_modified = metadata.modified();
  let last_modified = match last_modified {
    Ok(result) => result,
    Err(e) => return Err(e.to_string()),
  };
  let last_accessed = metadata.accessed();
  let last_accessed = match last_accessed {
    Ok(result) => result,
    Err(e) => return Err(e.to_string()),
  };
  let created = metadata.created();
  let created = match created {
    Ok(result) => result,
    Err(e) => return Err(e.to_string()),
  };
  let basename = get_basename(file_path.clone());
  let is_hidden = check_is_hidden(file_path.clone());
  let is_system = check_is_system_file(file_path.clone());
  let file_type = file_lib::get_type(basename.clone(), is_dir).await;
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
    file_type,
    basename,
    is_trash: false,
  })
}

#[tauri::command]
pub async fn get_dir_size(dir: String) -> u64 {
  let mut total_size: u64 = 0;
  let mut stack = vec![dir];
  while let Some(path) = stack.pop() {
    let entry = fs::read_dir(path);
    let entry = match entry {
      Ok(result) => result,
      Err(_) => continue,
    };
    for file in entry {
      let file = file.unwrap();
      let metadata = file.metadata().unwrap();
      if metadata.is_dir() {
        stack.push(file.path().to_str().unwrap().to_string());
      } else {
        total_size += metadata.len();
      }
    }
  }
  total_size
}

#[tauri::command]
pub async fn get_file_meta_data(file_path: String) -> Result<FileMetaData, String> {
  let properties = get_file_properties(file_path).await;
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
pub async fn read_directory(dir: &Path) -> Result<FolderInformation, String> {
  let preference = storage::read_data("preference".to_string());
  let preference = match preference {
    Ok(result) => result,
    Err(_) => return Err("Error reading preference".into()),
  };
  let preference: Result<Value, serde_json::Error> = serde_json::from_str(&preference.data);
  let hide_system_files = match preference {
    Ok(result) => result["hideSystemFiles"].as_bool().unwrap_or(false),
    Err(_) => true,
  };
  let paths = fs::read_dir(dir).map_err(|err| err.to_string())?;
  let mut number_of_files: u16 = 0;
  let mut files = Vec::new();
  let mut skipped_files = Vec::new();
  for path in paths {
    number_of_files += 1;
    let file_name = path.unwrap().path().display().to_string();
    let file_info = get_file_properties(file_name.clone()).await;
    if file_info.is_err() {
      skipped_files.push(file_name);
      continue;
    } else {
      let file_info = file_info.unwrap();
      if hide_system_files && file_info.is_system {
        skipped_files.push(file_name);
        continue;
      }
      files.push(file_info)
    };
  }
  Ok(FolderInformation {
    number_of_files,
    files,
    skipped_files,
  })
}

#[tauri::command]
pub async fn get_files_in_directory(dir: &Path) -> Result<Vec<String>, String> {
  let paths = fs::read_dir(dir).map_err(|err| err.to_string())?;
  let mut files = Vec::new();
  for path in paths {
    files.push(path.unwrap().path().display().to_string());
  }
  Ok(files)
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
    Command::new("cmd")
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

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub async fn get_trashed_items() -> Result<TrashInformation, String> {
  let _trash_items = trash::os_limited::list().map_err(|err| err.to_string())?;
  let mut trash_files = Vec::new();
  for item in _trash_items {
    let properties = get_file_properties(item.id.to_str().unwrap().to_string()).await;
    if properties.is_err() {
      continue;
    } else {
      let properties = properties.unwrap();
      trash_files.push(TrashMetaData {
        file_path: item.id.to_str().unwrap().to_string(),
        basename: item.name.clone(),
        original_parent: item.original_parent.into_os_string().into_string().unwrap(),
        file_type: properties.file_type,
        time_deleted: item.time_deleted,
        is_trash: true,
        is_dir: properties.is_dir,
        is_file: properties.is_file,
        is_hidden: properties.is_hidden,
        is_system: properties.is_system,
        size: properties.size,
        readonly: properties.readonly,
        last_modified: properties.last_modified,
        last_accessed: properties.last_accessed,
        created: properties.created,
      })
    }
  }
  Ok(TrashInformation { files: trash_files })
}
#[cfg(target_os = "macos")]
#[tauri::command]
pub async fn get_trashed_items() -> Result<TrashInformation, String> {
  Err("macOS is not supported currently".into())
}

#[tauri::command]
pub fn delete_file(paths: Vec<String>) -> bool {
  trash::delete_all(paths).is_ok()
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn purge_trashes(paths: Vec<String>) -> Result<bool, String> {
  let mut status = true;
  for path in paths {
    let result =
      trash::os_limited::purge_all(trash::os_limited::list().unwrap().into_iter().filter(|x| {
        Path::new(&x.id.to_str().unwrap().to_string())
          .normalize()
          .unwrap()
          == Path::new(&path).normalize().unwrap()
      }));
    if result.is_err() {
      status = false;
    }
  }
  Ok(status)
}

#[cfg(target_os = "macos")]
#[tauri::command]
pub fn purge_trashes(_paths: Vec<String>) -> Result<bool, String> {
  Err("macOS is not supported currently".into())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn restore_trash(
  original_parent: String,
  basename: String,
) -> Result<ReturnInformation, String> {
  let mut status = true;
  let mut message = String::new();
  let request_confirmation = false;
  let result =
    trash::os_limited::restore_all(trash::os_limited::list().unwrap().into_iter().filter(|x| {
      (x.name.clone() == basename.clone())
        && (Path::new(&x.original_parent.clone()).normalize().unwrap()
          == Path::new(&original_parent).normalize().unwrap())
    }));
  if result.is_err() {
    status = false;
    message = result.err().unwrap().to_string();
  }
  Ok(ReturnInformation {
    status: status,
    message: message,
    request_confirmation: request_confirmation,
  })
}
#[cfg(target_os = "macos")]
#[tauri::command]
pub fn restore_trash(
  _original_parent: String,
  _basename: String,
) -> Result<ReturnInformation, String> {
  Ok(ReturnInformation {
    status: false,
    message: "macOS is not supported currently".to_string(),
    request_confirmation: false,
  })
}
#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn restore_files(paths: Vec<String>, force: bool) -> Result<ReturnInformation, String> {
  let mut status = true;
  let mut message = String::new();
  let mut request_confirmation = false;
  for path in paths {
    let trash_items = trash::os_limited::list().unwrap().into_iter().filter(|x| {
      if Path::new(&x.id.to_str().unwrap().to_string())
        .normalize()
        .unwrap()
        == Path::new(&path).normalize().unwrap()
      {
        let target = Path::new(&x.original_parent).join(x.name.clone());
        if target.clone().exists() {
          if force {
            let metadata = fs::metadata(target.clone()).unwrap();
            if metadata.is_dir() {
              fs::remove_dir_all(target).unwrap()
            } else {
              fs::remove_file(target).unwrap()
            };
            true
          } else {
            status = false;
            message = "Target directory with the same name already exist.".to_string();
            request_confirmation = true;
            false
          }
        } else {
          fs::create_dir_all(x.original_parent.clone()).is_ok()
        }
      } else {
        false
      }
    });
    let result = trash::os_limited::restore_all(trash_items);
    if result.is_err() {
      status = false;
    }
  }
  Ok(ReturnInformation {
    status: status,
    message: message,
    request_confirmation: request_confirmation,
  })
}
#[cfg(target_os = "macos")]
#[tauri::command]
pub fn restore_files(_paths: Vec<String>, _force: bool) -> Result<ReturnInformation, String> {
  Ok(ReturnInformation {
    status: false,
    message: "macOS is not supported currently".to_string(),
    request_confirmation: false,
  })
}

#[tauri::command]
pub async fn listen_dir(dir: String, window: tauri::Window) -> Result<String, String> {
  let (tx, rx) = channel();

  let watcher = std::sync::Arc::new(std::sync::Mutex::new(raw_watcher(tx).unwrap()));

  watcher
    .lock()
    .unwrap()
    .watch(dir.clone(), RecursiveMode::NonRecursive)
    .unwrap();

  window.once("unlisten_dir", move |_| {
    watcher.lock().unwrap().unwatch(dir.clone()).unwrap();
  });
  loop {
    match rx.recv() {
      Ok(RawEvent {
        path: Some(path),
        op: Ok(op),
        ..
      }) => {
        //window.emit("changes", path.to_str().unwrap().to_string());
        let event: String;
        if op.contains(notify::op::CREATE) {
          event = "create".to_string();
        } else if op.contains(notify::op::REMOVE) {
          event = "remove".to_string();
        } else if op.contains(notify::op::RENAME) {
          event = "rename".to_string();
        } else {
          event = "unknown".to_string();
        }
        if event != "unknown" {
          window
            .emit(
              "changes",
              Event {
                path: path.to_str().unwrap().to_string(),
                event: event,
              },
            )
            .unwrap();
        }
        println!("{:?} {:?} {:?}", op, path.clone(), window.label());
      }
      Ok(event) => println!("broken event: {:?}", event),
      Err(e) => break Err(e.to_string()),
    }
  }
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn extract_icon(file_path: String) -> Result<String, String> {
  let storage_dir = Path::new(&local_data_dir().unwrap()).join("Xplorer/cache");
  fs::create_dir_all(storage_dir.clone()).unwrap();
  let basename = get_basename(file_path.clone());
  let icon_path = storage_dir.join(basename.clone() + ".png");
  if icon_path.exists() {
    Ok(icon_path.to_str().unwrap().to_string())
  } else {
    Command::new("powershell")
      .args(&[
        "./src/extractIcon.ps1",
        file_path.as_str(),
        icon_path.to_str().unwrap(),
      ])
      .creation_flags(0x08000000)
      .output()
      .expect("Failed to extract icon");

    Ok(icon_path.to_str().unwrap().to_string())
  }
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub async fn extract_icon(_file_path: String) -> Result<String, String> {
  Err("Not supported".to_string())
}

#[tauri::command]
pub async fn calculate_files_total_size(files: Vec<String>) -> u64 {
  let mut total_size: u64 = 0;
  for file in files {
    let metadata = fs::metadata(file.clone()).unwrap();
    if metadata.is_dir() {
      total_size += get_dir_size(file).await;
    }
    total_size += metadata.len();
  }
  total_size
}

#[tauri::command]
pub async fn search_in_dir(
  dir_path: String,
  pattern: String,
  window: tauri::Window,
) -> Vec<FileMetaData> {
  let glob_pattern = match dir_path.as_ref() {
    "xplorer://Home" => match cfg!(target_os = "windows") {
      true => "C://**/".to_string() + &pattern,
      false => "~/**/".to_string() + &pattern,
    },
    _ => format!("{}/**/{}", dir_path, pattern),
  };
  let glob_option = MatchOptions {
    case_sensitive: false,
    require_literal_separator: false,
    require_literal_leading_dot: false,
    ..Default::default()
  };
  let continue_search = std::sync::Arc::new(std::sync::Mutex::new(true));
  let id = window.listen("unsearch", {
    let continue_search = continue_search.clone();
    move |_| {
      *continue_search.lock().unwrap() = false;
    }
  });
  let mut files = Vec::new();
  let glob_result = glob_with(&glob_pattern, glob_option).unwrap();
  for entry in glob_result {
    if continue_search.lock().unwrap().clone() {
      match entry {
        Ok(path) => {
          files.push(
            get_file_properties(path.to_str().unwrap().to_string())
              .await
              .unwrap(),
          );
          if files.len() % 100 == 0 {
            window.emit("search_partial_result", files.clone()).unwrap();
            files.clear();
          }
        }
        Err(e) => println!("{:?}", e),
      }
    } else {
      break;
    }
  }
  window.unlisten(id);
  files
}
