use crate::extensions;
use crate::file_lib;
use crate::storage;
use glob::{glob_with, MatchOptions};
#[cfg(not(target_os = "macos"))]
use normpath::PathExt;
use notify::{raw_watcher, RawEvent, RecursiveMode, Watcher};
use parselnk::Lnk;
use std::convert::TryFrom;
use std::fs;
#[cfg(windows)]
use std::os::windows::prelude::*;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::path::Path;
use std::process::Command;
use std::sync::mpsc::channel;
use std::time::SystemTime;
use std::fs::File;
use std::io::prelude::*;
use zip::write::FileOptions;
use tauri::api::dialog::ask;
#[cfg(target_os = "windows")]
use tauri::api::path::local_data_dir;

#[derive(serde::Serialize, Clone, Debug)]
pub struct LnkData {
    file_path: String,
    icon: String,
}

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
    lnk_files: Vec<LnkData>,
}

#[derive(serde::Serialize)]
pub struct TrashInformation {
    files: Vec<TrashMetaData>,
}

#[derive(serde::Serialize, Clone)]
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

pub struct FileSystemUtils;

impl FileSystemUtils {
    /// Get basename of the path given
    #[inline]
    pub fn get_basename(file_path: &str) -> String {
        match Path::new(&file_path).file_name() {
            Some(basename) => basename.to_str().unwrap().to_string(),
            None => file_path.to_string(),
        }
    }

    /// Check if a file/dir is a symlink
    #[cfg(windows)]
    #[inline]
    pub fn check_is_symlink(file_path: &str) -> bool {
        let symlink_metadata = match fs::symlink_metadata(file_path) {
            Ok(result) => result,
            Err(_) => return true,
        };

        symlink_metadata.file_attributes() == 1040
    }

    /// Check if a file/dir is a symlink
    #[cfg(unix)]
    #[inline]
    pub fn check_is_symlink(_: &str) -> bool {
        false
    }

    /// Check if a file is hidden
    ///
    /// Checking file_attributes metadata of a file and check if it is hidden
    #[cfg(windows)]
    #[inline]
    pub fn check_is_hidden(file_path: &str) -> bool {
        let attributes = fs::metadata(file_path).unwrap().file_attributes();

        (attributes & 0x2) > 0
    }

    /// Check if a file is hidden
    ///
    /// Checking a file is hidden by checking if the file name starts with a dot
    #[cfg(unix)]
    #[inline]
    pub fn check_is_hidden(file_path: &str) -> bool {
        let basename = Self::get_basename(file_path);

        basename.starts_with(".")
    }

    /// Check if a file is system file
    ///
    /// Checking file_attributes metadata of a file and check if it is system file
    #[cfg(windows)]
    #[inline]
    fn check_is_system_file(file_path: &str) -> bool {
        let attributes = fs::metadata(file_path).unwrap().file_attributes();

        (attributes & 0x4) > 0
    }

    #[cfg(unix)]
    #[inline]
    fn check_is_system_file(_: &str) -> bool {
        false
    }
}

/// Get properties of a file
#[tauri::command]
pub async fn get_file_properties(file_path: &str) -> Result<FileMetaData, String> {
    let metadata = match fs::metadata(file_path) {
        Ok(result) => result,
        Err(e) => return Err(e.to_string()),
    };

    let last_modified = match metadata.modified() {
        Ok(result) => result,
        Err(e) => return Err(e.to_string()),
    };

    let last_accessed = match metadata.accessed() {
        Ok(result) => result,
        Err(e) => return Err(e.to_string()),
    };

    let created = match metadata.created() {
        Ok(result) => result,
        Err(e) => return Err(e.to_string()),
    };

    let is_symlink = FileSystemUtils::check_is_symlink(file_path);
    let is_hidden = if is_symlink {
        false
    } else {
        FileSystemUtils::check_is_hidden(file_path)
    };
    let is_system = if is_symlink {
        false
    } else {
        FileSystemUtils::check_is_system_file(file_path)
    };

    let is_dir = metadata.is_dir();
    let basename = FileSystemUtils::get_basename(file_path);
    let file_type = if is_symlink {
        "System link".to_string()
    } else {
        file_lib::get_type(&basename, is_dir).await
    };

    let size = if is_dir {
        let preference = match storage::read_data("preference") {
            Ok(result) => result,
            Err(_) => return Err("Error reading preference".into()),
        };
        let preference = if preference.status || preference.data == serde_json::Value::Null {
            preference.data
        } else {
            return Err("Error reading preference".into());
        };
        let calculate_sub_folder_size = match preference {
            serde_json::Value::Null => false,
            _ => preference["calculateSubFolderSize"].as_bool().unwrap_or(false),
        };
        if calculate_sub_folder_size {
            calculate_files_total_size(vec![file_path.to_string()]).await
        }
        else{
            0
        }
    } else {
        metadata.len()
    };
    Ok(FileMetaData {
        is_system,
        is_hidden,
        is_dir: is_dir,
        is_file: metadata.is_file(),
        size,
        readonly: metadata.permissions().readonly(),
        last_modified,
        last_accessed,
        created,
        file_path: file_path.to_string(),
        file_type,
        basename,
        is_trash: false,
    })
}

