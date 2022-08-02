use parselnk::Lnk;
use std::fs;
#[cfg(windows)]
use std::os::windows::prelude::*;
use std::path::Path;
use std::time::SystemTime;
use warp::Filter;
mod drives;
mod file_lib;
use dirs_next;
use font_loader::system_fonts;
use std::collections::HashMap;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
use std::process::Command;

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

#[derive(serde::Serialize)]
pub struct FolderInformation {
  number_of_files: u16,
  files: Vec<FileMetaData>,
  skipped_files: Vec<String>,
  lnk_files: Vec<LnkData>,
}

#[derive(serde::Serialize, Clone, Debug)]
pub struct LnkData {
  file_path: String,
  icon: String,
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
  let is_hidden = if is_symlink {
    false
} else {
    check_is_hidden(file_path.clone())
};
  let is_system = if is_symlink {
    false
} else {
    check_is_system_file(file_path.clone())
};
  let file_type = if is_symlink {
    "System link".to_string()
} else {
    file_lib::get_type(basename.clone(), is_dir)
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

/// Extract icon from executable file
///
/// Only supported on Windows
#[cfg(target_os = "windows")]
pub fn extract_icon(file_path: String) -> Result<String, String> {
  let storage_dir = Path::new(&dirs_next::data_local_dir().unwrap()).join("Xplorer/cache");
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

/// Extract icon from executable file
#[cfg(not(target_os = "windows"))]
pub fn extract_icon(_file_path: String) -> Result<String, String> {
  Err("Not supported".to_string())
}

fn calculate_dir_size(dir: String) -> u64 {
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
        let mut lnk_files: Vec<LnkData> = Vec::new();
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
            }
            if file_info.file_type == "Windows Shortcut" {
              let path = std::path::Path::new(&file_info.file_path);
              let lnk = Lnk::try_from(path).unwrap();
              let lnk_icon = lnk.string_data.icon_location;
              let lnk_icon = match lnk_icon {
                Some(icon) => {
                  let icon = icon.into_os_string().into_string().unwrap();
                  let icon_type = file_lib::get_type(icon.clone(), false);
                  if icon_type == "Image" {
                    icon
                  } else if icon_type == "Executable" {
                    extract_icon(icon).unwrap_or("".to_string())
                  } else {
                    "".to_string()
                  }
                }
                None => "".to_string(),
              };
              lnk_files.push(LnkData {
                file_path: file_path,
                icon: lnk_icon,
              });
              files.push(file_info)
            } else {
              files.push(file_info)
            }
          };
        }
        return serde_json::to_string(&serde_json::json!(FolderInformation {
          number_of_files,
          files,
          skipped_files,
          lnk_files
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

  let open_file = warp::get()
    .and(warp::path("open_file"))
    .and(warp::query::<HashMap<String, String>>())
    .map(|p: HashMap<String, String>| match p.get("path") {
      Some(path) => {
        open::that(path).unwrap();
        return "".to_string();
      }
      None => "".to_string(),
    })
    .with(cors.clone());

  let get_available_fonts = warp::path("get_available_fonts")
    .map(|| {
      let fonts = system_fonts::query_all();
      serde_json::to_string(&serde_json::json!(fonts)).unwrap()
    })
    .with(cors.clone());

  let get_dir_size = warp::get()
    .and(warp::path("get_dir_size"))
    .and(warp::query::<HashMap<String, String>>())
    .map(|p: HashMap<String, String>| match p.get("path") {
      Some(path) => {
        let dir_size = calculate_dir_size(path.to_string());
        return serde_json::to_string(&serde_json::json!(dir_size)).unwrap();
      }
      None => "".to_string(),
    })
    .with(cors.clone());

  let calculate_dirs_size = warp::get()
    .and(warp::path("calculate_dirs_size"))
    .and(warp::query::<HashMap<String, String>>())
    .map(|p: HashMap<String, String>| match p.get("paths") {
      // Split paths by %2c%2c
      Some(paths) => {
        let paths: Vec<String> = paths.split(",-,").map(|s| s.to_string()).collect();
        let mut total_size: u64 = 0;
        for file in paths {
          let metadata = fs::metadata(file.clone()).unwrap();
          if metadata.is_dir() {
            total_size += calculate_dir_size(file);
          }
          total_size += metadata.len();
        }
        return serde_json::to_string(&serde_json::json!(total_size)).unwrap();
      }
      None => "".to_string(),
    })
    .with(cors.clone());

  let get_drives = warp::get()
    .and(warp::path("drives"))
    .map(|| {
      let drives = drives::get_drives().unwrap();
      serde_json::to_string(&serde_json::json!(drives)).unwrap()
    })
    .with(cors.clone());

  let get_platform = warp::get()
    .and(warp::path("platform"))
    .map(|| serde_json::to_string(std::env::consts::OS).unwrap())
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
        .or(check_isdir)
        .or(open_file)
        .or(get_available_fonts)
        .or(get_dir_size)
        .or(get_drives)
        .or(get_platform)
        .or(calculate_dirs_size),
    )
    .with(cors);

  warp::serve(routes).run(([127, 0, 0, 1], 3030)).await;
}
