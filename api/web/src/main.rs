use std::fs;
#[cfg(windows)]
use std::os::windows::prelude::*;
use std::path::Path;
use std::time::SystemTime;
use warp::Filter;
mod file_lib;
use dirs_next;
use std::collections::HashMap;

#[derive(serde::Serialize, Clone, Debug)]
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

/// Get basename of the path given
pub fn get_basename(file_path: String) -> String {
  let basename = Path::new(&file_path).file_name();
  match basename {
    Some(basename) => basename.to_str().unwrap().to_string(),
    None => file_path,
  }
}

/// Check if a file is hidden
///
/// Checking file_attributes metadata of a file and check if it is hidden
#[cfg(windows)]
pub fn check_is_hidden(file_path: String) -> bool {
  let metadata = fs::metadata(file_path).unwrap();
  let attributes = metadata.file_attributes();
  (attributes & 0x2) > 0
}

/// Check if a file is hidden
///
/// Checking a file is hidden by checking if the file name starts with a dot
#[cfg(unix)]
pub fn check_is_hidden(file_path: String) -> bool {
  let basename = get_basename(file_path);
  basename.clone().starts_with(".")
}

/// Check if a file is system file
///
/// Checking file_attributes metadata of a file and check if it is system file
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

/// Get properties of a file
pub fn get_file_properties(file_path: String) -> Result<FileMetaData, String> {
  let metadata = fs::metadata(file_path.clone());
  let metadata = match metadata {
    Ok(result) => result,
    Err(e) => return Err(e.to_string()),
  };
  let is_dir = metadata.is_dir();
  // TODO: web version symlinks
  let is_symlink = false;
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
  let is_hidden = match is_symlink {
    true => false,
    false => check_is_hidden(file_path.clone()),
  };
  let is_system = match is_symlink {
    true => false,
    false => check_is_system_file(file_path.clone()),
  };
  let file_type = match is_symlink {
    true => "System link".to_string(),
    false => file_lib::get_type(basename.clone(), is_dir),
  };
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

#[derive(serde::Serialize)]
pub struct FolderInformation {
  number_of_files: u16,
  files: Vec<FileMetaData>,
  skipped_files: Vec<String>,
}

#[tokio::main]
async fn main() {
  let cors = warp::cors().allow_any_origin();

  let read_dir_route = warp::get()
    .and(warp::path("read_dir"))
    .and(warp::query::<HashMap<String, String>>())
    .map(|p: HashMap<String, String>| match p.get("path") {
      Some(dir) => {
        // TODO: read hide_system_Files preference from database
        let hide_system_files = true;
        let paths = fs::read_dir(dir).map_err(|err| err.to_string()).unwrap();
        let mut number_of_files: u16 = 0;
        let mut files = Vec::new();
        let mut skipped_files = Vec::new();
        for path in paths {
          number_of_files += 1;
          let file_path = path.unwrap().path().display().to_string();
          let file_info = get_file_properties(file_path.clone());
          if file_info.is_err() {
            skipped_files.push(file_path);
            continue;
          } else {
            let file_info = file_info.unwrap();
            if hide_system_files && file_info.is_system {
              skipped_files.push(file_path);
              continue;
            };
            files.push(file_info);
          };
        }
        return serde_json::to_string(&serde_json::json!(FolderInformation {
          number_of_files,
          files,
          skipped_files,
        }))
        .unwrap();
      }
      None => "".to_string(),
    })
    .with(cors.clone());

  let check_exist = warp::get()
    .and(warp::path("check_exist"))
    .and(warp::query::<HashMap<String, String>>())
    .map(|p: HashMap<String, String>| match p.get("path") {
      Some(path) => {
        let exists = fs::metadata(path).is_ok();
        return serde_json::to_string(&serde_json::json!(exists)).unwrap();
      }
      None => "false".to_string(),
    })
    .with(cors.clone());
  let check_isdir = warp::get()
    .and(warp::path("check_isdir"))
    .and(warp::query::<HashMap<String, String>>())
    .map(|p: HashMap<String, String>| match p.get("path") {
      Some(path) => {
        let is_dir = fs::metadata(path).unwrap().is_dir();
        return serde_json::to_string(&serde_json::json!(is_dir)).unwrap();
      }
      None => "false".to_string(),
    })
    .with(cors.clone());

  let get_favorite_paths = warp::path!("dir" / "favorites")
    .map(|| {
      let audio_path = dirs_next::audio_dir()
        .unwrap()
        .to_str()
        .unwrap()
        .to_string();
      let video_path = dirs_next::video_dir()
        .unwrap()
        .to_str()
        .unwrap()
        .to_string();
      let picture_path = dirs_next::picture_dir()
        .unwrap()
        .to_str()
        .unwrap()
        .to_string();
      let document_path = dirs_next::document_dir()
        .unwrap()
        .to_str()
        .unwrap()
        .to_string();
      let download_path = dirs_next::download_dir()
        .unwrap()
        .to_str()
        .unwrap()
        .to_string();
      let desktop_path = dirs_next::desktop_dir()
        .unwrap()
        .to_str()
        .unwrap()
        .to_string();
      let home_path = dirs_next::home_dir().unwrap().to_str().unwrap().to_string();
      return serde_json::to_string(&serde_json::json!({
        "audio": audio_path,
        "video": video_path,
        "picture": picture_path,
        "document": document_path,
        "download": download_path,
        "desktop": desktop_path,
        "home": home_path,
      }))
      .unwrap();
    })
    .with(cors.clone());

  let routes = warp::get()
    .and(
      read_dir_route
        .or(get_favorite_paths)
        .or(check_exist)
        .or(check_isdir),
    )
    .with(cors);

  warp::serve(routes).run(([127, 0, 0, 1], 3030)).await;
}