/// Get size of a directory
///
/// Get size of a directory by iterating and summing up the size of all files
// TODO: Make unified method for the directories and for the files
// FIXME: Not sure that `inline` is necessary in this case, but doesn't bad anyway.
#[tauri::command]
#[inline]
pub async fn get_dir_size(dir: String) -> u64 {
    let mut total_size = 0;
    let mut stack = vec![dir];

    while let Some(path) = stack.pop() {
        let entry = match fs::read_dir(path) {
            Ok(result) => result,
            Err(_) => continue,
        };

        for file in entry {
            let file = file.unwrap();
            let metadata = file.metadata().unwrap();
            if metadata.is_dir() {
                stack.push(file.path().to_string_lossy().to_string());
            } else {
                total_size += metadata.len();
            }
        }
    }

    total_size
}

#[tauri::command]
#[inline]
pub async fn get_file_meta_data(file_path: &str) -> Result<FileMetaData, String> {
    match get_file_properties(file_path).await {
        Ok(properties) => Ok(properties),
        Err(_) => Err("Error reading meta data".to_string()),
    }
}
/// Copy files/dir to a destination
#[tauri::command]
pub async fn copy(src: String, dest: String) -> bool {
    let result = fs::copy(src, dest);
    match result {
        Ok(_) => true,
        Err(_) => false,
    }
}
/// Rename a file/dir
#[tauri::command]
pub async fn rename(path: String, new_path: String) -> bool {
    let result = fs::rename(path, new_path);
    match result {
        Ok(_) => true,
        Err(_) => false,
    }
}

/// Permanently remove directory
#[tauri::command]
pub async fn remove_dir(path: String) -> bool {
    let result = fs::remove_dir_all(path);
    match result {
        Ok(_) => true,
        Err(_) => false,
    }
}

/// Permanently remove file
#[tauri::command]
pub async fn remove_file(path: String) -> bool {
    let result = fs::remove_file(path);
    match result {
        Ok(_) => true,
        Err(_) => false,
    }
}

/// Check if a given path is a directory
///
/// Return false if file does not exist or it isn't a directory
#[tauri::command]
#[inline]
pub fn is_dir(path: &Path) -> Result<bool, String> {
    if Path::new(path).exists() {
        Ok(fs::metadata(path).unwrap().is_dir())
    } else {
        Ok(false)
    }
}

/// Read files and its information of a directory
#[tauri::command]
pub async fn read_directory(dir: &Path) -> Result<FolderInformation, String> {
    let preference = match storage::read_data("preference") {
        Ok(result) => result,
        Err(_) => return Err("Error reading preference".into()),
    };
    let preference = if preference.status || preference.data == serde_json::Value::Null {
        preference.data
    } else {
        return Err("Error reading preference".into());
    };
    let hide_system_files = match preference {
        serde_json::Value::Null => true,
        _ => preference["hideSystemFiles"].as_bool().unwrap_or(true),
    };
    let paths = match fs::read_dir(dir) {
        Ok(result) => result,
        Err(e) => return Err(e.to_string().into()),
    };
    let mut number_of_files = 0;
    let mut files = Vec::new();
    let mut skipped_files = Vec::new();
    let mut lnk_files = Vec::new();

    for path in paths {
        number_of_files += 1;
        let file_path = path.unwrap().path().display().to_string();
        let file_info = get_file_properties(&file_path).await;
        match file_info {
            Ok(file_info) => {
                if hide_system_files && file_info.is_system {
                    skipped_files.push(file_path.to_string());
                    continue;
                }

                if file_info.file_type == "Windows Shortcut" {
                    let path = std::path::Path::new(&file_info.file_path);
                    let icon = match Lnk::try_from(path).unwrap().string_data.icon_location {
                        Some(icon) => {
                            let icon = icon.as_path().to_string_lossy().to_string();
                            let icon_type = file_lib::get_type(&icon, false).await;
                            match icon_type.as_str() {
                                "Image" => icon,
                                "Executable" => extract_icon(&icon).await.unwrap_or_default(),
                                _ => Default::default(),
                            }
                        }
                        None => Default::default(),
                    };

                    lnk_files.push(LnkData { file_path, icon });
                    files.push(file_info)
                } else {
                    files.push(file_info)
                }
            }
            Err(_) => {
                skipped_files.push(file_path);

                continue;
            }
        }
    }

    Ok(FolderInformation {
        number_of_files,
        files,
        skipped_files,
        lnk_files,
    })
}

/// Get array of files of a directory
#[tauri::command]
#[inline]
pub async fn get_files_in_directory(dir: &Path) -> Result<Vec<String>, String> {
    let paths = fs::read_dir(dir).map_err(|err| err.to_string())?;
    let mut files = Vec::new();
    for path in paths {
        files.push(path.unwrap().path().display().to_string());
    }

    Ok(files)
}

/// Open a file path in default application
#[tauri::command]
pub fn open_file(file_path: String, window: tauri::Window) -> bool {
    let extension = file_path.split('.').last().unwrap();
    let window_clone = window.clone();
    if extension == "xtension" {
        ask(
            Some(&window_clone),
            "Special file type",
            "This is Xplorer's extension file, do you want to install it?",
            move |answer| {
                if answer {
                    let file: Result<serde_json::Value, serde_json::Error> =
                        serde_json::from_str(std::fs::read_to_string(file_path).unwrap().as_str());
                    let file = match file {
                        Ok(file) => file,
                        Err(_) => {
                            panic!("Error parsing file");
                        }
                    };
                    extensions::install_extensions(file);
                    println!("Extension installed");
                    window
                        .emit("update_theme", serde_json::Value::Null)
                        .unwrap();
                }
            },
        );

        true
    } else {
        open::that(file_path).is_ok()
    }
}

/// Check if path given exists
#[tauri::command]
#[inline]
pub fn file_exist(file_path: &str) -> bool {
    fs::metadata(file_path).is_ok()
}

/// Create directory recursively
#[tauri::command]
#[inline]
pub async fn create_dir_recursive(dir_path: String) -> bool {
    fs::create_dir_all(dir_path).is_ok()
}

/// Create a file
#[tauri::command]
#[inline]
pub async fn create_file(file_path: String) -> bool {
    let parent_dir = Path::new(&file_path).parent().unwrap().to_str().unwrap();
    create_dir_recursive(parent_dir.to_string()).await;
    fs::write(file_path, "").is_ok()
}

/// Open terminal in a given directory
#[tauri::command]
pub fn open_in_terminal(folder_path: &str) {
    #[cfg(target_os = "windows")]
    Command::new("cmd")
        .args([
            "/C",
            format!(
                "{drive} && cd {folderPath} && start cmd",
                drive = folder_path.split('/').next().unwrap(),
                folderPath = folder_path
            )
            .as_str(),
        ])
        .creation_flags(0x08000000)
        .output()
        .expect("failed to execute process");

    #[cfg(target_os = "linux")]
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

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    Command::new("sh")
        .arg("-c")
        .arg(format!("open -a Terminal {folderPath}", folderPath = folder_path).as_str())
        .output()
        .expect("failed to execute process");
}

/// Open Visual Studio Code in a given directory
#[tauri::command]
#[inline]
pub fn open_in_vscode(path: String) {
    #[cfg(target_os = "windows")]
    Command::new("cmd")
        .args(["/C", format!("code {path}", path = path).as_str()])
        .creation_flags(0x08000000)
        .output()
        .expect("failed to execute process");

    #[cfg(not(target_os = "windows"))]
    Command::new("sh")
        .arg("-c")
        .arg(format!("code {path}", path = path).as_str())
        .output()
        .expect("failed to execute process");
}

/// Get trashed items
#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub async fn get_trashed_items() -> Result<TrashInformation, String> {
    let trash_items = trash::os_limited::list().map_err(|err| err.to_string())?;
    let mut trash_files = Vec::new();

    for item in trash_items {
        let properties = get_file_properties(item.id.to_str().unwrap()).await;
        if let Ok(properties) = properties {
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
/// Get trashed items
///
/// Not supported on macOS yet.
#[cfg(target_os = "macos")]
#[tauri::command]
#[inline]
pub async fn get_trashed_items() -> Result<TrashInformation, String> {
    Err("macOS is not supported currently".into())
}

/// Delete a file or directory
#[tauri::command]
#[inline]
pub async fn delete_file(paths: Vec<String>) -> bool {
    trash::delete_all(paths).is_ok()
}

/// Remove all trashes from trash folder
#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn purge_trashes(paths: Vec<String>) -> Result<bool, String> {
    Ok(paths.iter().all(|path| {
        trash::os_limited::purge_all(trash::os_limited::list().unwrap().into_iter().filter(|x| {
            Path::new(&x.id.to_str().unwrap()).normalize().unwrap()
                == Path::new(&path).normalize().unwrap()
        }))
        .is_ok()
    }))
}
/// Remove all trashes from trash folder
///
/// Not supported on macOS yet.
#[cfg(target_os = "macos")]
#[tauri::command]
#[inline]
pub fn purge_trashes(_paths: Vec<String>) -> Result<bool, String> {
    Err("macOS is not supported currently".into())
}

/// Restore a file or directory from trash folder
#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn restore_trash(
    original_parent: String,
    basename: String,
) -> Result<ReturnInformation, String> {
    let mut status = true;
    let mut message = String::new();
    let request_confirmation = false;

    if let Err(e) =
        trash::os_limited::restore_all(trash::os_limited::list().unwrap().into_iter().filter(|x| {
            x.name == basename.as_str()
                && (Path::new(&x.original_parent).normalize().unwrap()
                    == Path::new(&original_parent).normalize().unwrap())
        }))
    {
        status = false;
        message = e.to_string();
    }

    Ok(ReturnInformation {
        status,
        message,
        request_confirmation,
    })
}

/// Restore a file or directory from trash folder
///
/// Not supported on macOS yet.
#[cfg(target_os = "macos")]
#[tauri::command]
#[inline]
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

/// Restore array of files or directories from trash folder
#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn restore_files(paths: Vec<String>, force: bool) -> Result<ReturnInformation, String> {
    let mut status = true;
    let mut message = String::new();
    let mut request_confirmation = false;

    for path in paths {
        let trash_items = trash::os_limited::list().unwrap().into_iter().filter(|x| {
            if Path::new(&x.id.to_str().unwrap()).normalize().unwrap()
                == Path::new(&path).normalize().unwrap()
            {
                let target = Path::new(&x.original_parent).join(&x.name);
                if target.exists() {
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
                        message =
                            "Target directory with the same name already exist.".to_string();
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

        if trash::os_limited::restore_all(trash_items).is_err() {
            status = false;
        }
    }

    Ok(ReturnInformation {
        status,
        message,
        request_confirmation,
    })
}

/// Restore array of files or directories from trash folder
///
/// Not supported on macOS yet.
#[cfg(target_os = "macos")]
#[tauri::command]
#[inline]
pub fn restore_files(_paths: Vec<String>, _force: bool) -> Result<ReturnInformation, String> {
    Ok(ReturnInformation {
        status: false,
        message: "macOS is not supported currently".to_string(),
        request_confirmation: false,
    })
}

/// Listen to change events of a directory
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
                use notify::op;

                let event = match op {
                    op::CREATE => "create".to_string(),
                    op::REMOVE => "remove".to_string(),
                    op::RENAME => "rename".to_string(),
                    _ => "unknown".to_string(),
                };

                if event != "unknown" {
                    window
                        .emit(
                            "changes",
                            Event {
                                path: path.to_str().unwrap().to_string(),
                                event,
                            },
                        )
                        .unwrap();
                }
            }
            Ok(event) => eprintln!("broken event: {:?}", event),
            Err(e) => break Err(e.to_string()),
        }
    }
}

/// Extract icon from executable file
///
/// Only supported on Windows
#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn extract_icon(file_path: &str) -> Result<String, String> {
    let storage_dir = Path::new(&local_data_dir().unwrap()).join("Xplorer/cache");
    fs::create_dir_all(&storage_dir).unwrap();
    let basename = FileSystemUtils::get_basename(file_path);
    let icon_path = storage_dir.join(basename + ".png");

    if icon_path.exists() {
        Ok(icon_path.to_str().unwrap().to_string())
    } else {
        Command::new("powershell")
            .args(&[
                "./src/extractIcon.ps1",
                file_path,
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
#[tauri::command]
#[inline]
pub async fn extract_icon(_: &str) -> Result<String, String> {
    Err("Not supported".to_string())
}

/// Calculate total size of given array of files
#[tauri::command]
pub async fn calculate_files_total_size(files: Vec<String>) -> u64 {
    let mut total_size: u64 = 0;

    for file in files {
        let metadata = fs::metadata(&file).unwrap();
        if metadata.is_dir() {
            total_size += get_dir_size(file.clone()).await;
        }

        total_size += metadata.len();
    }

    total_size
}

/// Search for glob matches inside a given directory path
// TODO: `Mutex` can be swapped to `AtomicBool`
#[tauri::command]
pub async fn search_in_dir(
    dir_path: String,
    pattern: String,
    window: tauri::Window,
) -> Vec<FileMetaData> {
    let glob_pattern = match dir_path.as_ref() {
        "xplorer://Home" => if cfg!(target_os = "windows") {
            "C://**/".to_string() + &pattern
        } else {
            "~/**/".to_string() + &pattern
        },
        _ => format!("{dir_path}/**/{pattern}"),
    };
    let glob_option = MatchOptions::default();
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
        if *continue_search.lock().unwrap() {
            match entry {
                Ok(path) => {
                    files.push(get_file_properties(path.to_str().unwrap()).await.unwrap());
                    if files.len() % 100 == 0 {
                        window.emit("search_partial_result", files.clone()).unwrap();

                        files.clear();
                    }
                }
                Err(e) => eprintln!("{:?}", e),
            }
        } else {
            break;
        }
    }
    window.unlisten(id);

    files
}

#[tauri::command]
pub async fn compress_to_zip(files: Vec<String>){
    let target_name = files[0].to_string() + ".zip";
    let mut zip = zip::ZipWriter::new(File::create(target_name).unwrap());
    zip.set_comment("Compressed by Xplorer");
    let options = FileOptions::default()
        .compression_method(zip::CompressionMethod::Stored)
        .unix_permissions(0o755);
    for(_i, file) in files.iter().enumerate() {
        let file_name = file.to_string();
        let file_is_dir = is_dir(std::path::Path::new(&file_name.clone())).unwrap();
        if file_is_dir{
            fn add_dir_to_zip(zip: &mut zip::ZipWriter<File>, dir_path: &str, options: &FileOptions, relative_path: &str){
                zip.add_directory(relative_path.to_owned() , *options).unwrap();
                let paths = fs::read_dir(dir_path).unwrap();
                for path in paths {
                    let path = path.unwrap().path();
                    let file_name = path.to_str().unwrap();
                    let file_is_dir = is_dir(std::path::Path::new(&path)).unwrap();
                    let mut relative_file_path = relative_path.to_owned();
                    if relative_file_path == "" {
                        relative_file_path += &FileSystemUtils::get_basename(file_name);
                    }else{
                        relative_file_path += &("/".to_owned() + &FileSystemUtils::get_basename(file_name));
                    }
                     
                    if file_is_dir{
                        add_dir_to_zip(zip, file_name, options, &(relative_file_path));
                    } else {
                        zip.start_file(relative_file_path, *options).unwrap();
                        zip.write_all(fs::read(file_name).unwrap().as_ref()).unwrap();
                    }
                }
            }
            add_dir_to_zip(&mut zip, &file_name, &options, "");
        }else{
            zip.start_file(FileSystemUtils::get_basename(file_name.clone().as_str()), options).unwrap();
            zip.write_all(&std::fs::read(file_name).unwrap()).unwrap(); 
        }
    }
    zip.finish().unwrap();
}

#[tauri::command]
pub async fn decompress_from_zip(zip_path: String, target_dir: String){
    let mut zip = zip::ZipArchive::new(File::open(zip_path).unwrap()).unwrap();
    fs::create_dir_all(target_dir.clone()).unwrap();
    for i in 0..zip.len() {
        let mut file = zip.by_index(i).unwrap();
        let file_outpath = match file.enclosed_name(){
            Some(name) => target_dir.clone() + "/" + &name.to_str().unwrap(),
            None => continue,
        };
        let file_name = file.name();
        if file_name.ends_with('/') {
            fs::create_dir_all(&file_outpath).unwrap();
        }else{
            let mut outfile  = File::create(file_outpath).unwrap();
            std::io::copy(&mut file, &mut outfile).unwrap();
        }
    }
}
